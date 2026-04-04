import { DocumentType } from '../enums/document-type.enum';
import { LecturerBusinessRole } from '../enums/lecturer-business-role.enum';
import { RegistrationStatus } from '../enums/registration-status.enum';
import { RegistrationType } from '../enums/registration-type.enum';
import { SystemRole } from '../enums/system-role.enum';

export interface UserRow {
  id: string;
  email: string;
  password: string;
  ms: string;
  major: string;
  heDaoTao: string;
  ten: string;
  role: SystemRole;
  createdAt: string;
}

export interface QuotaRow {
  id: string;
  emailGV: string;
  msgv: string;
  quota: number | string;
  usedSlots: number | string;
  heDaoTao: string;
  dot: string;
  status?: string;
  approvedAt?: string;
}

export interface FieldRow {
  id: string;
  emailGV: string;
  fieldName: string;
}

export interface TermRow {
  id: string;
  tenDot: string;
  loai: RegistrationType;
  major: string;
  namHoc: string;
  hocKy: string;
  registrationOpenAt: string;
  registrationCloseAt: string;
  submissionOpenAt: string;
  submissionCloseAt: string;
  defenseDate: string;
  isActive: boolean | string;
}

export interface RegistrationRow {
  id: string;
  emailSV: string;
  tenSV: string;
  loai: RegistrationType;
  tenDeTai: string;
  linhVuc: string;
  tenCongTy: string;
  emailGVHD: string;
  emailGVPB: string;
  dot: string;
  status: RegistrationStatus;
  committeeId: string;
  defenseDate: string;
  location: string;
  finalScore: number | string;
  supervisorApproved: boolean | string;
  chairApproved: boolean | string;
  rejectionReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CommitteeRow {
  id: string;
  committeeName: string;
  dot: string;
  chairEmail: string;
  secretaryEmail: string;
  member1Email: string;
  member2Email: string;
  location: string;
  defenseDate: string;
  createdAt: string;
}

export interface ScoreRow {
  id: string;
  registrationId: string;
  emailGV: string;
  vaiTroCham: LecturerBusinessRole;
  score1: number | string;
  score2: number | string;
  score3: number | string;
  totalScore: number | string;
  comments: string;
  questions: string;
  createdAt: string;
  updatedAt: string;
}

export interface StudentDocumentRow {
  id: string;
  registrationId: string;
  emailSV: string;
  documentType: DocumentType;
  fileName: string;
  fileUrl: string;
  uploadedAt: string;
}

export interface LecturerDocumentRow {
  id: string;
  registrationId: string;
  emailGV: string;
  documentType: DocumentType;
  fileName: string;
  fileUrl: string;
  uploadedAt: string;
}

export interface SuggestedTopicRow {
  id: string;
  title: string;
  fieldName: string;
  emailGV: string;
  description: string;
  status: string;
  createdAt: string;
}

export interface NotificationRow {
  id: string;
  receiverEmail: string;
  title: string;
  content: string;
  type: string;
  referenceId: string;
  isRead: boolean | string;
  createdAt: string;
}

export interface MinuteRow {
  id: string;
  registrationId: string;
  generatedBy: string;
  content: string;
  fileUrl: string;
  createdAt: string;
  updatedAt: string;
}

export interface RegistrationWorkflowStatusRow {
  id: string;
  loai: RegistrationType;
  status: RegistrationStatus;
  label: string;
  description: string;
  step: number | string;
  stepLabel: string;
  actor: string;
  color: string;
  nextStatuses: string;
  canStudentUpdate: boolean | string;
  canLecturerUpdate: boolean | string;
  canManagerUpdate: boolean | string;
  isTerminal: boolean | string;
  sortOrder: number | string;
}

export interface RegistrationStatusHistoryRow {
  id: string;
  registrationId: string;
  status: RegistrationStatus;
  statusLabel: string;
  changedBy: string;
  changedByRole: string;
  note: string;
  changedAt: string;
}
