import { SetMetadata } from '@nestjs/common';
import { JWT_PUBLIC_KEY } from '../constants/app.constants';

export const Public = () => SetMetadata(JWT_PUBLIC_KEY, true);
