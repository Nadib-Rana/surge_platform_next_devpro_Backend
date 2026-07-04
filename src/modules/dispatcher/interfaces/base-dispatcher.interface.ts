export interface DispatchPayload {
  channel: string; // 'wordpress' | 'linkedin' | 'facebook' | ...
  title?: string;
  content: string; // plain text or markdown
  images?: string[]; // URLs or local paths
  metadata?: Record<string, any>;
  credentials: Record<string, any>; // provider-specific credentials (accessToken, apiUrl, targetUrn, etc.)
}

export interface DispatchResult {
  success: boolean;
  id?: string;
  url?: string;
  raw?: any;
  error?: string;
}

export abstract class BaseDispatcher {
  abstract readonly name: string;
  abstract handles(channel: string): boolean;
  abstract dispatch(payload: DispatchPayload): Promise<DispatchResult>;
}
