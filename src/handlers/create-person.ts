import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { CreatePersonResponseDto } from "../dto/create-person-response.dto";
import { createPerson } from "../services/person-service";
import { badRequest, created, internalServerError } from "../utils/http-response";
import { createPersonSchema } from "../validation/create-person.schema";
import { mapZodErrors } from "../mappers/zod-error-mapper";
import { logger, toErrorLogContext } from "../utils/logger";

export const createPersonHandler: APIGatewayProxyHandlerV2 = async (event) => {
  const requestId = event.requestContext.requestId;

  try {
    if (!event.body) {
      return badRequest("Request body is required");
    }

    let rawBody: unknown;

    try {
      rawBody = JSON.parse(event.body);
    } catch {
      return badRequest("Invalid JSON in request body");
    }

    const validationResult = createPersonSchema.safeParse(rawBody);

    if (!validationResult.success) {
      return badRequest("Validation failed", mapZodErrors(validationResult.error));
    }

    const response: CreatePersonResponseDto = await createPerson(validationResult.data);

    logger.info("Person created", {
      operation: "createPerson",
      requestId,
      personId: response.id,
    });

    return created(response);
  } catch (error) {
    logger.error("Unexpected error while creating person", {
      operation: "createPerson",
      requestId,
      ...toErrorLogContext(error),
    });
    return internalServerError();
  }
};
