import { SetMetadata } from '@nestjs/common';
import { ROLES_KEY } from '../constants/app.constants';
import { SystemRole } from '../enums/system-role.enum';

export const Roles = (...roles: SystemRole[]) => SetMetadata(ROLES_KEY, roles);
