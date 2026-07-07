import axios from "axios";
import { Injectable } from "@nestjs/common";
import {
  BaseDispatcher,
  DispatchPayload,
  DispatchResult,
} from "../interfaces/base-dispatcher.interface";

@Injectable()
export class LinkedinStrategy extends BaseDispatcher {
  readonly name = "linkedin";

  handles(channel: string): boolean {
    return channel === this.name;
  }

  private getAuthHeader(credentials: Record<string, any>) {
    if (!credentials.accessToken) return {};
    return { Authorization: `Bearer ${credentials.accessToken}` };
  }

  /**
   * Publish a simple UGC post. For images a full asset upload flow is required; here we support linking images
   * by URL in the post's contentEntities if the token owner permits.
   */
  async dispatch(payload: DispatchPayload): Promise<DispatchResult> {
    const accessToken = payload.credentials.accessToken;
    const authorUrn =
      payload.credentials.target || payload.credentials.authorUrn; // e.g. 'urn:li:person:xxxx' or org urn
    if (!accessToken || !authorUrn)
      return {
        success: false,
        error: "Missing accessToken or target author URN",
      };

    const body: any = {
      author: authorUrn,
      lifecycleState: "PUBLISHED",
      specificContent: {
        "com.linkedin.ugc.ShareContent": {
          shareCommentary: { text: payload.content },
          shareMediaCategory:
            payload.images && payload.images.length ? "IMAGE" : "NONE",
        },
      },
      visibility: { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" },
    };

    // If images are simple URLs, include them as media elements (best-effort)
    if (payload.images && payload.images.length) {
      body.specificContent["com.linkedin.ugc.ShareContent"].media =
        payload.images.map((u) => ({
          status: "READY",
          description: { text: payload.title || "" },
          originalUrl: u,
          title: { text: payload.title || "" },
        }));
    }

    try {
      const resp = await axios.post(
        "https://api.linkedin.com/v2/ugcPosts",
        body,
        {
          headers: {
            ...this.getAuthHeader(payload.credentials),
            "X-Restli-Protocol-Version": "2.0.0",
            "Content-Type": "application/json",
          },
        },
      );
      return {
        success: true,
        id: resp.headers["x-restli-id"] || resp.data?.id,
        raw: resp.data,
      };
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || "linkedin error",
        raw: err?.response?.data ?? err?.toString(),
      };
    }
  }
}
