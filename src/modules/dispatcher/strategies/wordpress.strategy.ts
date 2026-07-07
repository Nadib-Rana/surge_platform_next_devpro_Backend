import axios from "axios";
import FormData from "form-data";
import { Injectable } from "@nestjs/common";
import {
  BaseDispatcher,
  DispatchPayload,
  DispatchResult,
} from "../interfaces/base-dispatcher.interface";

@Injectable()
export class WordpressStrategy extends BaseDispatcher {
  readonly name = "wordpress";

  handles(channel: string): boolean {
    return channel === this.name;
  }

  private getAuthHeader(credentials: Record<string, any>) {
    if (credentials.accessToken)
      return { Authorization: `Bearer ${credentials.accessToken}` };
    if (credentials.username && credentials.password) {
      const token = Buffer.from(
        `${credentials.username}:${credentials.password}`,
      ).toString("base64");
      return { Authorization: `Basic ${token}` };
    }
    return {};
  }

  async uploadMedia(
    siteUrl: string,
    imageUrl: string,
    credentials: Record<string, any>,
  ) {
    // For simplicity: if imageUrl is remote, fetch it and forward bytes to WP media endpoint
    try {
      const imageResp = await axios.get(imageUrl, {
        responseType: "arraybuffer",
      });
      const form = new FormData();
      const filename = (imageUrl.split("/").pop() || "upload.jpg").split(
        "?",
      )[0];
      form.append("file", Buffer.from(imageResp.data), { filename });

      const headers = {
        ...form.getHeaders(),
        ...this.getAuthHeader(credentials),
      };
      const mediaResp = await axios.post(
        `${siteUrl.replace(/\/$/, "")}/wp-json/wp/v2/media`,
        form,
        { headers },
      );
      return mediaResp.data;
    } catch (err: any) {
      return null;
    }
  }

  async dispatch(payload: DispatchPayload): Promise<DispatchResult> {
    const siteUrl = payload.credentials.apiUrl || payload.credentials.siteUrl;
    if (!siteUrl)
      return {
        success: false,
        error: "Missing WordPress site URL in credentials.apiUrl or siteUrl",
      };

    try {
      let featuredMediaId: number | undefined;
      if (payload.images && payload.images.length > 0) {
        const media = await this.uploadMedia(
          siteUrl,
          payload.images[0],
          payload.credentials,
        );
        if (media && media.id) featuredMediaId = media.id;
      }

      const postBody: any = {
        title: payload.title || "",
        content: payload.content,
        status: payload.metadata?.status || "publish",
      };
      if (featuredMediaId) postBody.featured_media = featuredMediaId;

      const headers = this.getAuthHeader(payload.credentials);
      const resp = await axios.post(
        `${siteUrl.replace(/\/$/, "")}/wp-json/wp/v2/posts`,
        postBody,
        { headers },
      );

      return {
        success: true,
        id: String(resp.data.id),
        url: resp.data.link,
        raw: resp.data,
      };
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || "wordpress: unknown error",
        raw: err?.response?.data ?? err?.toString(),
      };
    }
  }
}
