import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { SHEET_REPOSITORY } from '../common/constants/injection-tokens';
import { SheetName } from '../common/constants/sheet-definitions';
import { ErrorCode } from '../common/enums/error-code.enum';
import { RegistrationStatus } from '../common/enums/registration-status.enum';
import { REGISTRATION_STATUS_LABELS } from '../common/enums/registration-status.enum';
import { RegistrationType } from '../common/enums/registration-type.enum';
import { SystemRole } from '../common/enums/system-role.enum';
import { AppException } from '../common/exceptions/app.exception';
import {
  CommitteeRow,
  LecturerDocumentRow,
  NotificationRow,
  QuotaRow,
  RegistrationRow,
  RegistrationWorkflowStatusRow,
  ScoreRow,
  StudentDocumentRow,
  TermRow,
} from '../common/types/domain.types';
import { isNowWithin, isTruthy, toIsoNow } from '../common/utils/date.util';
import { createId } from '../common/utils/id.util';
import { toNumber } from '../common/utils/score.util';
import { NotificationsService } from '../notifications/notifications.service';
import { RegistrationStatusHistoryService } from './registration-status-history.service';
import type { AuthenticatedUser } from '../common/types/authenticated-user.type';
import type { SheetRepository } from '../common/types/sheet-repository.interface';
import { ChangeReviewerDto } from './dto/change-reviewer.dto';
import { ChangeSupervisorDto } from './dto/change-supervisor.dto';
import { QueryRegistrationsDto } from './dto/query-registrations.dto';
import { ApproveRegistrationDto } from './dto/approve-registration.dto';
import { CreateBcttRegistrationDto } from './dto/create-bctt-registration.dto';
import { CreateKltnRegistrationDto } from './dto/create-kltn-registration.dto';
import { RejectRegistrationDto } from './dto/reject-registration.dto';
import { UpdateRegistrationStatusDto } from './dto/update-registration-status.dto';

@Injectable()
export class RegistrationsService {
  constructor(
    @Inject(SHEET_REPOSITORY)
    private readonly repository: SheetRepository,
    private readonly notificationsService: NotificationsService,
    private readonly registrationStatusHistoryService: RegistrationStatusHistoryService,
  ) {}

  async createBctt(
    user: AuthenticatedUser,
    payload: CreateBcttRegistrationDto,
  ) {
    this.ensureStudent(user);
    await this.ensureOpenTerm(
      payload.dot,
      RegistrationType.BCTT,
      user.major,
      'registration',
    );
    await this.ensureLecturerQuota(payload.emailGVHD, payload.dot);

    const registration: RegistrationRow = {
      id: createId('reg'),
      emailSV: user.email,
      tenSV: user.ten,
      loai: RegistrationType.BCTT,
      tenDeTai: payload.tenDeTai,
      linhVuc: payload.linhVuc,
      tenCongTy: payload.tenCongTy,
      emailGVHD: payload.emailGVHD,
      emailGVPB: '',
      dot: payload.dot,
      status: RegistrationStatus.BCTT_PENDING_APPROVAL,
      committeeId: '',
      defenseDate: '',
      location: '',
      finalScore: '',
      supervisorApproved: false,
      chairApproved: false,
      rejectionReason: '',
      createdAt: toIsoNow(),
      updatedAt: toIsoNow(),
    };

    await this.repository.insertRow<RegistrationRow>(
      SheetName.REGISTRATIONS,
      registration,
    );
    await this.registrationStatusHistoryService.append(
      registration.id,
      registration.status,
      user.email,
      user.role,
      'Sinh viên tạo đăng ký BCTT',
    );
    await this.incrementQuota(payload.emailGVHD, payload.dot, 1);
    await this.notificationsService.createNotification(
      payload.emailGVHD,
      'Đăng ký BCTT mới',
      `${user.ten} vừa gửi đăng ký BCTT`,
      'REGISTRATION_CREATED',
      registration.id,
    );

    return {
      message: 'Đăng ký BCTT thành công',
      data: await this.enrichRegistrationWithWorkflow(registration),
    };
  }

  async createKltn(
    user: AuthenticatedUser,
    payload: CreateKltnRegistrationDto,
  ) {
    this.ensureStudent(user);
    await this.ensureOpenTerm(
      payload.dot,
      RegistrationType.KLTN,
      user.major,
      'registration',
    );

    const passedBctt = await this.repository.findOne<RegistrationRow>(
      SheetName.REGISTRATIONS,
      (row) =>
        row.emailSV === user.email &&
        row.status === RegistrationStatus.BCTT_PASSED,
    );

    if (!passedBctt) {
      throw new AppException(
        'Chưa đủ điều kiện đăng ký KLTN',
        HttpStatus.BAD_REQUEST,
        ErrorCode.INVALID_STATUS_TRANSITION,
      );
    }

    const supervisorEmail = payload.emailGVHD || passedBctt.emailGVHD;
    await this.ensureLecturerQuota(supervisorEmail, payload.dot);

    const registration: RegistrationRow = {
      id: createId('reg'),
      emailSV: user.email,
      tenSV: user.ten,
      loai: RegistrationType.KLTN,
      tenDeTai: payload.tenDeTai,
      linhVuc: payload.linhVuc,
      tenCongTy: payload.tenCongTy ?? '',
      emailGVHD: supervisorEmail,
      emailGVPB: '',
      dot: payload.dot,
      status: RegistrationStatus.KLTN_PENDING_APPROVAL,
      committeeId: '',
      defenseDate: '',
      location: '',
      finalScore: '',
      supervisorApproved: false,
      chairApproved: false,
      rejectionReason: '',
      createdAt: toIsoNow(),
      updatedAt: toIsoNow(),
    };

    await this.repository.insertRow<RegistrationRow>(
      SheetName.REGISTRATIONS,
      registration,
    );
    await this.registrationStatusHistoryService.append(
      registration.id,
      registration.status,
      user.email,
      user.role,
      'Sinh viên tạo đăng ký KLTN',
    );
    await this.incrementQuota(supervisorEmail, payload.dot, 1);
    await this.notificationsService.createNotification(
      supervisorEmail,
      'Đăng ký KLTN mới',
      `${user.ten} vừa gửi đăng ký KLTN`,
      'REGISTRATION_CREATED',
      registration.id,
    );

    return {
      message: 'Đăng ký KLTN thành công',
      data: await this.enrichRegistrationWithWorkflow(registration),
    };
  }

  async getMine(user: AuthenticatedUser) {
    const [registrations, studentDocuments, lecturerDocuments] =
      await Promise.all([
        this.repository.getAllRows<RegistrationRow>(SheetName.REGISTRATIONS),
        this.repository.getAllRows<StudentDocumentRow>(
          SheetName.STUDENT_DOCUMENTS,
        ),
        this.repository.getAllRows<LecturerDocumentRow>(
          SheetName.LECTURER_DOCUMENTS,
        ),
      ]);

    if (user.role === SystemRole.STUDENT) {
      return {
        data: await this.enrichRegistrationsWithWorkflow(
          registrations.filter((registration) => registration.emailSV === user.email),
          studentDocuments,
          lecturerDocuments,
        ),
      };
    }

    if (user.role === SystemRole.LECTURER) {
      const committees = await this.repository.getAllRows<CommitteeRow>(
        SheetName.COMMITTEES,
      );
      const committeeIds = committees
        .filter((committee) =>
          [
            committee.chairEmail,
            committee.secretaryEmail,
            committee.member1Email,
            committee.member2Email,
          ].includes(user.email),
        )
        .map((committee) => committee.id);

      return {
        data: await this.enrichRegistrationsWithWorkflow(
          registrations.filter((registration) => {
            return (
              registration.emailGVHD === user.email ||
              registration.emailGVPB === user.email ||
              committeeIds.includes(registration.committeeId)
            );
          }),
          studentDocuments,
          lecturerDocuments,
        ),
      };
    }

    return {
      data: await this.enrichRegistrationsWithWorkflow(
        registrations,
        studentDocuments,
        lecturerDocuments,
      ),
    };
  }

  async findAll(user: AuthenticatedUser, query: QueryRegistrationsDto) {
    const [registrations, committees, studentDocuments, lecturerDocuments] =
      await Promise.all([
        this.repository.getAllRows<RegistrationRow>(SheetName.REGISTRATIONS),
        this.repository.getAllRows<CommitteeRow>(SheetName.COMMITTEES),
        this.repository.getAllRows<StudentDocumentRow>(
          SheetName.STUDENT_DOCUMENTS,
        ),
        this.repository.getAllRows<LecturerDocumentRow>(
          SheetName.LECTURER_DOCUMENTS,
        ),
      ]);

    let data = registrations.filter((registration) => {
      if (query.loai && registration.loai !== query.loai) {
        return false;
      }
      if (query.status && registration.status !== query.status) {
        return false;
      }
      if (query.dot && registration.dot !== query.dot) {
        return false;
      }
      if (query.emailGVHD && registration.emailGVHD !== query.emailGVHD) {
        return false;
      }
      if (query.emailGVPB && registration.emailGVPB !== query.emailGVPB) {
        return false;
      }
      if (query.committeeId && registration.committeeId !== query.committeeId) {
        return false;
      }
      return true;
    });

    if (user.role === SystemRole.STUDENT) {
      data = data.filter((registration) => registration.emailSV === user.email);
    }

    if (user.role === SystemRole.LECTURER) {
      const committeeIds = committees
        .filter((committee) =>
          this.resolveCommitteeMemberEmails(committee).includes(user.email),
        )
        .map((committee) => committee.id);

      data = data.filter((registration) => {
        if (query.roleView === 'supervisor') {
          return registration.emailGVHD === user.email;
        }
        if (query.roleView === 'reviewer') {
          return registration.emailGVPB === user.email;
        }
        if (query.roleView === 'committee') {
          return committeeIds.includes(registration.committeeId);
        }
        if (query.roleView === 'chair') {
          const committee = committees.find(
            (item) => item.id === registration.committeeId,
          );
          return committee?.chairEmail === user.email;
        }
        if (query.roleView === 'secretary') {
          const committee = committees.find(
            (item) => item.id === registration.committeeId,
          );
          return committee?.secretaryEmail === user.email;
        }

        return (
          registration.emailGVHD === user.email ||
          registration.emailGVPB === user.email ||
          committeeIds.includes(registration.committeeId)
        );
      });
    }

    return {
      data: await this.enrichRegistrationsWithWorkflow(
        data,
        studentDocuments,
        lecturerDocuments,
      ),
    };
  }

  async getStatusCatalog(loai?: RegistrationType) {
    const rows =
      await this.repository.getAllRows<RegistrationWorkflowStatusRow>(
        SheetName.REGISTRATION_WORKFLOW_STATUSES,
      );

    const data = rows
      .filter((row) => !loai || row.loai === loai)
      .sort(
        (left, right) => toNumber(left.sortOrder) - toNumber(right.sortOrder),
      )
      .map((row) => ({
        id: row.id,
        loai: row.loai,
        status: row.status,
        label: row.label,
        description: row.description,
        step: toNumber(row.step),
        stepLabel: row.stepLabel,
        actor: row.actor,
        color: row.color,
        nextStatuses: row.nextStatuses
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
        canStudentUpdate: isTruthy(row.canStudentUpdate),
        canLecturerUpdate: isTruthy(row.canLecturerUpdate),
        canManagerUpdate: isTruthy(row.canManagerUpdate),
        isTerminal: isTruthy(row.isTerminal),
        sortOrder: toNumber(row.sortOrder),
      }));

    return { data };
  }

  async getStudentRegistrationStatus(
    user: AuthenticatedUser,
    loai?: RegistrationType,
    studentEmail?: string,
  ) {
    const targetEmail = this.resolveTargetStudentEmail(user, studentEmail);
    const registrations = await this.repository.getAllRows<RegistrationRow>(
      SheetName.REGISTRATIONS,
    );
    const workflowStatuses =
      await this.repository.getAllRows<RegistrationWorkflowStatusRow>(
        SheetName.REGISTRATION_WORKFLOW_STATUSES,
      );

    const data = registrations
      .filter((row) => row.emailSV === targetEmail)
      .filter((row) => !loai || row.loai === loai)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .map((registration) => {
        const workflow = workflowStatuses.find(
          (row) =>
            row.loai === registration.loai &&
            row.status === registration.status,
        );

        return {
          registrationId: registration.id,
          emailSV: registration.emailSV,
          tenSV: registration.tenSV,
          loai: registration.loai,
          dot: registration.dot,
          tenDeTai: registration.tenDeTai,
          status: registration.status,
          statusLabel:
            workflow?.label ?? REGISTRATION_STATUS_LABELS[registration.status],
          statusDescription: workflow?.description ?? '',
          step: workflow ? toNumber(workflow.step) : null,
          stepLabel: workflow?.stepLabel ?? '',
          actor: workflow?.actor ?? '',
          color: workflow?.color ?? 'default',
          isTerminal: workflow ? isTruthy(workflow.isTerminal) : false,
          nextStatuses: workflow?.nextStatuses
            ? workflow.nextStatuses
                .split(',')
                .map((item) => item.trim())
                .filter(Boolean)
            : [],
          createdAt: registration.createdAt,
          updatedAt: registration.updatedAt,
        };
      });

    return { data };
  }

  async getRegistrationStatusById(id: string, user: AuthenticatedUser) {
    const registration = await this.getRegistrationOrThrow(id);
    await this.assertCanAccessRegistration(user, registration);

    const workflow =
      await this.repository.findOne<RegistrationWorkflowStatusRow>(
        SheetName.REGISTRATION_WORKFLOW_STATUSES,
        (row) =>
          row.loai === registration.loai && row.status === registration.status,
      );

    return {
      data: {
        registrationId: registration.id,
        emailSV: registration.emailSV,
        tenSV: registration.tenSV,
        loai: registration.loai,
        dot: registration.dot,
        tenDeTai: registration.tenDeTai,
        status: registration.status,
        statusLabel:
          workflow?.label ?? REGISTRATION_STATUS_LABELS[registration.status],
        statusDescription: workflow?.description ?? '',
        step: workflow ? toNumber(workflow.step) : null,
        stepLabel: workflow?.stepLabel ?? '',
        actor: workflow?.actor ?? '',
        color: workflow?.color ?? 'default',
        isTerminal: workflow ? isTruthy(workflow.isTerminal) : false,
        nextStatuses: workflow?.nextStatuses
          ? workflow.nextStatuses
              .split(',')
              .map((item) => item.trim())
              .filter(Boolean)
          : [],
        createdAt: registration.createdAt,
        updatedAt: registration.updatedAt,
      },
    };
  }

  async getRegistrationStatusHistory(id: string, user: AuthenticatedUser) {
    const registration = await this.getRegistrationOrThrow(id);
    await this.assertCanAccessRegistration(user, registration);

    return this.registrationStatusHistoryService.getByRegistrationId(id);
  }

  private async enrichRegistrationWithWorkflow(registration: RegistrationRow) {
    const workflow =
      await this.repository.findOne<RegistrationWorkflowStatusRow>(
        SheetName.REGISTRATION_WORKFLOW_STATUSES,
        (row) =>
          row.loai === registration.loai && row.status === registration.status,
      );

    return {
      ...registration,
      statusLabel:
        workflow?.label ?? REGISTRATION_STATUS_LABELS[registration.status],
      statusDescription: workflow?.description ?? '',
      step: workflow ? toNumber(workflow.step) : null,
      stepLabel: workflow?.stepLabel ?? '',
      actor: workflow?.actor ?? '',
      color: workflow?.color ?? 'default',
      isTerminal: workflow ? isTruthy(workflow.isTerminal) : false,
      nextStatuses: workflow?.nextStatuses
        ? workflow.nextStatuses
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean)
        : [],
    };
  }

  private async enrichRegistrationsWithWorkflow(
    registrations: RegistrationRow[],
    studentDocuments?: StudentDocumentRow[],
    lecturerDocuments?: LecturerDocumentRow[],
  ) {
    const resolvedStudentDocuments =
      studentDocuments ??
      (await this.repository.getAllRows<StudentDocumentRow>(
        SheetName.STUDENT_DOCUMENTS,
      ));
    const resolvedLecturerDocuments =
      lecturerDocuments ??
      (await this.repository.getAllRows<LecturerDocumentRow>(
        SheetName.LECTURER_DOCUMENTS,
      ));

    return Promise.all(
      registrations.map(async (registration) => {
        const enrichedRegistration =
          await this.enrichRegistrationWithWorkflow(registration);
        const registrationStudentDocuments = resolvedStudentDocuments.filter(
          (document) => document.registrationId === registration.id,
        );
        const registrationLecturerDocuments = resolvedLecturerDocuments.filter(
          (document) => document.registrationId === registration.id,
        );

        return {
          ...enrichedRegistration,
          documents: {
            studentDocuments: registrationStudentDocuments,
            lecturerDocuments: registrationLecturerDocuments,
          },
        };
      }),
    );
  }

  async findOneById(id: string, user: AuthenticatedUser) {
    const registration = await this.getRegistrationOrThrow(id);
    await this.assertCanAccessRegistration(user, registration);

    const [
      studentDocuments,
      lecturerDocuments,
      scores,
      committees,
      notifications,
    ] = await Promise.all([
      this.repository.getAllRows<StudentDocumentRow>(
        SheetName.STUDENT_DOCUMENTS,
      ),
      this.repository.getAllRows<LecturerDocumentRow>(
        SheetName.LECTURER_DOCUMENTS,
      ),
      this.repository.getAllRows<ScoreRow>(SheetName.SCORES),
      this.repository.getAllRows<CommitteeRow>(SheetName.COMMITTEES),
      this.repository.getAllRows<NotificationRow>(SheetName.NOTIFICATIONS),
    ]);

    const enrichedRegistration =
      await this.enrichRegistrationWithWorkflow(registration);

    return {
      data: {
        registration: enrichedRegistration,
        documents: {
          studentDocuments: studentDocuments.filter(
            (document) => document.registrationId === id,
          ),
          lecturerDocuments: lecturerDocuments.filter(
            (document) => document.registrationId === id,
          ),
        },
        scores: scores.filter((score) => score.registrationId === id),
        committee: committees.find(
          (committee) => committee.id === registration.committeeId,
        ),
        notifications: notifications.filter(
          (notification) => notification.referenceId === id,
        ),
        approvalStates: {
          supervisorApproved: isTruthy(registration.supervisorApproved),
          chairApproved: isTruthy(registration.chairApproved),
        },
      },
    };
  }

  async approve(
    id: string,
    user: AuthenticatedUser,
    payload: ApproveRegistrationDto,
  ) {
    const registration = await this.getRegistrationOrThrow(id);
    if (registration.emailGVHD !== user.email) {
      throw new AppException(
        'Chỉ GVHD mới được duyệt đăng ký này',
        HttpStatus.FORBIDDEN,
        ErrorCode.FORBIDDEN_ROLE,
      );
    }

    const nextStatus =
      registration.loai === RegistrationType.BCTT
        ? RegistrationStatus.BCTT_APPROVED
        : RegistrationStatus.KLTN_APPROVED;

    this.ensurePendingApproval(registration.status);

    const updated = await this.repository.updateRow<RegistrationRow>(
      SheetName.REGISTRATIONS,
      id,
      {
        tenDeTai: payload.tenDeTai ?? registration.tenDeTai,
        status: nextStatus,
        updatedAt: toIsoNow(),
      },
    );
    await this.registrationStatusHistoryService.append(
      id,
      nextStatus,
      user.email,
      user.role,
      'Sinh viên thục hiện BCTT',
    );

    await this.notificationsService.createNotification(
      registration.emailSV,
      'Đăng ký đã được duyệt',
      `GVHD đã duyệt đăng ký ${registration.loai} của bạn`,
      'REGISTRATION_APPROVED',
      id,
    );

    return { data: await this.enrichRegistrationWithWorkflow(updated) };
  }

  async reject(
    id: string,
    user: AuthenticatedUser,
    payload: RejectRegistrationDto,
  ) {
    const registration = await this.getRegistrationOrThrow(id);
    if (registration.emailGVHD !== user.email) {
      throw new AppException(
        'Chỉ GVHD mới được từ chối đăng ký này',
        HttpStatus.FORBIDDEN,
        ErrorCode.FORBIDDEN_ROLE,
      );
    }

    this.ensurePendingApproval(registration.status);

    const nextStatus =
      registration.loai === RegistrationType.BCTT
        ? RegistrationStatus.BCTT_REJECTED
        : RegistrationStatus.KLTN_REJECTED;

    const updated = await this.repository.updateRow<RegistrationRow>(
      SheetName.REGISTRATIONS,
      id,
      {
        status: nextStatus,
        rejectionReason: payload.reason,
        updatedAt: toIsoNow(),
      },
    );
    await this.registrationStatusHistoryService.append(
      id,
      nextStatus,
      user.email,
      user.role,
      payload.reason,
    );

    await this.incrementQuota(registration.emailGVHD, registration.dot, -1);
    await this.notificationsService.createNotification(
      registration.emailSV,
      'Đăng ký bị từ chối',
      payload.reason,
      'REGISTRATION_REJECTED',
      id,
    );

    return { data: await this.enrichRegistrationWithWorkflow(updated) };
  }

  async changeSupervisor(id: string, payload: ChangeSupervisorDto) {
    const registration = await this.getRegistrationOrThrow(id);
    await this.ensureLecturerQuota(payload.emailGVHD, registration.dot);

    const updated = await this.repository.updateRow<RegistrationRow>(
      SheetName.REGISTRATIONS,
      id,
      {
        emailGVHD: payload.emailGVHD,
        updatedAt: toIsoNow(),
      },
    );

    await this.incrementQuota(registration.emailGVHD, registration.dot, -1);
    await this.incrementQuota(payload.emailGVHD, registration.dot, 1);

    await this.notificationsService.createMany(
      [registration.emailSV, payload.emailGVHD],
      'Đổi giảng viên hướng dẫn',
      `Registration ${registration.id} đã được đổi GVHD`,
      'SUPERVISOR_CHANGED',
      id,
    );

    return { data: await this.enrichRegistrationWithWorkflow(updated) };
  }

  async changeReviewer(id: string, payload: ChangeReviewerDto) {
    const registration = await this.getRegistrationOrThrow(id);

    if (payload.emailGVPB === registration.emailGVHD) {
      throw new AppException(
        'GVPB không được trùng GVHD',
        HttpStatus.BAD_REQUEST,
        ErrorCode.COMMITTEE_ASSIGNMENT_INVALID,
      );
    }

    const updated = await this.repository.updateRow<RegistrationRow>(
      SheetName.REGISTRATIONS,
      id,
      {
        emailGVPB: payload.emailGVPB,
        updatedAt: toIsoNow(),
      },
    );

    await this.notificationsService.createNotification(
      payload.emailGVPB,
      'Phân công phản biện',
      `Bạn vừa được phân công phản biện cho registration ${registration.id}`,
      'REVIEWER_ASSIGNED',
      id,
    );

    return { data: await this.enrichRegistrationWithWorkflow(updated) };
  }

  async updateStatus(
    id: string,
    user: AuthenticatedUser,
    payload: UpdateRegistrationStatusDto,
  ) {
    const registration = await this.getRegistrationOrThrow(id);
    const studentDocuments =
      await this.repository.getAllRows<StudentDocumentRow>(
        SheetName.STUDENT_DOCUMENTS,
      );

    this.assertStatusTransitionAllowed(
      user,
      registration,
      payload.status,
      studentDocuments,
    );

    const updated = await this.repository.updateRow<RegistrationRow>(
      SheetName.REGISTRATIONS,
      id,
      {
        status: payload.status,
        supervisorApproved:
          payload.status === RegistrationStatus.WAITING_CHAIR_REVISION_APPROVAL
            ? true
            : registration.supervisorApproved,
        chairApproved:
          payload.status === RegistrationStatus.COMPLETED
            ? true
            : registration.chairApproved,
        updatedAt: toIsoNow(),
      },
    );
    await this.registrationStatusHistoryService.append(
      id,
      payload.status,
      user.email,
      user.role,
      'Cập nhật trạng thái đăng ký',
    );

    return { data: await this.enrichRegistrationWithWorkflow(updated) };
  }

  private ensureStudent(user: AuthenticatedUser) {
    if (user.role !== SystemRole.STUDENT) {
      throw new AppException(
        'Chỉ sinh viên mới được thực hiện thao tác này',
        HttpStatus.FORBIDDEN,
        ErrorCode.FORBIDDEN_ROLE,
      );
    }
  }

  private resolveTargetStudentEmail(
    user: AuthenticatedUser,
    studentEmail?: string,
  ) {
    if (!studentEmail || studentEmail === user.email) {
      return user.email;
    }

    if (
      [
        SystemRole.ADMIN,
        SystemRole.HEAD_OF_DEPARTMENT,
        SystemRole.LECTURER,
      ].includes(user.role)
    ) {
      return studentEmail;
    }

    throw new AppException(
      'Báº¡n khÃ´ng cÃ³ quyá»n xem tráº¡ng thÃ¡i cá»§a sinh viÃªn khÃ¡c',
      HttpStatus.FORBIDDEN,
      ErrorCode.FORBIDDEN_ROLE,
    );
  }

  private async ensureOpenTerm(
    dot: string,
    loai: RegistrationType,
    major: string,
    mode: 'registration' | 'submission',
  ) {
    const term = await this.repository.findOne<TermRow>(
      SheetName.TERMS,
      (row) => {
        return (
          this.matchesTerm(row, dot, loai, major) && isTruthy(row.isActive)
        );
      },
    );

    if (!term) {
      throw new AppException(
        'Đợt không tồn tại hoặc chưa kích hoạt',
        HttpStatus.BAD_REQUEST,
        ErrorCode.TERM_NOT_OPEN,
      );
    }

    const isOpen =
      mode === 'registration'
        ? isNowWithin(term.registrationOpenAt, term.registrationCloseAt)
        : isNowWithin(term.submissionOpenAt, term.submissionCloseAt);
    console.log(
      `Checking term open: now=${toIsoNow()}, registrationOpenAt=${term.registrationOpenAt}, registrationCloseAt=${term.registrationCloseAt}, submissionOpenAt=${term.submissionOpenAt}, submissionCloseAt=${term.submissionCloseAt}, isOpen=${isOpen}`,
    );
    if (!isOpen) {
      throw new AppException(
        'Đợt hiện không mở',
        HttpStatus.BAD_REQUEST,
        ErrorCode.TERM_NOT_OPEN,
      );
    }
  }

  private matchesTerm(
    row: TermRow,
    dot: string,
    loai: RegistrationType,
    major: string,
  ): boolean {
    return (
      this.normalizeText(row.tenDot) === this.normalizeText(dot) &&
      this.normalizeText(row.loai) === this.normalizeText(loai) &&
      this.normalizeText(row.major) === this.normalizeText(major)
    );
  }

  private normalizeText(value: string | null | undefined): string {
    return (value ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  private async ensureLecturerQuota(emailGV: string, dot: string) {
    const quotas = await this.repository.getAllRows<QuotaRow>(SheetName.QUOTAS);
    const quota =
      quotas.find((row) => row.emailGV === emailGV && row.dot === dot) ??
      quotas.find((row) => row.emailGV === emailGV);

    if (!quota || toNumber(quota.quota) - toNumber(quota.usedSlots) <= 0) {
      throw new AppException(
        'Giảng viên đã hết quota',
        HttpStatus.BAD_REQUEST,
        ErrorCode.QUOTA_EXCEEDED,
      );
    }

    return quota;
  }

  private async incrementQuota(emailGV: string, dot: string, delta: number) {
    const quotas = await this.repository.getAllRows<QuotaRow>(SheetName.QUOTAS);
    const quota =
      quotas.find((row) => row.emailGV === emailGV && row.dot === dot) ??
      quotas.find((row) => row.emailGV === emailGV);

    if (!quota) {
      return;
    }

    const nextUsedSlots = Math.max(0, toNumber(quota.usedSlots) + delta);
    const totalSlots = toNumber(quota.quota);
    await this.repository.updateRow<QuotaRow>(SheetName.QUOTAS, quota.id, {
      usedSlots: nextUsedSlots,
      quota: totalSlots - 1,
    });
  }

  private ensurePendingApproval(status: RegistrationStatus) {
    if (
      ![
        RegistrationStatus.BCTT_PENDING_APPROVAL,
        RegistrationStatus.KLTN_PENDING_APPROVAL,
      ].includes(status)
    ) {
      throw new AppException(
        'Trạng thái hiện tại không thể duyệt/từ chối',
        HttpStatus.BAD_REQUEST,
        ErrorCode.INVALID_STATUS_TRANSITION,
      );
    }
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

  private async assertCanAccessRegistration(
    user: AuthenticatedUser,
    registration: RegistrationRow,
  ) {
    if ([SystemRole.ADMIN, SystemRole.HEAD_OF_DEPARTMENT].includes(user.role)) {
      return;
    }

    if (
      user.role === SystemRole.STUDENT &&
      registration.emailSV === user.email
    ) {
      return;
    }

    if (user.role === SystemRole.LECTURER) {
      const committee = registration.committeeId
        ? await this.repository.findOne<CommitteeRow>(
            SheetName.COMMITTEES,
            (row) => {
              return row.id === registration.committeeId;
            },
          )
        : null;

      if (
        registration.emailGVHD === user.email ||
        registration.emailGVPB === user.email ||
        (committee &&
          this.resolveCommitteeMemberEmails(committee).includes(user.email))
      ) {
        return;
      }
    }

    throw new AppException(
      'Bạn không có quyền truy cập registration này',
      HttpStatus.FORBIDDEN,
      ErrorCode.FORBIDDEN_ROLE,
    );
  }

  private resolveCommitteeMemberEmails(committee: CommitteeRow): string[] {
    return [
      committee.chairEmail,
      committee.secretaryEmail,
      committee.member1Email,
      committee.member2Email,
    ].filter(Boolean);
  }

  private assertStatusTransitionAllowed(
    user: AuthenticatedUser,
    registration: RegistrationRow,
    nextStatus: RegistrationStatus,
    studentDocuments: StudentDocumentRow[],
  ) {
    const hasStudentDocument = (documentTypes: string[]) =>
      studentDocuments.some(
        (document) =>
          document.registrationId === registration.id &&
          document.emailSV === registration.emailSV &&
          documentTypes.includes(document.documentType),
      );

    if (
      user.role === SystemRole.STUDENT &&
      registration.emailSV === user.email
    ) {
      if (
        nextStatus === RegistrationStatus.BCTT_SUBMITTED &&
        [
          RegistrationStatus.BCTT_APPROVED,
          RegistrationStatus.BCTT_IN_PROGRESS,
        ].includes(registration.status) &&
        hasStudentDocument(['BCTT_REPORT', 'INTERNSHIP_CONFIRMATION'])
      ) {
        return;
      }

      if (
        nextStatus === RegistrationStatus.KLTN_SUBMITTED &&
        [
          RegistrationStatus.KLTN_APPROVED,
          RegistrationStatus.KLTN_IN_PROGRESS,
        ].includes(registration.status) &&
        hasStudentDocument(['KLTN_REPORT'])
      ) {
        return;
      }

      if (
        nextStatus ===
          RegistrationStatus.WAITING_SUPERVISOR_REVISION_APPROVAL &&
        registration.status === RegistrationStatus.WAITING_REVISED_UPLOAD &&
        hasStudentDocument(['REVISED_THESIS', 'REVISION_EXPLANATION'])
      ) {
        return;
      }
    }

    if (
      user.role === SystemRole.LECTURER &&
      registration.emailGVHD === user.email
    ) {
      if (
        [
          RegistrationStatus.BCTT_PASSED,
          RegistrationStatus.BCTT_FAILED,
        ].includes(nextStatus) &&
        registration.status === RegistrationStatus.BCTT_SUBMITTED
      ) {
        return;
      }

      if (
        nextStatus === RegistrationStatus.WAITING_CHAIR_REVISION_APPROVAL &&
        registration.status ===
          RegistrationStatus.WAITING_SUPERVISOR_REVISION_APPROVAL
      ) {
        return;
      }
    }

    if ([SystemRole.ADMIN, SystemRole.HEAD_OF_DEPARTMENT].includes(user.role)) {
      if (nextStatus === RegistrationStatus.DEFENDED) {
        return;
      }
    }

    if (
      user.role === SystemRole.LECTURER &&
      nextStatus === RegistrationStatus.COMPLETED &&
      isTruthy(registration.supervisorApproved)
    ) {
      return;
    }

    if (
      user.role === SystemRole.LECTURER &&
      nextStatus === RegistrationStatus.REJECTED_AFTER_DEFENSE &&
      registration.status === RegistrationStatus.WAITING_CHAIR_REVISION_APPROVAL
    ) {
      return;
    }

    throw new AppException(
      'Không thể cập nhật trạng thái theo yêu cầu',
      HttpStatus.BAD_REQUEST,
      ErrorCode.INVALID_STATUS_TRANSITION,
    );
  }
}
