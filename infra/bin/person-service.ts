import { App } from "aws-cdk-lib";
import { stageConfigs, type StageName } from "../config/stage-config";
import { PersonServiceStack } from "../lib/person-service-stack";

const app = new App();

const stage = (app.node.tryGetContext("stage") ?? "dev") as StageName;

const stageConfig = stageConfigs[stage];

if (!stageConfig) {
    throw new Error(`Invalid stage: ${stage}`);
}

new PersonServiceStack(app, `${stageConfig.serviceName}-${stage}-stack`, {
    env: {
        account: stageConfig.account,
        region: stageConfig.region,
    },
    stageConfig,
});

app.synth();