import { Inject, Injectable } from '@nestjs/common';
import { SHEET_REPOSITORY } from '../common/constants/injection-tokens';
import { SheetName } from '../common/constants/sheet-definitions';
import {
  FieldRow,
  SuggestedTopicRow,
  UserRow,
} from '../common/types/domain.types';
import type { AuthenticatedUser } from '../common/types/authenticated-user.type';
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

  async findByUserMajor(user: AuthenticatedUser) {
    const [users, fields] = await Promise.all([
      this.repository.getAllRows<UserRow>(SheetName.USERS),
      this.repository.getAllRows<FieldRow>(SheetName.FIELDS),
    ]);

    const normalizedMajor = this.normalizeText(user.major);
    const lecturerEmails = new Set(
      users
        .filter((item) => this.normalizeText(item.major) === normalizedMajor)
        .map((item) => item.email),
    );

    const fieldNames = Array.from(
      new Set(
        fields
          .filter((field) => lecturerEmails.has(field.emailGV))
          .map((field) => field.fieldName)
          .filter(Boolean),
      ),
    ).sort((left, right) => left.localeCompare(right));

    return {
      data: fieldNames,
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
}
