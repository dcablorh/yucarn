import { CreateEmployeeDto } from './create-employee.dto';

/**
 * A full replacement, not a patch. The Team form always submits every
 * field, and a partial update would need per-field merge rules that
 * nothing asks for.
 */
export class UpdateEmployeeDto extends CreateEmployeeDto {}
