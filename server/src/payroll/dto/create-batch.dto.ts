import { IsObject } from 'class-validator';

/**
 * `{ [employeeId]: "100.00" }`. Shape only — composeBatch does the real
 * validation, including rejecting an id that is not on this team.
 */
export class CreateBatchDto {
  @IsObject()
  amounts!: Record<string, string>;
}
