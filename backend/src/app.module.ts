import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './modules/prisma/prisma.module';
import { GymsModule } from './modules/gyms/gyms.module';
import { CheckinsModule } from './modules/checkins/checkins.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    GymsModule,
    CheckinsModule,
  ],
})
export class AppModule {}
