import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from "@nestjs/common";
import { Request, Response } from "express";
import { Observable, throwError } from "rxjs";
import { catchError, tap } from "rxjs/operators";
import { randomUUID } from "crypto";

@Injectable()
export class HttpLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger("HTTP");

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest<Request>();
    const res = context.switchToHttp().getResponse<Response>();

    const start = Date.now();
    const correlationId =
      (req.headers["x-correlation-id"] as string) ||
      (req.headers["x-request-id"] as string) ||
      randomUUID();

    const method = req.method || "UNKNOWN";
    const url = req.originalUrl || req.url || "/";
    const ip = this.getClientIp(req);
    const platform = this.getPlatform(req.headers["user-agent"]);
    const requestSize = this.getRequestSize(req);

    return next.handle().pipe(
      tap(() => {
        const latency = Date.now() - start;
        const statusCode = res.statusCode || 200;
        const responseSize = this.getResponseSize(res);
        const isSlowApi = latency > 1000;

        this.logger.log(
          JSON.stringify({
            correlationId,
            ip,
            isSlowApi,
            latency,
            level: "info",
            message: `${method} ${url} - ${statusCode}`,
            method,
            platform,
            requestSize,
            responseSize,
            service: "surge-platform-backend",
            statusCode,
            timestamp: this.formatTimestamp(new Date()),
            url,
          }),
        );
      }),
      catchError((error) => {
        const latency = Date.now() - start;
        const statusCode = error?.status || 500;
        const responseSize = this.getResponseSize(res);
        const isSlowApi = latency > 1000;

        this.logger.error(
          JSON.stringify({
            correlationId,
            ip,
            isSlowApi,
            latency,
            level: "error",
            message: `${method} ${url} - ${statusCode}`,
            method,
            platform,
            requestSize,
            responseSize,
            service: "surge-platform-backend",
            statusCode,
            timestamp: this.formatTimestamp(new Date()),
            url,
          }),
        );

        return throwError(() => error);
      }),
    );
  }

  private getClientIp(req: Request): string {
    const forwarded = req.headers["x-forwarded-for"];
    if (typeof forwarded === "string") return forwarded.split(",")[0].trim();
    if (Array.isArray(forwarded)) return forwarded[0];
    return req.socket?.remoteAddress || req.ip || "unknown";
  }

  private getPlatform(userAgent?: string): string {
    if (!userAgent) return "unknown";
    const ua = userAgent.toLowerCase();
    if (/android|iphone|ipad|mobile/i.test(ua)) return "mobile";
    if (/windows|macintosh|linux/i.test(ua)) return "desktop";
    return "unknown";
  }

  private getRequestSize(req: Request): number {
    const contentLength = req.headers["content-length"];
    if (typeof contentLength === "string") {
      const parsed = Number(contentLength);
      return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
  }

  private getResponseSize(res: Response): number {
    const contentLength = res.getHeader("content-length");
    if (typeof contentLength === "number") return contentLength;
    if (typeof contentLength === "string") {
      const parsed = Number(contentLength);
      return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
  }

  private formatTimestamp(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}:${String(date.getSeconds()).padStart(2, "0")}`;
  }
}
