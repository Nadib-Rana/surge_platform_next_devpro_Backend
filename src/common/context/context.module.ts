/**
 * src/common/context/context.module.ts
 * * Bundles and exports the ContextService.
 * We make it @Global() so it can be injected anywhere
 * without needing to import ContextModule in every feature module.
 */
import { Global, Module } from "@nestjs/common";
import { ContextService } from "./context.service";
import { PrismaService } from "./prisma.service";

@Global() // Make ContextService available globally
@Module({
  providers: [ContextService, PrismaService],
  exports: [ContextService, PrismaService],
})
export class ContextModule {}
