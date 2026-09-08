import type { APIGatewayProxyStructuredResultV2, Context } from "aws-lambda";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiGatewayEvent } from "../../fixtures/api-gateway-event";
import { personId, validCreatePersonRequest } from "../../fixtures/person";

const mocks = vi.hoisted(() => ({
  createPerson: vi.fn(),
  logInfo: vi.fn(),
  logError: vi.fn(),
  toErrorLogContext: vi.fn((error: unknown) => ({
    errorName: error instanceof Error ? error.name : "UnknownError",
  })),
}));

vi.mock("../../../src/services/person-service", () => ({
  createPerson: mocks.createPerson,
}));

vi.mock("../../../src/utils/logger", () => ({
  logger: {
    info: mocks.logInfo,
    error: mocks.logError,
  },
  toErrorLogContext: mocks.toErrorLogContext,
}));

import { createPersonHandler } from "../../../src/handlers/create-person";

const invoke = async (body?: string): Promise<APIGatewayProxyStructuredResultV2> => {
  const result = await createPersonHandler(
    apiGatewayEvent("POST", body),
    {} as Context,
    vi.fn(),
  );

  return result as APIGatewayProxyStructuredResultV2;
};

describe("createPersonHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createPerson.mockResolvedValue({ id: personId });
  });

  it("returns 201 and passes normalized data to the service", async () => {
    const response = await invoke(
      JSON.stringify({
        ...validCreatePersonRequest,
        phoneNumber: "+31 (6) 123-45678",
        address: {
          ...validCreatePersonRequest.address,
          country: "nl",
          postcode: "1012 ca",
        },
      }),
    );

    expect(mocks.createPerson).toHaveBeenCalledWith(validCreatePersonRequest);
    expect(response.statusCode).toBe(201);
    expect(JSON.parse(response.body ?? "")).toEqual({ id: personId });
    expect(mocks.logInfo).toHaveBeenCalledWith("Person created", {
      operation: "createPerson",
      requestId: "request-id",
      personId,
    });
  });

  it("returns 400 when the request body is missing", async () => {
    const response = await invoke();

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body ?? "")).toEqual({
      message: "Request body is required",
      errors: [],
    });
    expect(mocks.createPerson).not.toHaveBeenCalled();
  });

  it("returns 400 when the request body is invalid JSON", async () => {
    const response = await invoke("{invalid");

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body ?? "")).toEqual({
      message: "Invalid JSON in request body",
      errors: [],
    });
    expect(mocks.createPerson).not.toHaveBeenCalled();
  });

  it("returns validation errors for an invalid request", async () => {
    const response = await invoke(
      JSON.stringify({ ...validCreatePersonRequest, firstName: "" }),
    );

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body ?? "")).toEqual({
      message: "Validation failed",
      errors: [
        {
          field: "firstName",
          message: "First name is required",
        },
      ],
    });
    expect(mocks.createPerson).not.toHaveBeenCalled();
  });

  it("returns 500 and logs an unexpected service error", async () => {
    const error = new Error("DynamoDB unavailable");
    mocks.createPerson.mockRejectedValue(error);

    const response = await invoke(JSON.stringify(validCreatePersonRequest));

    expect(response.statusCode).toBe(500);
    expect(JSON.parse(response.body ?? "")).toEqual({
      message: "Internal Server Error",
      errors: [],
    });
    expect(mocks.logError).toHaveBeenCalledWith(
      "Unexpected error while creating person",
      {
        operation: "createPerson",
        requestId: "request-id",
        errorName: "Error",
      },
    );
  });
});
