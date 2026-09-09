import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import type { Business, Employee } from '@prisma/client';
import { EmployeesService } from './employees.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { PrivyAuthGuard } from '../auth/privy-auth.guard';
import { CurrentBusiness } from '../auth/current-business.decorator';

/**
 * An employee id does appear in the path here, unlike the ENS routes.
 * That is safe because the service resolves it as {id, businessId} — an
 * id belonging to another business does not resolve, so there is nothing
 * a merchant can name that reaches someone else's roster.
 */
@Controller('employees')
@UseGuards(PrivyAuthGuard)
export class EmployeesController {
  constructor(private readonly employees: EmployeesService) {}

  @Get()
  list(@CurrentBusiness() business: Business): Promise<Employee[]> {
    return this.employees.list(business.id);
  }

  @Post()
  create(
    @CurrentBusiness() business: Business,
    @Body() dto: CreateEmployeeDto,
  ): Promise<Employee> {
    return this.employees.create(business.id, dto);
  }

  @Patch(':id')
  update(
    @CurrentBusiness() business: Business,
    @Param('id') id: string,
    @Body() dto: UpdateEmployeeDto,
  ): Promise<Employee> {
    return this.employees.update(business.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(
    @CurrentBusiness() business: Business,
    @Param('id') id: string,
  ): Promise<void> {
    return this.employees.remove(business.id, id);
  }
}
