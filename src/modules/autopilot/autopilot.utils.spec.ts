import { describe, expect, it } from "@jest/globals";
import { buildDailyCronExpression, computeBackoffDelayMs } from "./autopilot.utils";

describe("autopilot utilities", () => {
  it("converts common posting times to daily cron expressions", () => {
    expect(buildDailyCronExpression("09:00")).toBe("0 9 * * *");
    expect(buildDailyCronExpression("5:30 PM")).toBe("30 17 * * *");
    expect(buildDailyCronExpression("12:15 am")).toBe("15 0 * * *");
  });

  it("computes exponential backoff delays for retry attempts", () => {
    expect(computeBackoffDelayMs(0)).toBe(1000);
    expect(computeBackoffDelayMs(1)).toBe(2000);
    expect(computeBackoffDelayMs(2)).toBe(4000);
  });
});
