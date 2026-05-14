/**
 * pagination.dto.ts
 * * This DTO defines the structure for pagination metadata.
 * It will be included in API responses for list endpoints.
 */

export class PaginationMetaDto {
  /**
   * The current page number.
   * @example 1
   */
  readonly page: number;

  /**
   * The number of items per page.
   * @example 10
   */
  readonly limit: number;

  /**
   * The total number of items available.
   * @example 100
   */
  readonly total: number;

  /**
   * The total number of pages.
   * @example 10
   */
  readonly totalPages: number;

  /**
   * A boolean indicating if there is a next page.
   * @example true
   */
  readonly hasNext: boolean;

  /**
   * A boolean indicating if there is a previous page.
   * @example false
   */
  readonly hasPrevious: boolean;

  constructor(total: number, page: number, limit: number) {
    this.total = total;
    this.page = page;
    this.limit = limit;
    this.totalPages = Math.ceil(this.total / this.limit);
    this.hasNext = this.page < this.totalPages;
    this.hasPrevious = this.page > 1;
  }
}
