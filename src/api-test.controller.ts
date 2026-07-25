import { Controller, Get } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { checkOpenAi } from "./common/services/health/openai-health.checker";
import { checkAnthropic } from "./common/services/health/anthropic-health.checker";
import { checkIdeogram } from "./common/services/health/ideogram-health.checker";
import { checkStripe } from "./common/services/health/stripe-health.checker";
import { checkMinioConfig } from "./common/services/health/minio-health.checker";

@Controller("api-test")
export class ApiTestController {
  constructor(private readonly configService: ConfigService) {}

  @Get("credentials")
  async checkCredentials() {
    const report = {
      timestamp: new Date().toISOString(),
      services: {
        openai: await checkOpenAi(this.configService),
        anthropic: await checkAnthropic(this.configService),
        ideogram: await checkIdeogram(this.configService),
        stripe: await checkStripe(this.configService),
        minio: await checkMinioConfig(this.configService),
      },
    };

    const summary = {
      totalServices: Object.keys(report.services).length,
      healthyServices: Object.values(report.services).filter((s) => s.valid)
        .length,
      unhealthyServices: Object.values(report.services).filter((s) => !s.valid)
        .length,
      allHealthy: Object.values(report.services).every((s) => s.valid),
    };

    return { summary, ...report };
  }
}