import { IsBoolean, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

/**
 * DTO for transferring project ownership to another user.
 */
export class TransferProjectDto {
  /**
   * Username or Telegram ID of the target user who will become the new owner.
   */
  @IsString()
  @IsNotEmpty()
  targetUsername!: string;

  /**
   * Whether to clear credentials (access tokens, etc.) of all project channels during transfer.
   * Defaults to true for security reasons.
   */
  @IsBoolean()
  @IsOptional()
  clearCredentials?: boolean = true;

  /**
   * Project name for confirmation.
   */
  @IsString()
  @IsNotEmpty()
  projectName!: string;
}
