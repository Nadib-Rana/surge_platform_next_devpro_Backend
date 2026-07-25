import axios from "axios";

export async function refreshOAuthTokenIfNeeded(
  platform: string,
  credentials: Record<string, any>,
): Promise<Record<string, any> | null> {
  const p = platform.toLowerCase();
  const refreshToken = credentials.refreshToken;
  if (!refreshToken && p !== "facebook") return null;

  try {
    if (p === "linkedin" && refreshToken) {
      const resp = await axios.post(
        "https://www.linkedin.com/oauth/v2/accessToken",
        new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: refreshToken,
          client_id:
            credentials.clientId || process.env.LINKEDIN_CLIENT_ID || "",
          client_secret:
            credentials.clientSecret ||
            process.env.LINKEDIN_CLIENT_SECRET ||
            "",
        }),
        { headers: { "Content-Type": "application/x-www-form-urlencoded" } },
      );

      if (resp.data?.access_token) {
        return {
          ...credentials,
          accessToken: resp.data.access_token,
          refreshToken: resp.data.refresh_token || refreshToken,
          expiresIn: resp.data.expires_in,
        };
      }
    } else if (p === "facebook") {
      const resp = await axios.get(
        "https://graph.facebook.com/v18.0/oauth/access_token",
        {
          params: {
            grant_type: "fb_exchange_token",
            client_id:
              credentials.clientId || process.env.FACEBOOK_APP_ID || "",
            client_secret:
              credentials.clientSecret ||
              process.env.FACEBOOK_APP_SECRET ||
              "",
            fb_exchange_token: credentials.accessToken || refreshToken,
          },
        },
      );

      if (resp.data?.access_token) {
        return {
          ...credentials,
          accessToken: resp.data.access_token,
          expiresIn: resp.data.expires_in,
        };
      }
    }
  } catch {
    return null;
  }

  return null;
}
