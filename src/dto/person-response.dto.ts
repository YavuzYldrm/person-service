export type PersonResponseDto = {
    id: string;
    firstName: string;
    lastName: string;
    phoneNumber: string;
    address: {
        street: string;
        number: string;
        city: string;
        country: string;
        postcode: string;
    };
    createdAt: string;
}