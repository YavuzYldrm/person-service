import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createdAt,
  personCreatedEvent,
  personId,
  personItem,
  validCreatePersonRequest,
} from "../../fixtures/person";

const mocks = vi.hoisted(() => ({
  randomUUID: vi.fn(),
  savePerson: vi.fn(),
  listPersonItems: vi.fn(),
  saveEventPublishFailure: vi.fn(),
  publishPersonCreated: vi.fn(),
  logError: vi.fn(),
  toErrorLogContext: vi.fn((error: unknown) => ({
    errorName: error instanceof Error ? error.name : "UnknownError",
  })),
}));

vi.mock("node:crypto", () => ({
  randomUUID: mocks.randomUUID,
}));

vi.mock("../../../src/repository/person-repository", () => ({
  savePerson: mocks.savePerson,
  listPersons: mocks.listPersonItems,
  saveEventPublishFailure: mocks.saveEventPublishFailure,
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

import {
  createPerson,
  listPersons,
} from "../../../src/services/person-service";

describe("person service", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(createdAt));
    vi.clearAllMocks();

    mocks.randomUUID.mockReturnValue(personId);
    mocks.savePerson.mockResolvedValue(undefined);
    mocks.listPersonItems.mockResolvedValue([]);
    mocks.saveEventPublishFailure.mockResolvedValue(undefined);
    mocks.publishPersonCreated.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("persists a person, publishes its event, and returns its ID", async () => {
    const result = await createPerson(validCreatePersonRequest);

    expect(result).toEqual({ id: personId });
    expect(mocks.savePerson).toHaveBeenCalledWith(personItem);
    expect(mocks.publishPersonCreated).toHaveBeenCalledWith(personCreatedEvent);
    expect(mocks.saveEventPublishFailure).not.toHaveBeenCalled();
  });

  it("does not publish when persisting the person fails", async () => {
    const error = new Error("DynamoDB unavailable");
    mocks.savePerson.mockRejectedValue(error);

    await expect(createPerson(validCreatePersonRequest)).rejects.toBe(error);
    expect(mocks.publishPersonCreated).not.toHaveBeenCalled();
  });

  it("records an SNS publish failure and still returns the person ID", async () => {
    const error = new Error("SNS unavailable");
    mocks.publishPersonCreated.mockRejectedValue(error);

    const result = await createPerson(validCreatePersonRequest);

    expect(result).toEqual({ id: personId });
    expect(mocks.saveEventPublishFailure).toHaveBeenCalledWith(personId, {
      failedAt: createdAt,
      errorMessage: "SNS unavailable",
    });
    expect(mocks.logError).toHaveBeenCalledWith(
      "Failed to publish person-created event",
      {
        operation: "publishPersonCreated",
        personId,
        errorName: "Error",
      },
    );
  });

  it("returns the person ID when recording the publish failure also fails", async () => {
    mocks.publishPersonCreated.mockRejectedValue(new Error("SNS unavailable"));
    mocks.saveEventPublishFailure.mockRejectedValue(
      new Error("DynamoDB unavailable"),
    );

    await expect(createPerson(validCreatePersonRequest)).resolves.toEqual({
      id: personId,
    });
    expect(mocks.logError).toHaveBeenCalledTimes(2);
    expect(mocks.logError).toHaveBeenLastCalledWith(
      "Unexpected error while persisting publish failure metadata",
      {
        operation: "saveEventPublishFailure",
        personId,
        errorName: "Error",
      },
    );
  });

  it("maps persistence items when listing persons", async () => {
    mocks.listPersonItems.mockResolvedValue([
      {
        ...personItem,
        eventPublishFailure: {
          failedAt: createdAt,
          errorMessage: "SNS unavailable",
        },
      },
    ]);

    await expect(listPersons()).resolves.toEqual([personItem]);
  });
});
