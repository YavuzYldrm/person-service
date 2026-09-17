import type {
  Context,
  DynamoDBRecord,
  DynamoDBStreamEvent,
} from "aws-lambda";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createdAt,
  personCreatedEvent,
  personId,
  personItem,
  streamEventId,
} from "../../fixtures/person";

const mocks = vi.hoisted(() => ({
  publishPersonCreated: vi.fn(),
  logError: vi.fn(),
  toErrorLogContext: vi.fn((error: unknown) => ({
    errorName: error instanceof Error ? error.name : "UnknownError",
  })),
}));

vi.mock("../../../src/publisher/person-event-publisher", () => ({
  publishPersonCreated: mocks.publishPersonCreated,
}));

vi.mock("../../../src/utils/logger", () => ({
  logger: {
    error: mocks.logError,
  },
  toErrorLogContext: mocks.toErrorLogContext,
}));

import { publishPersonCreatedHandler } from "../../../src/handlers/publish-person-created";

const personNewImage: NonNullable<
  NonNullable<DynamoDBRecord["dynamodb"]>["NewImage"]
> = {
  id: { S: personItem.id },
  firstName: { S: personItem.firstName },
  lastName: { S: personItem.lastName },
  phoneNumber: { S: personItem.phoneNumber },
  address: {
    M: {
      street: { S: personItem.address.street },
      number: { S: personItem.address.number },
      city: { S: personItem.address.city },
      country: { S: personItem.address.country },
      postcode: { S: personItem.address.postcode },
    },
  },
  createdAt: { S: personItem.createdAt },
};

const streamRecord = (
  overrides: Partial<DynamoDBRecord> = {},
): DynamoDBRecord => ({
  eventID: streamEventId,
  eventName: "INSERT",
  dynamodb: {
    NewImage: personNewImage,
  },
  ...overrides,
});

const invoke = async (records: DynamoDBRecord[]): Promise<void> => {
  const event: DynamoDBStreamEvent = { Records: records };

  await publishPersonCreatedHandler(
    event,
    {} as Context,
    vi.fn(),
  );
};

describe("publishPersonCreatedHandler", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(createdAt));
    vi.clearAllMocks();
    mocks.publishPersonCreated.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("publishes a person-created event from a DynamoDB INSERT record", async () => {
    await invoke([streamRecord()]);

    expect(mocks.publishPersonCreated).toHaveBeenCalledWith(personCreatedEvent);
  });

  it("ignores stream records that are not INSERT events", async () => {
    await invoke([streamRecord({ eventName: "MODIFY" })]);

    expect(mocks.publishPersonCreated).not.toHaveBeenCalled();
  });

  it("rejects an INSERT record without NewImage", async () => {
    await expect(
      invoke([
        streamRecord({
          dynamodb: {},
        }),
      ]),
    ).rejects.toThrow();

    expect(mocks.publishPersonCreated).not.toHaveBeenCalled();
  });

  it("rejects an INSERT record without an event ID", async () => {
    await expect(
      invoke([
        streamRecord({
          eventID: undefined,
        }),
      ]),
    ).rejects.toThrow("DynamoDB Stream record does not contain eventID");

    expect(mocks.publishPersonCreated).not.toHaveBeenCalled();
  });

  it("rejects an invalid person from the stream", async () => {
    await expect(
      invoke([
        streamRecord({
          dynamodb: {
            NewImage: {
              ...personNewImage,
              id: { S: "not-a-uuid" },
            },
          },
        }),
      ]),
    ).rejects.toThrow();

    expect(mocks.publishPersonCreated).not.toHaveBeenCalled();
  });

  it("logs and propagates an SNS publishing error", async () => {
    const error = new Error("SNS unavailable");
    mocks.publishPersonCreated.mockRejectedValue(error);

    await expect(invoke([streamRecord()])).rejects.toBe(error);
    expect(mocks.logError).toHaveBeenCalledWith(
      expect.stringContaining("Failed to publish person"),
      {
        operation: "publishPersonCreated",
        personId,
        streamEventId,
        errorName: "Error",
      },
    );
  });
});
