/**
 * response-standardization.interceptor.ts
 * * This interceptor wraps all successful (non-error) responses
 * in the standard ApiResponseDto structure.
 * * UPDATED: Now uses Reflector to check for a custom
 * * success message from the @ResponseMessage decorator.
 */

import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { map } from "rxjs/operators";
import { HttpArgumentsHost } from "@nestjs/common/interfaces";
import { Request, Response } from "express";
import { ApiResponseDto, PaginatedResponseDto } from "../dto/api-response.dto";
import { ContextService } from "../context/context.service";
import { Reflector } from "@nestjs/core";
import { RESPONSE_MESSAGE_KEY } from "../decorators/response-message.decorator";

@Injectable()
export class ResponseStandardizationInterceptor<T> implements NestInterceptor<
  T,
  ApiResponseDto<T | T[]>
> {
  // --- Inject ContextService and Reflector ---
  constructor(
    private readonly contextService: ContextService,
    private readonly reflector: Reflector, // <-- Inject Reflector
  ) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiResponseDto<T | T[]>> {
    const ctx: HttpArgumentsHost = context.switchToHttp();
    const request: Request = ctx.getRequest();
    const response: Response = ctx.getResponse(); // <-- GET RESPONSE OBJECT
    const path: string = request.url;
    const handler = context.getHandler(); // Get the route handler

    const requestId = this.contextService.getRequestId() || null;

    // --- Get custom message from decorator ---
    const customMessage = this.reflector.get<string>(
      RESPONSE_MESSAGE_KEY,
      handler, // Check the handler for the metadata
    );

    return next.handle().pipe(
      map((data) => {
        const statusCode = response.statusCode; // <-- GET ACTUAL STATUS CODE

        // Check if the controller response is already in our paginated format
        if (data instanceof PaginatedResponseDto) {
          return new ApiResponseDto<T[]>(
            true,
            statusCode, // <-- PASS STATUS CODE
            // Use custom message or default
            customMessage || "Data fetched successfully (paginated)",
            path,
            requestId,
            data.data,
            data.meta,
          );
        }

        // Handle non-paginated, standard successful responses
        return new ApiResponseDto<T>(
          true,
          statusCode, // <-- PASS STATUS CODE
          // Use custom message or default
          customMessage || "Operation successful",
          path,
          requestId,
          data as T,
        );
      }),
    );
  }
}
