import axios from 'axios';
import { Injectable } from '@nestjs/common';
import { BaseDispatcher, DispatchPayload, DispatchResult } from '../interfaces/base-dispatcher.interface';

@Injectable()
export class FacebookStrategy extends BaseDispatcher {
  readonly name = 'facebook';

  handles(channel: string): boolean {
    return channel === this.name;
  }

  private tokenParam(credentials: Record<string, any>) {
    return credentials.accessToken || credentials.token || '';
  }

  async dispatch(payload: DispatchPayload): Promise<DispatchResult> {
    const token = this.tokenParam(payload.credentials);
    const targetNode = payload.credentials.target; // page id or group id
    if (!token || !targetNode) return { success: false, error: 'Missing access token or target node id' };

    try {
      // If images are provided, prefer /photos endpoint
      if (payload.images && payload.images.length) {
        // publish first image with caption
        const params = new URLSearchParams();
        params.append('url', payload.images[0]);
        params.append('caption', payload.content || payload.title || '');
        params.append('access_token', token);
        const resp = await axios.post(`https://graph.facebook.com/${targetNode}/photos`, params);
        return { success: true, id: resp.data?.id, raw: resp.data, url: `https://facebook.com/${resp.data?.post_id || resp.data?.id}` };
      }

      // Text-only post to feed
      const feedParams = new URLSearchParams();
      feedParams.append('message', payload.content);
      feedParams.append('access_token', token);
      const feedResp = await axios.post(`https://graph.facebook.com/${targetNode}/feed`, feedParams);
      return { success: true, id: feedResp.data?.id, raw: feedResp.data, url: `https://facebook.com/${feedResp.data?.id}` };
    } catch (err: any) {
      return { success: false, error: err?.message || 'facebook error', raw: err?.response?.data ?? err?.toString() };
    }
  }
}
