import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import PDFDocument = require('pdfkit');
import { SHEET_REPOSITORY } from '../common/constants/injection-tokens';
import { SheetName } from '../common/constants/sheet-definitions';
import { ErrorCode } from '../common/enums/error-code.enum';
import { getLecturerBusinessRoleLabel } from '../common/enums/lecturer-business-role.enum';
import { SystemRole } from '../common/enums/system-role.enum';
import { AppException } from '../common/exceptions/app.exception';
import {
  CommitteeRow,
  MinuteRow,
  RegistrationRow,
  ScoreRow,
  UserRow,
} from '../common/types/domain.types';
import { toIsoNow } from '../common/utils/date.util';
import { createId } from '../common/utils/id.util';
import { calculateAverage } from '../common/utils/score.util';
import { CloudinaryService } from '../documents/cloudinary.service';
import { UpdateMinuteDto } from './dto/update-minute.dto';
import type { AuthenticatedUser } from '../common/types/authenticated-user.type';
import type { SheetRepository } from '../common/types/sheet-repository.interface';

@Injectable()
export class MinutesService {
  private readonly pdfFontPath = this.resolvePdfFontPath();
  private readonly sectionTitleColor = '#163B69';
  private readonly borderColor = '#D1D5DB';
  private readonly textColor = '#1F2937';

  constructor(
    @Inject(SHEET_REPOSITORY)
    private readonly repository: SheetRepository,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  async getByRegistration(registrationId: string, user: AuthenticatedUser) {
    await this.assertCanAccess(registrationId, user);

    const minute = await this.repository.findOne<MinuteRow>(
      SheetName.MINUTES,
      (row) => row.registrationId === registrationId,
    );

    return {
      data: minute,
    };
  }

  async generate(registrationId: string, user: AuthenticatedUser) {
    await this.assertCanManageMinute(registrationId, user);

    const [registration, users, scores] = await Promise.all([
      this.repository.findOne<RegistrationRow>(
        SheetName.REGISTRATIONS,
        (row) => row.id === registrationId,
      ),
      this.repository.getAllRows<UserRow>(SheetName.USERS),
      this.repository.getAllRows<ScoreRow>(SheetName.SCORES),
    ]);

    if (!registration) {
      throw new AppException(
        'Registration không tồn tại',
        HttpStatus.NOT_FOUND,
        ErrorCode.REGISTRATION_NOT_FOUND,
      );
    }

    const student = users.find((row) => row.email === registration.emailSV);
    const reviewerScore = scores.find(
      (score) =>
        score.registrationId === registrationId &&
        score.emailGV === registration.emailGVPB,
    );
    const allScores = scores.filter(
      (score) => score.registrationId === registrationId,
    );

    const finalScore = calculateAverage(
      allScores.map((score) => score.totalScore),
    );
    const content = this.buildMinuteContent({
      registration,
      studentMs: student?.ms ?? '',
      reviewerComment: reviewerScore?.comments || 'Chưa có nhận xét.',
      finalScore,
      scores: allScores,
    });
    const pdfBuffer = await this.generateMinutePdfBuffer({
      registration,
      studentMs: student?.ms ?? '',
      reviewerComment: reviewerScore?.comments || 'Chưa có nhận xét.',
      finalScore,
      scores: allScores,
    });
    const uploadResult = await this.cloudinaryService.uploadBuffer(
      pdfBuffer,
      `minute-${registrationId}.pdf`,
      'application/pdf',
      `klcn/minutes/${registrationId}`,
    );

    const existing = await this.repository.findOne<MinuteRow>(
      SheetName.MINUTES,
      (row) => row.registrationId === registrationId,
    );

    if (existing) {
      return {
        data: await this.repository.updateRow<MinuteRow>(
          SheetName.MINUTES,
          existing.id,
          {
            content,
            generatedBy: user.email,
            fileUrl: uploadResult.secure_url,
            updatedAt: toIsoNow(),
          },
        ),
      };
    }

    const minute: MinuteRow = {
      id: createId('minute'),
      registrationId,
      generatedBy: user.email,
      content,
      fileUrl: uploadResult.secure_url,
      createdAt: toIsoNow(),
      updatedAt: toIsoNow(),
    };

    await this.repository.insertRow<MinuteRow>(SheetName.MINUTES, minute);
    return { data: minute };
  }

  async update(
    registrationId: string,
    user: AuthenticatedUser,
    payload: UpdateMinuteDto,
  ) {
    await this.assertCanManageMinute(registrationId, user);

    const existing = await this.repository.findOne<MinuteRow>(
      SheetName.MINUTES,
      (row) => row.registrationId === registrationId,
    );

    if (!existing) {
      throw new AppException(
        'Biên bản chưa được tạo',
        HttpStatus.NOT_FOUND,
        ErrorCode.RESOURCE_NOT_FOUND,
      );
    }

    return {
      data: await this.repository.updateRow<MinuteRow>(
        SheetName.MINUTES,
        existing.id,
        {
          content: payload.content,
          fileUrl: payload.fileUrl ?? existing.fileUrl,
          updatedAt: toIsoNow(),
        },
      ),
    };
  }

  private buildMinuteContent(payload: {
    registration: RegistrationRow;
    studentMs: string;
    reviewerComment: string;
    finalScore: number;
    scores: ScoreRow[];
  }) {
    const scoreLines = payload.scores.length
      ? payload.scores.map(
          (score, index) =>
            `${index + 1}. ${getLecturerBusinessRoleLabel(score.vaiTroCham)}: ${score.totalScore} điểm`,
        )
      : ['Chưa có điểm thành phần.'];

    return [
      'BIÊN BẢN HỘI ĐỒNG BẢO VỆ KHÓA LUẬN TỐT NGHIỆP',
      '',
      `Họ và tên sinh viên: ${payload.registration.tenSV}`,
      `Mã số sinh viên: ${payload.studentMs || '-'}`,
      `Tên đề tài: ${payload.registration.tenDeTai}`,
      `Giảng viên hướng dẫn: ${payload.registration.emailGVHD}`,
      `Giảng viên phản biện: ${payload.registration.emailGVPB || 'Chưa phân công'}`,
      '',
      'Điểm thành phần:',
      ...scoreLines,
      '',
      `Điểm tổng hợp hiện tại: ${payload.finalScore}`,
      '',
      'Nhận xét của giảng viên phản biện:',
      payload.reviewerComment,
    ].join('\n');
  }

  private async assertCanAccess(
    registrationId: string,
    user: AuthenticatedUser,
  ) {
    if ([SystemRole.ADMIN, SystemRole.HEAD_OF_DEPARTMENT].includes(user.role)) {
      return;
    }

    const registration = await this.repository.findOne<RegistrationRow>(
      SheetName.REGISTRATIONS,
      (row) => row.id === registrationId,
    );

    if (!registration) {
      throw new AppException(
        'Registration không tồn tại',
        HttpStatus.NOT_FOUND,
        ErrorCode.REGISTRATION_NOT_FOUND,
      );
    }

    if (
      (user.role === SystemRole.STUDENT &&
        registration.emailSV === user.email) ||
      registration.emailGVHD === user.email ||
      registration.emailGVPB === user.email
    ) {
      return;
    }

    const committee = registration.committeeId
      ? await this.repository.findOne<CommitteeRow>(
          SheetName.COMMITTEES,
          (row) => row.id === registration.committeeId,
        )
      : null;

    if (
      committee &&
      [
        committee.chairEmail,
        committee.secretaryEmail,
        committee.member1Email,
        committee.member2Email,
      ].includes(user.email)
    ) {
      return;
    }

    throw new AppException(
      'Bạn không có quyền xem biên bản',
      HttpStatus.FORBIDDEN,
      ErrorCode.FORBIDDEN_ROLE,
    );
  }

  private async assertCanManageMinute(
    registrationId: string,
    user: AuthenticatedUser,
  ) {
    if ([SystemRole.ADMIN, SystemRole.HEAD_OF_DEPARTMENT].includes(user.role)) {
      return;
    }

    const registration = await this.repository.findOne<RegistrationRow>(
      SheetName.REGISTRATIONS,
      (row) => row.id === registrationId,
    );

    if (!registration) {
      throw new AppException(
        'Registration không tồn tại',
        HttpStatus.NOT_FOUND,
        ErrorCode.REGISTRATION_NOT_FOUND,
      );
    }

    const committee = registration.committeeId
      ? await this.repository.findOne<CommitteeRow>(
          SheetName.COMMITTEES,
          (row) => row.id === registration.committeeId,
        )
      : null;

    if (!committee || committee.secretaryEmail !== user.email) {
      throw new AppException(
        'Chỉ thư ký hội đồng mới được thao tác biên bản',
        HttpStatus.FORBIDDEN,
        ErrorCode.FORBIDDEN_ROLE,
      );
    }
  }

  private async generateMinutePdfBuffer(payload: {
    registration: RegistrationRow;
    studentMs: string;
    reviewerComment: string;
    finalScore: number;
    scores: ScoreRow[];
  }) {
    return new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      const doc = new PDFDocument({
        size: 'A4',
        margin: 48,
        info: {
          Title: `Biên bản hội đồng - ${payload.registration.id}`,
        },
      });

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      if (this.pdfFontPath) {
        doc.font(this.pdfFontPath);
      }

      this.drawHeader(doc, payload.registration.id);
      this.drawStudentInfo(doc, payload);
      this.drawScoreSection(doc, payload.scores, payload.finalScore);
      this.drawCommentSection(doc, payload.reviewerComment);
      this.drawSignatureSection(doc);

      doc.end();
    });
  }

  private drawHeader(doc: PDFKit.PDFDocument, registrationId: string) {
    const pageWidth =
      doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const boxTop = doc.y;

    doc
      .roundedRect(doc.page.margins.left, boxTop, pageWidth, 78, 10)
      .fillAndStroke('#E8F1FF', '#2F5D9F');

    doc.fillColor(this.sectionTitleColor).fontSize(17).text(
      'BIÊN BẢN HỘI ĐỒNG BẢO VỆ KHÓA LUẬN TỐT NGHIỆP',
      doc.page.margins.left + 18,
      boxTop + 16,
      {
        width: pageWidth - 36,
        align: 'center',
      },
    );

    doc.fillColor('#355C8A').fontSize(10).text(
      `Mã đăng ký: ${registrationId}`,
      doc.page.margins.left + 18,
      boxTop + 50,
      {
        width: pageWidth - 36,
        align: 'center',
      },
    );

    doc.moveDown(4.6);
    doc.fillColor(this.textColor);
  }

  private drawStudentInfo(
    doc: PDFKit.PDFDocument,
    payload: {
      registration: RegistrationRow;
      studentMs: string;
      reviewerComment: string;
      finalScore: number;
      scores: ScoreRow[];
    },
  ) {
    this.writeSectionTitle(doc, 'Thông tin sinh viên và đề tài');

    this.writeInfoRow(doc, 'Họ và tên sinh viên', payload.registration.tenSV);
    this.writeInfoRow(doc, 'Mã số sinh viên', payload.studentMs || '-');
    this.writeInfoRow(doc, 'Tên đề tài', payload.registration.tenDeTai);
    this.writeInfoRow(
      doc,
      'Giảng viên hướng dẫn',
      payload.registration.emailGVHD,
    );
    this.writeInfoRow(
      doc,
      'Giảng viên phản biện',
      payload.registration.emailGVPB || 'Chưa phân công',
    );
    doc.moveDown(0.5);
  }

  private drawScoreSection(
    doc: PDFKit.PDFDocument,
    scores: ScoreRow[],
    finalScore: number,
  ) {
    this.writeSectionTitle(doc, 'Kết quả chấm điểm');

    if (scores.length === 0) {
      doc.fontSize(11).fillColor('#4B5563').text('Chưa có điểm thành phần.');
      doc.moveDown(0.8);
      return;
    }

    scores.forEach((score, index) => {
      doc
        .fontSize(11)
        .fillColor(this.textColor)
        .text(
          `${index + 1}. ${getLecturerBusinessRoleLabel(score.vaiTroCham)}: ${score.totalScore} điểm`,
          {
            indent: 10,
            lineGap: 2,
          },
        );
    });

    doc.moveDown(0.6);
    const summaryTop = doc.y;
    doc
      .roundedRect(doc.page.margins.left, summaryTop, 230, 30, 8)
      .fillAndStroke('#F3F7FF', '#9BB7E0');
    doc.fillColor(this.sectionTitleColor).fontSize(12).text(
      `Điểm tổng hợp hiện tại: ${finalScore}`,
      doc.page.margins.left + 14,
      summaryTop + 8,
    );
    doc.y = summaryTop + 38;
  }

  private drawCommentSection(doc: PDFKit.PDFDocument, reviewerComment: string) {
    this.writeSectionTitle(doc, 'Nhận xét của giảng viên phản biện');

    const noteTop = doc.y;
    const noteHeight = 100;
    const pageWidth =
      doc.page.width - doc.page.margins.left - doc.page.margins.right;

    doc
      .roundedRect(doc.page.margins.left, noteTop, pageWidth, noteHeight, 8)
      .fillAndStroke('#FCFCFD', this.borderColor);

    doc.fillColor('#111827').fontSize(11).text(
      reviewerComment || 'Chưa có nhận xét.',
      doc.page.margins.left + 14,
      noteTop + 14,
      {
        width: pageWidth - 28,
        align: 'justify',
        lineGap: 3,
      },
    );

    doc.y = noteTop + noteHeight + 18;
  }

  private drawSignatureSection(doc: PDFKit.PDFDocument) {
    doc.moveDown(1.2);
    doc.fontSize(11).fillColor(this.textColor).text('Thư ký hội đồng', {
      align: 'right',
    });
    doc.moveDown(3);
    doc.fontSize(10).fillColor('#6B7280').text('(Ký và ghi rõ họ tên)', {
      align: 'right',
    });
  }

  private writeSectionTitle(doc: PDFKit.PDFDocument, title: string) {
    doc.moveDown(0.4);
    doc.fontSize(12).fillColor(this.sectionTitleColor).text(title, {
      underline: true,
    });
    doc.moveDown(0.5);
  }

  private writeInfoRow(doc: PDFKit.PDFDocument, label: string, value: string) {
    doc.fontSize(11).fillColor(this.textColor).text(`${label}: ${value || '-'}`, {
      align: 'left',
      lineGap: 2,
    });
  }

  private resolvePdfFontPath() {
    const candidates = [
      'C:\\Windows\\Fonts\\arial.ttf',
      'C:\\Windows\\Fonts\\tahoma.ttf',
      'C:\\Windows\\Fonts\\times.ttf',
      join(process.cwd(), 'fonts', 'arial.ttf'),
    ];

    return candidates.find((path) => existsSync(path));
  }
}
