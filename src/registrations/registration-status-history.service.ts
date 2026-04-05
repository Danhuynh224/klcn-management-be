import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { SHEET_REPOSITORY } from '../common/constants/injection-tokens';
import { SheetName } from '../common/constants/sheet-definitions';
import {
  REGISTRATION_STATUS_LABELS,
  RegistrationStatus,
} from '../common/enums/registration-status.enum';
import { ErrorCode } from '../common/enums/error-code.enum';
import { AppException } from '../common/exceptions/app.exception';
import { RegistrationStatusHistoryRow } from '../common/types/domain.types';
import { successResponse } from '../common/utils/api-response.util';
import { toIsoNow } from '../common/utils/date.util';
import { createId } from '../common/utils/id.util';
import type { SheetRepository } from '../common/types/sheet-repository.interface';

@Injectable()
export class RegistrationStatusHistoryService {
  constructor(
    @Inject(SHEET_REPOSITORY)
    private readonly repository: SheetRepository,
  ) {}

  async append(
    registrationId: string,
    status: RegistrationStatus,
    changedBy: string,
    changedByRole: string,
    note = '',
  ) {
    const row: RegistrationStatusHistoryRow = {
      id: createId('rsh'),
      registrationId,
      status,
      statusLabel: REGISTRATION_STATUS_LABELS[status],
      changedBy,
      changedByRole,
      note,
      changedAt: toIsoNow(),
    };

    await this.repository.insertRow<RegistrationStatusHistoryRow>(
      SheetName.REGISTRATION_STATUS_HISTORY,
      row,
    );

    return row;
  }

  async getByRegistrationId(registrationId: string) {
    const rows = await this.repository.getAllRows<RegistrationStatusHistoryRow>(
      SheetName.REGISTRATION_STATUS_HISTORY,
    );

    const data = rows
      .filter((row) => row.registrationId === registrationId)
      .sort((left, right) => left.changedAt.localeCompare(right.changedAt))
      .map((row) => ({
        id: row.id,
        registrationId: row.registrationId,
        status: row.status,
        changedBy: row.changedBy,
        changedByRole: row.changedByRole,
        note: row.note,
        changedAt: row.changedAt,
      }));

    return successResponse(data);
  }

  async getLatestByRegistrationId(registrationId: string) {
    const history = await this.getByRegistrationId(registrationId);
    return history.data.at(-1) ?? null;
  }

  async ensureRegistrationHistoryExists(registrationId: string) {
    const latest = await this.getLatestByRegistrationId(registrationId);
    if (!latest) {
      throw new AppException(
        'Khong tim thay lich su trang thai cua registration',
        HttpStatus.NOT_FOUND,
        ErrorCode.RESOURCE_NOT_FOUND,
      );
    }
    return latest;
  }
}
