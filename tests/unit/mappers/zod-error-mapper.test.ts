import { describe, expect, it } from "vitest";
import { mapZodErrors } from "../../../src/mappers/zod-error-mapper";
import { createPersonSchema } from "../../../src/validation/create-person.schema";
import { validCreatePersonRequest } from "../../fixtures/person";

describe("mapZodErrors", () => {
  it("maps nested issue paths to dot-separated field names", () => {
    const result = createPersonSchema.safeParse({
      ...validCreatePersonRequest,
      address: {
        ...validCreatePersonRequest.address,
        city: "",
      },
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(mapZodErrors(result.error)).toContainEqual({
        field: "address.city",
        message: "City is required",
      });
    }
  });

  it("uses an undefined field for root-level issues", () => {
    const result = createPersonSchema.safeParse({
      ...validCreatePersonRequest,
      unexpected: true,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(mapZodErrors(result.error)).toContainEqual({
        field: undefined,
        message: expect.stringContaining("Unrecognized key"),
      });
    }
  });
});
