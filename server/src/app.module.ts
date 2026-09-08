import './common/bigint-json';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { CryptoModule } from './crypto/crypto.module';
import { AuthModule } from './auth/auth.module';
import { InvoicesModule } from './invoices/invoices.module';
import { WatcherModule } from './watcher/watcher.module';
import { EnsModule } from './ens/ens.module';
import { EmployeesModule } from './employees/employees.module';
import { PayrollModule } from './payroll/payroll.module';
import { loadConfiguration } from './config/configuration';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [() => loadConfiguration()] }),
    ScheduleModule.forRoot(),
    PrismaModule,
    CryptoModule,
    AuthModule,
    InvoicesModule,
    EnsModule,
    EmployeesModule,
    PayrollModule,
    WatcherModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
