import Redis from "ioredis";

export async function acquireAutopilotLock(
  redis: Redis,
  draftId: string,
): Promise<{ acquired: boolean; lockKey: string; lockValue: string }> {
  const lockKey = `autopilot-lock:${draftId}`;
  const lockValue = `${process.pid}:${Date.now()}`;
  const result = await redis.set(lockKey, lockValue, "PX", 600_000, "NX");
  return { acquired: Boolean(result), lockKey, lockValue };
}

export async function releaseAutopilotLock(
  redis: Redis,
  lockKey: string,
  lockValue: string,
): Promise<void> {
  const script = `
    if redis.call("get", KEYS[1]) == ARGV[1] then
      return redis.call("del", KEYS[1])
    end
    return 0
  `;
  await redis.eval(script, 1, lockKey, lockValue);
}
