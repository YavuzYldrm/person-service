import { z } from "zod";

const e164PhoneNumberSchema = z
  .string()
  .trim()
  .transform((value) => value.replace(/[\s\-()]/g, ""))
  .refine((value) => /^\+[1-9]\d{1,14}$/.test(value), {
    message: "phoneNumber must be in E.164 format",
  });

const postalCodeSchema = z
  .string()
  .trim()
  .transform((value) => value.replace(/\s+/g, "").toUpperCase())
  .refine((value) => /^[A-Z0-9]{3,12}$/.test(value), {
    message: "postalCode must contain only letters and numbers",
  });

const addressSchema = z.strictObject({
  street: z.string().trim().min(1,"Street is required").max(100),
  number: z.string().trim().min(1,"Number is required").max(10),
  city: z.string().trim().min(1,"City is required").max(50),
  country: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2}$/, "Country must be a 2-letter code"),
  postcode: postalCodeSchema,
});

export const createPersonSchema = z.strictObject({
  firstName: z.string().trim().min(1,"First name is required").max(50),
  lastName: z.string().trim().min(1,"Last name is required").max(50),
  phoneNumber: e164PhoneNumberSchema,
  address: addressSchema,
});

export type CreatePersonRequestDto = z.infer<typeof createPersonSchema>;
