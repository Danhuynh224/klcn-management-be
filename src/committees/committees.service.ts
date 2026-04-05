import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { SHEET_REPOSITORY } from '../common/constants/injection-tokens';
import { SheetName } from '../common/constants/sheet-definitions';
import { ErrorCode } from '../common/enums/error-code.enum';
import { RegistrationStatus } from '../common/enums/registration-status.enum';
import { RegistrationType } from '../common/enums/registration-type.enum';
import { AppException } from '../common/exceptions/app.exception';
import { CommitteeRow, RegistrationRow } from '../common/types/domain.types';
import { toIsoNow } from '../common/utils/date.util';
import { createId } from '../common/utils/id.util';
import { NotificationsService } from '../notifications/notifications.service';
import { RegistrationStatusHistoryService } from '../registrations/registration-status-history.service';
import { AssignRegistrationDto } from './dto/assign-registration.dto';
import { CreateCommitteeDto } from './dto/create-committee.dto';
import { UpdateCommitteeDto } from './dto/update-committee.dto';
import type { SheetRepository } from '../common/types/sheet-repository.interface';

@Injectable()
export class CommitteesService {
  constructor(
    @Inject(SHEET_REPOSITORY)
    private readonly repository: SheetRepository,
    private readonly notificationsService: NotificationsService,
    private readonly registrationStatusHistoryService: RegistrationStatusHistoryService,
  ) {}

  async findAll(dot?: string) {
    const committees = await this.repository.getAllRows<CommitteeRow>(
      SheetName.COMMITTEES,
    );
    return {
      data: committees.filter((committee) => !dot || committee.dot === dot),
    };
  }

  async findOne(id: string) {
    const committee = await this.repository.findOne<CommitteeRow>(
      SheetName.COMMITTEES,
      (row) => row.id === id,
    );

    if (!committee) {
      throw new AppException(
        'Hội đồng không tồn tại',
        HttpStatus.NOT_FOUND,
        ErrorCode.RESOURCE_NOT_FOUND,
      );
    }

    return { data: committee };
  }

  async create(payload: CreateCommitteeDto) {
    const emails = [
      payload.chairEmail,
      payload.secretaryEmail,
      payload.member1Email,
      payload.member2Email,
    ];

    if (new Set(emails).size !== emails.length) {
      throw new AppException(
        'Thành viên hội đồng không được trùng vai trò',
        HttpStatus.BAD_REQUEST,
        ErrorCode.COMMITTEE_ASSIGNMENT_INVALID,
      );
    }

    const committee: CommitteeRow = {
      id: createId('committee'),
      ...payload,
      createdAt: toIsoNow(),
    };

    await this.repository.insertRow<CommitteeRow>(
      SheetName.COMMITTEES,
      committee,
    );
    return { data: committee };
  }

  async update(id: string, payload: UpdateCommitteeDto) {
    return {
      data: await this.repository.updateRow<CommitteeRow>(
        SheetName.COMMITTEES,
        id,
        payload,
      ),
    };
  }

  async assignRegistration(id: string, payload: AssignRegistrationDto) {
    const committee = await this.repository.findOne<CommitteeRow>(
      SheetName.COMMITTEES,
      (row) => row.id === id,
    );
    const registration = await this.repository.findOne<RegistrationRow>(
      SheetName.REGISTRATIONS,
      (row) => row.id === payload.registrationId,
    );

    if (!committee || !registration) {
      throw new AppException(
        'Dữ liệu phân công không hợp lệ',
        HttpStatus.NOT_FOUND,
        ErrorCode.COMMITTEE_ASSIGNMENT_INVALID,
      );
    }

    if (
      registration.loai !== RegistrationType.KLTN ||
      ![
        RegistrationStatus.KLTN_APPROVED,
        RegistrationStatus.KLTN_SUBMITTED,
        RegistrationStatus.WAITING_TURNITIN,
        RegistrationStatus.WAITING_SUPERVISOR_SCORE,
        RegistrationStatus.WAITING_REVIEWER_SCORE,
      ].includes(registration.status)
    ) {
      throw new AppException(
        'Registration chưa đủ điều kiện vào hội đồng',
        HttpStatus.BAD_REQUEST,
        ErrorCode.COMMITTEE_ASSIGNMENT_INVALID,
      );
    }

    await this.repository.updateRow<RegistrationRow>(
      SheetName.REGISTRATIONS,
      registration.id,
      {
        committeeId: committee.id,
        defenseDate: committee.defenseDate,
        location: committee.location,
        status: RegistrationStatus.DEFENSE_SCHEDULED,
        updatedAt: toIsoNow(),
      },
    );
    await this.registrationStatusHistoryService.append(
      registration.id,
      RegistrationStatus.DEFENSE_SCHEDULED,
      committee.chairEmail,
      'HEAD_OF_DEPARTMENT',
      `Phân vào hội đồng ${committee.committeeName}`,
    );

    await this.notificationsService.createMany(
      [
        registration.emailSV,
        committee.chairEmail,
        committee.secretaryEmail,
        committee.member1Email,
        committee.member2Email,
      ],
      'Phân công hội đồng',
      `Registration ${registration.id} đã được phân vào ${committee.committeeName}`,
      'COMMITTEE_ASSIGNED',
      registration.id,
    );

    return {
      data: {
        committeeId: committee.id,
        registrationId: registration.id,
      },
    };
  }
}
