import { z } from "zod";
import { createPersonSchema } from "./create-person.schema";

export const personItemSchema = createPersonSchema.extend({
    id: z.uuid(),
    createdAt: z.iso.datetime(),
});