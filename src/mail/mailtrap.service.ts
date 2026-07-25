import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { sendViaHttps } from "./mailtrap-transport.util";
import {
  buildOtpEmailContent,
  buildPasswordResetEmailContent,
  extractOtpFromText,
} from "./mailtrap-templates.util";

@Injectable()
export class MailtrapService {
  private token = "";
  private fromEmail = "";
  private fromName = "";
  private readonly logger = new Logger(MailtrapService.name);

  constructor(private configService: ConfigService) {
    this.refreshConfig();
  }

  private refreshConfig(): void {
    this.token =
      this.configService.get<string>("MAILTRAP_TOKEN")?.trim() || "";
    this.fromEmail =
      this.configService.get<string>("MAILTRAP_FROM_EMAIL")?.trim() ||
      "noreply@example.com";
    this.fromName =
      this.configService.get<string>("MAILTRAP_FROM_NAME")?.trim() ||
      "Your App";
  }

  private validateDns(): Promise<void> {
    this.logger.debug("Skipping DNS validation for Mailtrap (bypassed)");
    return Promise.resolve();
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
      to: [{ email: params.to }],
      subject: params.subject,
      html: params.html,
      text: params.text,
    };

    try {
      this.logger.debug(
        `Sending email to ${params.to} via Mailtrap. Token: ${this.token.substring(0, 10)}...`,
      );

      await this.validateDns();
      await sendViaHttps(this.token, payload, this.logger);

      this.logger.log(`Email sent successfully to ${params.to}`);
      return true;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Mailtrap send failed for ${params.to}: ${errorMsg}. Falling back to local console OTP output.`,
      );

      if (isDevelopment || errorMsg.toLowerCase().includes("unauthorized")) {
        this.logger.warn(
          `=== [LOCAL TESTING OTP FALLBACK] Code for ${params.to} is: ${extractOtpFromText(params.text ?? params.html)} ===`,
        );
      }

      return false;
    }
  }

  async sendOtpEmail(params: {
    to: string;
    otp: string;
    userName?: string;
  }): Promise<boolean> {
    const { html, text } = buildOtpEmailContent(params);

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
    const { html, text } = buildPasswordResetEmailContent(params);

    return this.sendEmail({
      to: params.to,
      subject: "Password Reset OTP",
      html,
      text,
    });
  }
}
