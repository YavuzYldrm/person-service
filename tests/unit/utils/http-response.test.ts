import { describe, expect, it } from "vitest";
import {
  badRequest,
  created,
  internalServerError,
  jsonResponse,
  ok,
} from "../../../src/utils/http-response";

describe("HTTP responses", () => {
  it("creates a JSON response", () => {
    expect(jsonResponse(202, { status: "accepted" })).toEqual({
      statusCode: 202,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "accepted" }),
    });
  });

  it("creates successful responses", () => {
    expect(ok([]).statusCode).toBe(200);
    expect(created({ id: "person-id" }).statusCode).toBe(201);
  });

  it("creates a bad request with validation details", () => {
    const response = badRequest("Validation failed", [
      { field: "firstName", message: "First name is required" },
    ]);

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body)).toEqual({
      message: "Validation failed",
      errors: [{ field: "firstName", message: "First name is required" }],
    });
  });

  it("does not expose details in an internal server error", () => {
    const response = internalServerError();

    expect(response.statusCode).toBe(500);
    expect(JSON.parse(response.body)).toEqual({
      message: "Internal Server Error",
      errors: [],
    });
  });
});
