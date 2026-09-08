type LogValue = string | number | boolean | undefined;

type LogContext = Record<string, LogValue>;

const writeLog = (
  level: "INFO" | "ERROR",
  message: string,
  context: LogContext = {},
): void => {
  const entry = JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    message,
    ...context,
  });

  if (level === "ERROR") {
    console.error(entry);
    return;
  }

  console.info(entry);
};

export const toErrorLogContext = (error: unknown): LogContext => {
  if (error instanceof Error) {
    return {
      errorName: error.name,
      errorMessage: error.message,
    };
  }

  return {
    errorName: "UnknownError",
  };
};

export const logger = {
  info: (message: string, context?: LogContext): void => {
    writeLog("INFO", message, context);
  },
  error: (message: string, context?: LogContext): void => {
    writeLog("ERROR", message, context);
  },
};
