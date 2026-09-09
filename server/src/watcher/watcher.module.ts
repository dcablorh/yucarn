import { Module } from '@nestjs/common';
import { ArcWatcherService } from './arc-watcher.service';
import { ArcRpcClient } from './arc-rpc.client';

@Module({
  providers: [ArcWatcherService, ArcRpcClient],
  exports: [ArcWatcherService, ArcRpcClient],
})
export class WatcherModule {}
