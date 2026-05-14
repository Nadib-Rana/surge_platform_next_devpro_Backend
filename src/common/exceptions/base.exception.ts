/**
 * src/common/exceptions/base.exception.ts
 *
 * Defines the base custom exception used across the application.
 * Provides structured API error responses with:
 * - message
 * - HTTP status
 * - application error code
 * - optional field errors
 * - optional frontend instruction
 * - optional details object
 */

import { HttpException, HttpStatus } from "@nestjs/common";
import { ErrorDetail } from "../dto/api-error-response.dto";

export class BaseException extends HttpException {
  public readonly code: string;
  public readonly errors: ErrorDetail[];
  public readonly instruction?: string;
  public readonly details?: unknown;
  public readonly isVerified?: boolean;

  /**
   * Creates a structured API exception.
   *
   * @param message Human readable error message
   * @param status HTTP status code
   * @param code Application specific error code
   * @param errors Optional detailed errors
   * @param instruction Optional frontend instruction
   * @param details Optional metadata object
   */
  constructor(
    message: string,
    status: HttpStatus,
    code: string,
    errors?: ErrorDetail[],
    instruction?: string,
    details?: unknown,
    isVerified?: boolean,
  ) {
    const formattedErrors: ErrorDetail[] = errors ?? [
      {
        code,
        message,
        field: undefined,
      },
    ];

    super(
      {
        success: false,
        statusCode: status,
        message,
        code,
        errors: formattedErrors,
        instruction,
        details,
        isVerified,
      },
      status,
    );

    this.code = code;
    this.errors = formattedErrors;
    this.instruction = instruction;
    this.details = details;
    this.isVerified = isVerified;
  }
}
