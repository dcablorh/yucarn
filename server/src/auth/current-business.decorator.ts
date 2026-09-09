import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Business } from '@prisma/client';

export const CurrentBusiness = createParamDecorator(
  (_data: unknown, context: ExecutionContext): Business =>
    context.switchToHttp().getRequest().business,
);
