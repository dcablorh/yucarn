import { Module } from '@nestjs/common';
import { PrivyService } from './privy.service';
import { PrivyAuthGuard } from './privy-auth.guard';
import { AuthController } from './auth.controller';

@Module({
  controllers: [AuthController],
  providers: [PrivyService, PrivyAuthGuard],
  exports: [PrivyService, PrivyAuthGuard],
})
export class AuthModule {}
