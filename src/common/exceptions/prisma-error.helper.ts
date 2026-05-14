/**
 * src/common/exceptions/prisma-error.helper.ts
 * * This file maps Prisma error codes to HTTP status codes and messages.
 * This allows our exception filter to handle database errors gracefully.
 *
 * Full list of Prisma error codes:
 * https://www.prisma.io/docs/reference/api-reference/error-reference#error-codes
 */

import { HttpStatus } from "@nestjs/common";

// Define a structure for our error mapping
interface PrismaError {
  status: HttpStatus;
  message: string;
}

// Map Prisma error codes to our custom error structure
export const PRISMA_ERROR_MAP: Record<string, PrismaError> = {
  // Common constraint-related errors
  P2000: {
    status: HttpStatus.BAD_REQUEST,
    message: "The provided value for the column is too long.",
  },
  P2002: {
    status: HttpStatus.CONFLICT,
    message:
      "A record with this value already exists (unique constraint failed).",
  },
  P2003: {
    status: HttpStatus.CONFLICT,
    message: "Foreign key constraint failed.",
  },

  // Record not found errors
  P2014: {
    status: HttpStatus.NOT_FOUND,
    message: "The related record could not be found.",
  },
  P2018: {
    status: HttpStatus.NOT_FOUND,
    message: "The required connected records were not found.",
  },
  P2025: {
    status: HttpStatus.NOT_FOUND,
    message: "The record you tried to operate on could not be found.",
  },

  // Other errors
  P2001: {
    status: HttpStatus.NOT_FOUND,
    message: "The record searched for in the where condition does not exist.",
  },
  // Add more Prisma error codes as needed by your application
};

/**
 * Checks if a given error code is a known Prisma error code.
 * @param code The error code to check.
 * @returns A PrismaError object if found, otherwise undefined.
 */
export function getPrismaError(code: string): PrismaError | undefined {
  return PRISMA_ERROR_MAP[code];
}
