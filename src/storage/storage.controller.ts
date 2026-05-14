import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  ServiceUnavailableException,
  Post,
  Query,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { AnyFilesInterceptor } from "@nestjs/platform-express";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { ResponseMessage } from "../common/decorators/response-message.decorator";
import { StorageService } from "./storage.service";
import { PresignedUploadDto } from "./dto/presigned-upload.dto";
import { PresignedDownloadDto } from "./dto/presigned-download.dto";
import { ObjectUrlQueryDto } from "./dto/object-url-query.dto";
import { DeleteObjectDto } from "./dto/delete-object.dto";
import { PublicPresignedUploadDto } from "./dto/public-presigned-upload.dto";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";

@Controller("storage")
export class StorageController {
  private readonly publicUploadPrefix =
    process.env.STORAGE_PUBLIC_UPLOAD_PREFIX ?? "temp/registrations/";
  private readonly publicUploadBucket =
    process.env.STORAGE_PUBLIC_UPLOAD_BUCKET ?? "profiles";

  constructor(private readonly storageService: StorageService) {}

  @Post("public/upload-file")
  @UseInterceptors(AnyFilesInterceptor())
  @ResponseMessage("File uploaded successfully")
  async uploadPublicFile(
    @UploadedFiles() files: Express.Multer.File[],
    @Body() dto: PublicPresignedUploadDto,
  ) {
    const file = files?.[0];

    if (!file) {
      throw new BadRequestException("file is required");
    }

    if (!this.storageService.isConfigured()) {
      throw new ServiceUnavailableException(
        "Storage service is not configured. Set STORAGE_ENDPOINT, STORAGE_ACCESS_KEY, and STORAGE_SECRET_KEY to upload files.",
      );
    }

    const bucket = dto.bucket ?? this.publicUploadBucket;
    const generatedKey = this.resolvePublicUploadKey(
      dto.key?.trim(),
      dto.filename ?? file.originalname,
      dto.mimeType ?? file.mimetype,
    );

    if (!this.isAllowedPublicUploadKey(generatedKey)) {
      throw new BadRequestException(
        `key must start with '${this.publicUploadPrefix}' and be a safe object key`,
      );
    }

    await this.storageService.uploadObject(
      file.buffer,
      bucket,
      generatedKey,
      file.mimetype,
    );

    const accessInfo = await this.storageService.getObjectAccessInfo(
      generatedKey,
      bucket,
    );

    return {
      key: generatedKey,
      objectKey: generatedKey,
      bucket,
      filename: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      temporary: true,
      url: accessInfo.url,
      restricted: accessInfo.restricted,
      accessType: accessInfo.accessType,
    };
  }

  @Post("public/presign-upload")
  @ResponseMessage("Public upload URL generated successfully")
  async getPublicPresignedUploadUrl(@Body() dto: PublicPresignedUploadDto) {
    const bucket = dto.bucket ?? this.publicUploadBucket;
    const trimmedKey = dto.key?.trim();
    const resolvedKey = this.resolvePublicUploadKey(
      trimmedKey,
      dto.filename,
      dto.mimeType,
    );

    if (!this.isAllowedPublicUploadKey(resolvedKey)) {
      throw new BadRequestException(
        `key must start with '${this.publicUploadPrefix}' and be a safe object key`,
      );
    }

    const expirySeconds = dto.expirySeconds ?? 600;
    const uploadUrl = await this.storageService.getPresignedUploadUrl(
      resolvedKey,
      bucket,
      expirySeconds,
    );

    return {
      key: resolvedKey,
      objectKey: resolvedKey,
      bucket,
      method: "PUT",
      expiresIn: expirySeconds,
      uploadUrl,
      temporary: true,
    };
  }

  @Post("presign-upload")
  @UseGuards(JwtAuthGuard)
  @ResponseMessage("Upload URL generated successfully")
  async getPresignedUploadUrl(@Body() dto: PresignedUploadDto) {
    const bucket = dto.bucket ?? this.storageService.getDefaultBucket();
    const uploadUrl = await this.storageService.getPresignedUploadUrl(
      dto.key,
      bucket,
      dto.expirySeconds,
    );

    return {
      key: dto.key,
      bucket,
      method: "PUT",
      expiresIn: dto.expirySeconds ?? undefined,
      uploadUrl,
    };
  }

  @Post("admin/presign-upload")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("vendor")
  @ResponseMessage("Admin upload URL generated successfully")
  async getAdminPresignedUploadUrl(@Body() dto: PresignedUploadDto) {
    const bucket = dto.bucket ?? this.storageService.getDefaultBucket();
    const uploadUrl = await this.storageService.getPresignedUploadUrl(
      dto.key,
      bucket,
      dto.expirySeconds,
    );

    return {
      key: dto.key,
      bucket,
      method: "PUT",
      expiresIn: dto.expirySeconds ?? undefined,
      uploadUrl,
    };
  }

  @Post("presign-download")
  @UseGuards(JwtAuthGuard)
  @ResponseMessage("Download URL generated successfully")
  async getPresignedDownloadUrl(@Body() dto: PresignedDownloadDto) {
    const bucket = dto.bucket ?? this.storageService.getDefaultBucket();
    const downloadUrl = await this.storageService.getPresignedObjectUrl(
      dto.key,
      bucket,
      dto.expirySeconds,
    );

    return {
      key: dto.key,
      bucket,
      expiresIn: dto.expirySeconds ?? undefined,
      downloadUrl,
    };
  }

  @Post("admin/presign-download")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("vendor")
  @ResponseMessage("Admin download URL generated successfully")
  async getAdminPresignedDownloadUrl(@Body() dto: PresignedDownloadDto) {
    const bucket = dto.bucket ?? this.storageService.getDefaultBucket();
    const downloadUrl = await this.storageService.getPresignedObjectUrl(
      dto.key,
      bucket,
      dto.expirySeconds,
    );

    return {
      key: dto.key,
      bucket,
      expiresIn: dto.expirySeconds ?? undefined,
      downloadUrl,
    };
  }

  @Get("object-url")
  @UseGuards(JwtAuthGuard)
  @ResponseMessage("Object URL generated successfully")
  getObjectUrl(@Query() query: ObjectUrlQueryDto) {
    const bucket = query.bucket ?? this.storageService.getDefaultBucket();

    return {
      key: query.key,
      bucket,
      objectUrl: this.storageService.getObjectUrl(query.key, bucket),
    };
  }

  @Get("admin/object-url")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("vendor")
  @ResponseMessage("Admin object URL generated successfully")
  getAdminObjectUrl(@Query() query: ObjectUrlQueryDto) {
    const bucket = query.bucket ?? this.storageService.getDefaultBucket();

    return {
      key: query.key,
      bucket,
      objectUrl: this.storageService.getObjectUrl(query.key, bucket),
    };
  }

  @Delete("object")
  @UseGuards(JwtAuthGuard)
  @ResponseMessage("Object deleted successfully")
  async deleteObject(@Body() dto: DeleteObjectDto) {
    const bucket = dto.bucket ?? this.storageService.getDefaultBucket();
    const deleted = await this.storageService.removeObject(dto.key, bucket);

    return {
      key: dto.key,
      bucket,
      deleted,
    };
  }

  @Delete("admin/object")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("vendor")
  @ResponseMessage("Admin object deleted successfully")
  async deleteAdminObject(@Body() dto: DeleteObjectDto) {
    const bucket = dto.bucket ?? this.storageService.getDefaultBucket();
    const deleted = await this.storageService.removeObject(dto.key, bucket);

    return {
      key: dto.key,
      bucket,
      deleted,
    };
  }

  private isAllowedPublicUploadKey(key: string): boolean {
    return (
      key.length > this.publicUploadPrefix.length &&
      key.startsWith(this.publicUploadPrefix) &&
      !key.includes("..") &&
      !key.includes("//") &&
      !key.startsWith("http://") &&
      !key.startsWith("https://")
    );
  }

  private resolvePublicUploadKey(
    key: string | undefined,
    filename: string | undefined,
    mimeType: string | undefined,
  ): string {
    if (key) {
      return key;
    }

    if (!filename || !mimeType) {
      throw new BadRequestException(
        "Either key or filename + mimeType must be provided",
      );
    }

    return this.generatePublicUploadKey(filename, mimeType);
  }

  private generatePublicUploadKey(filename: string, mimeType: string): string {
    const safeName = this.sanitizeFileBaseName(filename);
    const extension = this.resolveExtension(filename, mimeType);
    const timestamp = Date.now();
    const random = Math.random().toString(36).slice(2, 8);

    return `${this.publicUploadPrefix}${timestamp}-${random}-${safeName}.${extension}`;
  }

  private sanitizeFileBaseName(filename: string): string {
    const rawName = filename.split("/").pop() ?? "file";
    const withoutExtension = rawName.replace(/\.[^.]+$/, "");
    const normalized = withoutExtension
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    if (!normalized) {
      return "file";
    }

    return normalized.slice(0, 40);
  }

  private resolveExtension(filename: string, mimeType: string): string {
    const nameExtension = filename.split(".").pop()?.toLowerCase();
    const safeNameExtension =
      nameExtension && /^[a-z0-9]{1,10}$/.test(nameExtension)
        ? nameExtension
        : undefined;

    if (safeNameExtension) {
      return safeNameExtension;
    }

    const mimeToExtension: Record<string, string> = {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
      "image/gif": "gif",
      "application/pdf": "pdf",
    };

    return mimeToExtension[mimeType.toLowerCase()] ?? "bin";
  }
}
