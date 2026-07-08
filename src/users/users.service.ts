import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../common/context/prisma.service";
import { UpdateCurrentUserDto } from "./dto/update-current-user.dto";

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getMyProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        fullName: true,
        email: true,
        phoneNumber: true,
        role: true,
        avatarKey: true,
        isVerified: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    return {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      phoneNumber: user.phoneNumber,
      role: user.role,
      avatarKey: user.avatarKey,
      isVerified: user.isVerified,
      createdAt: user.createdAt,
    };
  }

  async updateMyProfile(userId: string, dto: UpdateCurrentUserDto) {
    if (
      dto.fullName === undefined &&
      dto.phoneNumber === undefined &&
      dto.avatarKey === undefined
    ) {
      throw new BadRequestException("At least one profile field is required");
    }

    try {
      const user = await this.prisma.user.update({
        where: { id: userId },
        data: {
          fullName: dto.fullName,
          phoneNumber: dto.phoneNumber,
          avatarKey: dto.avatarKey,
        },
        select: {
          id: true,
          fullName: true,
          email: true,
          phoneNumber: true,
          role: true,
          avatarKey: true,
          isVerified: true,
          createdAt: true,
        },
      });

      return {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        phoneNumber: user.phoneNumber,
        role: user.role,
        avatarKey: user.avatarKey,
        isVerified: user.isVerified,
        createdAt: user.createdAt,
      };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === "P2025") {
          throw new NotFoundException("User not found");
        }

        if (error.code === "P2002") {
          throw new ConflictException("Phone number is already in use");
        }
      }

      throw error;
    }
  }
}
