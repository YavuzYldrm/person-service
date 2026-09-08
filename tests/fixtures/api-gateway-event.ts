import type { APIGatewayProxyEventV2 } from "aws-lambda";

export const apiGatewayEvent = (
  method: "GET" | "POST",
  body?: string,
): APIGatewayProxyEventV2 =>
  ({
    version: "2.0",
    routeKey: `${method} /person`,
    rawPath: "/person",
    rawQueryString: "",
    headers: {},
    requestContext: {
      accountId: "test-account",
      apiId: "test-api",
      domainName: "test.execute-api.eu-west-1.amazonaws.com",
      domainPrefix: "test",
      http: {
        method,
        path: "/person",
        protocol: "HTTP/1.1",
        sourceIp: "127.0.0.1",
        userAgent: "vitest",
      },
      requestId: "request-id",
      routeKey: `${method} /person`,
      stage: "$default",
      time: "07/Sep/2026:10:00:00 +0000",
      timeEpoch: 1788775200000,
    },
    body,
    isBase64Encoded: false,
  }) as APIGatewayProxyEventV2;
