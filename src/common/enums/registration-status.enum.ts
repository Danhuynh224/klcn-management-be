export enum RegistrationStatus {
  NEW = 'NEW',
  BCTT_PENDING_APPROVAL = 'BCTT_PENDING_APPROVAL',
  BCTT_APPROVED = 'BCTT_APPROVED',
  BCTT_REJECTED = 'BCTT_REJECTED',
  BCTT_IN_PROGRESS = 'BCTT_IN_PROGRESS',
  BCTT_SUBMITTED = 'BCTT_SUBMITTED',
  BCTT_PASSED = 'BCTT_PASSED',
  BCTT_FAILED = 'BCTT_FAILED',
  KLTN_PENDING_APPROVAL = 'KLTN_PENDING_APPROVAL',
  KLTN_APPROVED = 'KLTN_APPROVED',
  KLTN_REJECTED = 'KLTN_REJECTED',
  KLTN_IN_PROGRESS = 'KLTN_IN_PROGRESS',
  KLTN_SUBMITTED = 'KLTN_SUBMITTED',
  WAITING_TURNITIN = 'WAITING_TURNITIN',
  WAITING_SUPERVISOR_SCORE = 'WAITING_SUPERVISOR_SCORE',
  WAITING_REVIEWER_SCORE = 'WAITING_REVIEWER_SCORE',
  WAITING_COMMITTEE_SCORE = 'WAITING_COMMITTEE_SCORE',
  DEFENSE_SCHEDULED = 'DEFENSE_SCHEDULED',
  DEFENDED = 'DEFENDED',
  WAITING_REVISED_UPLOAD = 'WAITING_REVISED_UPLOAD',
  WAITING_SUPERVISOR_REVISION_APPROVAL = 'WAITING_SUPERVISOR_REVISION_APPROVAL',
  WAITING_CHAIR_REVISION_APPROVAL = 'WAITING_CHAIR_REVISION_APPROVAL',
  COMPLETED = 'COMPLETED',
  REJECTED_AFTER_DEFENSE = 'REJECTED_AFTER_DEFENSE',
}

export const REGISTRATION_STATUS_LABELS: Record<RegistrationStatus, string> = {
  [RegistrationStatus.NEW]: 'Mới tạo',
  [RegistrationStatus.BCTT_PENDING_APPROVAL]:
    'Chờ giảng viên hướng dẫn duyệt BCTT',
  [RegistrationStatus.BCTT_APPROVED]: 'BCTT đã được duyệt',
  [RegistrationStatus.BCTT_REJECTED]: 'BCTT bị từ chối',
  [RegistrationStatus.BCTT_IN_PROGRESS]: 'Đang thực hiện BCTT',
  [RegistrationStatus.BCTT_SUBMITTED]: 'Đã nộp báo cáo BCTT',
  [RegistrationStatus.BCTT_PASSED]: 'BCTT đạt',
  [RegistrationStatus.BCTT_FAILED]: 'BCTT không đạt',
  [RegistrationStatus.KLTN_PENDING_APPROVAL]:
    'Chờ giảng viên hướng dẫn duyệt KLTN',
  [RegistrationStatus.KLTN_APPROVED]: 'KLTN đã được duyệt',
  [RegistrationStatus.KLTN_REJECTED]: 'KLTN bị từ chối',
  [RegistrationStatus.KLTN_IN_PROGRESS]: 'Đang thực hiện KLTN',
  [RegistrationStatus.KLTN_SUBMITTED]: 'Đã nộp khóa luận',
  [RegistrationStatus.WAITING_TURNITIN]: 'Chờ kiểm tra Turnitin',
  [RegistrationStatus.WAITING_SUPERVISOR_SCORE]:
    'Chờ giảng viên hướng dẫn chấm điểm',
  [RegistrationStatus.WAITING_REVIEWER_SCORE]:
    'Chờ giảng viên phản biện chấm điểm',
  [RegistrationStatus.WAITING_COMMITTEE_SCORE]: 'Chờ hội đồng chấm điểm',
  [RegistrationStatus.DEFENSE_SCHEDULED]: 'Đã xếp lịch bảo vệ',
  [RegistrationStatus.DEFENDED]: 'Đã bảo vệ',
  [RegistrationStatus.WAITING_REVISED_UPLOAD]:
    'Chờ sinh viên nộp bản chỉnh sửa',
  [RegistrationStatus.WAITING_SUPERVISOR_REVISION_APPROVAL]:
    'Chờ giảng viên hướng dẫn duyệt bản chỉnh sửa',
  [RegistrationStatus.WAITING_CHAIR_REVISION_APPROVAL]:
    'Chờ chủ tịch hội đồng duyệt bản chỉnh sửa',
  [RegistrationStatus.COMPLETED]: 'Hoàn thành',
  [RegistrationStatus.REJECTED_AFTER_DEFENSE]: 'Không đạt sau bảo vệ',
};
