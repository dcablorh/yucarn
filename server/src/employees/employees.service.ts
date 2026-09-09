import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Employee } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  InvalidEmployeeError,
  normaliseAddress,
  validateEmployeeInput,
  type EmployeeInput,
} from './employee-input';

@Injectable()
export class EmployeesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Every mutating method starts here.
   *
   * The lookup is by {id, businessId} rather than by id alone, so an
   * employee id belonging to another business simply does not resolve.
   * That is the whole tenancy story for this service — there is no path
   * that reads an employee without also naming whose it must be.
   */
  private async requireOwned(businessId: string, id: string): Promise<Employee> {
    const employee = await this.prisma.employee.findFirst({
      where: { id, businessId },
    });
    if (!employee) throw new NotFoundException('Employee not found');
    return employee;
  }

  private clean(input: EmployeeInput) {
    try {
      validateEmployeeInput(input);
    } catch (cause) {
      if (cause instanceof InvalidEmployeeError) {
        throw new BadRequestException(cause.message);
      }
      throw cause;
    }

    return {
      name: input.name.trim(),
      walletAddress: normaliseAddress(input.walletAddress),
      prefChain: input.prefChain,
      prefAsset: input.prefAsset,
    };
  }

  list(businessId: string): Promise<Employee[]> {
    return this.prisma.employee.findMany({
      where: { businessId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async create(businessId: string, input: EmployeeInput): Promise<Employee> {
    return this.prisma.employee.create({
      data: { businessId, ...this.clean(input) },
    });
  }

  async update(businessId: string, id: string, input: EmployeeInput): Promise<Employee> {
    await this.requireOwned(businessId, id);
    return this.prisma.employee.update({
      where: { id },
      data: this.clean(input),
    });
  }

  async remove(businessId: string, id: string): Promise<void> {
    const { count } = await this.prisma.employee.deleteMany({
      where: { id, businessId },
    });
    if (count === 0) throw new NotFoundException('Employee not found');
  }
}
