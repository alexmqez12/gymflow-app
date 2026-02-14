import { IsEmail, IsString, MinLength, IsOptional, Matches } from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(3)
  name: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsString()
  @IsOptional()
  @Matches(/^\d{7,8}-[\dkK]$/, {
    message: 'RUT debe tener formato válido (ej: 12345678-9)',
  })
  rut?: string;

  @IsString()
  @IsOptional()
  gymId?: string;
}