import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { THROTTLE_KEY, ThrottleOptions } from "../decorators/throttle.decorator";

interface RateRecord {
  count: number;
  resetTime: number;
}

@Injectable()
export class RateLimiterGuard implements CanActivate {
  private readonly hits = new Map<string, RateRecord>();

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const options = this.reflector.get<ThrottleOptions>(
      THROTTLE_KEY,
      context.getHandler(),
    ) || { limit: 10, ttlMs: 60000 };

    const req = context.switchToHttp().getRequest();
    const clientIp =
      req.headers["x-forwarded-for"] ||
      req.socket?.remoteAddress ||
      "127.0.0.1";
    const route = req.route?.path || req.url;
    const key = `${clientIp}:${route}`;

    const now = Date.now();
    const record = this.hits.get(key);

    if (!record || now > record.resetTime) {
      this.hits.set(key, { count: 1, resetTime: now + options.ttlMs });
      return true;
    }

    if (record.count >= options.limit) {
      const retryAfterSeconds = Math.ceil((record.resetTime - now) / 1000);
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: `Too many requests from IP. Please try again in ${retryAfterSeconds} seconds.`,
          error: "Too Many Requests",
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    record.count += 1;
    return true;
  }
}
