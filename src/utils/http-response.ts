type ErrorDetail = {
    field?: string;
    message: string;
}

type ErrorResponse = {
    message: string;
    errors: ErrorDetail[];
}

export const jsonResponse = (statusCode: number, body: unknown) => {
    return {
        statusCode,
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    };
};

export const ok = (body: unknown) => jsonResponse(200, body);

export const created = (body: unknown) => jsonResponse(201, body);

export const badRequest = (message: string, errors: ErrorDetail[] = []) => {
    const responseBody: ErrorResponse = {
        message,
        errors,
    };
    return jsonResponse(400, responseBody);
}

export const internalServerError = () => {
    const responseBody: ErrorResponse = {
        message: 'Internal Server Error',
        errors: [],
    };
    return jsonResponse(500, responseBody);
}