import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createdAt, personId, personItem } from "../../fixtures/person";

const mocks = vi.hoisted(() => {
  const send = vi.fn();

  return {
    send,
    DynamoDBClient: vi.fn(function () {
      return {};
    }),
    documentClientFrom: vi.fn(() => ({ send })),
    PutCommand: vi.fn(function (input: unknown) {
      return { command: "put", input };
    }),
    ScanCommand: vi.fn(function (input: unknown) {
      return { command: "scan", input };
    }),
    UpdateCommand: vi.fn(function (input: unknown) {
      return { command: "update", input };
    }),
  };
});

vi.mock("@aws-sdk/client-dynamodb", () => ({
  DynamoDBClient: mocks.DynamoDBClient,
}));

vi.mock("@aws-sdk/lib-dynamodb", () => ({
  DynamoDBDocumentClient: {
    from: mocks.documentClientFrom,
  },
  PutCommand: mocks.PutCommand,
  ScanCommand: mocks.ScanCommand,
  UpdateCommand: mocks.UpdateCommand,
}));

let repository: typeof import("../../../src/repository/person-repository");

describe("person repository", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    process.env.PERSON_TABLE_NAME = "person-table";
    mocks.send.mockResolvedValue({});
    repository = await import("../../../src/repository/person-repository");
  });

  afterEach(() => {
    delete process.env.PERSON_TABLE_NAME;
  });

  it("saves a person only when its ID does not already exist", async () => {
    await repository.savePerson(personItem);

    expect(mocks.PutCommand).toHaveBeenCalledWith({
      TableName: "person-table",
      Item: personItem,
      ConditionExpression: "attribute_not_exists(id)",
    });
  });

  it("returns person items from a table scan", async () => {
    mocks.send.mockResolvedValueOnce({ Items: [personItem] });

    await expect(repository.listPersons()).resolves.toEqual([personItem]);
    expect(mocks.ScanCommand).toHaveBeenCalledWith({
      TableName: "person-table",
    });
  });

  it("returns an empty list when the scan has no items", async () => {
    mocks.send.mockResolvedValueOnce({});

    await expect(repository.listPersons()).resolves.toEqual([]);
  });

  it("stores event publish failure metadata for an existing person", async () => {
    const failure = {
      failedAt: createdAt,
      errorMessage: "SNS unavailable",
    };

    await repository.saveEventPublishFailure(personId, failure);

    expect(mocks.UpdateCommand).toHaveBeenCalledWith({
      TableName: "person-table",
      Key: { id: personId },
      UpdateExpression: "SET eventPublishFailure = :eventPublishFailure",
      ExpressionAttributeValues: {
        ":eventPublishFailure": failure,
      },
      ConditionExpression: "attribute_exists(id)",
    });
  });

  it("propagates DynamoDB client errors", async () => {
    const error = new Error("DynamoDB unavailable");
    mocks.send.mockRejectedValueOnce(error);

    await expect(repository.savePerson(personItem)).rejects.toBe(error);
  });

  it("fails during initialization when the table name is missing", async () => {
    delete process.env.PERSON_TABLE_NAME;
    vi.resetModules();

    await expect(
      import("../../../src/repository/person-repository"),
    ).rejects.toThrow("PERSON_TABLE_NAME environment variable is not defined");
  });
});
