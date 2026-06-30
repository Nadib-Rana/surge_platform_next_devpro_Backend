import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { ContextModule } from "./common/context/context.module";
import { RequestIdMiddleware } from "./common/middleware/request-id.middleware";
import { APP_INTERCEPTOR, Reflector } from "@nestjs/core";
import { ResponseStandardizationInterceptor } from "./common/interceptors/response-standardization.interceptor";
import { AuthModule } from "./modules/auth/auth.module";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { getMailConfig } from "./mail/mail.config";
import { MailerModule } from "@nestjs-modules/mailer";
import { UsersModule } from "./users/users.module";
import { CompaniesModule } from './modules/companies/companies.module';
import { WorkspacesModule } from './modules/workspaces/workspaces.module';
import { RssFeedsModule } from './modules/rss-feeds/rss-feeds.module';
import { RawPostsModule } from './modules/raw-posts/raw-posts.module';
import { AiPromptsModule } from './modules/ai-prompts/ai-prompts.module';
import { GeneratedDraftsModule } from './modules/generated-drafts/generated-drafts.module';
import { PublishingChannelsModule } from './modules/publishing-channels/publishing-channels.module';
import { QueuesModule } from './modules/queues/queues.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ".env",
    }),
    MailerModule.forRootAsync({
      useFactory: getMailConfig,
      inject: [ConfigService],
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
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_INTERCEPTOR,
      useClass: ResponseStandardizationInterceptor,
    },
    Reflector,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware).forRoutes("*");
  }
}
