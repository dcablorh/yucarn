import { GUARDS_METADATA } from '@nestjs/common/constants';
import { EmployeesController } from './employees.controller';
import { PrivyAuthGuard } from '../auth/privy-auth.guard';

// The tenancy tests in employees.service.spec.ts mock Prisma and assert
// call shape — they prove the service scopes every query by businessId,
// but they say nothing about whether a request ever reaches that service
// unauthenticated. PrivyAuthGuard is what actually stops that: it is what
// resolves @CurrentBusiness() in the first place. If @UseGuards(PrivyAuthGuard)
// were ever dropped from the controller, every service-level test above
// would keep passing while the route itself served any caller. This test
// exists to catch exactly that regression.
describe('EmployeesController', () => {
  it('has PrivyAuthGuard attached at the controller level', () => {
    const guards: unknown[] = Reflect.getMetadata(GUARDS_METADATA, EmployeesController) ?? [];
    expect(guards).toContain(PrivyAuthGuard);
  });
});
