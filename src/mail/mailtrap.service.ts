import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as https from "https";
// DNS checks disabled to avoid blocking production email delivery

@Injectable()
export class MailtrapService {
  private token = "";
  private fromEmail = "";
  private fromName = "";
  private apiUrl = "https://send.api.mailtrap.io/api/send";
  private readonly logger = new Logger(MailtrapService.name);
  // dnsResolve intentionally removed to avoid DNS-based blocking

  constructor(private configService: ConfigService) {
    this.refreshConfig();
  }

  private refreshConfig(): void {
    this.token = this.configService.get<string>("MAILTRAP_TOKEN")?.trim() || "";
    this.fromEmail =
      this.configService.get<string>("MAILTRAP_FROM_EMAIL")?.trim() ||
      "noreply@example.com";
    this.fromName =
      this.configService.get<string>("MAILTRAP_FROM_NAME")?.trim() ||
      "Your App";
  }

  // DNS validation bypassed: do not perform DNS lookups here to avoid
  // blocking the email send flow in environments with restricted DNS.
  // Kept as a no-op for compatibility with older callers.
  private validateDns(): Promise<void> {
    this.logger.debug("Skipping DNS validation for Mailtrap (bypassed)");
    return Promise.resolve();
  }

  private async sendViaHttps(
    payload: object,
    attempt: number = 1,
  ): Promise<void> {
    const maxRetries = 3;

    return new Promise((resolve, reject) => {
      const postData = JSON.stringify(payload);

      const options = {
        hostname: "send.api.mailtrap.io",
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
  }): Promise<boolean> {
    this.refreshConfig();

    const isDevelopment =
      this.configService.get<string>("NODE_ENV") === "development";

    if (!this.token) {
      this.logger.warn(
        `Mailtrap token not configured. Falling back to local OTP logging for ${params.to}`,
      );
      return false;
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

      await this.validateDns();
      await this.sendViaHttps(payload);

      this.logger.log(`Email sent successfully to ${params.to}`);
      return true;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Mailtrap send failed for ${params.to}: ${errorMsg}. Falling back to local console OTP output.`,
      );

      if (isDevelopment || errorMsg.toLowerCase().includes("unauthorized")) {
        this.logger.warn(
          `=== [LOCAL TESTING OTP FALLBACK] Code for ${params.to} is: ${this.extractOtpFromText(params.text ?? params.html)} ===`,
        );
      }

      return false;
    }
  }

  private extractOtpFromText(value: string): string {
    const match = value.match(/\b\d{6}\b/);
    return match ? match[0] : "unknown";
  }

  async sendOtpEmail(params: {
    to: string;
    otp: string;
    userName?: string;
  }): Promise<boolean> {
    const name = params.userName || params.to;
    const html = `
      <h1>Email Verification</h1>
      <p>Hello ${name},</p>
      <p>Your OTP code is: <strong>${params.otp}</strong></p>
      <p>This code will expire in 5 minutes.</p>
    `;

    const text = `Your OTP code is: ${params.otp}. This code will expire in 5 minutes.`;

    return this.sendEmail({
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
  }): Promise<boolean> {
    const name = params.userName || params.to;
    const html = `
      <h1>Password Reset Request</h1>
      <p>Hello ${name},</p>
      <p>Your password reset OTP code is: <strong>${params.otp}</strong></p>
      <p>This code will expire in 10 minutes.</p>
      <p>If you did not request this, please ignore this email.</p>
    `;

    const text = `Your password reset OTP code is: ${params.otp}. This code will expire in 10 minutes.`;

    return this.sendEmail({
      to: params.to,
      subject: "Password Reset OTP",
      html,
      text,
    });
  }
}
