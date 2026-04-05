import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { SHEET_REPOSITORY } from '../common/constants/injection-tokens';
import { SheetName } from '../common/constants/sheet-definitions';
import { ErrorCode } from '../common/enums/error-code.enum';
import { SystemRole } from '../common/enums/system-role.enum';
import { AppException } from '../common/exceptions/app.exception';
import { FieldRow, QuotaRow, UserRow } from '../common/types/domain.types';
import { toNumber } from '../common/utils/score.util';
import type { AuthenticatedUser } from '../common/types/authenticated-user.type';
import type { SheetRepository } from '../common/types/sheet-repository.interface';

@Injectable()
export class UsersService {
  constructor(
    @Inject(SHEET_REPOSITORY)
    private readonly repository: SheetRepository,
  ) {}

  getMe(user: AuthenticatedUser) {
    return { data: user };
  }

  async findAll(role?: SystemRole, keyword?: string) {
    const users = await this.repository.getAllRows<UserRow>(SheetName.USERS);
    const normalizedKeyword = keyword?.toLowerCase().trim();

    return {
      data: users.filter((user) => {
        if (role && user.role !== role) {
          return false;
        }

        if (!normalizedKeyword) {
          return true;
        }

        return [user.email, user.ten, user.ms]
          .join(' ')
          .toLowerCase()
          .includes(normalizedKeyword);
      }),
    };
  }

  async findLecturers(
    user: AuthenticatedUser,
    fieldName?: string,
    dot?: string,
    availableOnly?: boolean,
  ) {
    const [users, quotas, fields] = await Promise.all([
      this.repository.getAllRows<UserRow>(SheetName.USERS),
      this.repository.getAllRows<QuotaRow>(SheetName.QUOTAS),
      this.repository.getAllRows<FieldRow>(SheetName.FIELDS),
    ]);

    return {
      data: users
        .filter((candidate) => {
          if (candidate.role !== SystemRole.LECTURER) {
            return false;
          }

          if (
            user.role === SystemRole.HEAD_OF_DEPARTMENT &&
            candidate.major !== user.major
          ) {
            return false;
          }

          return true;
        })
        .map((lecturer) => {
          const lecturerFields = fields
            .filter((field) => field.emailGV === lecturer.email)
            .map((field) => field.fieldName);
          const quota =
            quotas.find(
              (item) =>
                item.emailGV === lecturer.email && (!dot || item.dot === dot),
            ) ?? quotas.find((item) => item.emailGV === lecturer.email);
          const usedSlots = toNumber(quota?.usedSlots);
          const quotaValue = toNumber(quota?.quota);
          const remainingSlots = quotaValue - usedSlots;

          return {
            email: lecturer.email,
            ten: lecturer.ten,
            msgv: lecturer.ms,
            quota: quotaValue,
            usedSlots,
            remainingSlots,
            fields: lecturerFields,
          };
        })
        .filter((lecturer) => {
          if (fieldName && !lecturer.fields.includes(fieldName)) {
            return false;
          }

          if (availableOnly && lecturer.remainingSlots <= 0) {
            return false;
          }

          return true;
        }),
    };
  }

  async findStudents(keyword?: string) {
    return this.findAll(SystemRole.STUDENT, keyword);
  }

  async ensureLecturer(email: string) {
    const user = await this.repository.findOne<UserRow>(
      SheetName.USERS,
      (row) => {
        return row.email === email;
      },
    );

    if (!user || user.role !== SystemRole.LECTURER) {
      throw new AppException(
        'Giảng viên không tồn tại',
        HttpStatus.NOT_FOUND,
        ErrorCode.USER_NOT_FOUND,
      );
    }

    return user;
  }
}
