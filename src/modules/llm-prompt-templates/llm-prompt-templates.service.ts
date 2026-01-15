import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateLlmPromptTemplateDto } from './dto/create-llm-prompt-template.dto.js';
import { UpdateLlmPromptTemplateDto } from './dto/update-llm-prompt-template.dto.js';

@Injectable()
export class LlmPromptTemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createDto: CreateLlmPromptTemplateDto) {
    // Validate that either userId or projectId is provided, but not both
    if (createDto.userId && createDto.projectId) {
      throw new BadRequestException(
        'Cannot specify both userId and projectId',
      );
    }

    if (!createDto.userId && !createDto.projectId) {
      throw new BadRequestException(
        'Must specify either userId or projectId',
      );
    }

    return this.prisma.llmPromptTemplate.create({
      data: createDto,
    });
  }

  async findAllByUser(userId: string) {
    return this.prisma.llmPromptTemplate.findMany({
      where: { userId },
      orderBy: { order: 'asc' },
    });
  }

  async findAllByProject(projectId: string) {
    return this.prisma.llmPromptTemplate.findMany({
      where: { projectId },
      orderBy: { order: 'asc' },
    });
  }

  async findOne(id: string) {
    const template = await this.prisma.llmPromptTemplate.findUnique({
      where: { id },
    });

    if (!template) {
      throw new NotFoundException(`Template with ID ${id} not found`);
    }

    return template;
  }

  async update(id: string, updateDto: UpdateLlmPromptTemplateDto) {
    await this.findOne(id);

    return this.prisma.llmPromptTemplate.update({
      where: { id },
      data: updateDto,
    });
  }

  async remove(id: string) {
    await this.findOne(id);

    return this.prisma.llmPromptTemplate.delete({
      where: { id },
    });
  }

  async reorder(ids: string[]) {
    // Update order for each template
    const updates = ids.map((id, index) =>
      this.prisma.llmPromptTemplate.update({
        where: { id },
        data: { order: index },
      }),
    );

    await this.prisma.$transaction(updates);

    return { success: true };
  }
}
