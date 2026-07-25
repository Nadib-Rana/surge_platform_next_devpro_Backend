import { SetMetadata } from "@nestjs/common";

export interface ThrottleOptions {
  limit: number;
  ttlMs: number;
}

export const THROTTLE_KEY = "THROTTLE_OPTIONS";
export const Throttle = (limit: number, ttlMs = 60000) =>
  SetMetadata(THROTTLE_KEY, { limit, ttlMs });
