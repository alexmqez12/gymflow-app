import { Controller, Get, Param } from '@nestjs/common';
import { GymsService } from './gyms.service';

@Controller('gyms')
export class GymsController {
  constructor(private readonly gymsService: GymsService) {}

  @Get()
  findAll() {
    return this.gymsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.gymsService.findOne(id);
  }

  @Get(':id/hourly-stats')
  getHourlyStats(@Param('id') id: string) {
    return this.gymsService.getHourlyStats(id);
  }

  @Get(':id/predictive')
  getPredictiveStats(@Param('id') id: string) {
    return this.gymsService.getPredictiveStats(id);
  }

  @Get('for-user/:userId')
  getGymsForUser(@Param('userId') userId: string) {
    return this.gymsService.getGymsForUser(userId);
  }
}