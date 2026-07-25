export interface QueueConfig {
  autoPost?: boolean;
  fetchFrequencyHours?: number;
  postingTimes?: string[];
}

export function mergeQueueConfig(
  currentConfig: QueueConfig | null | undefined,
  newConfig: QueueConfig,
): QueueConfig {
  const existing = currentConfig ?? {};
  return {
    ...existing,
    ...newConfig,
    autoPost: newConfig.autoPost ?? existing.autoPost ?? false,
  };
}
