import { MailerOptions } from "@nestjs-modules/mailer";
import { HandlebarsAdapter } from "@nestjs-modules/mailer/adapters/handlebars.adapter";
import { ConfigService } from "@nestjs/config";
import { join } from "path";

export const getMailConfig = (configService: ConfigService): MailerOptions => {
  return {
    transport: {
      host: configService.get<string>("MAIL_HOST"),
      port: configService.get<number>("MAIL_PORT"),
      secure: false,
      auth: {
        user: configService.get<string>("MAIL_USER"),
        pass: configService.get<string>("MAIL_PASS"),
      },
      tls: {
        rejectUnauthorized: false,
      },
    },

    defaults: {
      from: `"Teams11 Support" <${configService.get<string>("MAIL_FROM")}>`,
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
