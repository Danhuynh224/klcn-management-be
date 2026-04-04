import { Inject, Injectable } from '@nestjs/common';
import { SHEET_REPOSITORY } from '../common/constants/injection-tokens';
import { SheetName } from '../common/constants/sheet-definitions';
import { FieldRow, SuggestedTopicRow } from '../common/types/domain.types';
import type { SheetRepository } from '../common/types/sheet-repository.interface';

@Injectable()
export class FieldsService {
  constructor(
    @Inject(SHEET_REPOSITORY)
    private readonly repository: SheetRepository,
  ) {}

  async findAll(emailGV?: string) {
    const fields = await this.repository.getAllRows<FieldRow>(SheetName.FIELDS);
    return {
      data: fields.filter((field) => !emailGV || field.emailGV === emailGV),
    };
  }

  async getSuggestions(fieldName?: string) {
    const topics = await this.repository.getAllRows<SuggestedTopicRow>(
      SheetName.SUGGESTED_TOPICS,
    );

    return {
      data: topics.filter(
        (topic) => !fieldName || topic.fieldName === fieldName,
      ),
    };
  }
}
