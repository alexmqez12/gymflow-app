import { IsString, IsUUID, IsOptional } from 'class-validator';

export class GymAccessDto {
  @IsUUID()
  gymId: string;

  @IsString()
  @IsOptional()
  rut?: string; // Para acceso por RUT

  @IsString()
  @IsOptional()
  qrCode?: string; // Para acceso por QR
}