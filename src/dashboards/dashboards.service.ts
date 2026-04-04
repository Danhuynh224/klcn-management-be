import { Inject, Injectable } from '@nestjs/common';
import { SHEET_REPOSITORY } from '../common/constants/injection-tokens';
import { SheetName } from '../common/constants/sheet-definitions';
import { RegistrationStatus } from '../common/enums/registration-status.enum';
import { RegistrationType } from '../common/enums/registration-type.enum';
import {
  CommitteeRow,
  NotificationRow,
  QuotaRow,
  RegistrationRow,
  TermRow,
} from '../common/types/domain.types';
import { isTruthy } from '../common/utils/date.util';
import { toNumber } from '../common/utils/score.util';
import type { AuthenticatedUser } from '../common/types/authenticated-user.type';
import type { SheetRepository } from '../common/types/sheet-repository.interface';

@Injectable()
export class DashboardsService {
  constructor(
    @Inject(SHEET_REPOSITORY)
    private readonly repository: SheetRepository,
  ) {}

  async getStudentDashboard(user: AuthenticatedUser) {
    const [registrations, notifications, terms] = await Promise.all([
      this.repository.getAllRows<RegistrationRow>(SheetName.REGISTRATIONS),
      this.repository.getAllRows<NotificationRow>(SheetName.NOTIFICATIONS),
      this.repository.getAllRows<TermRow>(SheetName.TERMS),
    ]);

    const myRegistrations = registrations
      .filter((registration) => registration.emailSV === user.email)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
    const currentRegistration = myRegistrations[0] ?? null;
    const deadline = currentRegistration
      ? terms.find(
          (term) =>
            term.tenDot === currentRegistration.dot &&
            term.loai === currentRegistration.loai &&
            isTruthy(term.isActive),
        )
      : null;

    return {
      data: {
        profileSummary: user,
        registrationHienTai: currentRegistration,
        statusHienTai: currentRegistration?.status ?? null,
        deadlineGanNhat: deadline?.submissionCloseAt ?? null,
        notifications: notifications
          .filter((notification) => notification.receiverEmail === user.email)
          .slice(0, 5),
      },
    };
  }

  async getLecturerDashboard(user: AuthenticatedUser) {
    const [registrations, committees] = await Promise.all([
      this.repository.getAllRows<RegistrationRow>(SheetName.REGISTRATIONS),
      this.repository.getAllRows<CommitteeRow>(SheetName.COMMITTEES),
    ]);

    const supervisionCount = registrations.filter(
      (registration) => registration.emailGVHD === user.email,
    ).length;
    const reviewCount = registrations.filter(
      (registration) => registration.emailGVPB === user.email,
    ).length;
    const committeesJoined = committees.filter((committee) =>
      [
        committee.chairEmail,
        committee.secretaryEmail,
        committee.member1Email,
        committee.member2Email,
      ].includes(user.email),
    );

    const pendingItems = registrations.filter((registration) => {
      return (
        (registration.emailGVHD === user.email &&
          [
            RegistrationStatus.BCTT_PENDING_APPROVAL,
            RegistrationStatus.KLTN_PENDING_APPROVAL,
            RegistrationStatus.WAITING_SUPERVISOR_REVISION_APPROVAL,
          ].includes(registration.status)) ||
        (registration.emailGVPB === user.email &&
          registration.status === RegistrationStatus.WAITING_REVIEWER_SCORE)
      );
    });

    return {
      data: {
        soSvHuongDan: supervisionCount,
        soSvPhanBien: reviewCount,
        soHoiDongThamGia: committeesJoined.length,
        danhSachCanXuLy: pendingItems,
      },
    };
  }

  async getHeadDashboard() {
    const [quotas, registrations] = await Promise.all([
      this.repository.getAllRows<QuotaRow>(SheetName.QUOTAS),
      this.repository.getAllRows<RegistrationRow>(SheetName.REGISTRATIONS),
    ]);

    const quotaOverview = quotas.map((quota) => ({
      ...quota,
      quota: toNumber(quota.quota),
      usedSlots: toNumber(quota.usedSlots),
      remainingSlots: toNumber(quota.quota) - toNumber(quota.usedSlots),
    }));

    const registrationByDot = registrations.reduce<Record<string, number>>(
      (accumulator, registration) => {
        accumulator[registration.dot] =
          (accumulator[registration.dot] ?? 0) + 1;
        return accumulator;
      },
      {},
    );

    return {
      data: {
        quotaOverview,
        soRegistrationTheoDot: registrationByDot,
        soRegistrationChoPhanCong: registrations.filter(
          (registration) =>
            registration.loai === RegistrationType.KLTN &&
            !registration.emailGVPB &&
            !registration.committeeId,
        ).length,
        soHoSoChoDuyetChinhSua: registrations.filter((registration) =>
          [
            RegistrationStatus.WAITING_SUPERVISOR_REVISION_APPROVAL,
            RegistrationStatus.WAITING_CHAIR_REVISION_APPROVAL,
          ].includes(registration.status),
        ).length,
      },
    };
  }
}
