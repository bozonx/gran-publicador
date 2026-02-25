import { IsArray, IsUUID } from 'class-validator';

export class ReorderSignaturesDto {
  @IsArray()
  @IsUUID('all', { each: true })
  signatureIds!: string[];
}
