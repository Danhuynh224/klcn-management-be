export enum LecturerBusinessRole {
  SUPERVISOR = 'SUPERVISOR',
  REVIEWER = 'REVIEWER',
  COMMITTEE_MEMBER = 'COMMITTEE_MEMBER',
  COMMITTEE_CHAIR = 'COMMITTEE_CHAIR',
  COMMITTEE_SECRETARY = 'COMMITTEE_SECRETARY',
}

export const LECTURER_BUSINESS_ROLE_LABELS: Record<
  LecturerBusinessRole,
  string
> = {
  [LecturerBusinessRole.SUPERVISOR]: 'Giảng viên hướng dẫn',
  [LecturerBusinessRole.REVIEWER]: 'Giảng viên phản biện',
  [LecturerBusinessRole.COMMITTEE_MEMBER]: 'Ủy viên hội đồng',
  [LecturerBusinessRole.COMMITTEE_CHAIR]: 'Chủ tịch hội đồng',
  [LecturerBusinessRole.COMMITTEE_SECRETARY]: 'Thư ký hội đồng',
};

export function getLecturerBusinessRoleLabel(
  role: LecturerBusinessRole | string,
): string {
  if (role in LECTURER_BUSINESS_ROLE_LABELS) {
    return LECTURER_BUSINESS_ROLE_LABELS[role as LecturerBusinessRole];
  }

  return role;
}
