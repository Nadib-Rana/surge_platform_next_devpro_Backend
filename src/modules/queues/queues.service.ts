import { Injectable, NotFoundException } from "@nestjs/common";
import { CreateQueueDto } from "./dto/create-queue.dto";
import { UpdateQueueDto } from "./dto/update-queue.dto";
import { Queue } from "./entities/queue.entity";

@Injectable()
export class QueuesService {
  private readonly queues: Queue[] = [];

  create(createQueueDto: CreateQueueDto) {
    const queue: Queue = {
      id: crypto.randomUUID(),
      name: createQueueDto.name,
      description: createQueueDto.description ?? null,
      status: createQueueDto.status ?? "active",
      createdAt: new Date(),
    };

    this.queues.push(queue);
    return queue;
  }

  findAll() {
    return this.queues
      .slice()
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  findOne(id: string) {
    const queue = this.queues.find((item) => item.id === id);

    if (!queue) {
      throw new NotFoundException(`Queue ${id} not found`);
    }

    return queue;
  }

  update(id: string, updateQueueDto: UpdateQueueDto) {
    const queue = this.queues.find((item) => item.id === id);

    if (!queue) {
      throw new NotFoundException(`Queue ${id} not found`);
    }

    Object.assign(queue, {
      ...updateQueueDto,
      ...(updateQueueDto.name ? { name: updateQueueDto.name } : {}),
      ...(updateQueueDto.description !== undefined
        ? { description: updateQueueDto.description }
        : {}),
      ...(updateQueueDto.status ? { status: updateQueueDto.status } : {}),
    });

    return queue;
  }

  remove(id: string) {
    const index = this.queues.findIndex((item) => item.id === id);

    if (index === -1) {
      throw new NotFoundException(`Queue ${id} not found`);
    }

    const [removed] = this.queues.splice(index, 1);
    return removed;
  }
}
