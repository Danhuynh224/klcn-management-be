import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { SHEET_REPOSITORY } from '../common/constants/injection-tokens';
import { SheetName } from '../common/constants/sheet-definitions';
import { ErrorCode } from '../common/enums/error-code.enum';
import { SystemRole } from '../common/enums/system-role.enum';
import { AppException } from '../common/exceptions/app.exception';
import {
  CommitteeRow,
  MinuteRow,
  RegistrationRow,
  ScoreRow,
  UserRow,
} from '../common/types/domain.types';
import { toIsoNow } from '../common/utils/date.util';
import { calculateAverage } from '../common/utils/score.util';
import { createId } from '../common/utils/id.util';
import { UpdateMinuteDto } from './dto/update-minute.dto';
import type { AuthenticatedUser } from '../common/types/authenticated-user.type';
import type { SheetRepository } from '../common/types/sheet-repository.interface';

@Injectable()
export class MinutesService {
  constructor(
    @Inject(SHEET_REPOSITORY)
    private readonly repository: SheetRepository,
  ) {}

  async getByRegistration(registrationId: string, user: AuthenticatedUser) {
    await this.assertCanAccess(registrationId, user);

    const minute = await this.repository.findOne<MinuteRow>(
      SheetName.MINUTES,
      (row) => {
        return row.registrationId === registrationId;
      },
    );

    return {
      data: minute,
    };
  }

  async generate(registrationId: string, user: AuthenticatedUser) {
    await this.assertCanManageMinute(registrationId, user);

    const [registration, users, scores] = await Promise.all([
      this.repository.findOne<RegistrationRow>(
        SheetName.REGISTRATIONS,
        (row) => {
          return row.id === registrationId;
        },
      ),
      this.repository.getAllRows<UserRow>(SheetName.USERS),
      this.repository.getAllRows<ScoreRow>(SheetName.SCORES),
    ]);

    if (!registration) {
      throw new AppException(
        'Registration không tồn tại',
        HttpStatus.NOT_FOUND,
        ErrorCode.REGISTRATION_NOT_FOUND,
      );
    }

    const student = users.find((row) => row.email === registration.emailSV);
    const reviewerScore = scores.find(
      (score) =>
        score.registrationId === registrationId &&
        score.emailGV === registration.emailGVPB,
    );
    const allScores = scores.filter(
      (score) => score.registrationId === registrationId,
    );

    const content = [
      `Sinh vien: ${registration.tenSV} (${student?.ms ?? ''})`,
      `De tai: ${registration.tenDeTai}`,
      `GVHD: ${registration.emailGVHD}`,
      `GVPB: ${registration.emailGVPB}`,
      `Nhan xet GVPB: ${reviewerScore?.comments ?? 'Chua co'}`,
      `Diem hien tai: ${calculateAverage(allScores.map((score) => score.totalScore))}`,
    ].join('\n');

    const existing = await this.repository.findOne<MinuteRow>(
      SheetName.MINUTES,
      (row) => {
        return row.registrationId === registrationId;
      },
    );

    if (existing) {
      return {
        data: await this.repository.updateRow<MinuteRow>(
          SheetName.MINUTES,
          existing.id,
          {
            content,
            generatedBy: user.email,
            updatedAt: toIsoNow(),
          },
        ),
      };
    }

    const minute: MinuteRow = {
      id: createId('minute'),
      registrationId,
      generatedBy: user.email,
      content,
      fileUrl: '',
      createdAt: toIsoNow(),
      updatedAt: toIsoNow(),
    };

    await this.repository.insertRow<MinuteRow>(SheetName.MINUTES, minute);
    return { data: minute };
  }

  async update(
    registrationId: string,
    user: AuthenticatedUser,
    payload: UpdateMinuteDto,
  ) {
    await this.assertCanManageMinute(registrationId, user);

    const existing = await this.repository.findOne<MinuteRow>(
      SheetName.MINUTES,
      (row) => {
        return row.registrationId === registrationId;
      },
    );

    if (!existing) {
      throw new AppException(
        'Biên bản chưa được tạo',
        HttpStatus.NOT_FOUND,
        ErrorCode.RESOURCE_NOT_FOUND,
      );
    }

    return {
      data: await this.repository.updateRow<MinuteRow>(
        SheetName.MINUTES,
        existing.id,
        {
          content: payload.content,
          fileUrl: payload.fileUrl ?? existing.fileUrl,
          updatedAt: toIsoNow(),
        },
      ),
    };
  }

  private async assertCanAccess(
    registrationId: string,
    user: AuthenticatedUser,
  ) {
    if ([SystemRole.ADMIN, SystemRole.HEAD_OF_DEPARTMENT].includes(user.role)) {
      return;
    }

    const registration = await this.repository.findOne<RegistrationRow>(
      SheetName.REGISTRATIONS,
      (row) => row.id === registrationId,
    );

    if (!registration) {
      throw new AppException(
        'Registration không tồn tại',
        HttpStatus.NOT_FOUND,
        ErrorCode.REGISTRATION_NOT_FOUND,
      );
    }

    if (
      (user.role === SystemRole.STUDENT &&
        registration.emailSV === user.email) ||
      registration.emailGVHD === user.email ||
      registration.emailGVPB === user.email
    ) {
      return;
    }

    const committee = registration.committeeId
      ? await this.repository.findOne<CommitteeRow>(
          SheetName.COMMITTEES,
          (row) => {
            return row.id === registration.committeeId;
          },
        )
      : null;

    if (
      committee &&
      [
        committee.chairEmail,
        committee.secretaryEmail,
        committee.member1Email,
        committee.member2Email,
      ].includes(user.email)
    ) {
      return;
    }

    throw new AppException(
      'Bạn không có quyền xem biên bản',
      HttpStatus.FORBIDDEN,
      ErrorCode.FORBIDDEN_ROLE,
    );
  }

  private async assertCanManageMinute(
    registrationId: string,
    user: AuthenticatedUser,
  ) {
    if ([SystemRole.ADMIN, SystemRole.HEAD_OF_DEPARTMENT].includes(user.role)) {
      return;
    }

    const registration = await this.repository.findOne<RegistrationRow>(
      SheetName.REGISTRATIONS,
      (row) => row.id === registrationId,
    );

    if (!registration) {
      throw new AppException(
        'Registration không tồn tại',
        HttpStatus.NOT_FOUND,
        ErrorCode.REGISTRATION_NOT_FOUND,
      );
    }

    const committee = registration.committeeId
      ? await this.repository.findOne<CommitteeRow>(
          SheetName.COMMITTEES,
          (row) => {
            return row.id === registration.committeeId;
          },
        )
      : null;

    if (!committee || committee.secretaryEmail !== user.email) {
      throw new AppException(
        'Chỉ thư ký hội đồng mới được thao tác biên bản',
        HttpStatus.FORBIDDEN,
        ErrorCode.FORBIDDEN_ROLE,
      );
    }
  }
}
