import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  BadRequestException,
  Query,
} from '@nestjs/common';
import { CheckinsService } from './checkins.service';
import { CheckinsGateway } from './checkins.gateway';
import { CreateCheckInDto } from './dto';

@Controller('checkins')
export class CheckinsController {
  constructor(
    private readonly checkinsService: CheckinsService,
    private readonly checkinsGateway: CheckinsGateway,
  ) {}

  @Post()
  async checkIn(@Body() createCheckInDto: CreateCheckInDto) {
    const checkin = await this.checkinsService.checkIn(createCheckInDto);
    
    // Emitir evento WebSocket
    this.checkinsGateway.emitCheckIn(checkin.gymId, checkin);
    
    return checkin;
  }

  @Put(':id/checkout')
  async checkOut(@Param('id') id: string) {
    const checkin = await this.checkinsService.checkOut(id);
    
    // Emitir evento WebSocket
    this.checkinsGateway.emitCheckOut(checkin.gym.id, checkin);
    
    return checkin;
  }

  @Get('gym/:gymId/active')
  findActiveByGym(@Param('gymId') gymId: string) {
    return this.checkinsService.findActiveByGym(gymId);
  }

  @Get('active/:gymId/:identifier')
  async getActiveCheckin(
    @Param('gymId') gymId: string,
    @Param('identifier') identifier: string,
  ) {
    return this.checkinsService.getActiveCheckin(gymId, identifier);
  }

  @Get('gym/:gymId/capacity')
  getCurrentCapacity(@Param('gymId') gymId: string) {
    return this.checkinsService.getCurrentCapacity(gymId);
  }

  @Get('user/:userId/active')
  getMyActiveCheckins(@Param('userId') userId: string) {
    return this.checkinsService.getMyActiveCheckins(userId);
  }

  // Simulador de torniquete (solo desarrollo)
  @Post('simulate')
  async simulateTurnstile(@Body() body: { gymId: string; rut?: string; qrCode?: string; event: 'entry' | 'exit'; eventId?: string }) {
    if (process.env.NODE_ENV === 'production') {
      throw new BadRequestException('No disponible en producción');
    }

    if (body.event === 'entry') {
      return this.checkinsService.checkIn({
        gymId: body.gymId,
        userId: undefined,
        rut: body.rut,
        qrCode: body.qrCode,
        eventId: body.eventId,
      });
    } else {
      return this.checkinsService.checkOutByUser({
        gymId: body.gymId,
        rut: body.rut,
        qrCode: body.qrCode,
      });
    }
  }

  @Get('dashboard/staff/:gymId')
  getStaffDashboard(@Param('gymId') gymId: string) {
    return this.checkinsService.getStaffDashboard(gymId);
  }

  @Get('dashboard/owner/:gymId')
  getOwnerDashboard(
    @Param('gymId') gymId: string,
    @Query('days') days?: string,
  ) {
    return this.checkinsService.getOwnerDashboard(gymId, days ? parseInt(days) : 30);
  }
}