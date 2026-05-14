/**
 * src/common/dto/api-error-response.dto.ts
 */

export class ErrorDetail {
  code: string;
  message: string;
  field?: string;
}

export class ApiErrorResponseDto {
  readonly success: boolean = false;
  readonly statusCode: number;
  readonly message: string;
  readonly requestId: string | null;
  readonly timestamp: string;
  readonly path: string;
  readonly errors: ErrorDetail[];
  readonly instruction?: string;
  readonly details?: unknown;
  readonly stack?: string;

  readonly isVerified?: boolean;

  constructor(
    statusCode: number,
    message: string,
    errors: ErrorDetail[],
    path: string,
    requestId: string | null,
    instruction?: string,
    details?: unknown,
    stack?: string,
    isVerified?: boolean,
  ) {
    this.statusCode = statusCode;
    this.message = message;
    this.errors = errors;
    this.path = path;
    this.requestId = requestId;
    this.timestamp = new Date().toISOString();
    this.instruction = instruction;
    this.details = details;
    this.stack = stack;

    this.isVerified = isVerified;
  }
}
