import { describe, expect, it } from "vitest";
import { personItem } from "../../fixtures/person";
import { personItemSchema } from "../../../src/validation/person-item.schema";

describe("person item schema", () => {
  it("accepts a valid persisted person", () => {
    expect(personItemSchema.parse(personItem)).toEqual(personItem);
  });

  it("rejects an invalid person ID", () => {
    const result = personItemSchema.safeParse({
      ...personItem,
      id: "not-a-uuid",
    });

    expect(result.success).toBe(false);
  });

  it("rejects an invalid creation timestamp", () => {
    const result = personItemSchema.safeParse({
      ...personItem,
      createdAt: "not-a-date",
    });

    expect(result.success).toBe(false);
  });

  it("rejects unknown persistence properties", () => {
    const result = personItemSchema.safeParse({
      ...personItem,
      unexpected: true,
    });

    expect(result.success).toBe(false);
  });
});
