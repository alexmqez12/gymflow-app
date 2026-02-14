import { IsUUID, IsOptional, IsString } from 'class-validator';

export class CreateCheckInDto {
  @IsUUID()
  gymId: string;

  @IsUUID()
  @IsOptional()
  userId?: string;

  @IsString()
  @IsOptional()
  rut?: string;

  @IsString()
  @IsOptional()
  qrCode?: string;

  @IsString()
  @IsOptional()
  eventId?: string;
}