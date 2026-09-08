export type PersonCreatedEvent = {
    eventType: "person-created";
    publishedAt: string;
    person: {
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
}