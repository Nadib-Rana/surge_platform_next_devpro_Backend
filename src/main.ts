import { HttpAdapterHost, NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { ValidationPipe, BadRequestException } from "@nestjs/common";
import { AllExceptionsFilter } from "./common/filters/all-exceptions.filter";
import { ContextService } from "./common/context/context.service";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { json, urlencoded } from "express";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Increase payload limit for avatar images & large data payloads
  app.use(json({ limit: "10mb" }));
  app.use(urlencoded({ limit: "10mb", extended: true }));

  // Allow frontend integration from configured origins.
  const allowedOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(",").map((origin) => origin.trim())
    : true;
  app.enableCors({
    origin: allowedOrigins,
    methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE", "OPTIONS"],
    credentials: true,
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "ngrok-skip-browser-warning",
    ],
  });

  // --- 1. Enable Global Validation Pipe ---
  // This is part of Feature #5, but required for the filter to catch
  // class-validator errors.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Strip properties not in DTO
      transform: true, // Automatically transform payloads to DTO instances
      forbidNonWhitelisted: true, // Throw error on non-whitelisted properties
      exceptionFactory: (errors) => {
        const messages = errors.map((error) => {
          const constraints = error.constraints;
          if (constraints) {
            return Object.values(constraints).join(", ");
          }
          return `Validation failed for ${error.property}`;
        });
        return new BadRequestException({
          statusCode: 400,
          message: messages,
          error: "Validation Failed",
        });
      },
      // transformOptions: {
      //   enableImplicitConversion: true, // Convert query/path params
      // },
    }),
  );

  // --- 2. Register Global Exception Filter ---
  // We MUST get these dependencies from the app instance
  // *after* it has been created.
  const httpAdapterHost = app.get(HttpAdapterHost);
  const contextService = app.get(ContextService);
  app.useGlobalFilters(
    new AllExceptionsFilter(httpAdapterHost, contextService),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle("Surge Platform API")
    .setDescription("Surge Platform backend API documentation")
    .setVersion("2.0")
    .addBearerAuth()
    .build();
  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup("docs", app, swaggerDocument);
  // Note: We are instantiating it here instead of using APP_FILTER
  // because the filter *depends* on other providers (HttpAdapterHost)
  // that are only available *after* the app is created.

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
