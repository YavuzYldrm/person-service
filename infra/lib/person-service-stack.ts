import { CfnOutput, CfnParameter, Duration, RemovalPolicy, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { StageConfig } from "../config/stage-config";
import { FilterCriteria, FilterRule, StartingPosition } from "aws-cdk-lib/aws-lambda";
import { HttpApi, HttpMethod } from "aws-cdk-lib/aws-apigatewayv2";
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import { DynamoEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
import { CoreServiceStack, createDynamoTable, createNodejsFunction } from "core-cdk";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as sns from "aws-cdk-lib/aws-sns";
import * as path from "node:path";
import * as subscriptions from "aws-cdk-lib/aws-sns-subscriptions";
import * as cloudwatch from "aws-cdk-lib/aws-cloudwatch";
import * as cloudwatchActions from "aws-cdk-lib/aws-cloudwatch-actions";



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

        // const personTable = new dynamodb.Table(this, "PersonTable", {
        //     tableName: `${baseName}-person-table`,
        //     partitionKey: { name: "id", type: dynamodb.AttributeType.STRING },
        //     billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
        //     removalPolicy: RemovalPolicy.DESTROY,
        //     stream: dynamodb.StreamViewType.NEW_IMAGE,
        // });

        const personTable = createDynamoTable(this, "PersonTable", {
            resourceName: "person-table",
            partitionKey: {
              name: "id",
              type: dynamodb.AttributeType.STRING,
            },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            stream: dynamodb.StreamViewType.NEW_IMAGE,
        });

        const personCreatedTopic = new sns.Topic(this, "PersonCreatedTopic", {
            topicName: `${baseName}-person-created-topic.fifo`,
            displayName: "Person Created Topic",
            fifo: true,
            contentBasedDeduplication: false,
        });

        const alertEmail = new CfnParameter(this, "AlertEmail", {
            type: "String",
            description: "Email address to receive alerts for person-created events",
        });

        const publisherAlertTopic = new sns.Topic(
            this, "PublisherAlertTopic", {
                topicName: `${baseName}-publisher-alert-topic`,
                displayName: "Publisher Alert Topic",
            }
        );

        publisherAlertTopic.applyRemovalPolicy(RemovalPolicy.DESTROY);

        publisherAlertTopic.addSubscription(
            new subscriptions.EmailSubscription(alertEmail.valueAsString)
        );

        personCreatedTopic.applyRemovalPolicy(RemovalPolicy.DESTROY);

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

        // const createPersonLambda = new NodejsFunction(this, "CreatePersonLambda", {
        //     functionName: `${baseName}-create-person`,
        //     entry: path.join(__dirname, "../../src/handlers/create-person.ts"),
        //     handler: "createPersonHandler",
        //     runtime: Runtime.NODEJS_24_X,
        //     environment: {
        //         PERSON_TABLE_NAME: personTable.tableName,
        //     },
        // });

        // const listPersonLambda = new NodejsFunction(this, "ListPersonLambda", {
        //     functionName: `${baseName}-list-person`,
        //     runtime: Runtime.NODEJS_24_X,
        //     entry: path.join(__dirname, "../../src/handlers/list-person.ts"),
        //     handler: "listPersonHandler",
        //     environment: {
        //       PERSON_TABLE_NAME: personTable.tableName,
        //     },
        //   });

        // const publishPersonCreatedLambda = new NodejsFunction(this, "PublishPersonCreatedLambda", {
        //     functionName: `${baseName}-publish-person-created`,
        //     runtime: Runtime.NODEJS_24_X,
        //     entry: path.join(__dirname, "../../src/handlers/publish-person-created.ts"),
        //     handler: "publishPersonCreatedHandler",
        //     environment: {
        //         PERSON_CREATED_TOPIC_ARN: personCreatedTopic.topicArn,
        //     },
        // });

        const publisherErrorAlarm = new cloudwatch.Alarm(
            this,
            "PublisherErrorAlarm",
            {
                alarmName: `${baseName}-publisher-errors`,
                alarmDescription: "Alerts when the Publisher Lambda fails to publish a person-created event to SNS",
                threshold: 1,
                metric: publishPersonCreatedLambda.metricErrors({
                    period: Duration.minutes(1),
                    statistic: "Sum",
                }),
                evaluationPeriods: 1,
                datapointsToAlarm: 1,
                comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
                treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING, 
            }
        );

        publisherErrorAlarm.addAlarmAction( new cloudwatchActions.SnsAction(publisherAlertTopic));

        personTable.grant(
            createPersonLambda,
            "dynamodb:PutItem",
        );
        personTable.grantReadData(listPersonLambda);

        personCreatedTopic.grantPublish(publishPersonCreatedLambda);

        publishPersonCreatedLambda.addEventSource(
            new DynamoEventSource(personTable, {
                startingPosition: StartingPosition.LATEST,
                batchSize: 1,
                filters: [FilterCriteria.filter({
                    eventName: FilterRule.isEqual("INSERT"),
                })]
            })
        );

        const httpApi = new HttpApi(this, "PersonHttpApi", {
            apiName: `${baseName}-http-api`,
        });

        const createPersonIntegration = new HttpLambdaIntegration("CreatePersonIntegration", createPersonLambda);
        const listPersonIntegration = new HttpLambdaIntegration("ListPersonIntegration", listPersonLambda);

        httpApi.addRoutes({
            path: "/person",
            methods: [HttpMethod.POST],
            integration: createPersonIntegration,
        });

        httpApi.addRoutes({
            path: "/person",
            methods: [HttpMethod.GET],
            integration: listPersonIntegration,
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
