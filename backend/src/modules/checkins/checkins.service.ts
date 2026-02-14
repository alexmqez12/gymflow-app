import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCheckInDto } from './dto';

@Injectable()
export class CheckinsService {
  constructor(private prisma: PrismaService) {}

  async checkIn(createCheckInDto: CreateCheckInDto) {
    const { gymId, userId, rut, qrCode, eventId } = createCheckInDto;

    // Idempotencia: verificar si el evento ya fue procesado
    if (eventId) {
      const existing = await this.prisma.checkIn.findFirst({
        where: { eventId },
      });
      if (existing) {
        return existing;
      }
    }

    // Resolver userId desde RUT o QR si no viene directo
    let resolvedUserId = userId;

    if (!resolvedUserId && (rut || qrCode)) {
      const user = await this.prisma.user.findFirst({
        where: {
          OR: [
            ...(rut ? [{ rut }] : []),
            ...(qrCode ? [{ qrCode }] : []),
          ],
        },
      });
      if (!user) throw new NotFoundException('Usuario no encontrado');
      resolvedUserId = user.id;
    }

    // Verificar si el gimnasio existe y tiene capacidad
    const gym = await this.prisma.gym.findUnique({
      where: { id: gymId },
      include: {
        _count: {
          select: {
            checkins: { where: { checkedOut: null } },
          },
        },
      },
    });

    if (!gym) throw new NotFoundException('Gimnasio no encontrado');
    if (!gym.isActive) throw new BadRequestException('El gimnasio no está activo');
    if (gym._count.checkins >= gym.maxCapacity) {
      throw new BadRequestException('El gimnasio está en capacidad máxima');
    }

    // Verificar si el usuario ya tiene check-in activo
    if (resolvedUserId) {
      const activeCheckin = await this.prisma.checkIn.findFirst({
        where: { gymId, userId: resolvedUserId, checkedOut: null },
      });
      if (activeCheckin) {
        throw new BadRequestException('Ya tienes un check-in activo en este gimnasio');
      }
    }

    // Crear el check-in
    const checkin = await this.prisma.checkIn.create({
      data: {
        gymId,
        userId: resolvedUserId,
        eventId: eventId || null,
      },
      include: {
        gym: {
          select: { id: true, name: true, maxCapacity: true },
        },
        user: resolvedUserId ? {
          select: { id: true, name: true, email: true },
        } : false,
      },
    });

    return checkin;
  }

  async checkOut(id: string) {
    const checkin = await this.prisma.checkIn.findUnique({
      where: { id },
      include: {
        gym: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!checkin) {
      throw new NotFoundException('Check-in no encontrado');
    }

    if (checkin.checkedOut) {
      throw new BadRequestException('Ya se realizó el check-out');
    }

    const updatedCheckin = await this.prisma.checkIn.update({
      where: { id },
      data: {
        checkedOut: new Date(),
      },
      include: {
        gym: {
          select: {
            id: true,
            name: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return updatedCheckin;
  }

  async findActiveByGym(gymId: string) {
    return this.prisma.checkIn.findMany({
      where: {
        gymId,
        checkedOut: null,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        checkedIn: 'desc',
      },
    });
  }

  async getCurrentCapacity(gymId: string) {
    const count = await this.prisma.checkIn.count({
      where: {
        gymId,
        checkedOut: null,
      },
    });

    const gym = await this.prisma.gym.findUnique({
      where: { id: gymId },
      select: {
        maxCapacity: true,
        name: true,
      },
    });

    if (!gym) {
      throw new NotFoundException('Gimnasio no encontrado');
    }

    return {
      gymId,
      gymName: gym.name,
      current: count,
      max: gym.maxCapacity,
      available: gym.maxCapacity - count,
      percentage: Math.round((count / gym.maxCapacity) * 100),
    };
  }

  async getMyActiveCheckins(userId: string) {
    return this.prisma.checkIn.findMany({
      where: {
        userId,
        checkedOut: null,
      },
      include: {
        gym: {
          select: {
            id: true,
            name: true,
            address: true,
            maxCapacity: true,
          },
        },
      },
      orderBy: {
        checkedIn: 'desc',
      },
    });
  }

  async getActiveCheckin(gymId: string, identifier: string) {
    // Buscar usuario por RUT o QR
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { rut: identifier },
          { qrCode: identifier },
        ],
      },
    });

    if (!user) return { isInside: false };

    const active = await this.prisma.checkIn.findFirst({
      where: { gymId, userId: user.id, checkedOut: null },
    });

    return {
      isInside: !!active,
      userId: user.id,
      userName: user.name,
    };
  }

  async checkOutByUser(dto: { gymId: string; rut?: string; qrCode?: string }) {
    // Buscar usuario por RUT o QR
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [
          ...(dto.rut ? [{ rut: dto.rut }] : []),
          ...(dto.qrCode ? [{ qrCode: dto.qrCode }] : []),
        ],
      },
    });

    if (!user) throw new NotFoundException('Usuario no encontrado');

    // Buscar check-in activo
    const activeCheckin = await this.prisma.checkIn.findFirst({
      where: { userId: user.id, gymId: dto.gymId, checkedOut: null },
    });

    if (!activeCheckin) throw new NotFoundException('No hay check-in activo');

    return this.checkOut(activeCheckin.id);
  }

  async getStaffDashboard(gymId: string): Promise<any> {
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);

    // ── Gym info ──────────────────────────────────────────
    const gym = await this.prisma.gym.findUnique({
      where: { id: gymId },
      include: {
        _count: {
          select: { checkins: { where: { checkedOut: null } } },
        },
      },
    });
    if (!gym) throw new NotFoundException('Gimnasio no encontrado');

    const currentInside = gym._count.checkins;
    const occupancyPct = Math.round((currentInside / gym.maxCapacity) * 100);

    // ── Usuarios activos ahora ────────────────────────────
    const activeCheckins = await this.prisma.checkIn.findMany({
      where: { gymId, checkedOut: null },
      include: {
        user: {
          include: {
            membership: true,
          },
        },
      },
      orderBy: { checkedIn: 'desc' },
    });

    const activeUsers = activeCheckins
      .filter(c => c.user)
      .map(c => {
        const minutesInside = Math.round(
          (now.getTime() - new Date(c.checkedIn).getTime()) / 60000
        );
        return {
          id: c.user!.id,
          name: c.user!.name,
          rut: c.user!.rut || 'N/A',
          membershipType: c.user!.membership?.type || 'N/A',
          checkedInAt: new Date(c.checkedIn).toLocaleTimeString('es-CL', {
            hour: '2-digit', minute: '2-digit',
          }),
          minutesInside,
          checkinId: c.id,
        };
      });

    // ── Actividad del día (entradas + salidas) ────────────
    const todayCheckins = await this.prisma.checkIn.findMany({
      where: {
        gymId,
        checkedIn: { gte: startOfDay },
      },
      include: {
        user: {
          include: { membership: true },
        },
      },
      orderBy: { checkedIn: 'desc' },
      take: 50,
    });

    const todayActivity: any[] = [];
    todayCheckins.forEach(c => {
      // Entrada
      todayActivity.push({
        id: `${c.id}-in`,
        userName: c.user?.name || 'Desconocido',
        type: 'entry',
        time: new Date(c.checkedIn).toLocaleTimeString('es-CL', {
          hour: '2-digit', minute: '2-digit',
        }),
        membershipType: c.user?.membership?.type || 'N/A',
        timestamp: new Date(c.checkedIn).getTime(),
      });
      // Salida (si existe)
      if (c.checkedOut) {
        todayActivity.push({
          id: `${c.id}-out`,
          userName: c.user?.name || 'Desconocido',
          type: 'exit',
          time: new Date(c.checkedOut).toLocaleTimeString('es-CL', {
            hour: '2-digit', minute: '2-digit',
          }),
          membershipType: c.user?.membership?.type || 'N/A',
          timestamp: new Date(c.checkedOut).getTime(),
        });
      }
    });

    todayActivity.sort((a, b) => b.timestamp - a.timestamp);

    // ── Stats del día ─────────────────────────────────────
    const totalVisitsToday = todayCheckins.length;

    // Ocupación por hora para encontrar pico
    const hourlyToday: Array<{ hour: number; label: string; count: number; percentage: number }> = [];
    let peakCount = 0;
    let peakHour = '00:00';

    for (let h = 0; h <= now.getHours(); h++) {
      const hStart = new Date(startOfDay);
      hStart.setHours(h, 0, 0, 0);
      const hEnd = new Date(startOfDay);
      hEnd.setHours(h, 59, 59, 999);

      const count = todayCheckins.filter(c => {
        const ci = new Date(c.checkedIn);
        const co = c.checkedOut ? new Date(c.checkedOut) : now;
        return ci <= hEnd && co >= hStart;
      }).length;

      if (count > peakCount) {
        peakCount = count;
        peakHour = `${h.toString().padStart(2, '0')}:00`;
      }

      hourlyToday.push({
        hour: h,
        label: `${h.toString().padStart(2, '0')}:00`,
        count,
        percentage: Math.round((count / gym.maxCapacity) * 100),
      });
    }

    // Tiempo promedio dentro
    const completedCheckins = todayCheckins.filter(c => c.checkedOut);
    const avgTimeInside = completedCheckins.length > 0
      ? Math.round(
          completedCheckins.reduce((sum, c) => {
            return sum + (new Date(c.checkedOut!).getTime() - new Date(c.checkedIn).getTime());
          }, 0) / completedCheckins.length / 60000
        )
      : 0;

    // ── Alertas ───────────────────────────────────────────
    const alerts: any[] = [];

    if (occupancyPct >= 95) {
      alerts.push({ type: 'critical', message: `¡Aforo crítico! ${currentInside}/${gym.maxCapacity} personas` });
    } else if (occupancyPct >= 80) {
      alerts.push({ type: 'warning', message: `Aforo alto: ${occupancyPct}% de capacidad` });
    }

    if (avgTimeInside > 120) {
      alerts.push({ type: 'info', message: `Tiempo promedio alto: ${avgTimeInside} min por visita` });
    }

    if (totalVisitsToday > gym.maxCapacity * 2) {
      alerts.push({ type: 'info', message: `Día de alta demanda: ${totalVisitsToday} visitas` });
    }

    return {
      gym: {
        id: gym.id,
        name: gym.name,
        maxCapacity: gym.maxCapacity,
        currentCapacity: currentInside,
        occupancyPercentage: occupancyPct,
      },
      activeUsers,
      todayActivity: todayActivity.slice(0, 30),
      stats: {
        totalVisitsToday,
        currentInside,
        peakToday: peakCount,
        peakHour,
        avgTimeInside,
      },
      hourlyToday,
      alerts,
    };
  }

  async getOwnerDashboard(gymId: string, days: number = 30): Promise<any> {
    const now = new Date();
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    const gym = await this.prisma.gym.findUnique({
      where: { id: gymId },
      include: {
        _count: {
          select: { checkins: { where: { checkedOut: null } } },
        },
      },
    });
    if (!gym) throw new NotFoundException('Gimnasio no encontrado');

    // ── Membresías del gym ────────────────────────────────
    const memberships = await this.prisma.membership.findMany({
      where: {
        gyms: { some: { gymId } },
      },
      include: {
        user: { select: { id: true, name: true, createdAt: true } },
      },
    });

    const activeMemberships = memberships.filter(m => m.status === 'ACTIVE');
    const expiredMemberships = memberships.filter(m => m.status !== 'ACTIVE');

    // ── Distribución por tipo ─────────────────────────────
    const membershipDistribution: Record<string, number> = {};
    activeMemberships.forEach(m => {
      membershipDistribution[m.type] = (membershipDistribution[m.type] || 0) + 1;
    });

    // ── Ingresos estimados ────────────────────────────────
    // Precios estimados por tipo (en CLP)
    const membershipPrices: Record<string, number> = {
      BASIC: 19990,
      SMARTFIT: 29990,
      POWERFIT: 34990,
      PREMIUM: 49990,
      CUSTOM: 39990,
    };

    const estimatedMonthlyRevenue = activeMemberships.reduce((sum, m) => {
      return sum + (membershipPrices[m.type] || 29990);
    }, 0);

    // ── Checkins del período ──────────────────────────────
    const checkins = await this.prisma.checkIn.findMany({
      where: {
        gymId,
        checkedIn: { gte: startDate },
      },
      include: {
        user: { select: { id: true } },
      },
      orderBy: { checkedIn: 'asc' },
    });

    // ── Comparativa día a día ─────────────────────────────
    const dailyStats: Record<string, number> = {};
    checkins.forEach(c => {
      const dateKey = new Date(c.checkedIn).toLocaleDateString('es-CL', {
        day: '2-digit', month: '2-digit',
      });
      dailyStats[dateKey] = (dailyStats[dateKey] || 0) + 1;
    });

    const dailyData = Object.entries(dailyStats).map(([date, visits]) => ({
      date,
      visits,
      percentage: Math.round((visits / gym.maxCapacity) * 100),
    }));

    // ── Comparativa mes a mes ─────────────────────────────
    const monthlyStats: Record<string, { visits: number; uniqueUsers: Set<string> }> = {};
    checkins.forEach(c => {
      const monthKey = new Date(c.checkedIn).toLocaleDateString('es-CL', {
        month: 'short', year: 'numeric',
      });
      if (!monthlyStats[monthKey]) {
        monthlyStats[monthKey] = { visits: 0, uniqueUsers: new Set() };
      }
      monthlyStats[monthKey].visits++;
      if (c.user?.id) monthlyStats[monthKey].uniqueUsers.add(c.user.id);
    });

    const monthlyData = Object.entries(monthlyStats).map(([month, data]) => ({
      month,
      visits: data.visits,
      uniqueUsers: data.uniqueUsers.size,
    }));

    // ── Ranking horas más rentables ───────────────────────
    const hourlyStats: Record<number, number> = {};
    checkins.forEach(c => {
      const hour = new Date(c.checkedIn).getHours();
      hourlyStats[hour] = (hourlyStats[hour] || 0) + 1;
    });

    const hourlyRanking = Object.entries(hourlyStats)
      .map(([hour, visits]) => ({
        hour: parseInt(hour),
        label: `${hour.toString().padStart(2, '0')}:00`,
        visits,
        avgPerDay: Math.round(visits / days),
        revenueIndex: Math.round((visits / (checkins.length || 1)) * 100),
      }))
      .sort((a, b) => b.visits - a.visits)
      .slice(0, 8);

    // ── Tasa de retención ─────────────────────────────────
    const userVisitCount: Record<string, number> = {};
    checkins.forEach(c => {
      if (c.user?.id) {
        userVisitCount[c.user.id] = (userVisitCount[c.user.id] || 0) + 1;
      }
    });

    const totalUniqueUsers = Object.keys(userVisitCount).length;
    const returningUsers = Object.values(userVisitCount).filter(v => v > 1).length;
    const retentionRate = totalUniqueUsers > 0
      ? Math.round((returningUsers / totalUniqueUsers) * 100)
      : 0;

    const loyalUsers = Object.values(userVisitCount).filter(v => v >= 5).length;
    const avgVisitsPerUser = totalUniqueUsers > 0
      ? Math.round((checkins.length / totalUniqueUsers) * 10) / 10
      : 0;

    // ── Tasa de ocupación promedio ────────────────────────
    const avgOccupancyByHour: Record<number, number[]> = {};
    checkins.forEach(c => {
      const hour = new Date(c.checkedIn).getHours();
      if (!avgOccupancyByHour[hour]) avgOccupancyByHour[hour] = [];
      avgOccupancyByHour[hour].push(1);
    });

    // ── Nuevos miembros en el período ─────────────────────
    const newMembersInPeriod = memberships.filter(m => {
      return new Date(m.startDate) >= startDate;
    }).length;

    // ── Churn rate (membresías vencidas vs total) ─────────
    const churnRate = memberships.length > 0
      ? Math.round((expiredMemberships.length / memberships.length) * 100)
      : 0;

    // ── Días con mayor ocupación ──────────────────────────
    const topDays = [...dailyData]
      .sort((a, b) => b.visits - a.visits)
      .slice(0, 3);

    // ── Proyección ingresos próximo mes ──────────────────
    const renewalRate = 100 - churnRate;
    const projectedRevenue = Math.round(estimatedMonthlyRevenue * (renewalRate / 100));

    return {
      gym: {
        id: gym.id,
        name: gym.name,
        maxCapacity: gym.maxCapacity,
        currentCapacity: gym._count.checkins,
      },
      period: { days, startDate: startDate.toISOString(), endDate: now.toISOString() },

      // KPIs principales
      kpis: {
        totalMembers: memberships.length,
        activeMembers: activeMemberships.length,
        inactiveMembers: expiredMemberships.length,
        newMembersInPeriod,
        retentionRate,
        churnRate,
        loyalUsers,
        avgVisitsPerUser,
        totalVisitsInPeriod: checkins.length,
        avgDailyVisits: days > 0 ? Math.round(checkins.length / days) : 0,
      },

      // Finanzas
      revenue: {
        estimatedMonthly: estimatedMonthlyRevenue,
        projectedNextMonth: projectedRevenue,
        avgPerMember: activeMemberships.length > 0
          ? Math.round(estimatedMonthlyRevenue / activeMemberships.length)
          : 0,
        distribution: membershipDistribution,
      },

      // Gráficos
      charts: {
        daily: dailyData.slice(-30),
        monthly: monthlyData,
        hourlyRanking,
        membershipTypes: Object.entries(membershipDistribution).map(([type, count]) => ({
          type,
          count,
          percentage: Math.round((count / (activeMemberships.length || 1)) * 100),
          estimatedRevenue: count * (membershipPrices[type] || 29990),
        })),
      },

      topDays,
    };
  }
}