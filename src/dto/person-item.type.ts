export type PersonItem = {
    id:string;
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
    eventPublishFailure?: {
        failedAt: string;
        errorMessage?: string;
    };
}