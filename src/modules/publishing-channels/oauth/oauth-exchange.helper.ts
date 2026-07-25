import axios from "axios";

export async function exchangeLinkedInCode(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string,
) {
  const tokenResp = await axios.post(
    "https://www.linkedin.com/oauth/v2/accessToken",
    new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: clientSecret,
    }),
    { headers: { "Content-Type": "application/x-www-form-urlencoded" } },
  );

  const accessToken = tokenResp.data.access_token;
  const meResp = await axios.get("https://api.linkedin.com/v2/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  const authorUrn = `urn:li:person:${meResp.data.id}`;

  return {
    accessToken,
    refreshToken: tokenResp.data.refresh_token,
    authorUrn,
    target: authorUrn,
    expiresIn: tokenResp.data.expires_in,
  };
}

export async function exchangeFacebookCode(
  code: string,
  appId: string,
  appSecret: string,
  redirectUri: string,
) {
  const tokenResp = await axios.get(
    "https://graph.facebook.com/v18.0/oauth/access_token",
    {
      params: {
        client_id: appId,
        client_secret: appSecret,
        redirect_uri: redirectUri,
        code,
      },
    },
  );

  const accessToken = tokenResp.data.access_token;
  const pagesResp = await axios.get(
    `https://graph.facebook.com/v18.0/me/accounts?access_token=${accessToken}`,
  );

  const firstPage = pagesResp.data?.data?.[0];
  const pageToken = firstPage?.access_token || accessToken;
  const target = firstPage?.id || "me";

  return {
    accessToken: pageToken,
    userAccessToken: accessToken,
    target,
    expiresIn: tokenResp.data.expires_in,
  };
}

export async function exchangeWordPressCode(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string,
) {
  const resp = await axios.post(
    "https://public-api.wordpress.com/oauth2/token",
    new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    }),
  );

  return {
    accessToken: resp.data.access_token,
    blogId: resp.data.blog_id,
    endpoint: `https://public-api.wordpress.com/rest/v1.1/sites/${resp.data.blog_id}`,
  };
}
