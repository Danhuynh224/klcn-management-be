import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { google, sheets_v4 } from 'googleapis';
import { readFile, utils } from 'xlsx';
import {
  DEFAULT_LOGIN_PASSWORD,
  DEFAULT_SHEET_YEAR,
} from '../common/constants/app.constants';
import {
  REQUIRED_SHEET_HEADERS,
  SheetName,
} from '../common/constants/sheet-definitions';
import {
  LecturerDocumentType,
  StudentDocumentType,
} from '../common/enums/document-type.enum';
import { ErrorCode } from '../common/enums/error-code.enum';
import { LecturerBusinessRole } from '../common/enums/lecturer-business-role.enum';
import { RegistrationStatus } from '../common/enums/registration-status.enum';
import { RegistrationType } from '../common/enums/registration-type.enum';
import { SystemRole } from '../common/enums/system-role.enum';
import { AppException } from '../common/exceptions/app.exception';
import type {
  CommitteeRow,
  FieldRow,
  LecturerDocumentRow,
  MinuteRow,
  NotificationRow,
  QuotaRow,
  RegistrationRow,
  RegistrationStatusHistoryRow,
  RegistrationWorkflowStatusRow,
  ScoreRow,
  StudentDocumentRow,
  SuggestedTopicRow,
  TermRow,
  UserRow,
} from '../common/types/domain.types';
import type { SheetRepository } from '../common/types/sheet-repository.interface';
import { toIsoNow } from '../common/utils/date.util';
import { createId } from '../common/utils/id.util';

type RowObject = Record<string, string>;

interface SheetConfig<T> {
  actualTitle: string;
  headers: string[];
  sampleTitle?: string;
  importSample?: boolean;
  toInternal: (row: RowObject) => T;
  toExternal: (row: T) => RowObject;
}

@Injectable()
export class GoogleSheetsService implements OnModuleInit, SheetRepository {
  private readonly logger = new Logger(GoogleSheetsService.name);
  private readonly spreadsheetId = process.env.GOOGLE_SHEET_ID ?? '';
  private readonly sampleWorkbookPath = join(
    process.cwd(),
    'data',
    'klcn-management.xlsx',
  );
  private client: sheets_v4.Sheets | null = null;

  private readonly configs: Record<string, SheetConfig<unknown>> = {
    [SheetName.USERS]: {
      actualTitle: 'User',
      headers: [
        'Email',
        'MS',
        'Ten',
        'Role',
        'Major',
        'HeDaoTao',
        'Password',
        'Id',
        'CreatedAt',
      ],
      sampleTitle: 'User',
      importSample: true,
      toInternal: (row) =>
        ({
          id:
            row.Id ||
            this.getFallbackRowId('user', row, ['Email', 'MS', 'Role']),
          email: row.Email,
          password: row.Password || DEFAULT_LOGIN_PASSWORD,
          ms: row.MS,
          ten: row.Ten,
          major: row.Major,
          heDaoTao: row.HeDaoTao,
          role: this.mapSystemRole(row.Role, row.Email),
          createdAt: row.CreatedAt || toIsoNow(),
        }) satisfies UserRow,
      toExternal: (row) => {
        const user = row as UserRow;
        return {
          Email: user.email,
          MS: user.ms,
          Ten: user.ten,
          Role: this.mapExternalRole(user.role),
          Major: '',
          HeDaoTao: '',
          Password: user.password || DEFAULT_LOGIN_PASSWORD,
          Id: user.id,
          CreatedAt: user.createdAt || toIsoNow(),
        };
      },
    },
    [SheetName.QUOTAS]: {
      actualTitle: 'Quota',
      headers: [
        'Email',
        'Major',
        'HeDaoTao',
        'Quota',
        'UsedSlots',
        'Dot',
        'Status',
        'ApprovedAt',
        'Id',
        'MSGV',
      ],
      sampleTitle: 'Quota',
      importSample: true,
      toInternal: (row) =>
        ({
          id:
            row.Id ||
            this.getFallbackRowId('quota', row, ['Email', 'Dot', 'HeDaoTao']),
          emailGV: row.Email,
          msgv: row.MSGV,
          quota: row.Quota || '0',
          usedSlots: row.UsedSlots || '0',
          heDaoTao: row.HeDaoTao,
          dot: row.Dot,
          status: row.Status,
          approvedAt: row.ApprovedAt,
        }) satisfies QuotaRow,
      toExternal: (row) => {
        const quota = row as QuotaRow;
        return {
          Email: quota.emailGV,
          Major: '',
          HeDaoTao: quota.heDaoTao ?? '',
          Quota: `${quota.quota ?? 0}`,
          UsedSlots: `${quota.usedSlots ?? 0}`,
          Dot: quota.dot ?? '',
          Status: quota.status ?? '',
          ApprovedAt: quota.approvedAt ?? '',
          Id: quota.id,
          MSGV: quota.msgv ?? '',
        };
      },
    },
    [SheetName.FIELDS]: {
      actualTitle: 'Field',
      headers: ['Email', 'Major', 'Field', 'Id'],
      sampleTitle: 'Field',
      importSample: true,
      toInternal: (row) =>
        ({
          id: row.Id || this.getFallbackRowId('field', row, ['Email', 'Field']),
          emailGV: row.Email,
          fieldName: row.Field,
        }) satisfies FieldRow,
      toExternal: (row) => {
        const field = row as FieldRow;
        return {
          Email: field.emailGV,
          Major: '',
          Field: field.fieldName,
          Id: field.id,
        };
      },
    },
    [SheetName.TERMS]: {
      actualTitle: 'Dot',
      headers: [
        'StartReg',
        'EndReg',
        'Loaidetai',
        'Major',
        'Dot',
        'Active',
        'StartEx',
        'EndEx',
        'Id',
        'NamHoc',
        'HocKy',
        'DefenseDate',
      ],
      sampleTitle: 'Dot',
      importSample: true,
      toInternal: (row) => {
        const registrationOpenAt = this.toIsoDate(row.StartReg);
        const registrationCloseAt = this.toIsoDate(row.EndReg);
        const submissionOpenAt =
          this.toIsoDate(row.StartEx) || registrationOpenAt;
        const submissionCloseAt =
          this.toIsoDate(row.EndEx) || registrationCloseAt;

        return {
          id:
            row.Id ||
            this.getFallbackRowId('term', row, ['Dot', 'Loaidetai', 'Major']),
          tenDot: row.Dot,
          loai: this.mapRegistrationType(row.Loaidetai),
          major: row.Major || '',
          namHoc: row.NamHoc || '',
          hocKy: row.HocKy || '',
          registrationOpenAt,
          registrationCloseAt,
          submissionOpenAt,
          submissionCloseAt,
          defenseDate: this.toIsoDate(row.DefenseDate) || submissionCloseAt,
          isActive: this.mapYesNoToBoolean(row.Active),
        } satisfies TermRow;
      },
      toExternal: (row) => {
        const term = row as TermRow;
        return {
          StartReg: term.registrationOpenAt,
          EndReg: term.registrationCloseAt,
          Loaidetai: term.loai,
          Major: term.major ?? '',
          Dot: term.tenDot,
          Active: this.mapBooleanToYesNo(term.isActive),
          StartEx: term.submissionOpenAt,
          EndEx: term.submissionCloseAt,
          Id: term.id,
          NamHoc: term.namHoc ?? '',
          HocKy: term.hocKy ?? '',
          DefenseDate: term.defenseDate ?? '',
        };
      },
    },
    [SheetName.REGISTRATIONS]: {
      actualTitle: 'Registrations',
      headers: REQUIRED_SHEET_HEADERS[SheetName.REGISTRATIONS],
      toInternal: (row) =>
        ({
          id: row.id,
          emailSV: row.emailSV,
          tenSV: row.tenSV,
          loai: this.mapRegistrationType(row.loai),
          tenDeTai: row.tenDeTai,
          linhVuc: row.linhVuc,
          tenCongTy: row.tenCongTy,
          emailGVHD: row.emailGVHD,
          emailGVPB: row.emailGVPB,
          dot: row.dot,
          status: this.mapRegistrationStatus(row.status),
          committeeId: row.committeeId,
          defenseDate: row.defenseDate,
          location: row.location,
          finalScore: row.finalScore,
          supervisorApproved: row.supervisorApproved,
          chairApproved: row.chairApproved,
          rejectionReason: row.rejectionReason,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
        }) satisfies RegistrationRow,
      toExternal: (row) =>
        this.normalizeCanonicalRow(row as Record<string, unknown>),
    },
    [SheetName.COMMITTEES]: {
      actualTitle: 'Committees',
      headers: REQUIRED_SHEET_HEADERS[SheetName.COMMITTEES],
      toInternal: (row) =>
        ({
          id: row.id,
          committeeName: row.committeeName,
          dot: row.dot,
          chairEmail: row.chairEmail,
          secretaryEmail: row.secretaryEmail,
          member1Email: row.member1Email,
          member2Email: row.member2Email,
          location: row.location,
          defenseDate: row.defenseDate,
          createdAt: row.createdAt,
        }) satisfies CommitteeRow,
      toExternal: (row) =>
        this.normalizeCanonicalRow(row as Record<string, unknown>),
    },
    [SheetName.SCORES]: {
      actualTitle: 'Điểm',
      headers: [
        'Email',
        'GV',
        'TC1',
        'TC2',
        'TC3',
        'TC4',
        'TC5',
        'TC6',
        'TC7',
        'TC8',
        'TC9',
        'TC10',
        'Tổng điểm',
        'id',
        'registrationId',
        'emailGV',
        'vaiTroCham',
        'score1',
        'score2',
        'score3',
        'totalScore',
        'comments',
        'questions',
        'createdAt',
        'updatedAt',
      ],
      sampleTitle: 'Điểm',
      importSample: true,
      toInternal: (row) =>
        ({
          id: row.id || createId('score'),
          registrationId: row.registrationId,
          emailGV: row.emailGV || row.GV,
          vaiTroCham: this.mapLecturerBusinessRole(row.vaiTroCham),
          score1: row.score1 || row.TC1 || '',
          score2: row.score2 || row.TC2 || '',
          score3: row.score3 || row.TC3 || '',
          totalScore: row.totalScore || row['Tổng điểm'] || '',
          comments: row.comments || '',
          questions: row.questions || '',
          createdAt: row.createdAt || toIsoNow(),
          updatedAt: row.updatedAt || toIsoNow(),
        }) satisfies ScoreRow,
      toExternal: (row) =>
        this.normalizeCanonicalRow(row as Record<string, unknown>),
    },
    [SheetName.STUDENT_DOCUMENTS]: {
      actualTitle: 'Linkbainop',
      headers: [
        'EmailSV',
        'Tendetai',
        'DotHK',
        'Loaidetai',
        'Linkbai',
        'Id',
        'DocumentType',
        'FileName',
        'FileUrl',
        'UploadedAt',
        'RegistrationId',
      ],
      sampleTitle: 'Linkbainop',
      importSample: true,
      toInternal: (row) =>
        ({
          id:
            row.Id ||
            this.getFallbackRowId('sdoc', row, ['EmailSV', 'Linkbai', 'DotHK']),
          registrationId: row.RegistrationId,
          emailSV: row.EmailSV,
          documentType: (row.DocumentType ||
            this.inferStudentDocumentType(
              row.Linkbai,
            )) as StudentDocumentRow['documentType'],
          fileName: row.FileName || '',
          fileUrl: row.FileUrl || row.Linkbai,
          uploadedAt: row.UploadedAt || toIsoNow(),
        }) satisfies StudentDocumentRow,
      toExternal: (row) => {
        const document = row as StudentDocumentRow;
        return {
          EmailSV: document.emailSV,
          Tendetai: '',
          DotHK: '',
          Loaidetai: '',
          Linkbai: document.fileUrl,
          Id: document.id,
          DocumentType: document.documentType,
          FileName: document.fileName,
          FileUrl: document.fileUrl,
          UploadedAt: document.uploadedAt,
          RegistrationId: document.registrationId,
        };
      },
    },
    [SheetName.LECTURER_DOCUMENTS]: {
      actualTitle: 'LinkGiangvien',
      headers: [
        'EmailSV',
        'EmailGV',
        'Role',
        'Diadiem',
        'Diem',
        'End',
        'Link',
        'Id',
        'RegistrationId',
        'DocumentType',
        'FileName',
        'FileUrl',
        'UploadedAt',
      ],
      sampleTitle: 'LinkGiangvien',
      importSample: true,
      toInternal: (row) =>
        ({
          id:
            row.Id ||
            this.getFallbackRowId('ldoc', row, ['EmailGV', 'Link', 'Role']),
          registrationId: row.RegistrationId,
          emailGV: row.EmailGV,
          documentType: (row.DocumentType ||
            this.inferLecturerDocumentType(
              row.Role,
              row.Link,
            )) as LecturerDocumentRow['documentType'],
          fileName: row.FileName || '',
          fileUrl: row.FileUrl || row.Link,
          uploadedAt: row.UploadedAt || toIsoNow(),
        }) satisfies LecturerDocumentRow,
      toExternal: (row) => {
        const document = row as LecturerDocumentRow;
        return {
          EmailSV: '',
          EmailGV: document.emailGV,
          Role: '',
          Diadiem: '',
          Diem: '',
          End: '',
          Link: document.fileUrl,
          Id: document.id,
          RegistrationId: document.registrationId,
          DocumentType: document.documentType,
          FileName: document.fileName,
          FileUrl: document.fileUrl,
          UploadedAt: document.uploadedAt,
        };
      },
    },
    [SheetName.SUGGESTED_TOPICS]: {
      actualTitle: 'Detaigoiy',
      headers: [
        'Email',
        'Tendetai',
        'Dot',
        'Id',
        'Field',
        'Description',
        'Status',
        'CreatedAt',
      ],
      sampleTitle: 'Detaigoiy',
      importSample: true,
      toInternal: (row) =>
        ({
          id:
            row.Id ||
            this.getFallbackRowId('topic', row, ['Email', 'Tendetai', 'Dot']),
          title: row.Tendetai,
          fieldName: row.Field || '',
          emailGV: row.Email,
          description: row.Description || '',
          status: row.Status || 'OPEN',
          createdAt: row.CreatedAt || toIsoNow(),
        }) satisfies SuggestedTopicRow,
      toExternal: (row) => {
        const topic = row as SuggestedTopicRow;
        return {
          Email: topic.emailGV,
          Tendetai: topic.title,
          Dot: '',
          Id: topic.id,
          Field: topic.fieldName,
          Description: topic.description,
          Status: topic.status,
          CreatedAt: topic.createdAt,
        };
      },
    },
    [SheetName.NOTIFICATIONS]: {
      actualTitle: 'Notifications',
      headers: REQUIRED_SHEET_HEADERS[SheetName.NOTIFICATIONS],
      toInternal: (row) =>
        ({
          id: row.id,
          receiverEmail: row.receiverEmail,
          title: row.title,
          content: row.content,
          type: row.type,
          referenceId: row.referenceId,
          isRead: row.isRead,
          createdAt: row.createdAt,
        }) satisfies NotificationRow,
      toExternal: (row) =>
        this.normalizeCanonicalRow(row as Record<string, unknown>),
    },
    [SheetName.MINUTES]: {
      actualTitle: 'Minutes',
      headers: REQUIRED_SHEET_HEADERS[SheetName.MINUTES],
      toInternal: (row) =>
        ({
          id: row.id,
          registrationId: row.registrationId,
          generatedBy: row.generatedBy,
          content: row.content,
          fileUrl: row.fileUrl,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
        }) satisfies MinuteRow,
      toExternal: (row) =>
        this.normalizeCanonicalRow(row as Record<string, unknown>),
    },
    [SheetName.REGISTRATION_WORKFLOW_STATUSES]: {
      actualTitle: 'RegistrationWorkflowStatuses',
      headers: [
        'id',
        'loai',
        'status',
        'label',
        'description',
        'step',
        'stepLabel',
        'actor',
        'color',
        'nextStatuses',
        'canStudentUpdate',
        'canLecturerUpdate',
        'canManagerUpdate',
        'isTerminal',
        'sortOrder',
      ],
      toInternal: (row) =>
        ({
          id: row.id,
          loai: this.mapRegistrationType(row.loai),
          status: this.mapRegistrationStatus(row.status),
          label: row.label,
          description: row.description,
          step: row.step,
          stepLabel: row.stepLabel,
          actor: row.actor,
          color: row.color,
          nextStatuses: row.nextStatuses,
          canStudentUpdate: row.canStudentUpdate,
          canLecturerUpdate: row.canLecturerUpdate,
          canManagerUpdate: row.canManagerUpdate,
          isTerminal: row.isTerminal,
          sortOrder: row.sortOrder,
        }) satisfies RegistrationWorkflowStatusRow,
      toExternal: (row) =>
        this.normalizeCanonicalRow(row as Record<string, unknown>),
    },
    [SheetName.REGISTRATION_STATUS_HISTORY]: {
      actualTitle: 'RegistrationStatusHistory',
      headers: REQUIRED_SHEET_HEADERS[SheetName.REGISTRATION_STATUS_HISTORY],
      toInternal: (row) =>
        ({
          id: row.id,
          registrationId: row.registrationId,
          status: this.mapRegistrationStatus(row.status),
          statusLabel: row.statusLabel,
          changedBy: row.changedBy,
          changedByRole: row.changedByRole,
          note: row.note,
          changedAt: row.changedAt,
        }) satisfies RegistrationStatusHistoryRow,
      toExternal: (row) =>
        this.normalizeCanonicalRow(row as Record<string, unknown>),
    },
  };

  async onModuleInit() {
    try {
      await this.bootstrapSpreadsheet();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(`Google Sheets bootstrap skipped: ${message}`);
    }
  }

  async getAllRows<T>(sheetName: string): Promise<T[]> {
    const config = this.getConfig(sheetName);
    const rows = await this.readMappedRows(config);
    return rows.map((row) => config.toInternal(row) as T);
  }

  async findOne<T>(
    sheetName: string,
    predicate: (row: T) => boolean,
  ): Promise<T | null> {
    const rows = await this.getAllRows<T>(sheetName);
    return rows.find(predicate) ?? null;
  }

  async insertRow<T>(sheetName: string, row: T): Promise<T> {
    const config = this.getConfig(sheetName);
    const rows = await this.readMappedRows(config);
    rows.push(config.toExternal(row));
    await this.writeMappedRows(config, rows);
    return row;
  }

  async updateRow<T>(
    sheetName: string,
    id: string,
    partial: Partial<T>,
  ): Promise<T> {
    const currentRows = await this.getAllRows<T & { id?: string }>(sheetName);
    const index = currentRows.findIndex((row) => row.id === id);

    if (index === -1) {
      throw new Error(`Row ${id} not found in ${sheetName}`);
    }

    const nextRow = {
      ...currentRows[index],
      ...partial,
    };

    currentRows[index] = nextRow;
    await this.writeTypedRows(sheetName, currentRows);
    return nextRow;
  }

  async deleteRow(sheetName: string, id: string): Promise<void> {
    const rows = await this.getAllRows<{ id?: string }>(sheetName);
    const nextRows = rows.filter((row) => row.id !== id);
    await this.writeTypedRows(sheetName, nextRows);
  }

  async ensureSheet(sheetName: string, headers: string[]): Promise<void> {
    const config = this.getConfig(sheetName);
    await this.ensureSheetExists(config.actualTitle);
    const { headers: existingHeaders, rows } = await this.readSheet(
      config.actualTitle,
    );
    const mergedHeaders = Array.from(
      new Set([...config.headers, ...headers, ...existingHeaders]),
    );
    await this.writeSheet(config.actualTitle, mergedHeaders, rows);
  }

  private async bootstrapSpreadsheet() {
    if (!this.spreadsheetId) {
      this.logger.warn(
        'GOOGLE_SHEET_ID is missing. Google Sheets adapter is disabled.',
      );
      return;
    }

    for (const config of Object.values(this.configs)) {
      await this.ensureSheetExists(config.actualTitle);
      const { rows } = await this.readSheet(config.actualTitle);
      if (rows.length === 0 && config.importSample) {
        const sampleRows = this.readSampleSheet(
          config.sampleTitle ?? config.actualTitle,
        );
        if (sampleRows.length > 0) {
          await this.writeSheet(config.actualTitle, config.headers, sampleRows);
          continue;
        }
      }

      await this.ensureSheet(
        config.actualTitle === 'Điểm'
          ? SheetName.SCORES
          : this.findLogicalName(config.actualTitle),
        config.headers,
      );
    }

    await this.ensureDefaultUsers();
    await this.ensureRegistrationWorkflowStatuses();
    this.logger.log(
      `Google Sheets repository ready for spreadsheet ${this.spreadsheetId}`,
    );
  }

  private async ensureDefaultUsers() {
    const users = await this.getAllRows<UserRow>(SheetName.USERS);
    const requiredUsers: UserRow[] = [
      {
        id: 'u_admin',
        email: 'admin@ute.edu.vn',
        password: DEFAULT_LOGIN_PASSWORD,
        ms: 'ADM001',
        major: '',
        heDaoTao: '',
        ten: 'System Admin',
        role: SystemRole.ADMIN,
        createdAt: toIsoNow(),
      },
      {
        id: 'u_head',
        email: 'tbm@ute.edu.vn',
        password: DEFAULT_LOGIN_PASSWORD,
        ms: 'TBM001',
        major: '',
        heDaoTao: '',
        ten: 'Truong Bo Mon',
        role: SystemRole.HEAD_OF_DEPARTMENT,
        createdAt: toIsoNow(),
      },
    ];

    for (const user of requiredUsers) {
      if (!users.some((item) => item.email === user.email)) {
        await this.insertRow<UserRow>(SheetName.USERS, user);
      }
    }
  }

  private async ensureRegistrationWorkflowStatuses() {
    const statuses = await this.getAllRows<RegistrationWorkflowStatusRow>(
      SheetName.REGISTRATION_WORKFLOW_STATUSES,
    );

    if (statuses.length > 0) {
      return;
    }

    for (const row of this.buildDefaultRegistrationWorkflowStatuses()) {
      await this.insertRow<RegistrationWorkflowStatusRow>(
        SheetName.REGISTRATION_WORKFLOW_STATUSES,
        row,
      );
    }
  }

  private async writeTypedRows<T>(sheetName: string, rows: T[]) {
    const config = this.getConfig(sheetName);
    const externalRows = rows.map((row) => config.toExternal(row));
    await this.writeMappedRows(config, externalRows);
  }

  private async readMappedRows(
    config: SheetConfig<unknown>,
  ): Promise<RowObject[]> {
    const { headers, rows } = await this.readSheet(config.actualTitle);
    const mergedHeaders = Array.from(new Set([...config.headers, ...headers]));

    if (mergedHeaders.length !== headers.length) {
      await this.writeSheet(config.actualTitle, mergedHeaders, rows);
      return rows.map((row) => this.normalizeRow(row, mergedHeaders));
    }

    return rows.map((row) => this.normalizeRow(row, mergedHeaders));
  }

  private async writeMappedRows(
    config: SheetConfig<unknown>,
    rows: RowObject[],
  ) {
    await this.writeSheet(config.actualTitle, config.headers, rows);
  }

  private async ensureSheetExists(title: string) {
    const client = await this.getClient();
    const metadata = await this.executeSheetsCall(() =>
      client.spreadsheets.get({
        spreadsheetId: this.spreadsheetId,
        fields: 'sheets.properties.title',
      }),
    );

    const exists = metadata.data.sheets?.some(
      (sheet) => sheet.properties?.title === title,
    );

    if (exists) {
      return;
    }

    await this.executeSheetsCall(() =>
      client.spreadsheets.batchUpdate({
        spreadsheetId: this.spreadsheetId,
        requestBody: {
          requests: [
            {
              addSheet: {
                properties: {
                  title,
                },
              },
            },
          ],
        },
      }),
    );
  }

  private async readSheet(
    title: string,
  ): Promise<{ headers: string[]; rows: RowObject[] }> {
    const client = await this.getClient();
    const response = await this.executeSheetsCall(() =>
      client.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: `'${title}'!A:ZZ`,
        valueRenderOption: 'UNFORMATTED_VALUE',
        dateTimeRenderOption: 'SERIAL_NUMBER',
      }),
    );

    const values = (response.data.values ?? []) as Array<
      Array<string | number | boolean>
    >;
    if (values.length === 0) {
      return { headers: [], rows: [] };
    }

    const [headerRow, ...dataRows] = values;
    const headers = headerRow.map((cell) => `${cell}`);
    const rows = dataRows.map((dataRow) =>
      this.rowFromValues(headers, dataRow),
    );
    return { headers, rows };
  }

  private async writeSheet(
    title: string,
    headers: string[],
    rows: RowObject[],
  ) {
    const client = await this.getClient();
    const normalizedRows = rows.map((row) => this.normalizeRow(row, headers));
    const values = [
      headers,
      ...normalizedRows.map((row) =>
        headers.map((header) => row[header] ?? ''),
      ),
    ];

    await this.executeSheetsCall(() =>
      client.spreadsheets.values.update({
        spreadsheetId: this.spreadsheetId,
        range: `'${title}'!A1`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values,
        },
      }),
    );
  }

  private rowFromValues(
    headers: string[],
    values: Array<string | number | boolean>,
  ): RowObject {
    return headers.reduce<RowObject>((accumulator, header, index) => {
      const value = values[index];
      accumulator[header] =
        value === undefined || value === null ? '' : `${value}`;
      return accumulator;
    }, {});
  }

  private normalizeRow(row: RowObject, headers: string[]): RowObject {
    return headers.reduce<RowObject>((accumulator, header) => {
      accumulator[header] = row[header] ?? '';
      return accumulator;
    }, {});
  }

  private normalizeCanonicalRow(row: Record<string, unknown>): RowObject {
    return Object.entries(row).reduce<RowObject>(
      (accumulator, [key, value]) => {
        accumulator[key] = this.serializeCell(value);
        return accumulator;
      },
      {},
    );
  }

  private readSampleSheet(title: string): RowObject[] {
    if (!existsSync(this.sampleWorkbookPath)) {
      return [];
    }

    const workbook = readFile(this.sampleWorkbookPath);
    const sheet = workbook.Sheets[title];
    if (!sheet) {
      return [];
    }

    return utils.sheet_to_json<RowObject>(sheet, {
      defval: '',
      raw: false,
    });
  }

  private getConfig(sheetName: string): SheetConfig<unknown> {
    const config = this.configs[sheetName];
    if (!config) {
      throw new Error(`Sheet config not found for ${sheetName}`);
    }
    return config;
  }

  private findLogicalName(actualTitle: string): string {
    const entry = Object.entries(this.configs).find(
      ([, config]) => config.actualTitle === actualTitle,
    );
    return entry?.[0] ?? actualTitle;
  }

  private getClient() {
    if (this.client) {
      return Promise.resolve(this.client);
    }

    const privateKey = (process.env.GOOGLE_PRIVATE_KEY ?? '').replace(
      /\\n/g,
      '\n',
    );
    const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ?? '';

    const auth = new google.auth.JWT({
      email: clientEmail,
      key: privateKey,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    this.client = google.sheets({
      version: 'v4',
      auth,
    });

    return Promise.resolve(this.client);
  }

  private async executeSheetsCall<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      const apiError = error as {
        message?: string;
        response?: { data?: { error?: { status?: string; message?: string } } };
      };

      const status = apiError.response?.data?.error?.status;
      const message =
        apiError.response?.data?.error?.message ??
        apiError.message ??
        'Google Sheets error';

      if (status === 'PERMISSION_DENIED' && message.includes('disabled')) {
        throw new AppException(
          'Google Sheets API chưa được bật cho project service account',
          503,
          ErrorCode.RESOURCE_NOT_FOUND,
        );
      }

      if (status === 'PERMISSION_DENIED') {
        throw new AppException(
          'Service account chưa có quyền truy cập Google Sheet',
          503,
          ErrorCode.RESOURCE_NOT_FOUND,
        );
      }

      throw new AppException(
        `Google Sheets error: ${message}`,
        503,
        ErrorCode.RESOURCE_NOT_FOUND,
      );
    }
  }

  private mapSystemRole(role: string, email: string): SystemRole {
    const normalized = role.trim().toUpperCase();
    if (normalized === 'STUDENT') {
      return SystemRole.STUDENT;
    }
    if (normalized === 'LECTURER') {
      return SystemRole.LECTURER;
    }
    if (normalized === 'HEAD_OF_DEPARTMENT') {
      return SystemRole.HEAD_OF_DEPARTMENT;
    }
    if (normalized === 'ADMIN') {
      return SystemRole.ADMIN;
    }
    if (normalized.includes('LECTURER') || normalized.includes('GIANG')) {
      return SystemRole.LECTURER;
    }
    if (normalized.includes('STUDENT') || email.includes('@student.')) {
      return SystemRole.STUDENT;
    }
    if (normalized.includes('HEAD') || normalized.includes('TBM')) {
      return SystemRole.HEAD_OF_DEPARTMENT;
    }
    return SystemRole.LECTURER;
  }

  private mapExternalRole(role: SystemRole): string {
    switch (role) {
      case SystemRole.STUDENT:
        return 'Student';
      case SystemRole.HEAD_OF_DEPARTMENT:
        return 'HeadOfDepartment';
      case SystemRole.ADMIN:
        return 'Admin';
      default:
        return 'Lecturer';
    }
  }

  private mapRegistrationType(type: string): RegistrationType {
    return type === 'KLTN' ? RegistrationType.KLTN : RegistrationType.BCTT;
  }

  private mapRegistrationStatus(status: string): RegistrationStatus {
    if (
      Object.values(RegistrationStatus).includes(status as RegistrationStatus)
    ) {
      return status as RegistrationStatus;
    }
    return RegistrationStatus.NEW;
  }

  private mapLecturerBusinessRole(role: string): LecturerBusinessRole {
    if (
      Object.values(LecturerBusinessRole).includes(role as LecturerBusinessRole)
    ) {
      return role as LecturerBusinessRole;
    }

    const normalized = role.trim().toUpperCase();
    if (normalized === 'GVHD') {
      return LecturerBusinessRole.SUPERVISOR;
    }
    if (normalized === 'GVPB') {
      return LecturerBusinessRole.REVIEWER;
    }
    if (normalized === 'CTHD') {
      return LecturerBusinessRole.COMMITTEE_CHAIR;
    }
    if (normalized === 'TKHD') {
      return LecturerBusinessRole.COMMITTEE_SECRETARY;
    }
    return LecturerBusinessRole.COMMITTEE_MEMBER;
  }

  private mapYesNoToBoolean(value: string): boolean {
    return ['yes', 'true', '1'].includes(value.trim().toLowerCase());
  }

  private mapBooleanToYesNo(value: boolean | string): string {
    return value === true || value === 'true' ? 'Yes' : 'No';
  }

  private serializeCell(value: unknown): string {
    if (value === undefined || value === null) {
      return '';
    }

    if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      return `${value}`;
    }

    return JSON.stringify(value);
  }

  private getFallbackRowId(
    prefix: string,
    row: RowObject,
    keys: string[],
  ): string {
    const token = keys
      .map((key) => this.toIdToken(row[key]))
      .filter(Boolean)
      .join('_');

    return token ? `${prefix}_${token}` : createId(prefix);
  }

  private toIdToken(value: string | undefined): string {
    return (value ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D')
      .replace(/[^a-zA-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .toLowerCase();
  }

  private buildDefaultRegistrationWorkflowStatuses(): RegistrationWorkflowStatusRow[] {
    return [
      {
        id: 'wf_bctt_pending',
        loai: RegistrationType.BCTT,
        status: RegistrationStatus.BCTT_PENDING_APPROVAL,
        label: 'Chờ giảng viên hướng dẫn duyệt',
        description:
          'Sinh viên đã gửi đăng ký BCTT và đang chờ giảng viên hướng dẫn duyệt.',
        step: 1,
        stepLabel: 'Đăng ký',
        actor: 'STUDENT',
        color: 'warning',
        nextStatuses: RegistrationStatus.BCTT_APPROVED,
        canStudentUpdate: false,
        canLecturerUpdate: true,
        canManagerUpdate: true,
        isTerminal: false,
        sortOrder: 1,
      },
      {
        id: 'wf_bctt_approved',
        loai: RegistrationType.BCTT,
        status: RegistrationStatus.BCTT_APPROVED,
        label: 'BCTT đã được duyệt',
        description: 'Giảng viên hướng dẫn đã duyệt đề tài BCTT.',
        step: 2,
        stepLabel: 'Thực hiện',
        actor: 'LECTURER',
        color: 'info',
        nextStatuses: `${RegistrationStatus.BCTT_IN_PROGRESS},${RegistrationStatus.BCTT_SUBMITTED}`,
        canStudentUpdate: true,
        canLecturerUpdate: true,
        canManagerUpdate: true,
        isTerminal: false,
        sortOrder: 2,
      },
      {
        id: 'wf_bctt_in_progress',
        loai: RegistrationType.BCTT,
        status: RegistrationStatus.BCTT_IN_PROGRESS,
        label: 'Đang thực hiện BCTT',
        description: 'Sinh viên đang thực hiện BCTT và chuẩn bị nộp báo cáo.',
        step: 2,
        stepLabel: 'Thực hiện',
        actor: 'STUDENT',
        color: 'primary',
        nextStatuses: RegistrationStatus.BCTT_SUBMITTED,
        canStudentUpdate: true,
        canLecturerUpdate: false,
        canManagerUpdate: true,
        isTerminal: false,
        sortOrder: 3,
      },
      {
        id: 'wf_bctt_submitted',
        loai: RegistrationType.BCTT,
        status: RegistrationStatus.BCTT_SUBMITTED,
        label: 'Đã nộp báo cáo BCTT',
        description: 'Sinh viên đã nộp đủ báo cáo BCTT để giảng viên chấm.',
        step: 3,
        stepLabel: 'Nộp báo cáo',
        actor: 'STUDENT',
        color: 'secondary',
        nextStatuses: `${RegistrationStatus.BCTT_PASSED},${RegistrationStatus.BCTT_FAILED}`,
        canStudentUpdate: false,
        canLecturerUpdate: true,
        canManagerUpdate: true,
        isTerminal: false,
        sortOrder: 4,
      },
      {
        id: 'wf_bctt_passed',
        loai: RegistrationType.BCTT,
        status: RegistrationStatus.BCTT_PASSED,
        label: 'BCTT đạt',
        description: 'Giảng viên đã chấm và sinh viên đạt BCTT.',
        step: 4,
        stepLabel: 'Kết quả',
        actor: 'LECTURER',
        color: 'success',
        nextStatuses: '',
        canStudentUpdate: false,
        canLecturerUpdate: false,
        canManagerUpdate: false,
        isTerminal: true,
        sortOrder: 5,
      },
      {
        id: 'wf_bctt_failed',
        loai: RegistrationType.BCTT,
        status: RegistrationStatus.BCTT_FAILED,
        label: 'BCTT không đạt',
        description: 'Giảng viên đã chấm và sinh viên không đạt BCTT.',
        step: 4,
        stepLabel: 'Kết quả',
        actor: 'LECTURER',
        color: 'danger',
        nextStatuses: '',
        canStudentUpdate: false,
        canLecturerUpdate: false,
        canManagerUpdate: false,
        isTerminal: true,
        sortOrder: 6,
      },
      {
        id: 'wf_kltn_pending',
        loai: RegistrationType.KLTN,
        status: RegistrationStatus.KLTN_PENDING_APPROVAL,
        label: 'Chờ giảng viên hướng dẫn duyệt',
        description:
          'Sinh viên đã gửi đăng ký KLTN và đang chờ giảng viên hướng dẫn duyệt.',
        step: 1,
        stepLabel: 'Đăng ký',
        actor: 'STUDENT',
        color: 'warning',
        nextStatuses: RegistrationStatus.KLTN_APPROVED,
        canStudentUpdate: false,
        canLecturerUpdate: true,
        canManagerUpdate: true,
        isTerminal: false,
        sortOrder: 11,
      },
      {
        id: 'wf_kltn_approved',
        loai: RegistrationType.KLTN,
        status: RegistrationStatus.KLTN_APPROVED,
        label: 'KLTN đã được duyệt',
        description: 'Giảng viên hướng dẫn đã duyệt đăng ký KLTN.',
        step: 2,
        stepLabel: 'Thực hiện',
        actor: 'LECTURER',
        color: 'info',
        nextStatuses: `${RegistrationStatus.KLTN_IN_PROGRESS},${RegistrationStatus.KLTN_SUBMITTED}`,
        canStudentUpdate: true,
        canLecturerUpdate: true,
        canManagerUpdate: true,
        isTerminal: false,
        sortOrder: 12,
      },
      {
        id: 'wf_kltn_in_progress',
        loai: RegistrationType.KLTN,
        status: RegistrationStatus.KLTN_IN_PROGRESS,
        label: 'Đang thực hiện KLTN',
        description: 'Sinh viên đang hoàn thiện khóa luận.',
        step: 2,
        stepLabel: 'Thực hiện',
        actor: 'STUDENT',
        color: 'primary',
        nextStatuses: RegistrationStatus.KLTN_SUBMITTED,
        canStudentUpdate: true,
        canLecturerUpdate: false,
        canManagerUpdate: true,
        isTerminal: false,
        sortOrder: 13,
      },
      {
        id: 'wf_kltn_submitted',
        loai: RegistrationType.KLTN,
        status: RegistrationStatus.KLTN_SUBMITTED,
        label: 'Đã nộp khóa luận',
        description: 'Sinh viên đã nộp khóa luận và đang chờ xử lý tiếp theo.',
        step: 3,
        stepLabel: 'Nộp khóa luận',
        actor: 'STUDENT',
        color: 'secondary',
        nextStatuses: `${RegistrationStatus.WAITING_TURNITIN},${RegistrationStatus.WAITING_SUPERVISOR_SCORE}`,
        canStudentUpdate: false,
        canLecturerUpdate: true,
        canManagerUpdate: true,
        isTerminal: false,
        sortOrder: 14,
      },
      {
        id: 'wf_kltn_turnitin',
        loai: RegistrationType.KLTN,
        status: RegistrationStatus.WAITING_TURNITIN,
        label: 'Chờ kiểm tra Turnitin',
        description: 'Khóa luận đang chờ kiểm tra trùng lặp Turnitin.',
        step: 4,
        stepLabel: 'Kiểm tra',
        actor: 'LECTURER',
        color: 'warning',
        nextStatuses: RegistrationStatus.WAITING_SUPERVISOR_SCORE,
        canStudentUpdate: false,
        canLecturerUpdate: true,
        canManagerUpdate: true,
        isTerminal: false,
        sortOrder: 15,
      },
      {
        id: 'wf_kltn_supervisor_score',
        loai: RegistrationType.KLTN,
        status: RegistrationStatus.WAITING_SUPERVISOR_SCORE,
        label: 'Chờ giảng viên hướng dẫn chấm',
        description: 'Đang chờ giảng viên hướng dẫn nhập điểm.',
        step: 5,
        stepLabel: 'Chấm điểm',
        actor: 'LECTURER',
        color: 'info',
        nextStatuses: RegistrationStatus.WAITING_REVIEWER_SCORE,
        canStudentUpdate: false,
        canLecturerUpdate: true,
        canManagerUpdate: true,
        isTerminal: false,
        sortOrder: 16,
      },
      {
        id: 'wf_kltn_reviewer_score',
        loai: RegistrationType.KLTN,
        status: RegistrationStatus.WAITING_REVIEWER_SCORE,
        label: 'Chờ giảng viên phản biện chấm',
        description: 'Đang chờ giảng viên phản biện nhập điểm.',
        step: 5,
        stepLabel: 'Chấm điểm',
        actor: 'LECTURER',
        color: 'info',
        nextStatuses: RegistrationStatus.WAITING_COMMITTEE_SCORE,
        canStudentUpdate: false,
        canLecturerUpdate: true,
        canManagerUpdate: true,
        isTerminal: false,
        sortOrder: 17,
      },
      {
        id: 'wf_kltn_committee_score',
        loai: RegistrationType.KLTN,
        status: RegistrationStatus.WAITING_COMMITTEE_SCORE,
        label: 'Chờ hội đồng chấm',
        description: 'Đang chờ các thành viên hội đồng nhập điểm.',
        step: 5,
        stepLabel: 'Chấm điểm',
        actor: 'LECTURER',
        color: 'info',
        nextStatuses: `${RegistrationStatus.DEFENSE_SCHEDULED},${RegistrationStatus.DEFENDED}`,
        canStudentUpdate: false,
        canLecturerUpdate: true,
        canManagerUpdate: true,
        isTerminal: false,
        sortOrder: 18,
      },
      {
        id: 'wf_kltn_defense_scheduled',
        loai: RegistrationType.KLTN,
        status: RegistrationStatus.DEFENSE_SCHEDULED,
        label: 'Đã xếp lịch bảo vệ',
        description: 'Khóa luận đã được xếp lịch bảo vệ.',
        step: 6,
        stepLabel: 'Bảo vệ',
        actor: 'HEAD_OF_DEPARTMENT',
        color: 'primary',
        nextStatuses: RegistrationStatus.DEFENDED,
        canStudentUpdate: false,
        canLecturerUpdate: false,
        canManagerUpdate: true,
        isTerminal: false,
        sortOrder: 19,
      },
      {
        id: 'wf_kltn_defended',
        loai: RegistrationType.KLTN,
        status: RegistrationStatus.DEFENDED,
        label: 'Đã bảo vệ',
        description: 'Sinh viên đã hoàn thành buổi bảo vệ.',
        step: 6,
        stepLabel: 'Bảo vệ',
        actor: 'LECTURER',
        color: 'success',
        nextStatuses: `${RegistrationStatus.WAITING_REVISED_UPLOAD},${RegistrationStatus.COMPLETED},${RegistrationStatus.REJECTED_AFTER_DEFENSE}`,
        canStudentUpdate: false,
        canLecturerUpdate: true,
        canManagerUpdate: true,
        isTerminal: false,
        sortOrder: 20,
      },
      {
        id: 'wf_kltn_revised_upload',
        loai: RegistrationType.KLTN,
        status: RegistrationStatus.WAITING_REVISED_UPLOAD,
        label: 'Chờ sinh viên nộp bản chỉnh sửa',
        description:
          'Sinh viên cần nộp lại bản chỉnh sửa và giải trình sau bảo vệ.',
        step: 7,
        stepLabel: 'Chỉnh sửa',
        actor: 'STUDENT',
        color: 'warning',
        nextStatuses: RegistrationStatus.WAITING_SUPERVISOR_REVISION_APPROVAL,
        canStudentUpdate: true,
        canLecturerUpdate: false,
        canManagerUpdate: true,
        isTerminal: false,
        sortOrder: 21,
      },
      {
        id: 'wf_kltn_supervisor_revision',
        loai: RegistrationType.KLTN,
        status: RegistrationStatus.WAITING_SUPERVISOR_REVISION_APPROVAL,
        label: 'Chờ giảng viên hướng dẫn duyệt chỉnh sửa',
        description: 'Giảng viên hướng dẫn đang duyệt bản chỉnh sửa.',
        step: 7,
        stepLabel: 'Chỉnh sửa',
        actor: 'LECTURER',
        color: 'info',
        nextStatuses: RegistrationStatus.WAITING_CHAIR_REVISION_APPROVAL,
        canStudentUpdate: false,
        canLecturerUpdate: true,
        canManagerUpdate: true,
        isTerminal: false,
        sortOrder: 22,
      },
      {
        id: 'wf_kltn_chair_revision',
        loai: RegistrationType.KLTN,
        status: RegistrationStatus.WAITING_CHAIR_REVISION_APPROVAL,
        label: 'Chờ chủ tịch hội đồng duyệt chỉnh sửa',
        description: 'Chủ tịch hội đồng đang kiểm tra bản chỉnh sửa cuối cùng.',
        step: 7,
        stepLabel: 'Chỉnh sửa',
        actor: 'HEAD_OF_DEPARTMENT',
        color: 'info',
        nextStatuses: `${RegistrationStatus.COMPLETED},${RegistrationStatus.REJECTED_AFTER_DEFENSE}`,
        canStudentUpdate: false,
        canLecturerUpdate: true,
        canManagerUpdate: true,
        isTerminal: false,
        sortOrder: 23,
      },
      {
        id: 'wf_kltn_completed',
        loai: RegistrationType.KLTN,
        status: RegistrationStatus.COMPLETED,
        label: 'Hoàn thành',
        description: 'Khóa luận đã hoàn tất toàn bộ quy trình.',
        step: 8,
        stepLabel: 'Hoàn tất',
        actor: 'HEAD_OF_DEPARTMENT',
        color: 'success',
        nextStatuses: '',
        canStudentUpdate: false,
        canLecturerUpdate: false,
        canManagerUpdate: false,
        isTerminal: true,
        sortOrder: 24,
      },
      {
        id: 'wf_kltn_rejected_after_defense',
        loai: RegistrationType.KLTN,
        status: RegistrationStatus.REJECTED_AFTER_DEFENSE,
        label: 'Không đạt sau bảo vệ',
        description: 'Khóa luận không đạt sau quá trình bảo vệ và chỉnh sửa.',
        step: 8,
        stepLabel: 'Hoàn tất',
        actor: 'HEAD_OF_DEPARTMENT',
        color: 'danger',
        nextStatuses: '',
        canStudentUpdate: false,
        canLecturerUpdate: false,
        canManagerUpdate: false,
        isTerminal: true,
        sortOrder: 25,
      },
    ];
  }

  private toIsoDate(value: string): string {
    if (!value) {
      return '';
    }

    if (!Number.isNaN(Number(value))) {
      const serial = Number(value);
      const utcDays = Math.floor(serial - 25569);
      const utcValue = utcDays * 86400;
      const dateInfo = new Date(utcValue * 1000);
      const fractionalDay = serial - Math.floor(serial) + 0.0000001;
      let totalSeconds = Math.floor(86400 * fractionalDay);

      const seconds = totalSeconds % 60;
      totalSeconds -= seconds;
      const hours = Math.floor(totalSeconds / (60 * 60));
      const minutes = Math.floor(totalSeconds / 60) % 60;

      dateInfo.setUTCHours(hours);
      dateInfo.setUTCMinutes(minutes);
      dateInfo.setUTCSeconds(seconds);
      return dateInfo.toISOString();
    }

    if (!/\b\d{4}\b/.test(value)) {
      const parsedWithDefaultYear = new Date(`${value} ${DEFAULT_SHEET_YEAR}`);
      return Number.isNaN(parsedWithDefaultYear.getTime())
        ? ''
        : parsedWithDefaultYear.toISOString();
    }

    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString();
  }

  private inferStudentDocumentType(
    value: string,
  ): StudentDocumentRow['documentType'] {
    const normalized = value.toLowerCase();
    if (normalized.includes('xác nhận') || normalized.includes('xác nhận')) {
      return StudentDocumentType.INTERNSHIP_CONFIRMATION;
    }
    if (normalized.includes('revised') || normalized.includes('chỉnh sửa')) {
      return StudentDocumentType.REVISED_THESIS;
    }
    if (
      normalized.includes('giải trình') ||
      normalized.includes('giai trinh')
    ) {
      return StudentDocumentType.REVISION_EXPLANATION;
    }
    if (normalized.includes('kltn')) {
      return StudentDocumentType.KLTN_REPORT;
    }
    return StudentDocumentType.BCTT_REPORT;
  }

  private inferLecturerDocumentType(
    role: string,
    link: string,
  ): LecturerDocumentRow['documentType'] {
    const normalizedRole = role.trim().toUpperCase();
    const normalizedLink = link.toLowerCase();

    if (normalizedLink.includes('turnitin')) {
      return LecturerDocumentType.TURNITIN;
    }
    if (
      normalizedLink.includes('biên bản') ||
      normalizedLink.includes('bien ban')
    ) {
      return LecturerDocumentType.COMMITTEE_MINUTES;
    }
    if (normalizedRole === 'GVPB') {
      return LecturerDocumentType.REVIEW_ATTACHMENT;
    }
    return LecturerDocumentType.SUPERVISOR_ATTACHMENT;
  }
}
