import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { personCreatedEvent } from "../../fixtures/person";

const mocks = vi.hoisted(() => {
  const send = vi.fn();
  const state: { clientConfig?: unknown } = {};

  return {
    send,
    state,
    SNSClient: vi.fn(function (config: unknown) {
      state.clientConfig = config;
      return { send };
    }),
    PublishCommand: vi.fn(function (input: unknown) {
      return { input };
    }),
  };
});

vi.mock("@aws-sdk/client-sns", () => ({
  SNSClient: mocks.SNSClient,
  PublishCommand: mocks.PublishCommand,
}));

import { publishPersonCreated } from "../../../src/publisher/person-event-publisher";

describe("person event publisher", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.PERSON_CREATED_TOPIC_ARN = "arn:aws:sns:eu-west-1:111111111111:person-created";
    mocks.send.mockResolvedValue({ MessageId: "message-id" });
  });

  afterEach(() => {
    delete process.env.PERSON_CREATED_TOPIC_ARN;
  });

  it("configures the SNS client with three maximum attempts", () => {
    expect(mocks.state.clientConfig).toEqual({ maxAttempts: 3 });
  });

  it("publishes the serialized event to the configured topic", async () => {
    await publishPersonCreated(personCreatedEvent);

    expect(mocks.PublishCommand).toHaveBeenCalledWith({
      TopicArn: "arn:aws:sns:eu-west-1:111111111111:person-created",
      Message: JSON.stringify(personCreatedEvent),
    });
    expect(mocks.send).toHaveBeenCalledWith({
      input: {
        TopicArn: "arn:aws:sns:eu-west-1:111111111111:person-created",
        Message: JSON.stringify(personCreatedEvent),
      },
    });
  });

  it("rejects when the topic ARN is not configured", async () => {
    delete process.env.PERSON_CREATED_TOPIC_ARN;

    await expect(publishPersonCreated(personCreatedEvent)).rejects.toThrow(
      "PERSON_CREATED_TOPIC_ARN environment variable is not defined",
    );
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it("propagates an SNS client error", async () => {
    const error = new Error("SNS unavailable");
    mocks.send.mockRejectedValue(error);

    await expect(publishPersonCreated(personCreatedEvent)).rejects.toBe(error);
  });
});
