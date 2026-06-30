import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Request } from "express";
// import { UserRole } from "../../generated/prisma/client";
import { ROLES_KEY } from "../decorators/roles.decorator";

// Define a custom request interface to include the user property
interface AuthenticatedRequest extends Request {
  user?: {
    role: string;
    // Add other user properties as needed
  };
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // ১. ডেকোরেটর থেকে রিকোয়েস্ট করা রোলগুলো রিভলভ করা
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // যদি কোনো মেথডে @Roles() দেওয়া না থাকে, তবে সেটা সবার জন্য ওপেন (যদি JwtAuthGuard পাস করে)
    if (!requiredRoles) {
      return true;
    }

    // ২. রিকোয়েস্ট থেকে ইউজার অবজেক্ট নেওয়া (JwtAuthGuard এটা সেট করে দেয়)
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const { user } = request;

    if (!user || !user.role) {
      throw new ForbiddenException("User role not found or access denied");
    }

    // ৩. ইউজারের রোল রিকোয়ার্ড রোলের সাথে মিলছে কি না চেক করা
    const hasRole = requiredRoles.some((role) => user.role === role);

    if (!hasRole) {
      throw new ForbiddenException(
        `Access denied: Required role is ${requiredRoles.join(" or ")}`,
      );
    }

    return true;
  }
}
