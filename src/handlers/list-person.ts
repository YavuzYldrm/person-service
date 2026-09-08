import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import type { ListPersonResponseDto } from "../dto/list-person-response.dto";
import { listPersons } from "../services/person-service";
import { internalServerError, ok } from "../utils/http-response";
import { logger, toErrorLogContext } from "../utils/logger";

export const listPersonHandler: APIGatewayProxyHandlerV2 = async (event) => {
  const requestId = event.requestContext.requestId;

  try {
    const response: ListPersonResponseDto = await listPersons();

    logger.info("Persons listed", {
      operation: "listPersons",
      requestId,
      personCount: response.length,
    });

    return ok(response);
  } catch (error) {
    logger.error("Unexpected error while listing persons", {
      operation: "listPersons",
      requestId,
      ...toErrorLogContext(error),
    });
    return internalServerError();
  }
};
