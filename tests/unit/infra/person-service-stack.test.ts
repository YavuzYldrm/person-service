import { App } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { beforeAll, describe, expect, it } from "vitest";
import { PersonServiceStack } from "../../../infra/lib/person-service-stack";

describe("PersonServiceStack", () => {
  let template: Template;

  beforeAll(() => {
    const app = new App({
      outdir: `/tmp/person-service-cdk-unit-${process.pid}`,
    });
    const stack = new PersonServiceStack(app, "PersonServiceUnitStack", {
      env: {
        account: "111111111111",
        region: "eu-west-1",
      },
      stageConfig: {
        stage: "dev",
        serviceName: "person-service",
        account: "111111111111",
        region: "eu-west-1",
      },
    });

    template = Template.fromStack(stack);
  });

  it("creates the expected serverless resources", () => {
    template.resourceCountIs("AWS::DynamoDB::Table", 1);
    template.resourceCountIs("AWS::SNS::Topic", 1);
    template.resourceCountIs("AWS::Lambda::Function", 2);
    template.resourceCountIs("AWS::ApiGatewayV2::Api", 1);
    template.resourceCountIs("AWS::ApiGatewayV2::Route", 2);
  });

  it("creates an on-demand person table with a string ID key", () => {
    template.hasResourceProperties("AWS::DynamoDB::Table", {
      TableName: "person-service-dev-person-table",
      BillingMode: "PAY_PER_REQUEST",
      AttributeDefinitions: [{ AttributeName: "id", AttributeType: "S" }],
      KeySchema: [{ AttributeName: "id", KeyType: "HASH" }],
    });
  });

  it("creates the person-created SNS topic", () => {
    template.hasResourceProperties("AWS::SNS::Topic", {
      TopicName: "person-service-dev-person-created-topic",
      DisplayName: "Person Created Topic",
    });
  });

  it("creates Node.js 24 create and list Lambda functions", () => {
    template.hasResourceProperties("AWS::Lambda::Function", {
      FunctionName: "person-service-dev-create-person",
      Runtime: "nodejs24.x",
      Environment: {
        Variables: Match.objectLike({
          PERSON_TABLE_NAME: Match.anyValue(),
          PERSON_CREATED_TOPIC_ARN: Match.anyValue(),
        }),
      },
    });
    template.hasResourceProperties("AWS::Lambda::Function", {
      FunctionName: "person-service-dev-list-person",
      Runtime: "nodejs24.x",
      Environment: {
        Variables: Match.objectLike({
          PERSON_TABLE_NAME: Match.anyValue(),
        }),
      },
    });
  });

  it("routes POST and GET person requests to Lambda integrations", () => {
    template.hasResourceProperties("AWS::ApiGatewayV2::Route", {
      RouteKey: "POST /person",
      AuthorizationType: "NONE",
    });
    template.hasResourceProperties("AWS::ApiGatewayV2::Route", {
      RouteKey: "GET /person",
      AuthorizationType: "NONE",
    });
  });

  it("limits create Lambda DynamoDB access to put and update", () => {
    const policies = template.findResources("AWS::IAM::Policy");
    const actions = Object.values(policies).flatMap((policy) =>
      policy.Properties.PolicyDocument.Statement.flatMap(
        (statement: { Action: string | string[] }) =>
          Array.isArray(statement.Action) ? statement.Action : [statement.Action],
      ),
    );

    expect(actions).toContain("dynamodb:PutItem");
    expect(actions).toContain("dynamodb:UpdateItem");
    expect(actions).not.toContain("dynamodb:DeleteItem");
  });

  it("outputs the API base URL and person route", () => {
    template.hasOutput("PersonApiBaseUrl", {
      Description: "Base URL of the Person Service HTTP API",
    });
    template.hasOutput("PersonApiPersonRoute", {
      Description: "Full URL of the /person route",
    });
    template.hasOutput("PersonTableName", {
      Description: "DynamoDB table used by the Person Service",
    });
  });
});
