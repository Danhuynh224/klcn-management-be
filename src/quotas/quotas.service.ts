import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { SHEET_REPOSITORY } from '../common/constants/injection-tokens';
import { SheetName } from '../common/constants/sheet-definitions';
import { ErrorCode } from '../common/enums/error-code.enum';
import { AppException } from '../common/exceptions/app.exception';
import { QuotaRow } from '../common/types/domain.types';
import { toIsoNow } from '../common/utils/date.util';
import { toNumber } from '../common/utils/score.util';
import { UpdateQuotaDto } from './dto/update-quota.dto';
import type { SheetRepository } from '../common/types/sheet-repository.interface';

@Injectable()
export class QuotasService {
  constructor(
    @Inject(SHEET_REPOSITORY)
    private readonly repository: SheetRepository,
  ) {}

  async findAll(dot?: string, emailGV?: string) {
    const quotas = await this.repository.getAllRows<QuotaRow>(SheetName.QUOTAS);

    return {
      data: quotas
        .filter(
          (quota) =>
            (!dot || quota.dot === dot) &&
            (!emailGV || quota.emailGV === emailGV),
        )
        .map((quota) => ({
          ...quota,
          quota: toNumber(quota.quota),
          usedSlots: toNumber(quota.usedSlots),
          remainingSlots: toNumber(quota.quota) - toNumber(quota.usedSlots),
        })),
    };
  }

  async updateQuota(id: string, payload: UpdateQuotaDto) {
    const quota = await this.repository.findOne<QuotaRow>(
      SheetName.QUOTAS,
      (row) => {
        return row.id === id;
      },
    );

    if (!quota) {
      throw new AppException(
        'Quota không tồn tại',
        HttpStatus.NOT_FOUND,
        ErrorCode.RESOURCE_NOT_FOUND,
      );
    }

    return {
      data: await this.repository.updateRow<QuotaRow>(SheetName.QUOTAS, id, {
        quota: payload.quota,
      }),
    };
  }

  async approveQuota(id: string) {
    return {
      data: await this.repository.updateRow<QuotaRow>(SheetName.QUOTAS, id, {
        status: 'APPROVED',
        approvedAt: toIsoNow(),
      }),
    };
  }
}
