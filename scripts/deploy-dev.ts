import { spawnSync } from "node:child_process";
import { readFileSync, rmSync } from "node:fs";
import * as path from "node:path";
import { stageConfigs } from "../infra/config/stage-config";

type CdkOutputs = Record<string, Record<string, unknown>>;

export type SmokeEnvironment = {
  PERSON_API_URL: string;
  PERSON_TABLE_NAME: string;
  AWS_REGION: string;
};

export const resolveSmokeEnvironment = (
  outputs: CdkOutputs,
): SmokeEnvironment => {
  const stage = "dev";
  const config = stageConfigs[stage];
  const stackName = `${config.serviceName}-${stage}-stack`;
  const stackOutputs = outputs[stackName];

  if (!stackOutputs) {
    throw new Error(`CDK outputs do not contain stack ${stackName}`);
  }

  const apiUrl = stackOutputs.PersonApiPersonRoute;
  const tableName = stackOutputs.PersonTableName;

  if (typeof apiUrl !== "string" || typeof tableName !== "string") {
    throw new Error(`Required smoke test outputs are missing for ${stackName}`);
  }

  return {
    PERSON_API_URL: apiUrl,
    PERSON_TABLE_NAME: tableName,
    AWS_REGION: config.region,
  };
};

const runNpmCommand = (
  args: string[],
  projectRoot: string,
  failureMessage: string,
  env = process.env,
): void => {
  const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
  const result = spawnSync(npmCommand, args, {
    cwd: projectRoot,
    stdio: "inherit",
    env,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(failureMessage);
  }
};

export const deployDev = (projectRoot = process.cwd()): void => {
  const outputFile = path.join(projectRoot, "cdk-outputs.dev.json");
  const cdkOutputDirectory = path.join(projectRoot, "cdk.out");

  rmSync(outputFile, { force: true });

  try {
    runNpmCommand(
      [
        "run",
        "cdk",
        "--",
        "deploy",
        "-c",
        "stage=dev",
        "--outputs-file",
        outputFile,
      ],
      projectRoot,
      "Dev deployment failed",
    );

    const outputs = JSON.parse(readFileSync(outputFile, "utf8")) as CdkOutputs;
    const smokeEnvironment = resolveSmokeEnvironment(outputs);

    runNpmCommand(
      ["run", "test:integration"],
      projectRoot,
      "Smoke tests failed for stage dev",
      {
        ...process.env,
        ...smokeEnvironment,
      },
    );

    rmSync(cdkOutputDirectory, { recursive: true, force: true });
  } finally {
    rmSync(outputFile, { force: true });
  }
};

if (typeof require !== "undefined" && require.main === module) {
  try {
    deployDev();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown deployment error";
    console.error(message);
    process.exitCode = 1;
  }
}
