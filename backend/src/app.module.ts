import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './modules/prisma/prisma.module';
import { GymsModule } from './modules/gyms/gyms.module';
import { CheckinsModule } from './modules/checkins/checkins.module';
import { AuthModule } from './modules/auth/auth.module';
import { MembershipsModule } from './modules/memberships/memberships.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    GymsModule,
    CheckinsModule,
    AuthModule,
    MembershipsModule,
  ],
})
export class AppModule {}
