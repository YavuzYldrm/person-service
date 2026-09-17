import type {
  APIGatewayProxyHandlerV2,
  APIGatewayProxyStructuredResultV2,
  Context,
  DynamoDBRecord,
  DynamoDBStreamEvent,
} from "aws-lambda";
import { marshall } from "@aws-sdk/util-dynamodb";
import { z } from "zod";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiGatewayEvent } from "../../fixtures/api-gateway-event";
import {
  createdAt,
  personId,
  personItem,
  streamEventId,
  validCreatePersonRequest,
} from "../../fixtures/person";

const uuidV4Schema = z
  .string()
  .regex(
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    "Expected a UUID v4",
  );

const timestampSchema = z.iso.datetime();

const addressContractSchema = z.strictObject({
  street: z.string(),
  number: z.string(),
  city: z.string(),
  country: z.string().regex(/^[A-Z]{2}$/),
  postcode: z.string().regex(/^[A-Z0-9]{3,12}$/),
});

const personResponseContractSchema = z.strictObject({
  id: uuidV4Schema,
  firstName: z.string(),
  lastName: z.string(),
  phoneNumber: z.string().regex(/^\+[1-9]\d{1,14}$/),
  address: addressContractSchema,
  createdAt: timestampSchema,
});

const createPersonResponseContractSchema = z.strictObject({
  id: uuidV4Schema,
});

const listPersonResponseContractSchema = z.array(personResponseContractSchema);

const errorResponseContractSchema = z.strictObject({
  message: z.string(),
  errors: z.array(
    z.strictObject({
      field: z.string().optional(),
      message: z.string(),
    }),
  ),
});

const personCreatedEventContractSchema = z.strictObject({
  eventId: z.string().min(1),
  eventType: z.literal("person-created"),
  publishedAt: timestampSchema,
  person: personResponseContractSchema,
});

const mocks = vi.hoisted(() => ({
  randomUUID: vi.fn(),
  savePerson: vi.fn(),
  listPersonItems: vi.fn(),
  publishPersonCreated: vi.fn(),
  logInfo: vi.fn(),
  logError: vi.fn(),
}));

vi.mock("node:crypto", () => ({
  randomUUID: mocks.randomUUID,
}));

vi.mock("../../../src/repository/person-repository", () => ({
  savePerson: mocks.savePerson,
  listPersons: mocks.listPersonItems,
}));

vi.mock("../../../src/publisher/person-event-publisher", () => ({
  publishPersonCreated: mocks.publishPersonCreated,
}));

vi.mock("../../../src/utils/logger", () => ({
  logger: {
    info: mocks.logInfo,
    error: mocks.logError,
  },
  toErrorLogContext: (error: unknown) => ({
    errorName: error instanceof Error ? error.name : "UnknownError",
  }),
}));

import { createPersonHandler } from "../../../src/handlers/create-person";
import { listPersonHandler } from "../../../src/handlers/list-person";
import { publishPersonCreatedHandler } from "../../../src/handlers/publish-person-created";

const invoke = async (
  handler: APIGatewayProxyHandlerV2,
  method: "GET" | "POST",
  body?: string,
): Promise<APIGatewayProxyStructuredResultV2> => {
  const result = await handler(
    apiGatewayEvent(method, body),
    {} as Context,
    vi.fn(),
  );

  return result as APIGatewayProxyStructuredResultV2;
};

const invokePublisher = async (): Promise<void> => {
  const newImage = marshall(personItem) as unknown as NonNullable<
    NonNullable<DynamoDBRecord["dynamodb"]>["NewImage"]
  >;
  const event: DynamoDBStreamEvent = {
    Records: [
      {
        eventID: streamEventId,
        eventName: "INSERT",
        dynamodb: { NewImage: newImage },
      },
    ],
  };

  await publishPersonCreatedHandler(
    event,
    {} as Context,
    vi.fn(),
  );
};

describe("Person Service contracts", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(createdAt));
    vi.clearAllMocks();

    mocks.randomUUID.mockReturnValue(personId);
    mocks.savePerson.mockResolvedValue(undefined);
    mocks.listPersonItems.mockResolvedValue([]);
    mocks.publishPersonCreated.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("matches the create response contract", async () => {
    const response = await invoke(
      createPersonHandler,
      "POST",
      JSON.stringify(validCreatePersonRequest),
    );

    expect(response.statusCode).toBe(201);
    expect(
      createPersonResponseContractSchema.parse(JSON.parse(response.body ?? "")),
    ).toEqual({ id: personId });
    expect(mocks.publishPersonCreated).not.toHaveBeenCalled();
  });

  it("matches the person-created event contract", async () => {
    await invokePublisher();

    expect(mocks.publishPersonCreated).toHaveBeenCalledOnce();
    expect(
      personCreatedEventContractSchema.parse(
        mocks.publishPersonCreated.mock.calls[0]?.[0],
      ),
    ).toMatchObject({
      eventId: streamEventId,
      eventType: "person-created",
      person: {
        id: personId,
      },
    });
  });

  it("matches the list response contract", async () => {
    mocks.listPersonItems.mockResolvedValue([personItem]);

    const response = await invoke(listPersonHandler, "GET");

    expect(response.statusCode).toBe(200);
    expect(
      listPersonResponseContractSchema.parse(JSON.parse(response.body ?? "")),
    ).toEqual([personItem]);
  });

  it("matches the validation error contract", async () => {
    const response = await invoke(
      createPersonHandler,
      "POST",
      JSON.stringify({ ...validCreatePersonRequest, firstName: "" }),
    );

    expect(response.statusCode).toBe(400);
    expect(
      errorResponseContractSchema.parse(JSON.parse(response.body ?? "")),
    ).toMatchObject({
      message: "Validation failed",
    });
  });

  it("matches the unexpected error contract", async () => {
    mocks.savePerson.mockRejectedValue(new Error("DynamoDB unavailable"));

    const response = await invoke(
      createPersonHandler,
      "POST",
      JSON.stringify(validCreatePersonRequest),
    );

    expect(response.statusCode).toBe(500);
    expect(
      errorResponseContractSchema.parse(JSON.parse(response.body ?? "")),
    ).toEqual({
      message: "Internal Server Error",
      errors: [],
    });
  });
});
