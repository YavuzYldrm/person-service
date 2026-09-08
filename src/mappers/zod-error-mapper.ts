import type { ZodError } from "zod";

export const mapZodErrors = (error: ZodError) => {
    return error.issues.map((issue) => ({
        field: issue.path.length > 0 ? issue.path.join(".") : undefined,
        message: issue.message,
    }));
};