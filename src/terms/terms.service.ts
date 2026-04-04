import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { SHEET_REPOSITORY } from '../common/constants/injection-tokens';
import { SheetName } from '../common/constants/sheet-definitions';
import { ErrorCode } from '../common/enums/error-code.enum';
import { AppException } from '../common/exceptions/app.exception';
import { TermRow } from '../common/types/domain.types';
import { createId } from '../common/utils/id.util';
import { CreateTermDto } from './dto/create-term.dto';
import { UpdateTermDto } from './dto/update-term.dto';
import type { SheetRepository } from '../common/types/sheet-repository.interface';

@Injectable()
export class TermsService {
  constructor(
    @Inject(SHEET_REPOSITORY)
    private readonly repository: SheetRepository,
  ) {}

  async findAll(loai?: string, isActive?: string) {
    const terms = await this.repository.getAllRows<TermRow>(SheetName.TERMS);

    return {
      data: terms.filter((term) => {
        if (loai && String(term.loai) !== loai) {
          return false;
        }

        if (
          isActive === 'true' &&
          String(term.isActive).toLowerCase() !== 'true'
        ) {
          return false;
        }

        return true;
      }),
    };
  }

  async create(payload: CreateTermDto) {
    const term: TermRow = {
      id: createId('term'),
      ...payload,
    };

    return {
      data: await this.repository.insertRow<TermRow>(SheetName.TERMS, term),
    };
  }

  async update(id: string, payload: UpdateTermDto) {
    const term = await this.repository.findOne<TermRow>(
      SheetName.TERMS,
      (row) => {
        return row.id === id;
      },
    );

    if (!term) {
      throw new AppException(
        'Đợt không tồn tại',
        HttpStatus.NOT_FOUND,
        ErrorCode.RESOURCE_NOT_FOUND,
      );
    }

    return {
      data: await this.repository.updateRow<TermRow>(
        SheetName.TERMS,
        id,
        payload,
      ),
    };
  }
}
