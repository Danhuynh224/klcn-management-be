export enum StudentDocumentType {
  BCTT_REPORT = 'BCTT_REPORT',
  INTERNSHIP_CONFIRMATION = 'INTERNSHIP_CONFIRMATION',
  KLTN_REPORT = 'KLTN_REPORT',
  REVISED_THESIS = 'REVISED_THESIS',
  REVISION_EXPLANATION = 'REVISION_EXPLANATION',
}

export enum LecturerDocumentType {
  TURNITIN = 'TURNITIN',
  COMMITTEE_MINUTES = 'COMMITTEE_MINUTES',
  REVIEW_ATTACHMENT = 'REVIEW_ATTACHMENT',
  SUPERVISOR_ATTACHMENT = 'SUPERVISOR_ATTACHMENT',
}

export const DOCUMENT_TYPES = [
  ...Object.values(StudentDocumentType),
  ...Object.values(LecturerDocumentType),
] as const;

export type DocumentType = (typeof DOCUMENT_TYPES)[number];
