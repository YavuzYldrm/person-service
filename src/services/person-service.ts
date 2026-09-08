import type { CreatePersonRequestDto } from "../validation/create-person.schema";
import type { CreatePersonResponseDto } from "../dto/create-person-response.dto";
import type { ListPersonResponseDto } from "../dto/list-person-response.dto";
import type { PersonCreatedEvent } from "../dto/person-created-event.dto";
import type { PersonItem } from "../dto/person-item.type";
import { listPersons as listPersonItems, saveEventPublishFailure, savePerson } from "../repository/person-repository";
import { toListPersonResponseDto } from "../mappers/person.mapper";
import { publishPersonCreated } from "../publisher/person-event-publisher";
import { randomUUID } from "node:crypto";
import { logger, toErrorLogContext } from "../utils/logger";

const generatePersonId = (): string => {
    return randomUUID();
  };

const nowIso = (): string => {
  return new Date().toISOString();
};

const toErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }

  return "Unknown publish error";
};

export const createPerson = async (
  input: CreatePersonRequestDto,
): Promise<CreatePersonResponseDto> => {
  const id = generatePersonId();
  const createdAt = nowIso();

  const personItem: PersonItem = {
    id,
    firstName: input.firstName,
    lastName: input.lastName,
    phoneNumber: input.phoneNumber,
    address: input.address,
    createdAt,
  };

  await savePerson(personItem);

  const personCreatedEvent: PersonCreatedEvent = {
    eventType: "person-created",
    publishedAt: nowIso(),
    person: {
      id: personItem.id,
      firstName: personItem.firstName,
      lastName: personItem.lastName,
      phoneNumber: personItem.phoneNumber,
      address: personItem.address,
      createdAt: personItem.createdAt,
    },
  };

  try {
    await publishPersonCreated(personCreatedEvent);
  } catch (error) {
    logger.error("Failed to publish person-created event", {
      operation: "publishPersonCreated",
      personId: id,
      ...toErrorLogContext(error),
    });

    try {
      await saveEventPublishFailure(id, {
        failedAt: nowIso(),
        errorMessage: toErrorMessage(error),
      });
    } catch (updateError) {
      logger.error("Unexpected error while persisting publish failure metadata", {
        operation: "saveEventPublishFailure",
        personId: id,
        ...toErrorLogContext(updateError),
      });
    }
  }

  return { id };
};

export const listPersons = async (): Promise<ListPersonResponseDto> => {
  const personItems = await listPersonItems();

  return toListPersonResponseDto(personItems);
};
