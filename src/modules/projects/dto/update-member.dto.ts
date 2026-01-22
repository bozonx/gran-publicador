import { IsUUID } from 'class-validator';

export class UpdateMemberDto {
  @IsUUID()
  public roleId!: string;
}

