/**
 * src/common/filters/all-exceptions.filter.ts
 * * This is the global exception filter. It catches ALL exceptions
 * * UPDATED: Now passes 'instruction', 'details',
 * * and conditionally 'stack'.
 */
import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  BadRequestException,
} from "@nestjs/common";
import { HttpAdapterHost } from "@nestjs/core";
import { Request } from "express";
import { ContextService } from "../context/context.service";
import {
  ApiErrorResponseDto,
  ErrorDetail,
} from "../dto/api-error-response.dto";
import { getPrismaError } from "../exceptions/prisma-error.helper";
import { BaseException } from "../exceptions/base.exception"; // <-- Import BaseException

// --- Type definitions for better type safety ---

/**
 * Interface for the object returned by *our BaseException's*
 * getResponse() method.
 */
interface HttpExceptionResponse {
  message: string | string[];
  code?: string;
  errors?: ErrorDetail[];
  instruction?: string; // <-- Support instruction
  details?: unknown;
  isVerified?: boolean; // <-- Support details
  // <-- REMOVED the [key: string]: unknown index signature
}

/**
 * A simplified interface for class-validator's ValidationError.
 */
interface SimpleValidationError {
  property: string;
  constraints?: { [type: string]: string };
  children?: SimpleValidationError[];
}

/**
 * Shape of a PrismaClientKnownRequestError.
 */
interface PrismaErrorInterface {
  code: string;
  message: string;
  stack?: string;
  meta?: { target?: string[] };
}

/**
 * Type guard to check if an exception is a Prisma error.
 * This is more robust than a dynamic import.
 */
function isPrismaError(exception: unknown): exception is PrismaErrorInterface {
  return (
    typeof exception === "object" &&
    exception !== null &&
    (exception as Error).constructor?.name ===
      "PrismaClientKnownRequestError" &&
    typeof (exception as PrismaErrorInterface).code === "string"
  );
}

@Catch() // <-- Catches ALL exceptions
@Injectable()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(
    private readonly httpAdapterHost: HttpAdapterHost,
    private readonly contextService: ContextService,
  ) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const { httpAdapter } = this.httpAdapterHost;
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const path = request.url;
    const requestId = this.contextService.getRequestId() || null;
    const stack = (exception as Error)?.stack; // <-- Get stack trace early

    let httpStatus: HttpStatus = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string = "Internal Server Error";
    let errors: ErrorDetail[] = [];
    let instruction: string | undefined = undefined; // <-- ADDED THIS
    let details: unknown = undefined; // <-- CHANGED to just 'unknown'
    let isVerified: boolean | undefined = undefined;

    // --- Logic to handle different exception types ---

    if (exception instanceof BaseException) {
      // 1. (NEW) Handle our custom BaseException
      // This gives us full control over the error response
      httpStatus = exception.getStatus();
      const response = exception.getResponse() as HttpExceptionResponse;
      message = response.message as string;

      instruction = response.instruction;
      details = response.details;
      isVerified = response.isVerified;

      errors =
        response.errors ||
        (response.message
          ? [
              {
                code: response.code || exception.name,
                message: response.message as string,
              },
            ]
          : []);
      instruction = response.instruction; // <-- CAPTURE INSTRUCTION
      details = response.details; // <-- CAPTURE DETAILS
    } else if (exception instanceof HttpException) {
      // 2. Handle standard NestJS HTTP Exceptions
      httpStatus = exception.getStatus();
      // Get response without casting. Type is (string | object)
      const response = exception.getResponse();

      // --- Type guard for class-validator response ---
      const isClassValidatorResponse = (
        res: unknown,
      ): res is { message: unknown[] } =>
        typeof res === "object" &&
        res !== null &&
        "message" in res &&
        Array.isArray((res as { message: unknown[] }).message);

      // --- Type guard for generic object response ---
      const isGenericErrorResponse = (
        res: unknown,
      ): res is Record<string, unknown> =>
        typeof res === "object" && res !== null;

      if (
        exception instanceof BadRequestException &&
        isClassValidatorResponse(response)
      ) {
        // 2a. Handle class-validator Validation Errors
        message = "Validation Failed";
        errors = this.buildValidationErrors(
          response.message as unknown as SimpleValidationError[],
        );
      } else if (typeof response === "string") {
        // 2b. Handle simple string HTTP exceptions
        message = response;
        errors = [{ code: exception.name, message: response }];
      } else if (isGenericErrorResponse(response)) {
        // 2c. Handle other object-based HTTP exceptions
        // Safely access properties from the 'unknown' record
        const responseMessage = response.message;
        if (Array.isArray(responseMessage)) {
          message = responseMessage.join(", ");
        } else if (typeof responseMessage === "string") {
          message = responseMessage;
        } else {
          message = exception.name;
        }

        const responseCode =
          typeof response.code === "string" ? response.code : exception.name;

        const errorMessage = Array.isArray(responseMessage)
          ? responseMessage.join(", ")
          : typeof responseMessage === "string"
            ? responseMessage
            : "An unexpected error occurred";

        errors = [
          {
            code: responseCode,
            message: errorMessage,
          },
        ];
      }
    } else if (isPrismaError(exception)) {
      // 3. Handle Prisma (Database) Errors
      const prismaError = getPrismaError(exception.code);
      if (prismaError) {
        httpStatus = prismaError.status;
        message = prismaError.message;
        errors = [
          {
            code: `DB_${exception.code}`,
            message: prismaError.message, // Use the friendly message
            field: exception.meta?.target?.join("."),
          },
        ];
      } else {
        // Unhandled Prisma error
        httpStatus = HttpStatus.INTERNAL_SERVER_ERROR;
        message = "An unhandled database error occurred.";
        errors = [
          { code: `DB_UNKNOWN_${exception.code}`, message: exception.message },
        ];
      }
      this.logger.error(
        `Prisma Error: ${exception.code} | Message: ${exception.message}`,
        exception.stack,
        `RequestID: ${requestId}`,
      );
    } else if (exception instanceof Error) {
      // 4. Handle generic Javascript Errors
      message = exception.message;
      errors = [
        { code: exception.name || "Error", message: exception.message },
      ];
      this.logger.error(
        `Generic Error: ${message}`,
        exception.stack,
        `RequestID: ${requestId}`,
      );
    } else {
      // 5. Handle all other unknown exceptions
      message = "An unknown error occurred.";
      errors = [
        { code: "UNKNOWN_ERROR", message: "An unknown error occurred." },
      ];
      this.logger.error(
        "Unknown exception caught",
        exception,
        `RequestID: ${requestId}`,
      );
    }

    // --- Log the error (except for 404s, which are common) ---
    if (httpStatus !== HttpStatus.NOT_FOUND) {
      this.logger.error(
        `[${requestId}] ${httpStatus} ${message} - ${path}`,
        stack ?? JSON.stringify(exception), // Use the captured stack
      );
    }

    // --- Build and send the final response ---
    const responseBody = new ApiErrorResponseDto(
      httpStatus,
      message,
      errors,
      path,
      requestId,
      instruction, // <-- PASS INSTRUCTION
      details, // <-- PASS DETAILS
      process.env.NODE_ENV !== "production" ? stack : undefined, // <-- PASS CONDITIONAL STACK
      isVerified,
    );

    httpAdapter.reply(ctx.getResponse(), responseBody, httpStatus);
  }

  /**
   * Helper to transform class-validator errors into our ErrorDetail format.
   */
  private buildValidationErrors(
    validationErrors: SimpleValidationError[],
  ): ErrorDetail[] {
    const errors: ErrorDetail[] = [];

    const traverseErrors = (
      err: SimpleValidationError,
      parentField?: string,
    ) => {
      const field = parentField
        ? `${parentField}.${err.property}`
        : err.property;

      if (err.constraints) {
        for (const key of Object.keys(err.constraints)) {
          errors.push({
            code: "VALIDATION_ERROR",
            message: err.constraints[key],
            field: field,
          });
        }
      }

      if (err.children && err.children.length > 0) {
        for (const child of err.children) {
          traverseErrors(child, field);
        }
      }
    };

    for (const error of validationErrors) {
      traverseErrors(error);
    }

    return errors;
  }
}
