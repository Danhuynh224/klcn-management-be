import { Inject, Injectable } from '@nestjs/common';
import { SHEET_REPOSITORY } from '../common/constants/injection-tokens';
import { SheetName } from '../common/constants/sheet-definitions';
import {
  REGISTRATION_STATUS_LABELS,
  RegistrationStatus,
} from '../common/enums/registration-status.enum';
import { RegistrationType } from '../common/enums/registration-type.enum';
import { SystemRole } from '../common/enums/system-role.enum';
import {
  CommitteeRow,
  NotificationRow,
  QuotaRow,
  RegistrationRow,
  RegistrationStatusHistoryRow,
  TermRow,
  UserRow,
} from '../common/types/domain.types';
import { successResponse } from '../common/utils/api-response.util';
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
    const [registrations, notifications, terms, users, statusHistories] =
      await Promise.all([
        this.repository.getAllRows<RegistrationRow>(SheetName.REGISTRATIONS),
        this.repository.getAllRows<NotificationRow>(SheetName.NOTIFICATIONS),
        this.repository.getAllRows<TermRow>(SheetName.TERMS),
        this.repository.getAllRows<UserRow>(SheetName.USERS),
        this.repository.getAllRows<RegistrationStatusHistoryRow>(
          SheetName.REGISTRATION_STATUS_HISTORY,
        ),
      ]);

    const myRegistrations = registrations
      .filter((registration) => registration.emailSV === user.email)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
    const currentRegistration = myRegistrations[0] ?? null;
    const supervisor = currentRegistration?.emailGVHD
      ? users.find((item) => item.email === currentRegistration.emailGVHD)
      : null;
    const term = currentRegistration
      ? this.resolveTermForRegistration(terms, currentRegistration)
      : null;
    const currentHistory = currentRegistration
      ? statusHistories
          .filter((item) => item.registrationId === currentRegistration.id)
          .sort((left, right) => left.changedAt.localeCompare(right.changedAt))
      : [];

    const data = {
      profile: {
        id: user.id,
        email: user.email,
        fullName: user.ten,
        studentCode: user.ms,
        major: user.major,
      },
      currentRegistration: currentRegistration
        ? {
            id: currentRegistration.id,
            loai: currentRegistration.loai,
            type: currentRegistration.loai,
            status: currentRegistration.status,
            statusLabel:
              REGISTRATION_STATUS_LABELS[currentRegistration.status],
            topicTitle: currentRegistration.tenDeTai,
            title: currentRegistration.tenDeTai,
            supervisor: currentRegistration.emailGVHD
              ? {
                  email: currentRegistration.emailGVHD,
                  fullName: supervisor?.ten ?? currentRegistration.emailGVHD,
                }
              : null,
            term: {
              id: term?.id ?? currentRegistration.dot,
              name: term?.tenDot ?? currentRegistration.dot,
              code: term?.id ?? currentRegistration.dot,
            },
            createdAt: currentRegistration.createdAt,
            updatedAt: currentRegistration.updatedAt,
          }
        : null,
      statusHistory: currentHistory.map((item, index) => ({
        status: item.status,
        label: item.statusLabel,
        description:
          item.note || (index === 0 ? 'Hồ sơ đã được tạo.' : 'Trạng thái đã được cập nhật.'),
        createdAt: item.changedAt,
      })),
      nextDeadline: currentRegistration
        ? this.resolveNextDeadline(currentRegistration, term)
        : null,
      notifications: notifications
        .filter((notification) => notification.receiverEmail === user.email)
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
        .slice(0, 10)
        .map((notification) => ({
          id: notification.id,
          title: notification.title,
          content: notification.content,
          isRead: isTruthy(notification.isRead),
          createdAt: notification.createdAt,
        })),
    };

    return successResponse(data);
  }

  async getLecturerDashboard(user: AuthenticatedUser) {
    const [registrations, committees] = await Promise.all([
      this.repository.getAllRows<RegistrationRow>(SheetName.REGISTRATIONS),
      this.repository.getAllRows<CommitteeRow>(SheetName.COMMITTEES),
    ]);

    const supervisorRegistrations = registrations.filter(
      (registration) => registration.emailGVHD === user.email,
    );
    const reviewerRegistrations = registrations.filter(
      (registration) => registration.emailGVPB === user.email,
    );
    const committeesJoined = committees.filter((committee) =>
      [
        committee.chairEmail,
        committee.secretaryEmail,
        committee.member1Email,
        committee.member2Email,
      ].includes(user.email),
    );

    const waitingApprovalCount = supervisorRegistrations.filter((registration) =>
      [
        RegistrationStatus.BCTT_PENDING_APPROVAL,
        RegistrationStatus.KLTN_PENDING_APPROVAL,
      ].includes(registration.status),
    ).length;
    const waitingReviewerScoreCount = reviewerRegistrations.filter(
      (registration) =>
        registration.status === RegistrationStatus.WAITING_REVIEWER_SCORE,
    ).length;
    const waitingRevisionApprovalCount = supervisorRegistrations.filter(
      (registration) =>
        registration.status ===
          RegistrationStatus.WAITING_SUPERVISOR_REVISION_APPROVAL ||
        registration.status === RegistrationStatus.WAITING_CHAIR_REVISION_APPROVAL,
    ).length;

    const tasks = [
      {
        label: 'Hồ sơ chờ duyệt',
        description: 'Các hồ sơ sinh viên đang chờ giảng viên hướng dẫn xác nhận.',
        count: waitingApprovalCount,
      },
      {
        label: 'Bài cần chấm phản biện',
        description: 'Các đề tài đã đến bước phản biện và cần giảng viên chấm điểm.',
        count: waitingReviewerScoreCount,
      },
      {
        label: 'Duyệt chỉnh sửa sau bảo vệ',
        description: 'Các hồ sơ đang chờ giảng viên duyệt bản chỉnh sửa sau bảo vệ.',
        count: waitingRevisionApprovalCount,
      },
    ];

    return successResponse({
      supervisorCount: supervisorRegistrations.length,
      reviewerCount: reviewerRegistrations.length,
      committeeCount: committeesJoined.length,
      pendingTasks: tasks.reduce((sum, item) => sum + item.count, 0),
      tasks,
    });
  }

  async getHeadDashboard() {
    const [quotas, registrations, users] = await Promise.all([
      this.repository.getAllRows<QuotaRow>(SheetName.QUOTAS),
      this.repository.getAllRows<RegistrationRow>(SheetName.REGISTRATIONS),
      this.repository.getAllRows<UserRow>(SheetName.USERS),
    ]);

    const pendingApprovals = registrations.filter((registration) =>
      [
        RegistrationStatus.BCTT_PENDING_APPROVAL,
        RegistrationStatus.KLTN_PENDING_APPROVAL,
      ].includes(registration.status),
    ).length;
    const pendingReviewers = registrations.filter(
      (registration) =>
        registration.loai === RegistrationType.KLTN && !registration.emailGVPB,
    ).length;
    const pendingCommittees = registrations.filter(
      (registration) =>
        registration.loai === RegistrationType.KLTN &&
        Boolean(registration.emailGVPB) &&
        !registration.committeeId,
    ).length;

    const quotaOverview = quotas
      .sort((left, right) => left.emailGV.localeCompare(right.emailGV))
      .map((quota) => {
        const lecturer = users.find((user) => user.email === quota.emailGV);
        const usedSlots = toNumber(quota.usedSlots);
        const totalSlots = toNumber(quota.quota);

        return {
          label: lecturer?.ten ? `GV ${lecturer.ten}` : `GV ${quota.emailGV}`,
          value: `${usedSlots}/${totalSlots}`,
        };
      });

    return successResponse({
      totalRegistrations: registrations.length,
      pendingApprovals,
      pendingReviewers,
      pendingCommittees,
      quotaOverview,
    });
  }

  private resolveTermForRegistration(terms: TermRow[], registration: RegistrationRow) {
    return (
      terms.find(
        (term) => term.id === registration.dot && term.loai === registration.loai,
      ) ??
      terms.find(
        (term) =>
          term.tenDot === registration.dot && term.loai === registration.loai,
      ) ??
      null
    );
  }

  private resolveNextDeadline(
    registration: RegistrationRow,
    term: TermRow | null,
  ) {
    if (!term) {
      return null;
    }

    if (registration.loai === RegistrationType.BCTT) {
      return {
        title: 'Nộp báo cáo BCTT',
        description: 'Hạn nộp file báo cáo và giấy xác nhận thực tập.',
        dueAt: term.submissionCloseAt,
      };
    }

    if (
      [
        RegistrationStatus.DEFENSE_SCHEDULED,
        RegistrationStatus.WAITING_COMMITTEE_SCORE,
        RegistrationStatus.DEFENDED,
      ].includes(registration.status)
    ) {
      return {
        title: 'Bảo vệ khóa luận',
        description: 'Thời gian dự kiến diễn ra buổi bảo vệ khóa luận.',
        dueAt: registration.defenseDate || term.defenseDate,
      };
    }

    return {
      title: 'Nộp khóa luận',
      description: 'Hạn nộp báo cáo khóa luận và các tài liệu liên quan.',
      dueAt: term.submissionCloseAt,
    };
  }
}
