export type StageName = "dev" | "prod";

export type StageConfig = {
    stage: StageName;
    serviceName: string;
    account: string;
    region: string;
}

export const stageConfigs: Record<StageName, StageConfig> = {
    dev: {
        stage: "dev",
        serviceName: "person-service",
        account: "342050997982",
        region: "eu-west-1",
    },
    prod: {
        stage: "prod",
        serviceName: "person-service",
        account: "342050997982",
        region: "eu-west-1",
    },
};
