import { MailerOptions } from "@nestjs-modules/mailer";
import { HandlebarsAdapter } from "@nestjs-modules/mailer/adapters/handlebars.adapter";
import { ConfigService } from "@nestjs/config";
import { join } from "path";

export const getMailConfig = (configService: ConfigService): MailerOptions => {
  const port = Number(configService.get<string>("MAIL_PORT") || 587);
  const secure =
    configService.get<string>("MAIL_SECURE") === "true" || port === 465;

  return {
    transport: {
      host: configService.get<string>("MAIL_HOST"),
      port,
      secure,
      auth: {
        user: configService.get<string>("MAIL_USER"),
        pass: configService.get<string>("MAIL_PASS"),
      },
      tls: {
        rejectUnauthorized: false,
      },
    },

    defaults: {
      from: `"Surge Support" <${configService.get<string>("MAIL_FROM")}>`,
    },
    template: {
      dir: join(process.cwd(), "templates"),
      adapter: new HandlebarsAdapter(),
      options: {
        strict: true,
      },
    },
  };
};
