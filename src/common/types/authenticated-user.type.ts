import { SystemRole } from '../enums/system-role.enum';

export interface AuthenticatedUser {
  id: string;
  email: string;
  ms: string;
  ten: string;
  major: string;
  heDaoTao: string;
  role: SystemRole;
}
