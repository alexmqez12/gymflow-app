import { Controller, Get, Param, Post, Body } from '@nestjs/common';
import { MembershipsService } from './memberships.service';

@Controller('memberships')
export class MembershipsController {
  constructor(private readonly membershipsService: MembershipsService) {}

  @Get('user/:userId')
  getUserMembership(@Param('userId') userId: string) {
    return this.membershipsService.getUserMembership(userId);
  }

  @Get('user/:userId/gyms')
  getGymsForUser(@Param('userId') userId: string) {
    return this.membershipsService.getGymsForUser(userId);
  }

  @Get('user/:userId/gym/:gymId/validate')
  validateAccess(
    @Param('userId') userId: string,
    @Param('gymId') gymId: string,
  ) {
    return this.membershipsService.validateGymAccess(userId, gymId);
  }

  @Post('validate-rut')
  validateRut(@Body() body: { rut: string; gymId: string }) {
    return this.membershipsService.validateRutMembership(body.rut, body.gymId);
  }
}