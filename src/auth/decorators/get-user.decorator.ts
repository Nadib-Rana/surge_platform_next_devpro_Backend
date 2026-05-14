import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { Request } from "express";

// Define a basic User interface based on your JWT payload or user entity.
// Adjust properties as needed (e.g., add email, roles, etc.).
interface User {
  userId: string;
  role: string;
  isVerified?: boolean;
  email?: string;
  fullName?: string;
  avatarKey?: string | null;
}

export const GetUser = createParamDecorator<keyof User | undefined, unknown>(
  (data: keyof User | undefined, ctx: ExecutionContext): unknown => {
    const request = ctx.switchToHttp().getRequest<Request>();
    const user = request.user as User | undefined;
    return data ? user?.[data] : user;
  },
);
