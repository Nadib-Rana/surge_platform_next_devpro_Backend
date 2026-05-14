/**
 * src/common/exceptions/http.exceptions.ts
 *
 * Collection of reusable HTTP exceptions extending BaseException.
 * Each exception provides:
 * - message
 * - error code
 * - optional validation errors
 * - optional instruction for frontend
 * - optional details for debugging
 */

import { HttpStatus } from "@nestjs/common";
import { BaseException } from "./base.exception";
import { ErrorDetail } from "../dto/api-error-response.dto";

// ------------------------------------------------
// 400 - Bad Request
// ------------------------------------------------
export class BadRequestException extends BaseException {
  constructor(
    message: string = "Bad request",
    code: string = "BAD_REQUEST",
    errors?: ErrorDetail[],
    instruction?: string,
    details?: unknown,
  ) {
    super(message, HttpStatus.BAD_REQUEST, code, errors, instruction, details);
  }
}

// ------------------------------------------------
// 401 - Unauthorized
// ------------------------------------------------
export class UnauthorizedException extends BaseException {
  constructor(
    message: string = "Authentication required",
    isVerified?: boolean,
    code: string = "AUTHENTICATION_ERROR",
    errors?: ErrorDetail[],
    instruction?: string,
    details?: unknown,
  ) {
    super(
      message,
      HttpStatus.UNAUTHORIZED,
      code,
      errors,
      instruction,
      details,
      isVerified,
    );
  }
}

// ------------------------------------------------
// 403 - Forbidden
// ------------------------------------------------
export class ForbiddenException extends BaseException {
  constructor(
    message: string = "Insufficient permissions",
    code: string = "AUTHORIZATION_ERROR",
    errors?: ErrorDetail[],
    instruction?: string,
    details?: unknown,
  ) {
    super(message, HttpStatus.FORBIDDEN, code, errors, instruction, details);
  }
}

// ------------------------------------------------
// 404 - Not Found
// ------------------------------------------------
export class NotFoundException extends BaseException {
  constructor(
    resource: string = "Resource",
    message?: string,
    errors?: ErrorDetail[],
    instruction?: string,
    details?: unknown,
  ) {
    super(
      message ?? `${resource} not found`,
      HttpStatus.NOT_FOUND,
      "NOT_FOUND",
      errors,
      instruction,
      details,
    );
  }
}

// ------------------------------------------------
// 409 - Conflict
// ------------------------------------------------
export class ConflictException extends BaseException {
  constructor(
    message: string = "Resource conflict",
    code: string = "CONFLICT_ERROR",
    errors?: ErrorDetail[],
    instruction?: string,
    details?: unknown,
  ) {
    super(message, HttpStatus.CONFLICT, code, errors, instruction, details);
  }
}

// ------------------------------------------------
// 413 - Payload Too Large
// ------------------------------------------------
export class PayloadTooLargeException extends BaseException {
  constructor(
    message: string = "Payload too large",
    code: string = "PAYLOAD_TOO_LARGE",
    errors?: ErrorDetail[],
    instruction?: string,
    details?: unknown,
  ) {
    super(
      message,
      HttpStatus.PAYLOAD_TOO_LARGE,
      code,
      errors,
      instruction,
      details,
    );
  }
}

// ------------------------------------------------
// 429 - Too Many Requests
// ------------------------------------------------
export class RateLimitException extends BaseException {
  constructor(
    message: string = "Too many requests",
    code: string = "RATE_LIMIT_ERROR",
    errors?: ErrorDetail[],
    instruction?: string,
    details?: unknown,
  ) {
    super(
      message,
      HttpStatus.TOO_MANY_REQUESTS,
      code,
      errors,
      instruction,
      details,
    );
  }
}

// ------------------------------------------------
// 500 - Internal Server Error
// ------------------------------------------------
export class InternalServerException extends BaseException {
  constructor(
    message: string = "Internal server error",
    code: string = "INTERNAL_ERROR",
    errors?: ErrorDetail[],
    instruction?: string,
    details?: unknown,
  ) {
    super(
      message,
      HttpStatus.INTERNAL_SERVER_ERROR,
      code,
      errors,
      instruction,
      details,
    );
  }
}

// ------------------------------------------------
// 502 - External Service Error
// ------------------------------------------------
export class ExternalServiceException extends BaseException {
  constructor(
    message: string = "External service error",
    code: string = "EXTERNAL_SERVICE_ERROR",
    errors?: ErrorDetail[],
    instruction?: string,
    details?: unknown,
  ) {
    super(message, HttpStatus.BAD_GATEWAY, code, errors, instruction, details);
  }
}

// ------------------------------------------------
// 504 - Timeout
// ------------------------------------------------
export class TimeoutException extends BaseException {
  constructor(
    message: string = "Request timeout",
    code: string = "TIMEOUT_ERROR",
    errors?: ErrorDetail[],
    instruction?: string,
    details?: unknown,
  ) {
    super(
      message,
      HttpStatus.REQUEST_TIMEOUT,
      code,
      errors,
      instruction,
      details,
    );
  }
}
