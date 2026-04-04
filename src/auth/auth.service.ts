import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { SHEET_REPOSITORY } from '../common/constants/injection-tokens';
import { SheetName } from '../common/constants/sheet-definitions';
import { ErrorCode } from '../common/enums/error-code.enum';
import { AppException } from '../common/exceptions/app.exception';
import { UserRow } from '../common/types/domain.types';
import { LoginDto } from './dto/login.dto';
import type { AuthenticatedUser } from '../common/types/authenticated-user.type';
import type { SheetRepository } from '../common/types/sheet-repository.interface';

@Injectable()
export class AuthService {
  constructor(
    @Inject(SHEET_REPOSITORY)
    private readonly repository: SheetRepository,
    private readonly jwtService: JwtService,
  ) {}

  async login(payload: LoginDto) {
    const user = await this.repository.findOne<UserRow>(
      SheetName.USERS,
      (row) => {
        return row.email === payload.email;
      },
    );

    if (!user || user.password !== payload.password) {
      throw new AppException(
        'Email hoặc mật khẩu không đúng',
        HttpStatus.UNAUTHORIZED,
        ErrorCode.AUTH_INVALID_CREDENTIALS,
      );
    }

    const authUser = this.toAuthUser(user);

    return {
      data: {
        accessToken: await this.jwtService.signAsync(authUser),
        user: authUser,
      },
    };
  }

  me(user: AuthenticatedUser) {
    return { data: user };
  }

  private toAuthUser(user: UserRow): AuthenticatedUser {
    return {
      id: user.id,
      email: user.email,
      ten: user.ten,
      role: user.role,
      ms: user.ms,
      major: user.major,
      heDaoTao: user.heDaoTao,
    };
  }
}
