import { describe, expect, it } from "vitest";
import {
  toListPersonResponseDto,
  toPersonResponseDto,
} from "../../../src/mappers/person.mapper";
import { personItem } from "../../fixtures/person";

describe("person mapper", () => {
  it("maps a persistence item to a response", () => {
    const result = toPersonResponseDto(personItem);

    expect(result).toEqual(personItem);
  });

  it("maps every persistence item in a list", () => {
    const secondPerson = {
      ...personItem,
      id: "b62d44e1-a707-4bec-a9ef-d47ec7d1baec",
      firstName: "Grace",
    };

    expect(toListPersonResponseDto([personItem, secondPerson])).toEqual([
      personItem,
      secondPerson,
    ]);
  });
});
