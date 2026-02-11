import { IsUUID, IsOptional } from 'class-validator';

export class CreateCheckInDto {
  @IsUUID()
  gymId: string;

  @IsUUID()
  @IsOptional()
  userId?: string;
}