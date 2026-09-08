import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { logger, toErrorLogContext } from "../../../src/utils/logger";

describe("logger", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-07T10:00:00.000Z"));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("writes structured info logs", () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => undefined);

    logger.info("Person created", {
      operation: "createPerson",
      personId: "person-id",
    });

    expect(JSON.parse(String(infoSpy.mock.calls[0]?.[0]))).toEqual({
      timestamp: "2026-09-07T10:00:00.000Z",
      level: "INFO",
      message: "Person created",
      operation: "createPerson",
      personId: "person-id",
    });
  });

  it("writes structured error logs", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    logger.error("Publish failed", { errorName: "Error" });

    expect(JSON.parse(String(errorSpy.mock.calls[0]?.[0]))).toMatchObject({
      level: "ERROR",
      message: "Publish failed",
      errorName: "Error",
    });
  });

  it("maps Error instances without including arbitrary values", () => {
    expect(toErrorLogContext(new Error("SNS unavailable"))).toEqual({
      errorName: "Error",
      errorMessage: "SNS unavailable",
    });
    expect(toErrorLogContext("raw error")).toEqual({
      errorName: "UnknownError",
    });
  });
});
