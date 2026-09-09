import { Module } from '@nestjs/common';
import { PayrollService } from './payroll.service';
import { PayrollController } from './payroll.controller';
import { AuthModule } from '../auth/auth.module';
import { EmployeesModule } from '../employees/employees.module';
import { WatcherModule } from '../watcher/watcher.module';

@Module({
  imports: [AuthModule, EmployeesModule, WatcherModule],
  controllers: [PayrollController],
  providers: [PayrollService],
})
export class PayrollModule {}
