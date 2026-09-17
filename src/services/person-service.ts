import type { CreatePersonRequestDto } from "../validation/create-person.schema";
import type { CreatePersonResponseDto } from "../dto/create-person-response.dto";
import type { ListPersonResponseDto } from "../dto/list-person-response.dto";
import type { PersonItem } from "../dto/person-item.type";
import { listPersons as listPersonItems, savePerson } from "../repository/person-repository";
import { toListPersonResponseDto } from "../mappers/person.mapper";
import { randomUUID } from "node:crypto";

const generatePersonId = (): string => {
    return randomUUID();
  };

const nowIso = (): string => {
  return new Date().toISOString();
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

  return { id };
};

export const listPersons = async (): Promise<ListPersonResponseDto> => {
  const personItems = await listPersonItems();

  return toListPersonResponseDto(personItems);
};
