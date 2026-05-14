/**
 * src/common/middleware/request-id.middleware.ts
 * * This middleware generates a unique request ID (using crypto)
 * * and sets it in the AsyncLocalStorage context for every request.
 */
import { Injectable, NestMiddleware } from "@nestjs/common";
import { Request, Response, NextFunction } from "express";
import { requestContext, RequestContextStore } from "../context/storage";
import { REQUEST_ID_KEY } from "../context/context.service";
import { randomUUID } from "crypto"; // Built-in Node.js module

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // Attempt to get ID from header (for tracing across services)
    // Otherwise, generate a new unique ID
    const requestId = (req.headers["x-request-id"] as string) || randomUUID();

    // Create a new Map to store context data for this request
    const store: RequestContextStore = new Map();
    store.set(REQUEST_ID_KEY, requestId);

    // Also add the request ID to the response header
    res.setHeader("x-request-id", requestId);

    // Run the rest of the request chain *within* the async context
    requestContext.run(store, () => {
      next();
    });
  }
}
