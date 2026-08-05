import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../../common/context/prisma.service";
import { CreateCompanyDto } from "./dto/create-company.dto";
import { UpdateCompanyDto } from "./dto/update-company.dto";

interface AuthenticatedUser {
  userId: string;
  role: string;
}

@Injectable()
export class CompaniesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createCompanyDto: CreateCompanyDto, user: AuthenticatedUser) {
    return this.prisma.company.create({
      data: {
        ownerId: user.userId,
        name: createCompanyDto.name,
        status: "active",
      },
    });
  }

  findAll(user: AuthenticatedUser) {
    if (user.role === "admin") {
      return this.prisma.company.findMany({
        orderBy: { createdAt: "desc" },
      });
    }

    return this.prisma.company.findMany({
      where: { ownerId: user.userId },
      orderBy: { createdAt: "desc" },
    });
  }

  async findMine(user: AuthenticatedUser) {
    const company = await this.prisma.company.findFirst({
      where: { ownerId: user.userId },
      orderBy: { createdAt: "desc" },
    });
    return company || null;
  }

  async findOne(id: string, user: AuthenticatedUser) {
    const company = await this.prisma.company.findUnique({
      where: { id },
    });

    if (!company) {
      throw new NotFoundException(`Company ${id} not found`);
    }

    if (user.role !== "admin" && company.ownerId !== user.userId) {
      throw new ForbiddenException("You can only view your own company");
    }

    return company;
  }

  async update(
    id: string,
    updateCompanyDto: UpdateCompanyDto,
    user: AuthenticatedUser,
  ) {
    if (!updateCompanyDto.name) {
      throw new BadRequestException("name is required");
    }

    const company = await this.prisma.company.findUnique({
      where: { id },
      select: { id: true, ownerId: true },
    });

    if (!company) {
      throw new NotFoundException(`Company ${id} not found`);
    }

    if (user.role !== "admin" && company.ownerId !== user.userId) {
      throw new ForbiddenException("You can only update your own company");
    }

    return this.prisma.company.update({
      where: { id },
      data: { name: updateCompanyDto.name },
    });
  }

  async remove(id: string, user: AuthenticatedUser) {
    const company = await this.prisma.company.findUnique({
      where: { id },
      select: { id: true, ownerId: true },
    });

    if (!company) {
      throw new NotFoundException(`Company ${id} not found`);
    }

    if (user.role !== "admin" && company.ownerId !== user.userId) {
      throw new ForbiddenException("You can only delete your own company");
    }

    return this.prisma.company.delete({ where: { id } });
  }
}
