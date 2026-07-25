import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { ApiTestController } from "./api-test.controller";
import { ContextModule } from "./common/context/context.module";
import { RequestIdMiddleware } from "./common/middleware/request-id.middleware";
import { APP_INTERCEPTOR, Reflector } from "@nestjs/core";
import { ResponseStandardizationInterceptor } from "./common/interceptors/response-standardization.interceptor";
import { HttpLoggingInterceptor } from "./common/interceptors/http-logging.interceptor";
import { AuthModule } from "./modules/auth/auth.module";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { getMailConfig } from "./mail/mail.config";
import { MailerModule } from "@nestjs-modules/mailer";
import { UsersModule } from "./users/users.module";
import { CompaniesModule } from "./modules/companies/companies.module";
import { WorkspacesModule } from "./modules/workspaces/workspaces.module";
import { RssFeedsModule } from "./modules/rss-feeds/rss-feeds.module";
import { RawPostsModule } from "./modules/raw-posts/raw-posts.module";
import { AiPromptsModule } from "./modules/ai-prompts/ai-prompts.module";
import { GeneratedDraftsModule } from "./modules/generated-drafts/generated-drafts.module";
import { PublishingChannelsModule } from "./modules/publishing-channels/publishing-channels.module";
import { QueuesModule } from "./modules/queues/queues.module";
import { AutopilotModule } from "./modules/autopilot/autopilot.module";
import { StorageModule } from "./modules/storage/storage.module";
import { EncryptionModule } from "./common/security/encryption.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ".env",
    }),
    EncryptionModule,
    MailerModule.forRootAsync({
      useFactory: getMailConfig,
      inject: [ConfigService],
    }),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.get("REDIS_HOST") || "127.0.0.1",
          port: Number(configService.get("REDIS_PORT") || 6379),
          password: configService.get("REDIS_PASSWORD") || undefined,
        },
      }),
    }),
    ContextModule,
    AuthModule,
    UsersModule,
    CompaniesModule,
    WorkspacesModule,
    RssFeedsModule,
    RawPostsModule,
    AiPromptsModule,
    GeneratedDraftsModule,
    PublishingChannelsModule,
    QueuesModule,
    AutopilotModule,
    StorageModule,
  ],
  controllers: [AppController, ApiTestController],
  providers: [
    AppService,
    {
      provide: APP_INTERCEPTOR,
      useClass: ResponseStandardizationInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: HttpLoggingInterceptor,
    },
    Reflector,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware).forRoutes("*");
  }
}
