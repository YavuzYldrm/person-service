import { CfnOutput, RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { StageConfig } from "../config/stage-config";
import { Runtime } from "aws-cdk-lib/aws-lambda";
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { HttpApi, HttpMethod } from "aws-cdk-lib/aws-apigatewayv2";
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as sns from "aws-cdk-lib/aws-sns";
import * as path from "node:path";



type PersonServiceStackProps = StackProps & {
    stageConfig: StageConfig;
};

export class PersonServiceStack extends Stack {
    constructor(scope: Construct, id: string, props: PersonServiceStackProps) {
        super(scope, id , props);

        const { stageConfig } = props;
        const baseName = `${stageConfig.serviceName}-${stageConfig.stage}`;

        const personTable = new dynamodb.Table(this, "PersonTable", {
            tableName: `${baseName}-person-table`,
            partitionKey: { name: "id", type: dynamodb.AttributeType.STRING },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            removalPolicy: RemovalPolicy.DESTROY,
        });

        const personCreatedTopic = new sns.Topic(this, "PersonCreatedTopic", {
            topicName: `${baseName}-person-created-topic`,
            displayName: "Person Created Topic",
        });

        personCreatedTopic.applyRemovalPolicy(RemovalPolicy.DESTROY);

        const createPersonLambda = new NodejsFunction(this, "CreatePersonLambda", {
            functionName: `${baseName}-create-person`,
            entry: path.join(__dirname, "../../src/handlers/create-person.ts"),
            handler: "createPersonHandler",
            runtime: Runtime.NODEJS_24_X,
            environment: {
                PERSON_TABLE_NAME: personTable.tableName,
                PERSON_CREATED_TOPIC_ARN: personCreatedTopic.topicArn,
            },
        });

        const listPersonLambda = new NodejsFunction(this, "ListPersonLambda", {
            functionName: `${baseName}-list-person`,
            runtime: Runtime.NODEJS_24_X,
            entry: path.join(__dirname, "../../src/handlers/list-person.ts"),
            handler: "listPersonHandler",
            environment: {
              PERSON_TABLE_NAME: personTable.tableName,
            },
          });

        personTable.grant(
            createPersonLambda,
            "dynamodb:PutItem",
            "dynamodb:UpdateItem",
        );
        personTable.grantReadData(listPersonLambda);

        personCreatedTopic.grantPublish(createPersonLambda);

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
