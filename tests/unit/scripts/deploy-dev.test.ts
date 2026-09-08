import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  spawnSync: vi.fn(),
  readFileSync: vi.fn(),
  rmSync: vi.fn(),
}));

vi.mock("node:child_process", () => ({
  spawnSync: mocks.spawnSync,
}));

vi.mock("node:fs", () => ({
  readFileSync: mocks.readFileSync,
  rmSync: mocks.rmSync,
}));

import {
  deployDev,
  resolveSmokeEnvironment,
} from "../../../scripts/deploy-dev";

const cdkOutputs = {
  "person-service-dev-stack": {
    PersonApiPersonRoute: "https://example.test/person",
    PersonTableName: "person-service-dev-person-table",
  },
};

describe("dev deployment runner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.spawnSync.mockReturnValue({ status: 0 });
    mocks.readFileSync.mockReturnValue(JSON.stringify(cdkOutputs));
  });

  it("resolves dev integration test values from CDK outputs", () => {
    expect(resolveSmokeEnvironment(cdkOutputs)).toEqual({
      PERSON_API_URL: "https://example.test/person",
      PERSON_TABLE_NAME: "person-service-dev-person-table",
      AWS_REGION: "eu-west-1",
    });
  });

  it("fails when the dev stack outputs are unavailable", () => {
    expect(() => resolveSmokeEnvironment({})).toThrow(
      "CDK outputs do not contain stack person-service-dev-stack",
    );
  });

  it("fails when a required output is missing", () => {
    expect(() =>
      resolveSmokeEnvironment({
        "person-service-dev-stack": {
          PersonApiPersonRoute: "https://example.test/person",
        },
      }),
    ).toThrow(
      "Required smoke test outputs are missing for person-service-dev-stack",
    );
  });

  it("deploys dev, runs smoke tests, and removes generated outputs", () => {
    deployDev("/project");

    expect(mocks.spawnSync).toHaveBeenCalledTimes(2);
    expect(mocks.spawnSync.mock.calls[0]?.[1]).toEqual([
      "run",
      "cdk",
      "--",
      "deploy",
      "-c",
      "stage=dev",
      "--outputs-file",
      "/project/cdk-outputs.dev.json",
    ]);
    expect(mocks.spawnSync.mock.calls[1]?.[1]).toEqual([
      "run",
      "test:integration",
    ]);
    expect(mocks.spawnSync.mock.calls[1]?.[2]).toMatchObject({
      env: expect.objectContaining({
        PERSON_API_URL: "https://example.test/person",
        PERSON_TABLE_NAME: "person-service-dev-person-table",
        AWS_REGION: "eu-west-1",
      }),
    });
    expect(mocks.rmSync).toHaveBeenNthCalledWith(
      1,
      "/project/cdk-outputs.dev.json",
      { force: true },
    );
    expect(mocks.rmSync).toHaveBeenCalledWith("/project/cdk.out", {
      recursive: true,
      force: true,
    });
    expect(mocks.rmSync).toHaveBeenLastCalledWith(
      "/project/cdk-outputs.dev.json",
      { force: true },
    );
  });

  it("removes the output file when smoke tests fail", () => {
    mocks.spawnSync
      .mockReturnValueOnce({ status: 0 })
      .mockReturnValueOnce({ status: 1 });

    expect(() => deployDev("/project")).toThrow(
      "Smoke tests failed for stage dev",
    );
    expect(mocks.rmSync).toHaveBeenLastCalledWith(
      "/project/cdk-outputs.dev.json",
      { force: true },
    );
    expect(mocks.rmSync).not.toHaveBeenCalledWith("/project/cdk.out", {
      recursive: true,
      force: true,
    });
  });
});
