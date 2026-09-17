import type { AttributeValue } from "@aws-sdk/client-dynamodb";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import type { DynamoDBRecord, DynamoDBStreamHandler } from "aws-lambda";

import type { PersonCreatedEvent } from "../dto/person-created-event.dto";
import { publishPersonCreated} from "../publisher/person-event-publisher";
import { logger, toErrorLogContext} from "../utils/logger";
import { personItemSchema } from "../validation/person-item.schema";

const getPersonFromRecord = (record: DynamoDBRecord) => {
    const newImage = record.dynamodb?.NewImage;

    if(!newImage) {
        throw new Error(
            "DynamoDB INSERT record does not contain new image."
        )
    }

    const rawPerson = unmarshall(newImage as unknown as Record<string, AttributeValue>);

    return personItemSchema.parse(rawPerson);
}

export const publishPersonCreatedHandler: DynamoDBStreamHandler = async (
    event,
) => {
    for (const record of event.Records) {
        if(record.eventName !== "INSERT") {
            continue;
        }

        if (!record.eventID) {
            throw new Error(
                "DynamoDB Stream record does not contain eventID",
            );
        }

        const person = getPersonFromRecord(record);
        const personCreatedEvent: PersonCreatedEvent = {
            eventId: record.eventID,
            eventType: "person-created",
            publishedAt: new Date().toISOString(),
            person,
        };

        try {
            await publishPersonCreated(personCreatedEvent);
        } catch(error) {
            logger.error("Failed to publish person-created event", {operation: "publishPersonCreated",
                personId: person.id,
                streamEventId: record.eventID,
                ...toErrorLogContext(error),
              });
              throw error;
    }
}};
