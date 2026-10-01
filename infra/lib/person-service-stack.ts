import { CfnOutput, CfnParameter, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { StageConfig } from "../config/stage-config";
import { FilterCriteria, FilterRule, StartingPosition } from "aws-cdk-lib/aws-lambda";
import { HttpMethod } from "aws-cdk-lib/aws-apigatewayv2";
import { CoreServiceStack, createDynamoTable, createNodejsFunction, createSnsTopic, addHttpLambdaRoute, createHttpApi, addDynamoStreamToLambda, createLambdaErrorAlarm } from "core-cdk";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as path from "node:path";
import * as subscriptions from "aws-cdk-lib/aws-sns-subscriptions";

type PersonServiceStackProps = StackProps & {
    stageConfig: StageConfig;
};

export class PersonServiceStack extends CoreServiceStack {
    constructor(scope: Construct, id: string, props: PersonServiceStackProps) {
        const { stageConfig, ...stackProps } = props;

        super(scope, id, {
        ...stackProps,
        serviceName: stageConfig.serviceName,
        stage: stageConfig.stage,
        });
        const baseName = `${stageConfig.serviceName}-${stageConfig.stage}`;

        const personTable = createDynamoTable(this, "PersonTable", {
            resourceName: "person-table",
            partitionKey: {
              name: "id",
              type: dynamodb.AttributeType.STRING,
            },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            stream: dynamodb.StreamViewType.NEW_IMAGE,
        });

        const personCreatedTopic = createSnsTopic(
            this,
            "PersonCreatedTopic",
            {
                resourceName: "person-created-topic",
                displayName: "Person Created Topic",
                fifo: true,
                contentBasedDeduplication: false,
            }
        );

        const alertEmail = new CfnParameter(this, "AlertEmail", {
            type: "String",
            description: "Email address to receive alerts for person-created events",
        });

       const publisherAlertTopic = createSnsTopic(
            this,
            "PublisherAlertTopic",
            {
                resourceName: "publisher-alert-topic",
                displayName: "Publisher Alert Topic",
            }
        )

        publisherAlertTopic.addSubscription(
            new subscriptions.EmailSubscription(alertEmail.valueAsString)
        );

        const createPersonLambda = createNodejsFunction(
            this, 
            "CreatePersonLambda",
            {
                resourceName: "create-person",
                entry: path.join(
                    __dirname,
                    "../../src/handlers/create-person.ts",
                ),
                handler: "createPersonHandler",
                environment: {
                    PERSON_TABLE_NAME: personTable.tableName,
                }
            }
        )

        const listPersonLambda = createNodejsFunction(
            this,
            "ListPersonLambda",
            {
              resourceName: "list-person",
              entry: path.join(
                __dirname,
                "../../src/handlers/list-person.ts",
              ),
              handler: "listPersonHandler",
              environment: {
                PERSON_TABLE_NAME: personTable.tableName,
              },
            },
          );

        const publishPersonCreatedLambda = createNodejsFunction(
            this,
            "PublishPersonCreatedLambda",
            {
                resourceName: "publish-person-created",
                entry: path.join(
                __dirname,
                "../../src/handlers/publish-person-created.ts",
                ),
                handler: "publishPersonCreatedHandler",
                environment: {
                PERSON_CREATED_TOPIC_ARN: personCreatedTopic.topicArn,
                },
            },
        );

        createLambdaErrorAlarm(this, "PublisherErrorAlarm", {
            resourceName: "publisher-errors",
            handler: publishPersonCreatedLambda,
            alertTopic: publisherAlertTopic,
            alarmDescription:
              "Alerts when the Publisher Lambda fails to publish a person-created event to SNS",
          });

        personTable.grant(
            createPersonLambda,
            "dynamodb:PutItem",
        );
        personTable.grantReadData(listPersonLambda);

        personCreatedTopic.grantPublish(publishPersonCreatedLambda);

        addDynamoStreamToLambda({
            table: personTable,
            handler: publishPersonCreatedLambda,
            startingPosition: StartingPosition.LATEST,
            batchSize: 1,
            filters: [
                FilterCriteria.filter({
                    eventName: FilterRule.isEqual("INSERT"),
                })
            ]
        });

        const httpApi = createHttpApi(this, "PersonHttpApi", {
            resourceName: "http-api",
          });

          addHttpLambdaRoute(httpApi, {
            integrationId: "CreatePersonIntegration",
            path: "/person",
            method: HttpMethod.POST,
            handler: createPersonLambda,
          });
          
          addHttpLambdaRoute(httpApi, {
            integrationId: "ListPersonIntegration",
            path: "/person",
            method: HttpMethod.GET,
            handler: listPersonLambda,
          });

        new CfnOutput(this, "PersonApiBaseUrl", {
            value: httpApi.apiEndpoint,
            description: "Base URL of the Person Service HTTP API",
        });

        new CfnOutput(this, "PersonApiPersonRoute", {
            value: `${httpApi.apiEndpoint}/person`,
            description: "Full URL of the /person route",
        });

        new CfnOutput(this, "PersonTableName", {
            value: personTable.tableName,
            description: "DynamoDB table used by the Person Service",
        });
    }
}
