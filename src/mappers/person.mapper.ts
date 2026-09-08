import type { PersonItem } from "../dto/person-item.type";
import type { PersonResponseDto } from "../dto/person-response.dto";

export const toPersonResponseDto = (personItem: PersonItem): PersonResponseDto => {
  return {
    id: personItem.id,
    firstName: personItem.firstName,
    lastName: personItem.lastName,
    phoneNumber: personItem.phoneNumber,
    address: {
      street: personItem.address.street,
      number: personItem.address.number,
      city: personItem.address.city,
      country: personItem.address.country,
      postcode: personItem.address.postcode,
    },
    createdAt: personItem.createdAt,
  };
};

export const toListPersonResponseDto = (
  personItems: PersonItem[],
): PersonResponseDto[] => {
  return personItems.map(toPersonResponseDto);
};