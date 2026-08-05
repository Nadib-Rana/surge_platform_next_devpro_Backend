export interface QueueConfig {
  autoPost?: boolean;
  fetchFrequencyHours?: number;
  postingTimes?: string[];
  name?: string;
  targetAudience?: string;
  brandVoice?: string;
  editorialRules?: string[];
}

export function mergeQueueConfig(
  currentConfig: QueueConfig | null | undefined,
  newConfig: Partial<QueueConfig>,
): QueueConfig {
  const existing = currentConfig ?? {};
  return {
    ...existing,
    ...newConfig,
    autoPost: newConfig.autoPost ?? existing.autoPost ?? false,
  };
}
