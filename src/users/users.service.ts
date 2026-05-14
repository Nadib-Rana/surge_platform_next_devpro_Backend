import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../common/context/prisma.service";
import { StorageService } from "../storage/storage.service";

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
  ) {}

  async getMyProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        fullName: true,
        email: true,
        phoneNumber: true,
        role: true,
        age: true,
        gender: true,
        avatarKey: true,
        isVerified: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    const avatarUrl = user.avatarKey
      ? await this.storageService.getPresignedObjectUrl(
          user.avatarKey,
          "profiles",
        )
      : null;

    return {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      phoneNumber: user.phoneNumber,
      role: user.role,
      age: user.age,
      gender: user.gender,
      avatarUrl,
      isVerified: user.isVerified,
      createdAt: user.createdAt,
    };
  }
}
