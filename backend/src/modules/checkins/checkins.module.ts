import { Module } from '@nestjs/common';
import { CheckinsController } from './checkins.controller';
import { CheckinsService } from './checkins.service';
import { CheckinsGateway } from './checkins.gateway';

@Module({
  controllers: [CheckinsController],
  providers: [CheckinsService, CheckinsGateway],
  exports: [CheckinsService, CheckinsGateway],
})
export class CheckinsModule {}