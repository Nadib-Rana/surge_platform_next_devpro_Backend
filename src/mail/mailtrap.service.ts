import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as https from "https";
import * as dns from "dns";
import { promisify } from "util";

@Injectable()
export class MailtrapService {
  private token: string;
  private fromEmail: string;
  private fromName: string;
  private apiUrl = "https://api.mailtrap.io/api/send";
  private readonly logger = new Logger(MailtrapService.name);
  private dnsResolve = promisify(dns.resolve);

  constructor(private configService: ConfigService) {
    this.token = this.configService.get<string>("MAILTRAP_TOKEN") || "";
    this.fromEmail =
      this.configService.get<string>("MAILTRAP_FROM_EMAIL") ||
      "noreply@example.com";
    this.fromName =
      this.configService.get<string>("MAILTRAP_FROM_NAME") || "Your App";

    if (!this.token) {
      this.logger.warn(
        "MAILTRAP_TOKEN not configured. Email delivery will fail.",
      );
    }

    // Ensure DNS uses Google's public DNS servers for reliability
    dns.setServers(["8.8.8.8", "8.8.4.4"]);
  }

  private async validateDns(): Promise<void> {
    try {
      await this.dnsResolve("api.mailtrap.io");
      this.logger.debug("DNS validation passed for api.mailtrap.io");
    } catch (error) {
      this.logger.warn(
        `DNS resolution failed for api.mailtrap.io: ${error instanceof Error ? error.message : String(error)}. Retrying...`,
      );
      throw new Error(
        `DNS resolution failed for api.mailtrap.io: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  private async sendViaHttps(
    payload: object,
    attempt: number = 1,
  ): Promise<void> {
    const maxRetries = 3;

    return new Promise((resolve, reject) => {
      const postData = JSON.stringify(payload);

      const options = {
        hostname: "api.mailtrap.io",
        port: 443,
        path: "/api/send",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(postData),
          Authorization: `Bearer ${this.token}`,
        },
        timeout: 10000, // 10 second timeout
      };

      const req = https.request(options, (res) => {
        let data = "";

        res.on("data", (chunk) => {
          data += chunk;
        });

        res.on("end", () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            resolve();
          } else {
            reject(
              new Error(`Mailtrap API error (${res.statusCode}): ${data}`),
            );
          }
        });
      });

      req.on("error", (error: NodeJS.ErrnoException) => {
        const errorMsg = error.message || String(error);

        // Check if it's a network/DNS error
        if (
          error.code === "ENOTFOUND" ||
          error.code === "ECONNREFUSED" ||
          error.code === "ETIMEDOUT"
        ) {
          if (attempt < maxRetries) {
            this.logger.warn(
              `Network error on attempt ${attempt}/${maxRetries}: ${errorMsg}. Retrying...`,
            );
            // Retry after a delay
            setTimeout(() => {
              this.sendViaHttps(payload, attempt + 1)
                .then(resolve)
                .catch(reject);
            }, 1000 * attempt); // Exponential backoff
          } else {
            reject(
              new Error(
                `Network error after ${maxRetries} attempts: ${errorMsg}`,
              ),
            );
          }
        } else {
          reject(error);
        }
      });

      req.setTimeout(10000, () => {
        req.destroy();
        reject(new Error("Request timeout"));
      });

      req.write(postData);
      req.end();
    });
  }

  async sendEmail(params: {
    to: string;
    subject: string;
    html: string;
    text?: string;
  }): Promise<void> {
    if (!this.token) {
      throw new Error(
        "Mailtrap token not configured. Set MAILTRAP_TOKEN in .env",
      );
    }

    const payload = {
      from: {
        email: this.fromEmail,
        name: this.fromName,
      },
      to: [
        {
          email: params.to,
        },
      ],
      subject: params.subject,
      html: params.html,
      text: params.text,
    };

    try {
      this.logger.debug(
        `Sending email to ${params.to} via Mailtrap. Token: ${this.token.substring(0, 10)}...`,
      );

      // Validate DNS before sending
      await this.validateDns();

      await this.sendViaHttps(payload);

      this.logger.log(`Email sent successfully to ${params.to}`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Failed to send email to ${params.to}: ${errorMsg}`,
        error instanceof Error ? error.stack : "",
      );
      throw new Error(`Mailtrap send failed: ${errorMsg}`);
    }
  }

  async sendOtpEmail(params: {
    to: string;
    otp: string;
    userName?: string;
  }): Promise<void> {
    const name = params.userName || params.to;
    const html = `
      <h1>Email Verification</h1>
      <p>Hello ${name},</p>
      <p>Your OTP code is: <strong>${params.otp}</strong></p>
      <p>This code will expire in 5 minutes.</p>
    `;

    const text = `Your OTP code is: ${params.otp}. This code will expire in 5 minutes.`;

    await this.sendEmail({
      to: params.to,
      subject: "Email Verification OTP",
      html,
      text,
    });
  }

  async sendPasswordResetEmail(params: {
    to: string;
    otp: string;
    userName?: string;
  }): Promise<void> {
    const name = params.userName || params.to;
    const html = `
      <h1>Password Reset Request</h1>
      <p>Hello ${name},</p>
      <p>Your password reset OTP code is: <strong>${params.otp}</strong></p>
      <p>This code will expire in 10 minutes.</p>
      <p>If you did not request this, please ignore this email.</p>
    `;

    const text = `Your password reset OTP code is: ${params.otp}. This code will expire in 10 minutes.`;

    await this.sendEmail({
      to: params.to,
      subject: "Password Reset OTP",
      html,
      text,
    });
  }
}
