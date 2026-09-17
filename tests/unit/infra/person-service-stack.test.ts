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
    template.resourceCountIs("AWS::SNS::Topic", 2);
    template.resourceCountIs("AWS::SNS::Subscription", 1);
    template.resourceCountIs("AWS::CloudWatch::Alarm", 1);
    template.resourceCountIs("AWS::Lambda::Function", 3);
    template.resourceCountIs("AWS::Lambda::EventSourceMapping", 1);
    template.resourceCountIs("AWS::ApiGatewayV2::Api", 1);
    template.resourceCountIs("AWS::ApiGatewayV2::Route", 2);
  });

  it("creates an on-demand person table with a string ID key", () => {
    template.hasResourceProperties("AWS::DynamoDB::Table", {
      TableName: "person-service-dev-person-table",
      BillingMode: "PAY_PER_REQUEST",
      AttributeDefinitions: [{ AttributeName: "id", AttributeType: "S" }],
      KeySchema: [{ AttributeName: "id", KeyType: "HASH" }],
      StreamSpecification: {
        StreamViewType: "NEW_IMAGE",
      },
    });
  });

  it("creates the person-created SNS topic", () => {
    template.hasResourceProperties("AWS::SNS::Topic", {
      TopicName: "person-service-dev-person-created-topic.fifo",
      DisplayName: "Person Created Topic",
      FifoTopic: true,
    });
  });

  it("creates an email alert topic from a deployment parameter", () => {
    template.hasParameter("AlertEmail", {
      Type: "String",
      Description: "Email address to receive alerts for person-created events",
    });
    template.hasResourceProperties("AWS::SNS::Topic", {
      TopicName: "person-service-dev-publisher-alert-topic",
      DisplayName: "Publisher Alert Topic",
    });
    template.hasResourceProperties("AWS::SNS::Subscription", {
      Protocol: "email",
      Endpoint: {
        Ref: "AlertEmail",
      },
    });
  });

  it("alarms when the publisher Lambda reports an error", () => {
    template.hasResourceProperties("AWS::CloudWatch::Alarm", {
      AlarmName: "person-service-dev-publisher-errors",
      AlarmDescription:
        "Alerts when the Publisher Lambda fails to publish a person-created event to SNS",
      Namespace: "AWS/Lambda",
      MetricName: "Errors",
      Period: 60,
      Statistic: "Sum",
      EvaluationPeriods: 1,
      DatapointsToAlarm: 1,
      Threshold: 1,
      ComparisonOperator: "GreaterThanOrEqualToThreshold",
      TreatMissingData: "notBreaching",
    });

    const alarms = template.findResources("AWS::CloudWatch::Alarm");
    const alarm = Object.values(alarms)[0];

    expect(alarm.Properties.AlarmActions).toHaveLength(1);
    expect(alarm.Properties.AlarmActions[0].Ref).toMatch(
      /^PublisherAlertTopic/,
    );
  });

  it("creates Node.js 24 create, list, and publisher Lambda functions", () => {
    template.hasResourceProperties("AWS::Lambda::Function", {
      FunctionName: "person-service-dev-create-person",
      Runtime: "nodejs24.x",
      Environment: {
        Variables: Match.objectLike({
          PERSON_TABLE_NAME: Match.anyValue(),
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
    template.hasResourceProperties("AWS::Lambda::Function", {
      FunctionName: "person-service-dev-publish-person-created",
      Runtime: "nodejs24.x",
      Environment: {
        Variables: Match.objectLike({
          PERSON_CREATED_TOPIC_ARN: Match.anyValue(),
        }),
      },
    });
  });

  it("connects DynamoDB INSERT records to the publisher Lambda", () => {
    template.hasResourceProperties("AWS::Lambda::EventSourceMapping", {
      BatchSize: 1,
      StartingPosition: "LATEST",
      FilterCriteria: {
        Filters: [
          {
            Pattern: '{"eventName":["INSERT"]}',
          },
        ],
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

  it("does not grant DynamoDB update or delete access", () => {
    const policies = template.findResources("AWS::IAM::Policy");
    const actions = Object.values(policies).flatMap((policy) =>
      policy.Properties.PolicyDocument.Statement.flatMap(
        (statement: { Action: string | string[] }) =>
          Array.isArray(statement.Action) ? statement.Action : [statement.Action],
      ),
    );

    expect(actions).toContain("dynamodb:PutItem");
    expect(actions).not.toContain("dynamodb:UpdateItem");
    expect(actions).not.toContain("dynamodb:DeleteItem");
    expect(actions).toContain("sns:Publish");
    expect(actions).toContain("dynamodb:GetRecords");
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
