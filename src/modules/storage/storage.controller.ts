import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { StorageService } from "./storage.service";

class CreateUploadDto {
  contentType!: string;
  folder!: string;
  fileName!: string;
}

@Controller("storage")
export class StorageController {
  constructor(private readonly storageService: StorageService) {}

  @Post("presigned-upload")
  async createPresignedUpload(@Body() dto: CreateUploadDto) {
    return this.storageService.generatePresignedUploadUrl(dto);
  }

  @Get("presigned-download/:objectName")
  async getPresignedDownload(@Param("objectName") objectName: string) {
    return {
      downloadUrl: await this.storageService.getPresignedDownloadUrl(
        decodeURIComponent(objectName),
      ),
    };
  }

  @Get("health")
  async health() {
    return this.storageService.verifyConnection();
  }
}
