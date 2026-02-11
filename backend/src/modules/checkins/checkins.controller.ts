import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
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

  @Get('gym/:gymId/capacity')
  getCurrentCapacity(@Param('gymId') gymId: string) {
    return this.checkinsService.getCurrentCapacity(gymId);
  }

  @Get('user/:userId/active')
  getMyActiveCheckins(@Param('userId') userId: string) {
    return this.checkinsService.getMyActiveCheckins(userId);
  }
}