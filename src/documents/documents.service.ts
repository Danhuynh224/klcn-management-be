import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { SHEET_REPOSITORY } from '../common/constants/injection-tokens';
import { SheetName } from '../common/constants/sheet-definitions';
import {
  LecturerDocumentType,
  StudentDocumentType,
} from '../common/enums/document-type.enum';
import { ErrorCode } from '../common/enums/error-code.enum';
import { RegistrationStatus } from '../common/enums/registration-status.enum';
import { RegistrationType } from '../common/enums/registration-type.enum';
import { SystemRole } from '../common/enums/system-role.enum';
import { AppException } from '../common/exceptions/app.exception';
import {
  CommitteeRow,
  LecturerDocumentRow,
  RegistrationRow,
  StudentDocumentRow,
  TermRow,
} from '../common/types/domain.types';
import { isNowWithin, toIsoNow } from '../common/utils/date.util';
import { createId } from '../common/utils/id.util';
import { NotificationsService } from '../notifications/notifications.service';
import { RegistrationStatusHistoryService } from '../registrations/registration-status-history.service';
import { CloudinaryService } from './cloudinary.service';
import { UploadDocumentDto } from './dto/upload-document.dto';
import type { AuthenticatedUser } from '../common/types/authenticated-user.type';
import type { SheetRepository } from '../common/types/sheet-repository.interface';

@Injectable()
export class DocumentsService {
  constructor(
    @Inject(SHEET_REPOSITORY)
    private readonly repository: SheetRepository,
    private readonly notificationsService: NotificationsService,
    private readonly registrationStatusHistoryService: RegistrationStatusHistoryService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  async upload(
    user: AuthenticatedUser,
    payload: UploadDocumentDto,
    file: Express.Multer.File,
  ) {
    if (!file) {
      throw new AppException(
        'Thiếu file upload',
        HttpStatus.BAD_REQUEST,
        ErrorCode.DOCUMENT_NOT_ALLOWED,
      );
    }

    file.originalname = this.normalizeUploadedFileName(file.originalname);

    this.validateFile(
      file,
      payload.documentType as StudentDocumentType | LecturerDocumentType,
    );
    const registration = await this.getRegistrationOrThrow(
      payload.registrationId,
    );

    if (user.role === SystemRole.STUDENT) {
      const document = await this.uploadStudentDocument(
        user,
        registration,
        {
          ...payload,
          documentType: payload.documentType as StudentDocumentType,
        },
        file,
      );
      return { data: document };
    }

    if (user.role === SystemRole.LECTURER) {
      const document = await this.uploadLecturerDocument(
        user,
        registration,
        {
          ...payload,
          documentType: payload.documentType as LecturerDocumentType,
        },
        file,
      );
      return { data: document };
    }

    throw new AppException(
      'Vai trò hiện tại không được upload tài liệu',
      HttpStatus.FORBIDDEN,
      ErrorCode.FORBIDDEN_ROLE,
    );
  }

  async getByRegistration(registrationId: string, user: AuthenticatedUser) {
    const registration = await this.getRegistrationOrThrow(registrationId);
    await this.assertCanAccess(user, registration);

    const [studentDocuments, lecturerDocuments] = await Promise.all([
      this.repository.getAllRows<StudentDocumentRow>(
        SheetName.STUDENT_DOCUMENTS,
      ),
      this.repository.getAllRows<LecturerDocumentRow>(
        SheetName.LECTURER_DOCUMENTS,
      ),
    ]);

    return {
      data: {
        studentDocuments: studentDocuments.filter(
          (document) => document.registrationId === registrationId,
        ),
        lecturerDocuments: lecturerDocuments.filter(
          (document) => document.registrationId === registrationId,
        ),
      },
    };
  }

  private validateFile(
    file: Express.Multer.File,
    documentType: StudentDocumentType | LecturerDocumentType,
  ) {
    const ext = file.originalname.split('.').pop()?.toLowerCase();
    const isPdfRequired = ![
      LecturerDocumentType.REVIEW_ATTACHMENT,
      LecturerDocumentType.SUPERVISOR_ATTACHMENT,
    ].includes(documentType as LecturerDocumentType);

    if (isPdfRequired && ext !== 'pdf') {
      throw new AppException(
        'Tài liệu chính phải là file PDF',
        HttpStatus.BAD_REQUEST,
        ErrorCode.DOCUMENT_NOT_ALLOWED,
      );
    }
  }

  private normalizeUploadedFileName(fileName: string): string {
    if (!fileName) {
      return 'unnamed-file';
    }

    try {
      const decoded = Buffer.from(fileName, 'latin1').toString('utf8');
      if (decoded.includes('\uFFFD')) {
        return fileName.normalize('NFC');
      }
      return decoded.normalize('NFC');
    } catch {
      return fileName.normalize('NFC');
    }
  }

  private async uploadStudentDocument(
    user: AuthenticatedUser,
    registration: RegistrationRow,
    payload: UploadDocumentDto & { documentType: StudentDocumentType },
    file: Express.Multer.File,
  ) {
    if (registration.emailSV !== user.email) {
      throw new AppException(
        'Bạn không thể upload cho registration này',
        HttpStatus.FORBIDDEN,
        ErrorCode.FORBIDDEN_ROLE,
      );
    }

    await this.ensureStudentDocumentAllowed(registration, payload.documentType);
    const uploadResult = await this.cloudinaryService.uploadFile(
      file,
      `klcn/student/${registration.id}`,
    );

    const document: StudentDocumentRow = {
      id: createId('sdoc'),
      registrationId: registration.id,
      emailSV: user.email,
      documentType: payload.documentType as StudentDocumentRow['documentType'],
      fileName: file.originalname,
      fileUrl: uploadResult.secure_url,
      uploadedAt: toIsoNow(),
    };

    await this.repository.insertRow<StudentDocumentRow>(
      SheetName.STUDENT_DOCUMENTS,
      document,
    );

    const nextStatus = this.resolveStatusAfterStudentUpload(
      registration.status,
      payload.documentType,
    );

    if (nextStatus) {
      await this.repository.updateRow<RegistrationRow>(
        SheetName.REGISTRATIONS,
        registration.id,
        {
          status: nextStatus,
          updatedAt: toIsoNow(),
        },
      );
      await this.registrationStatusHistoryService.append(
        registration.id,
        nextStatus,
        user.email,
        user.role,
        `Đăng tải tài liệu: ${payload.documentType == StudentDocumentType.BCTT_REPORT ? 'Báo cáo thực tập' : payload.documentType == StudentDocumentType.INTERNSHIP_CONFIRMATION ? 'Xác nhận thực tập' : payload.documentType == StudentDocumentType.KLTN_REPORT ? 'Báo cáo khóa luận' : 'Tài liệu khác'}`,
      );
    }

    await this.notificationsService.createNotification(
      registration.emailGVHD,
      'Sinh viên vừa nộp tài liệu',
      `${user.ten} vừa upload ${payload.documentType}`,
      'DOCUMENT_UPLOADED',
      registration.id,
    );

    return document;
  }

  private async uploadLecturerDocument(
    user: AuthenticatedUser,
    registration: RegistrationRow,
    payload: UploadDocumentDto & { documentType: LecturerDocumentType },
    file: Express.Multer.File,
  ) {
    await this.ensureLecturerDocumentAllowed(
      user,
      registration,
      payload.documentType,
    );
    const uploadResult = await this.cloudinaryService.uploadFile(
      file,
      `klcn/lecturer/${registration.id}`,
    );

    const document: LecturerDocumentRow = {
      id: createId('ldoc'),
      registrationId: registration.id,
      emailGV: user.email,
      documentType: payload.documentType as LecturerDocumentRow['documentType'],
      fileName: file.originalname,
      fileUrl: uploadResult.secure_url,
      uploadedAt: toIsoNow(),
    };

    await this.repository.insertRow<LecturerDocumentRow>(
      SheetName.LECTURER_DOCUMENTS,
      document,
    );

    if (payload.documentType === LecturerDocumentType.TURNITIN) {
      const nextStatus = registration.emailGVPB
        ? RegistrationStatus.WAITING_REVIEWER_SCORE
        : RegistrationStatus.WAITING_SUPERVISOR_SCORE;

      await this.repository.updateRow<RegistrationRow>(
        SheetName.REGISTRATIONS,
        registration.id,
        {
          status: nextStatus,
          updatedAt: toIsoNow(),
        },
      );
      await this.registrationStatusHistoryService.append(
        registration.id,
        nextStatus,
        user.email,
        user.role,
        `Đăng tải tài liệu: ${payload.documentType == LecturerDocumentType.TURNITIN ? 'Báo cáo Turnitin' : payload.documentType == LecturerDocumentType.COMMITTEE_MINUTES ? 'Biên bản hội đồng' : payload.documentType == LecturerDocumentType.REVIEW_ATTACHMENT ? 'Tài liệu đánh giá' : payload.documentType == LecturerDocumentType.SUPERVISOR_ATTACHMENT ? 'Tài liệu hướng dẫn' : 'Tài liệu khác'}`,
      );
    }

    return document;
  }

  private async ensureStudentDocumentAllowed(
    registration: RegistrationRow,
    documentType: StudentDocumentType,
  ) {
    if (
      [
        StudentDocumentType.BCTT_REPORT,
        StudentDocumentType.INTERNSHIP_CONFIRMATION,
      ].includes(documentType) &&
      registration.status === RegistrationStatus.BCTT_PENDING_APPROVAL
    ) {
      throw new AppException(
        'Chỉ được upload báo cáo BCTT hoặc xác nhận thực tập khi đã được giáo viên hướng dẫn phê duyệt',
        HttpStatus.BAD_REQUEST,
        ErrorCode.DOCUMENT_NOT_ALLOWED,
      );
    }

    if (
      documentType === StudentDocumentType.KLTN_REPORT &&
      registration.status === RegistrationStatus.KLTN_PENDING_APPROVAL
    ) {
      throw new AppException(
        'Chỉ được upload báo cáo KLTN sau khi registration không còn ở trạng thái chờ duyệt',
        HttpStatus.BAD_REQUEST,
        ErrorCode.DOCUMENT_NOT_ALLOWED,
      );
    }

    const term = await this.repository.findOne<TermRow>(
      SheetName.TERMS,
      (row) => {
        return (
          row.tenDot === registration.dot && row.loai === registration.loai
        );
      },
    );

    if (!term || !isNowWithin(term.submissionOpenAt, term.submissionCloseAt)) {
      throw new AppException(
        'Hiện chưa đến thời gian nộp tài liệu',
        HttpStatus.BAD_REQUEST,
        ErrorCode.TERM_NOT_OPEN,
      );
    }

    if (
      documentType === StudentDocumentType.BCTT_REPORT ||
      documentType === StudentDocumentType.INTERNSHIP_CONFIRMATION
    ) {
      if (registration.loai !== RegistrationType.BCTT) {
        throw new AppException(
          'Tài liệu không phù hợp cho loại registration',
          HttpStatus.BAD_REQUEST,
          ErrorCode.DOCUMENT_NOT_ALLOWED,
        );
      }
      return;
    }

    if (documentType === StudentDocumentType.KLTN_REPORT) {
      if (registration.loai !== RegistrationType.KLTN) {
        throw new AppException(
          'Tài liệu không phù hợp cho loại registration',
          HttpStatus.BAD_REQUEST,
          ErrorCode.DOCUMENT_NOT_ALLOWED,
        );
      }
      return;
    }

    if (
      [
        StudentDocumentType.REVISED_THESIS,
        StudentDocumentType.REVISION_EXPLANATION,
      ].includes(documentType) &&
      registration.status === RegistrationStatus.WAITING_REVISED_UPLOAD
    ) {
      return;
    }

    throw new AppException(
      'Tài liệu không được phép upload ở giai đoạn này',
      HttpStatus.BAD_REQUEST,
      ErrorCode.DOCUMENT_NOT_ALLOWED,
    );
  }

  private async ensureLecturerDocumentAllowed(
    user: AuthenticatedUser,
    registration: RegistrationRow,
    documentType: LecturerDocumentType,
  ) {
    if (
      documentType === LecturerDocumentType.TURNITIN &&
      user.email === registration.emailGVHD &&
      [
        RegistrationStatus.KLTN_SUBMITTED,
        RegistrationStatus.WAITING_TURNITIN,
        RegistrationStatus.WAITING_SUPERVISOR_SCORE,
      ].includes(registration.status)
    ) {
      return;
    }

    if (documentType === LecturerDocumentType.COMMITTEE_MINUTES) {
      const committee = await this.repository.findOne<CommitteeRow>(
        SheetName.COMMITTEES,
        (row) => row.id === registration.committeeId,
      );

      if (committee && committee.secretaryEmail === user.email) {
        return;
      }
    }

    if (
      [
        LecturerDocumentType.REVIEW_ATTACHMENT,
        LecturerDocumentType.SUPERVISOR_ATTACHMENT,
      ].includes(documentType) &&
      [registration.emailGVHD, registration.emailGVPB].includes(user.email)
    ) {
      return;
    }

    throw new AppException(
      'Bạn không được upload tài liệu này',
      HttpStatus.BAD_REQUEST,
      ErrorCode.DOCUMENT_NOT_ALLOWED,
    );
  }

  private resolveStatusAfterStudentUpload(
    currentStatus: RegistrationStatus,
    documentType: StudentDocumentType,
  ) {
    if (
      [
        StudentDocumentType.BCTT_REPORT,
        StudentDocumentType.INTERNSHIP_CONFIRMATION,
      ].includes(documentType)
    ) {
      return RegistrationStatus.BCTT_SUBMITTED;
    }

    if (documentType === StudentDocumentType.KLTN_REPORT) {
      return RegistrationStatus.KLTN_SUBMITTED;
    }

    if (
      [
        StudentDocumentType.REVISED_THESIS,
        StudentDocumentType.REVISION_EXPLANATION,
      ].includes(documentType) &&
      currentStatus === RegistrationStatus.WAITING_REVISED_UPLOAD
    ) {
      return RegistrationStatus.WAITING_SUPERVISOR_REVISION_APPROVAL;
    }

    return null;
  }

  private async getRegistrationOrThrow(registrationId: string) {
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

    return registration;
  }

  private async assertCanAccess(
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

    if (
      user.role === SystemRole.LECTURER &&
      [registration.emailGVHD, registration.emailGVPB].includes(user.email)
    ) {
      return;
    }

    if (registration.committeeId) {
      const committee = await this.repository.findOne<CommitteeRow>(
        SheetName.COMMITTEES,
        (row) => row.id === registration.committeeId,
      );
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
    }

    throw new AppException(
      'Bạn không có quyền xem tài liệu',
      HttpStatus.FORBIDDEN,
      ErrorCode.FORBIDDEN_ROLE,
    );
  }
}
