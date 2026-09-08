import type { APIGatewayProxyStructuredResultV2, Context } from "aws-lambda";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiGatewayEvent } from "../../fixtures/api-gateway-event";
import { personItem } from "../../fixtures/person";

const mocks = vi.hoisted(() => ({
  listPersons: vi.fn(),
  logInfo: vi.fn(),
  logError: vi.fn(),
  toErrorLogContext: vi.fn((error: unknown) => ({
    errorName: error instanceof Error ? error.name : "UnknownError",
  })),
}));

vi.mock("../../../src/services/person-service", () => ({
  listPersons: mocks.listPersons,
}));

vi.mock("../../../src/utils/logger", () => ({
  logger: {
    info: mocks.logInfo,
    error: mocks.logError,
  },
  toErrorLogContext: mocks.toErrorLogContext,
}));

import { listPersonHandler } from "../../../src/handlers/list-person";

const invoke = async (): Promise<APIGatewayProxyStructuredResultV2> => {
  const result = await listPersonHandler(
    apiGatewayEvent("GET"),
    {} as Context,
    vi.fn(),
  );

  return result as APIGatewayProxyStructuredResultV2;
};

describe("listPersonHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listPersons.mockResolvedValue([]);
  });

  it("returns persons and logs the result count", async () => {
    mocks.listPersons.mockResolvedValue([personItem]);

    const response = await invoke();

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body ?? "")).toEqual([personItem]);
    expect(mocks.logInfo).toHaveBeenCalledWith("Persons listed", {
      operation: "listPersons",
      requestId: "request-id",
      personCount: 1,
    });
  });

  it("returns 500 and logs an unexpected service error", async () => {
    mocks.listPersons.mockRejectedValue(new Error("DynamoDB unavailable"));

    const response = await invoke();

    expect(response.statusCode).toBe(500);
    expect(mocks.logError).toHaveBeenCalledWith(
      "Unexpected error while listing persons",
      {
        operation: "listPersons",
        requestId: "request-id",
        errorName: "Error",
      },
    );
  });
});
