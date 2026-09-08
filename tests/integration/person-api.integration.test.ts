import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  ScanCommand,
} from "@aws-sdk/lib-dynamodb";
import { afterAll, describe, expect, it } from "vitest";
import type { PersonResponseDto } from "../../src/dto/person-response.dto";
import type { CreatePersonRequestDto } from "../../src/validation/create-person.schema";

const requiredEnvironment = (name: string): string => {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} environment variable is required`);
  }

  return value;
};

const personApiUrl = requiredEnvironment("PERSON_API_URL").replace(/\/$/, "");
const personTableName = requiredEnvironment("PERSON_TABLE_NAME");
const region = requiredEnvironment("AWS_REGION");

const documentClient = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region }),
);
const createdPersonIds = new Set<string>();

const createRequest = (): CreatePersonRequestDto => {
  const uniquePart = randomUUID().replaceAll("-", "").slice(0, 6).toUpperCase();

  return {
    firstName: "Integration",
    lastName: `Test${uniquePart}`,
    phoneNumber: `+319${Date.now().toString().slice(-9)}`,
    address: {
      street: "Integration Street",
      number: "1",
      city: "Amsterdam",
      country: "NL",
      postcode: `TST${uniquePart}`,
    },
  };
};

const postPerson = (body: unknown): Promise<Response> =>
  fetch(personApiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

const getPersons = async (): Promise<PersonResponseDto[]> => {
  const response = await fetch(personApiUrl);

  if (!response.ok) {
    throw new Error(`GET /person failed with status ${response.status}`);
  }

  return (await response.json()) as PersonResponseDto[];
};

const waitForPerson = async (
  personId: string,
): Promise<PersonResponseDto | undefined> => {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const persons = await getPersons();
    const person = persons.find((item) => item.id === personId);

    if (person) {
      return person;
    }

    await delay(300);
  }

  return undefined;
};

afterAll(async () => {
  await Promise.all(
    [...createdPersonIds].map((id) =>
      documentClient.send(
        new DeleteCommand({
          TableName: personTableName,
          Key: { id },
        }),
      ),
    ),
  );
});

describe("Person API integration", () => {
  it(
    "creates a person and returns its ID",
    async () => {
      const response = await postPerson(createRequest());
      const body = (await response.json()) as { id: string };

      expect(response.status).toBe(201);
      expect(body.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      );

      createdPersonIds.add(body.id);
    },
    15_000,
  );

  it(
    "lists a person after it has been created",
    async () => {
      const request = createRequest();
      const createResponse = await postPerson(request);
      const createdPerson = (await createResponse.json()) as { id: string };

      expect(createResponse.status).toBe(201);
      createdPersonIds.add(createdPerson.id);

      const listedPerson = await waitForPerson(createdPerson.id);

      expect(listedPerson).toEqual({
        id: createdPerson.id,
        ...request,
        createdAt: expect.any(String),
      });
    },
    15_000,
  );

  it(
    "rejects an invalid request without storing a person",
    async () => {
      const request = createRequest();
      const response = await postPerson({
        ...request,
        unexpectedField: "must be rejected",
      });

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toMatchObject({
        message: "Validation failed",
      });

      const scanResult = await documentClient.send(
        new ScanCommand({
          TableName: personTableName,
          FilterExpression: "phoneNumber = :phoneNumber",
          ExpressionAttributeValues: {
            ":phoneNumber": request.phoneNumber,
          },
          ConsistentRead: true,
        }),
      );

      expect(scanResult.Items ?? []).toHaveLength(0);
    },
    15_000,
  );
});
