import "dotenv/config";
import { Injectable } from "@nestjs/common";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

@Injectable()
export class PrismaService extends PrismaClient {
  constructor() {
    const useSsl = process.env.DATABASE_SSL === "true";
    const adapter = new PrismaPg({
      connectionString: process.env.DATABASE_URL,
      ...(useSsl
        ? {
            ssl: {
              rejectUnauthorized: false,
            },
          }
        : {}),
    });
    super({ adapter });
  }
}
