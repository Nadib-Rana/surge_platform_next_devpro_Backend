/**
 * api-response.dto.ts
 * * This DTO defines the standard structure for all successful API responses.
 */

import { PaginationMetaDto } from "./pagination.dto";

export class ApiResponseDto<T> {
  /**
   * Indicates if the request was successful.
   * @example true
   */
  readonly success: boolean;

  /**
   * The HTTP Status code.
   * @example 200
   */
  readonly statusCode: number;

  /**
   * A descriptive message about the response.
   * @example "Users fetched successfully"
   */
  readonly message: string;

  /**
   * Pagination metadata (only included for paginated responses).
   */
  readonly meta?: PaginationMetaDto;

  /**
   * The unique request ID (will be implemented in Feature #2).
   * @example "a1b2c3d4-e5f6-7890-g1h2-i3j4k5l6m7n8"
   */
  readonly requestId: string | null; // Will be populated by Request ID middleware

  /**
   * The server timestamp when the response was generated.
   * @example "2025-11-16T03:52:00.000Z"
   */
  readonly timestamp: string;

  /**
   * The API endpoint path that was called.
   * @example "/v1/users"
   */
  readonly path: string;

  /**
   * The main data payload of the response.
   */
  readonly data: T | null;

  constructor(
    success: boolean,
    statusCode: number, // <-- ADDED STATUS CODE
    message: string,
    path: string,
    requestId: string | null,
    data: T | null,
    meta?: PaginationMetaDto,
  ) {
    this.success = success;
    this.statusCode = statusCode; // <-- ASSIGNED STATUS CODE
    this.message = message;
    this.meta = meta;
    this.requestId = requestId;
    this.timestamp = new Date().toISOString();
    // this.statusCode = success ? 200 : 400; // <-- REMOVED HARDCODED VALUE
    this.path = path;
    this.data = data;
  }
}

/**
 * A simple paginated response structure.
 * All services will return data in this format
 * for the interceptor to correctly format.
 */
export class PaginatedResponseDto<T> {
  data: T[];
  meta: PaginationMetaDto;

  constructor(data: T[], total: number, page: number, limit: number) {
    this.data = data;
    this.meta = new PaginationMetaDto(total, page, limit);
  }
}
