import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createdAt,
  personId,
  personItem,
  validCreatePersonRequest,
} from "../../fixtures/person";

const mocks = vi.hoisted(() => ({
  randomUUID: vi.fn(),
  savePerson: vi.fn(),
  listPersonItems: vi.fn(),
}));

vi.mock("node:crypto", () => ({
  randomUUID: mocks.randomUUID,
}));

vi.mock("../../../src/repository/person-repository", () => ({
  savePerson: mocks.savePerson,
  listPersons: mocks.listPersonItems,
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
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("persists a person and returns its ID", async () => {
    const result = await createPerson(validCreatePersonRequest);

    expect(result).toEqual({ id: personId });
    expect(mocks.savePerson).toHaveBeenCalledWith(personItem);
  });

  it("propagates an error when persistence fails", async () => {
    const error = new Error("DynamoDB unavailable");
    mocks.savePerson.mockRejectedValue(error);

    await expect(createPerson(validCreatePersonRequest)).rejects.toBe(error);
  });

  it("maps persistence items when listing persons", async () => {
    mocks.listPersonItems.mockResolvedValue([personItem]);

    await expect(listPersons()).resolves.toEqual([personItem]);
  });
});
