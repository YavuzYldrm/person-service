import { describe, expect, it } from "vitest";
import { createPersonSchema } from "../../../src/validation/create-person.schema";
import { validCreatePersonRequest } from "../../fixtures/person";

describe("createPersonSchema", () => {
  it("accepts a valid person request", () => {
    const result = createPersonSchema.safeParse(validCreatePersonRequest);

    expect(result.success).toBe(true);
  });

  it("normalizes strings, phone number, country, and postcode", () => {
    const result = createPersonSchema.parse({
      ...validCreatePersonRequest,
      firstName: "  Ada  ",
      phoneNumber: "+31 (6) 123-45678",
      address: {
        ...validCreatePersonRequest.address,
        country: " nl ",
        postcode: "1012 ca",
      },
    });

    expect(result.firstName).toBe("Ada");
    expect(result.phoneNumber).toBe("+31612345678");
    expect(result.address.country).toBe("NL");
    expect(result.address.postcode).toBe("1012CA");
  });

  it("rejects a phone number without the E.164 plus prefix", () => {
    const result = createPersonSchema.safeParse({
      ...validCreatePersonRequest,
      phoneNumber: "31612345678",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["phoneNumber"]);
    }
  });

  it("rejects a country containing non-letter characters", () => {
    const result = createPersonSchema.safeParse({
      ...validCreatePersonRequest,
      address: {
        ...validCreatePersonRequest.address,
        country: "1L",
      },
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["address", "country"]);
    }
  });

  it("rejects an invalid postcode", () => {
    const result = createPersonSchema.safeParse({
      ...validCreatePersonRequest,
      address: {
        ...validCreatePersonRequest.address,
        postcode: "10@!",
      },
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["address", "postcode"]);
    }
  });

  it("rejects unknown request properties", () => {
    const result = createPersonSchema.safeParse({
      ...validCreatePersonRequest,
      age: 36,
    });

    expect(result.success).toBe(false);
  });

  it("rejects unknown address properties", () => {
    const result = createPersonSchema.safeParse({
      ...validCreatePersonRequest,
      address: {
        ...validCreatePersonRequest.address,
        province: "Noord-Holland",
      },
    });

    expect(result.success).toBe(false);
  });

  it("rejects an empty first name", () => {
    const result = createPersonSchema.safeParse({
      ...validCreatePersonRequest,
      firstName: "   ",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("First name is required");
    }
  });
});
