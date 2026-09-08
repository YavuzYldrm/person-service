import { PublishCommand, SNSClient } from "@aws-sdk/client-sns";
import type { PersonCreatedEvent } from "../dto/person-created-event.dto";

const snsClient = new SNSClient({
    maxAttempts: 3,
});

export const publishPersonCreated = async (event: PersonCreatedEvent): Promise<void> => {
    const topicArn = process.env.PERSON_CREATED_TOPIC_ARN;

    if(!topicArn) {
        throw new Error("PERSON_CREATED_TOPIC_ARN environment variable is not defined");
    }

    await snsClient.send(
        new PublishCommand({
            TopicArn: topicArn,
            Message: JSON.stringify(event),
    }));};





