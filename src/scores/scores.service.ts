import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { SHEET_REPOSITORY } from '../common/constants/injection-tokens';
import { SheetName } from '../common/constants/sheet-definitions';
import { ErrorCode } from '../common/enums/error-code.enum';
import { LecturerBusinessRole } from '../common/enums/lecturer-business-role.enum';
import { RegistrationStatus } from '../common/enums/registration-status.enum';
import { SystemRole } from '../common/enums/system-role.enum';
import { AppException } from '../common/exceptions/app.exception';
import {
  CommitteeRow,
  RegistrationRow,
  ScoreRow,
} from '../common/types/domain.types';
import { toIsoNow } from '../common/utils/date.util';
import { calculateAverage } from '../common/utils/score.util';
import { createId } from '../common/utils/id.util';
import { RegistrationStatusHistoryService } from '../registrations/registration-status-history.service';
import { CreateScoreDto } from './dto/create-score.dto';
import { FinalizeScoreDto } from './dto/finalize-score.dto';
import { UpdateScoreDto } from './dto/update-score.dto';
import type { AuthenticatedUser } from '../common/types/authenticated-user.type';
import type { SheetRepository } from '../common/types/sheet-repository.interface';

@Injectable()
export class ScoresService {
  constructor(
    @Inject(SHEET_REPOSITORY)
    private readonly repository: SheetRepository,
    private readonly registrationStatusHistoryService: RegistrationStatusHistoryService,
  ) {}

  async create(user: AuthenticatedUser, payload: CreateScoreDto) {
    const registration = await this.getRegistrationOrThrow(
      payload.registrationId,
    );
    await this.assertCanScore(user, registration, payload.vaiTroCham);

    const existing = await this.repository.findOne<ScoreRow>(
      SheetName.SCORES,
      (row) => {
        return (
          row.registrationId === payload.registrationId &&
          row.emailGV === user.email &&
          row.vaiTroCham === payload.vaiTroCham
        );
      },
    );

    if (existing) {
      throw new AppException(
        'Điểm đã tồn tại, vui lòng dùng API cập nhật',
        HttpStatus.BAD_REQUEST,
        ErrorCode.DUPLICATE_RESOURCE,
      );
    }

    const score: ScoreRow = {
      id: createId('score'),
      registrationId: payload.registrationId,
      emailGV: user.email,
      vaiTroCham: payload.vaiTroCham,
      score1: payload.score1,
      score2: payload.score2,
      score3: payload.score3,
      totalScore: payload.totalScore,
      comments: payload.comments ?? '',
      questions: payload.questions ?? '',
      createdAt: toIsoNow(),
      updatedAt: toIsoNow(),
    };

    await this.repository.insertRow<ScoreRow>(SheetName.SCORES, score);
    await this.updateRegistrationStatusAfterScoring(
      registration,
      payload.vaiTroCham,
      user.email,
    );

    return { data: score };
  }

  async update(id: string, user: AuthenticatedUser, payload: UpdateScoreDto) {
    const score = await this.repository.findOne<ScoreRow>(
      SheetName.SCORES,
      (row) => row.id === id,
    );

    if (!score || score.emailGV !== user.email) {
      throw new AppException(
        'Không thể cập nhật điểm',
        HttpStatus.FORBIDDEN,
        ErrorCode.SCORE_NOT_ALLOWED,
      );
    }

    return {
      data: await this.repository.updateRow<ScoreRow>(SheetName.SCORES, id, {
        ...payload,
        updatedAt: toIsoNow(),
      }),
    };
  }

  async getByRegistration(registrationId: string) {
    const scores = await this.repository.getAllRows<ScoreRow>(SheetName.SCORES);
    const registrationScores = scores.filter(
      (score) => score.registrationId === registrationId,
    );

    return {
      data: {
        supervisor:
          registrationScores.find(
            (score) => score.vaiTroCham === LecturerBusinessRole.SUPERVISOR,
          ) ?? null,
        reviewer:
          registrationScores.find(
            (score) => score.vaiTroCham === LecturerBusinessRole.REVIEWER,
          ) ?? null,
        committee: registrationScores.filter((score) =>
          [
            LecturerBusinessRole.COMMITTEE_MEMBER,
            LecturerBusinessRole.COMMITTEE_CHAIR,
            LecturerBusinessRole.COMMITTEE_SECRETARY,
          ].includes(score.vaiTroCham),
        ),
        final: {
          average: calculateAverage(
            registrationScores.map((score) => score.totalScore),
          ),
        },
      },
    };
  }

  async finalize(
    registrationId: string,
    user: AuthenticatedUser,
    payload: FinalizeScoreDto,
  ) {
    void payload;
    const registration = await this.getRegistrationOrThrow(registrationId);
    await this.assertCanFinalize(user, registration);

    const scores = await this.repository.getAllRows<ScoreRow>(SheetName.SCORES);
    const registrationScores = scores.filter(
      (score) => score.registrationId === registrationId,
    );

    if (registrationScores.length === 0) {
      throw new AppException(
        'Chưa có điểm để tổng hợp',
        HttpStatus.BAD_REQUEST,
        ErrorCode.SCORE_NOT_ALLOWED,
      );
    }

    const finalScore = calculateAverage(
      registrationScores.map((score) => score.totalScore),
    );

    await this.repository.updateRow<RegistrationRow>(
      SheetName.REGISTRATIONS,
      registration.id,
      {
        finalScore,
        status: RegistrationStatus.DEFENDED,
        updatedAt: toIsoNow(),
      },
    );
    await this.registrationStatusHistoryService.append(
      registration.id,
      RegistrationStatus.DEFENDED,
      user.email,
      user.role,
      'Tong hop diem va chot trang thai da bao ve',
    );

    return {
      data: {
        finalScore,
      },
    };
  }

  private async updateRegistrationStatusAfterScoring(
    registration: RegistrationRow,
    role: LecturerBusinessRole,
    changedBy: string,
  ) {
    let status = registration.status;

    if (role === LecturerBusinessRole.SUPERVISOR && registration.emailGVPB) {
      status = RegistrationStatus.WAITING_REVIEWER_SCORE;
    } else if (
      role === LecturerBusinessRole.REVIEWER ||
      [
        LecturerBusinessRole.COMMITTEE_MEMBER,
        LecturerBusinessRole.COMMITTEE_CHAIR,
        LecturerBusinessRole.COMMITTEE_SECRETARY,
      ].includes(role)
    ) {
      status = RegistrationStatus.WAITING_COMMITTEE_SCORE;
    }

    await this.repository.updateRow<RegistrationRow>(
      SheetName.REGISTRATIONS,
      registration.id,
      {
        status,
        updatedAt: toIsoNow(),
      },
    );
    if (status !== registration.status) {
      await this.registrationStatusHistoryService.append(
        registration.id,
        status,
        changedBy,
        'LECTURER',
        `Cap nhat sau khi cham diem voi vai tro ${role}`,
      );
    }
  }

  private async assertCanScore(
    user: AuthenticatedUser,
    registration: RegistrationRow,
    role: LecturerBusinessRole,
  ) {
    if (user.role !== SystemRole.LECTURER) {
      throw new AppException(
        'Chỉ giảng viên mới được chấm điểm',
        HttpStatus.FORBIDDEN,
        ErrorCode.SCORE_NOT_ALLOWED,
      );
    }

    if (
      role === LecturerBusinessRole.SUPERVISOR &&
      registration.emailGVHD === user.email
    ) {
      return;
    }

    if (
      role === LecturerBusinessRole.REVIEWER &&
      registration.emailGVPB === user.email
    ) {
      return;
    }

    if (
      [
        LecturerBusinessRole.COMMITTEE_MEMBER,
        LecturerBusinessRole.COMMITTEE_CHAIR,
        LecturerBusinessRole.COMMITTEE_SECRETARY,
      ].includes(role)
    ) {
      const committee = await this.repository.findOne<CommitteeRow>(
        SheetName.COMMITTEES,
        (row) => row.id === registration.committeeId,
      );

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
    }

    throw new AppException(
      'Bạn không được phép chấm điểm registration này',
      HttpStatus.FORBIDDEN,
      ErrorCode.SCORE_NOT_ALLOWED,
    );
  }

  private async assertCanFinalize(
    user: AuthenticatedUser,
    registration: RegistrationRow,
  ) {
    if ([SystemRole.ADMIN, SystemRole.HEAD_OF_DEPARTMENT].includes(user.role)) {
      return;
    }

    if (user.role === SystemRole.LECTURER) {
      const committee = await this.repository.findOne<CommitteeRow>(
        SheetName.COMMITTEES,
        (row) => row.id === registration.committeeId,
      );

      if (committee && committee.secretaryEmail === user.email) {
        return;
      }
    }

    throw new AppException(
      'Bạn không được finalize điểm',
      HttpStatus.FORBIDDEN,
      ErrorCode.SCORE_NOT_ALLOWED,
    );
  }

  private async getRegistrationOrThrow(id: string) {
    const registration = await this.repository.findOne<RegistrationRow>(
      SheetName.REGISTRATIONS,
      (row) => row.id === id,
    );

    if (!registration) {
      throw new AppException(
        'Registration không tồn tại',
        HttpStatus.NOT_FOUND,
        ErrorCode.REGISTRATION_NOT_FOUND,
      );
    }

    return registration;
  }
}
