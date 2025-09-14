import { Request, Response, NextFunction } from "express";
import config from "../config/environment";

export interface ApiError extends Error {
  statusCode?: number;
  code?: string;
  details?: unknown;
}

export class CustomError extends Error implements ApiError {
  public statusCode: number;
  public code: string;
  public details?: unknown;

  constructor(
    message: string,
    statusCode: number = 500,
    code: string = "INTERNAL_ERROR",
    details?: unknown
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.name = this.constructor.name;

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

// Specific error classes
export class ValidationError extends CustomError {
  constructor(message: string, details?: unknown) {
    super(message, 400, "VALIDATION_ERROR", details);
  }
}

export class AuthenticationError extends CustomError {
  constructor(message: string = "Authentication failed") {
    super(message, 401, "AUTH_ERROR");
  }
}

export class AuthorizationError extends CustomError {
  constructor(message: string = "Access denied") {
    super(message, 403, "AUTHORIZATION_ERROR");
  }
}

export class NotFoundError extends CustomError {
  constructor(message: string = "Resource not found") {
    super(message, 404, "NOT_FOUND");
  }
}

export class ConflictError extends CustomError {
  constructor(message: string, details?: unknown) {
    super(message, 409, "CONFLICT_ERROR", details);
  }
}

// Global error handler middleware
export const errorHandler = (
  error: ApiError,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  let statusCode = error.statusCode || 500;
  let code = error.code || "INTERNAL_ERROR";
  let message = error.message || "Internal server error";
  let details = error.details;

  // Handle Mongoose validation errors
  if (error.name === "ValidationError") {
    statusCode = 400;
    code = "VALIDATION_ERROR";
    message = "Validation failed";
    details = error.details || error.message;
  }

  // Handle Mongoose cast errors (invalid ObjectId)
  if (error.name === "CastError") {
    statusCode = 400;
    code = "INVALID_ID";
    message = "Invalid ID format";
  }

  // Handle MongoDB duplicate key errors
  if (
    error.name === "MongoServerError" &&
    (error as unknown as { code: number }).code === 11000
  ) {
    statusCode = 409;
    code = "DUPLICATE_ERROR";
    message = "Resource already exists";
    const mongoError = error as unknown as {
      keyValue: Record<string, unknown>;
    };
    const field = Object.keys(mongoError.keyValue)[0];
    details = { field, value: mongoError.keyValue[field] };
  }

  // Handle JWT errors
  if (error.name === "JsonWebTokenError") {
    statusCode = 401;
    code = "INVALID_TOKEN";
    message = "Invalid token";
  }

  if (error.name === "TokenExpiredError") {
    statusCode = 401;
    code = "TOKEN_EXPIRED";
    message = "Token expired";
  }

  // Log error details
  const errorLog = {
    timestamp: new Date().toISOString(),
    method: req.method,
    url: req.url,
    statusCode,
    code,
    message,
    details,
    stack: config.nodeEnv === "development" ? error.stack : undefined,
    ip: req.ip,
    userAgent: req.get("User-Agent"),
  };

  if (statusCode >= 500) {
    console.error("Server Error:", JSON.stringify(errorLog, null, 2));
  } else if (config.nodeEnv === "development") {
    console.warn("Client Error:", JSON.stringify(errorLog, null, 2));
  }

  // Send error response
  const errorResponse = {
    success: false,
    error: {
      code,
      message,
      ...(details && typeof details === 'object' && details !== null ? { details } : {}),
      ...(config.nodeEnv === "development" &&
        statusCode >= 500 && { stack: error.stack }),
    },
  };

  res.status(statusCode).json(errorResponse);
};

// 404 handler for unmatched routes
export const notFoundHandler = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  const error = new NotFoundError(`Route ${req.method} ${req.url} not found`);
  next(error);
};
