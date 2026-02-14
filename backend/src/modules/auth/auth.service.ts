import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto, LoginDto, GymAccessDto } from './dto';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async register(registerDto: RegisterDto) {
    const { email, password, name, rut, gymId } = registerDto;

    // Verificar email único
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });
    if (existingUser) {
      throw new ConflictException('El email ya está registrado');
    }

    // Verificar RUT único
    if (rut) {
      const existingRut = await this.prisma.user.findUnique({
        where: { rut },
      });
      if (existingRut) {
        throw new ConflictException('El RUT ya está registrado');
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const qrCode = this.generateQRCode();

    // Crear usuario
    const user = await this.prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        rut,
        qrCode,
      },
      select: {
        id: true,
        email: true,
        name: true,
        rut: true,
        qrCode: true,
        role: true,
        createdAt: true,
      },
    });

    // Crear membresía si viene un gymId
    if (gymId) {
      const gym = await this.prisma.gym.findUnique({
        where: { id: gymId },
      });

      if (gym) {
        const membership = await this.prisma.membership.create({
          data: {
            userId: user.id,
            type: gym.chain ? gym.chain.toUpperCase() as any : 'BASIC',
            status: 'ACTIVE',
            startDate: new Date(),
            endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          },
        });

        // Si tiene cadena, agregar TODOS los gyms de esa cadena
        if (gym.chain) {
          const chainGyms = await this.prisma.gym.findMany({
            where: { chain: gym.chain, isActive: true },
          });
          for (const chainGym of chainGyms) {
            await this.prisma.membershipGym.create({
              data: { membershipId: membership.id, gymId: chainGym.id },
            });
          }
        } else {
          // Sin cadena, solo ese gym
          await this.prisma.membershipGym.create({
            data: { membershipId: membership.id, gymId: gym.id },
          });
        }
      }
    }

    const token = this.generateToken(user.id, user.email);
    return { user, token };
  }

  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;

    // Buscar usuario
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    // Verificar password
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    // Generar token
    const token = this.generateToken(user.id, user.email);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        rut: user.rut,
        qrCode: user.qrCode,
        role: user.role,
      },
      token,
    };
  }

  async validateGymAccess(accessDto: GymAccessDto) {
    const { gymId, rut, qrCode } = accessDto;

    // Buscar usuario por RUT o QR
    let user;
    if (rut) {
      user = await this.prisma.user.findUnique({
        where: { rut },
      });
    } else if (qrCode) {
      user = await this.prisma.user.findUnique({
        where: { qrCode },
      });
    }

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    // Después de encontrar el user, agregar:
    if (user.role !== 'ADMIN') {
      const membership = await this.prisma.membership.findUnique({
        where: { userId: user.id },
        include: { gyms: true },
      });

      if (!membership || membership.status !== 'ACTIVE') {
        throw new ForbiddenException('No tienes membresía activa');
      }

      const hasAccess = membership.gyms.some(mg => mg.gymId === gymId);
      if (!hasAccess) {
        throw new ForbiddenException('Tu membresía no incluye acceso a este gimnasio');
      }
    }

    // Verificar si el gimnasio existe
    const gym = await this.prisma.gym.findUnique({
      where: { id: gymId },
      include: {
        _count: {
          select: {
            checkins: {
              where: { checkedOut: null },
            },
          },
        },
      },
    });

    if (!gym) {
      throw new NotFoundException('Gimnasio no encontrado');
    }

    // Verificar capacidad
    if (gym._count.checkins >= gym.maxCapacity) {
      throw new ConflictException('El gimnasio está en capacidad máxima');
    }

    // Verificar si ya tiene check-in activo
    const activeCheckin = await this.prisma.checkIn.findFirst({
      where: {
        userId: user.id,
        gymId,
        checkedOut: null,
      },
    });

    if (activeCheckin) {
      // En lugar de rechazar, hacer check-out automático
      const checkout = await this.prisma.checkIn.update({
        where: { id: activeCheckin.id },
        data: { checkedOut: new Date() },
        include: {
          gym: true,
          user: {
            select: {
              id: true,
              name: true,
              rut: true,
            },
          },
        },
      });

      return {
        success: true,
        message: 'Check-out realizado',
        isCheckout: true,  // ← Nuevo campo
        checkin: checkout,
        user: {
          id: user.id,
          name: user.name,
          rut: user.rut,
        },
      };
    }

    // Crear check-in
    const checkin = await this.prisma.checkIn.create({
      data: {
        gymId,
        userId: user.id,
      },
      include: {
        gym: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            rut: true,
          },
        },
      },
    });

    return {
      success: true,
      message: 'Acceso concedido',
      checkin,
      user: {
        id: user.id,
        name: user.name,
        rut: user.rut,
      },
    };
  }

  async getMyProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        rut: true,
        qrCode: true,
        role: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    return user;
  }

  private generateToken(userId: string, email: string): string {
    const payload = { sub: userId, email };
    return this.jwtService.sign(payload);
  }

  private generateQRCode(): string {
    // Generar código único de 16 caracteres
    return randomBytes(8).toString('hex').toUpperCase();
  }
}