import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from "@nestjs/common";
import { from, Observable } from "rxjs";
import { mergeMap } from "rxjs/operators";
import { StorageService } from "../../storage/storage.service";

/**
 * ImageTransformInterceptor
 *
 * এই interceptor response-এ object keys গুলোকে presigned URLs-এ রূপান্তরিত করে।
 *
 * Features:
 * - Profile images ট্রান্সফর্ম করে (users/ prefix)
 * - Business logos ট্রান্সফর্ম করে
 * - Business images arrays ট্রান্সফর্ম করে
 * - Nested objects recursively handle করে
 * - Category images support করে
 *
 * Response Format:
 * {
 *   "profileImage": "http://minio:9010/devscout-profiles/users/...",      // Direct URL
 *   "profileImageKey": "users/user-123/profile-1711938000000.jpg"         // Raw key backup
 * }
 */
@Injectable()
export class ImageTransformInterceptor implements NestInterceptor {
  private readonly logger = new Logger(ImageTransformInterceptor.name);

  constructor(private storageService: StorageService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      mergeMap((data: unknown) => {
        try {
          if (data && typeof data === "object") {
            return from(this.transformImageKeys(data));
          }
          return from(Promise.resolve(data));
        } catch (error: unknown) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          this.logger.error(`Error transforming image keys: ${errorMessage}`);
          return from(Promise.resolve(data));
        }
      }),
    );
  }

  private async transformImageKeys(obj: unknown): Promise<unknown> {
    if (Array.isArray(obj)) {
      return Promise.all(obj.map((item) => this.transformImageKeys(item)));
    }

    if (obj === null || typeof obj !== "object") {
      return obj;
    }

    const source = obj as Record<string, unknown>;
    const transformed: Record<string, unknown> = { ...source };

    await this.transformKeyToUrl(
      transformed,
      "avatarKey",
      "avatarUrl",
      "profiles",
    );
    await this.transformKeyToUrl(
      transformed,
      "thumbnailKey",
      "thumbnailUrl",
      "media",
    );
    await this.transformKeyToUrl(transformed, "videoKey", "videoUrl", "media");
    await this.transformKeyToUrl(transformed, "thumbKey", "thumbUrl", "media");
    await this.transformKeyToUrl(
      transformed,
      "imageKey",
      "imageUrl",
      "products",
    );

    // Legacy key compatibility
    await this.transformKeyToUrl(
      transformed,
      "profileImage",
      "profileImageUrl",
      "profiles",
    );
    await this.transformKeyToUrl(
      transformed,
      "logoKey",
      "logoUrl",
      "businesses",
    );

    const keys = Object.keys(transformed);
    for (const key of keys) {
      const value = transformed[key];
      if (
        value !== null &&
        typeof value === "object" &&
        !this.isRelationField(key) &&
        key !== "user" &&
        key !== "vendor" &&
        key !== "customer" &&
        key !== "business"
      ) {
        transformed[key] = await this.transformImageKeys(value);
      }
    }

    return transformed as unknown;
  }

  private async transformKeyToUrl(
    source: Record<string, unknown>,
    keyField: string,
    urlField: string,
    bucket: string,
  ): Promise<void> {
    const keyValue = source[keyField];

    if (typeof keyValue !== "string" || !this.isSafeKey(keyValue)) {
      return;
    }

    source[urlField] = await this.storageService.getPresignedObjectUrl(
      keyValue,
      bucket,
    );
  }

  private isSafeKey(key: string): boolean {
    return (
      key.length > 3 &&
      !key.includes("..") &&
      !key.includes("//") &&
      !key.startsWith("http://") &&
      !key.startsWith("https://")
    );
  }

  private isRelationField(fieldName: string): boolean {
    const relationFieldPatterns = [
      "id",
      "userId",
      "classId",
      "orderId",
      "productId",
      "enrollmentId",
      "categoryId",
      "createdAt",
      "updatedAt",
    ];
    return relationFieldPatterns.includes(fieldName);
  }
}
