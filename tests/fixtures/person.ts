import type { PersonCreatedEvent } from "../../src/dto/person-created-event.dto";
import type { PersonItem } from "../../src/dto/person-item.type";
import type { CreatePersonRequestDto } from "../../src/validation/create-person.schema";

export const personId = "de305d54-75b4-431b-adb2-eb6b9e546014";
export const streamEventId = "stream-event-id";
export const createdAt = "2026-09-07T10:00:00.000Z";

export const validCreatePersonRequest: CreatePersonRequestDto = {
  firstName: "Ada",
  lastName: "Lovelace",
  phoneNumber: "+31612345678",
  address: {
    street: "Dam Square",
    number: "4",
    city: "Amsterdam",
    country: "NL",
    postcode: "1012CA",
  },
};

export const personItem: PersonItem = {
  id: personId,
  ...validCreatePersonRequest,
  createdAt,
};

export const personCreatedEvent: PersonCreatedEvent = {
  eventId: streamEventId,
  eventType: "person-created",
  publishedAt: createdAt,
  person: personItem,
};
