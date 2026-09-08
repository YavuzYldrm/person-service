import { describe, expect, it } from "vitest";
import {
  stageConfigs,
  type StageName,
} from "../../../infra/config/stage-config";

describe.each<StageName>(["dev", "prod"])("%s stage configuration", (stage) => {
  it("contains the required deployment values", () => {
    const config = stageConfigs[stage];

    expect(config.stage).toBe(stage);
    expect(config.serviceName).toBe("person-service");
    expect(config.account).toMatch(/^\d{12}$/);
    expect(config.region).toBe("eu-west-1");
  });
});
