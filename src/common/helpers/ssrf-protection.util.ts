import { BadRequestException } from "@nestjs/common";
import { URL } from "url";

const BLOCKED_HOSTNAMES = ["localhost", "127.0.0.1", "0.0.0.0", "169.254.169.254", "::1"];

export function validateUrlForSsrf(inputUrl: string): URL {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(inputUrl);
  } catch {
    throw new BadRequestException("Invalid URL format.");
  }

  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    throw new BadRequestException("Only HTTP and HTTPS protocols are allowed.");
  }

  const hostname = parsedUrl.hostname.toLowerCase();

  if (BLOCKED_HOSTNAMES.includes(hostname)) {
    throw new BadRequestException("Access to local or private IP metadata endpoints is forbidden.");
  }

  // Block private RFC 1918 IPv4 ranges
  if (/^127\./.test(hostname) || /^10\./.test(hostname) || /^169\.254\./.test(hostname)) {
    throw new BadRequestException("Access to private IP ranges is forbidden.");
  }

  if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname)) {
    throw new BadRequestException("Access to private IP ranges is forbidden.");
  }

  if (/^192\.168\./.test(hostname)) {
    throw new BadRequestException("Access to private IP ranges is forbidden.");
  }

  return parsedUrl;
}
