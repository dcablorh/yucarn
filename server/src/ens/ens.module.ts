import { Module } from '@nestjs/common';
import { EnsService } from './ens.service';
import { EnsController } from './ens.controller';
import { SepoliaRpcClient } from './sepolia-rpc.client';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [EnsController],
  providers: [EnsService, SepoliaRpcClient],
  exports: [EnsService],
})
export class EnsModule {}
