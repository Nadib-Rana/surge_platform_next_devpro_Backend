// src/auth/decorators/roles.decorator.ts
import { SetMetadata } from "@nestjs/common";
// import { UserRole } from "../../generated/prisma/client";

export const ROLES_KEY = "roles";
export const Roles = (...roles: [string, ...string[]]) =>
  SetMetadata(ROLES_KEY, roles);
