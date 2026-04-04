// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  const rawMessage = err?.message || "Internal Server Error";
  const normalizedMessage = String(rawMessage).toLowerCase();

  const isTransientDbError =
    normalizedMessage.includes("failed to connect to upstream database") ||
    normalizedMessage.includes("can't reach database server") ||
    normalizedMessage.includes("timed out fetching a new connection") ||
    normalizedMessage.includes("connection terminated unexpectedly") ||
    normalizedMessage.includes("econnreset") ||
    normalizedMessage.includes("econnrefused");

  const statusCode = isTransientDbError ? 503 : err.statusCode || 500;
  const message = isTransientDbError
    ? "Database is temporarily unavailable. Please retry in a few seconds."
    : rawMessage;

  console.error(`Error: ${message}, Status Code: ${statusCode}`);

  res.status(statusCode).json({
    success: err.success ?? false,
    error: message,
    ...(err.code ? { code: err.code } : {}),
  });
}
