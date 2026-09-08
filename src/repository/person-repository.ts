import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, ScanCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import type { PersonItem } from "../dto/person-item.type";

const tableName = process.env.PERSON_TABLE_NAME;

type EventPublishFailure = {
    failedAt: string;
    errorMessage?: string;
  };

if(!tableName) { throw new Error("PERSON_TABLE_NAME environment variable is not defined"); }

const dynamoDbClient = new DynamoDBClient({});
const documentClient = DynamoDBDocumentClient.from(dynamoDbClient);

export const savePerson = async (person: PersonItem): Promise<void> => {
    await documentClient.send(new PutCommand({
        TableName: tableName,
        Item: person,
        ConditionExpression: "attribute_not_exists(id)", // Ensure that the item does not already exist
    }));
}

export const listPersons = async (): Promise<PersonItem[]> => {
    const result = await documentClient.send(new ScanCommand({
        TableName: tableName,
    }));

    return (result.Items ?? []) as PersonItem[];
}

export const saveEventPublishFailure = async (
    personId: string,
    failure: EventPublishFailure,
  ): Promise<void> => {
    await documentClient.send(
      new UpdateCommand({
        TableName: tableName,
        Key: {
          id: personId,
        },
        UpdateExpression: "SET eventPublishFailure = :eventPublishFailure",
        ExpressionAttributeValues: {
          ":eventPublishFailure": failure,
        },
        ConditionExpression: "attribute_exists(id)",
      }),
    );
  };