# KLCN Backend API Reference

Swagger UI:
- `GET /docs`

Base response success:
```json
{
  "success": true,
  "message": "optional",
  "data": {}
}
```

Base response error:
```json
{
  "success": false,
  "message": "Error message",
  "errorCode": "ERROR_CODE"
}
```

Auth:
- Most endpoints require `Authorization: Bearer <accessToken>`

## Health

### `GET /`
- Auth: Public
- Response:
```json
{
  "success": true,
  "data": {
    "service": "klcn-management-be",
    "status": "ok"
  },
  "message": "KLCN backend is running"
}
```

## Auth

### `POST /auth/login`
- Auth: Public
- Body:
```json
{
  "email": "sv01@ute.edu.vn",
  "password": "123456"
}
```
- Response:
```json
{
  "success": true,
  "data": {
    "accessToken": "jwt_token",
    "user": {
      "id": "u_sv01",
      "email": "sv01@ute.edu.vn",
      "ten": "Nguyen Van A",
      "role": "STUDENT",
      "ms": "20123456"
    }
  }
}
```

### `GET /auth/me`
- Auth: Bearer
- Response: current user profile

## Users

### `GET /users/me`
- Auth: Bearer
- Response: current user profile

### `GET /users`
- Auth: `ADMIN`, `HEAD_OF_DEPARTMENT`
- Query:
  - `role`
  - `keyword`
- Response: list users

### `GET /users/lecturers`
- Auth: Bearer
- Query:
  - `fieldName`
  - `dot`
  - `availableOnly=true|false`
- Response item:
```json
{
  "email": "gv01@ute.edu.vn",
  "ten": "Tran Van B",
  "msgv": "GV001",
  "quota": 10,
  "usedSlots": 4,
  "remainingSlots": 6,
  "fields": ["AI", "Web"]
}
```

### `GET /users/students`
- Auth: `ADMIN`, `HEAD_OF_DEPARTMENT`, `LECTURER`
- Query:
  - `keyword`

## Quotas

### `GET /quotas`
- Auth: `ADMIN`, `HEAD_OF_DEPARTMENT`
- Query:
  - `dot`
  - `emailGV`

### `PATCH /quotas/:id`
- Auth: `ADMIN`, `HEAD_OF_DEPARTMENT`
- Body:
```json
{
  "quota": 12
}
```

### `PATCH /quotas/:id/approve`
- Auth: `ADMIN`, `HEAD_OF_DEPARTMENT`
- Response: updated quota row

## Terms

### `GET /terms`
- Auth: Bearer
- Query:
  - `loai`
  - `isActive`

### `POST /terms`
- Auth: `ADMIN`, `HEAD_OF_DEPARTMENT`
- Body:
```json
{
  "tenDot": "DOT1-2026",
  "loai": "BCTT",
  "namHoc": "2025-2026",
  "hocKy": "HK2",
  "registrationOpenAt": "2026-04-01T00:00:00.000Z",
  "registrationCloseAt": "2026-04-30T23:59:59.000Z",
  "submissionOpenAt": "2026-05-01T00:00:00.000Z",
  "submissionCloseAt": "2026-05-31T23:59:59.000Z",
  "defenseDate": "2026-06-10T08:00:00.000Z",
  "isActive": true
}
```

### `PATCH /terms/:id`
- Auth: `ADMIN`, `HEAD_OF_DEPARTMENT`
- Body: partial of create term body

## Fields

### `GET /fields`
- Auth: Bearer
- Query:
  - `emailGV`

### `GET /fields/suggestions`
- Auth: Bearer
- Query:
  - `fieldName`

## Registrations

### `POST /registrations/bctt`
- Auth: `STUDENT`
- Body:
```json
{
  "tenDeTai": "He thong quan ly thu vien",
  "linhVuc": "Web",
  "tenCongTy": "ABC Software",
  "emailGVHD": "gv01@ute.edu.vn",
  "dot": "DOT1-2026"
}
```

### `POST /registrations/kltn`
- Auth: `STUDENT`
- Body:
```json
{
  "tenDeTai": "He thong danh gia do an",
  "linhVuc": "Web",
  "tenCongTy": "ABC Software",
  "emailGVHD": "gv01@ute.edu.vn",
  "dot": "DOT2-2026"
}
```

### `GET /registrations/me`
- Auth: Bearer
- Response:
  - student: registrations of current student
  - lecturer: registrations related to supervisor/reviewer/committee
  - admin/head: all registrations

### `GET /registrations`
- Auth: Bearer
- Query:
  - `loai`
  - `status`
  - `dot`
  - `emailGVHD`
  - `emailGVPB`
  - `committeeId`
  - `roleView=supervisor|reviewer|committee|chair|secretary`

### `GET /registrations/:id`
- Auth: Bearer
- Response:
```json
{
  "success": true,
  "data": {
    "registration": {},
    "documents": {
      "studentDocuments": [],
      "lecturerDocuments": []
    },
    "scores": [],
    "committee": {},
    "notifications": [],
    "approvalStates": {
      "supervisorApproved": false,
      "chairApproved": false
    }
  }
}
```

### `PATCH /registrations/:id/approve`
- Auth: `LECTURER`
- Body:
```json
{
  "tenDeTai": "Ten de tai da chinh sua"
}
```

### `PATCH /registrations/:id/reject`
- Auth: `LECTURER`
- Body:
```json
{
  "reason": "De tai chua phu hop"
}
```

### `PATCH /registrations/:id/change-supervisor`
- Auth: `ADMIN`, `HEAD_OF_DEPARTMENT`
- Body:
```json
{
  "emailGVHD": "gv02@ute.edu.vn"
}
```

### `PATCH /registrations/:id/change-reviewer`
- Auth: `ADMIN`, `HEAD_OF_DEPARTMENT`
- Body:
```json
{
  "emailGVPB": "gv03@ute.edu.vn"
}
```

### `PATCH /registrations/:id/update-status`
- Auth: Bearer
- Body:
```json
{
  "status": "BCTT_PASSED"
}
```

## Documents

### `POST /documents/upload`
- Auth: Bearer
- Content-Type: `multipart/form-data`
- Form fields:
  - `registrationId`
  - `documentType`
  - `file`
- Response:
```json
{
  "success": true,
  "data": {
    "id": "sdoc_xxx",
    "registrationId": "reg_xxx",
    "emailSV": "sv01@ute.edu.vn",
    "documentType": "KLTN_REPORT",
    "fileName": "report.pdf",
    "fileUrl": "https://res.cloudinary.com/.../report.pdf",
    "uploadedAt": "2026-04-04T00:00:00.000Z"
  }
}
```

### `GET /documents/registration/:registrationId`
- Auth: Bearer
- Response:
```json
{
  "success": true,
  "data": {
    "studentDocuments": [],
    "lecturerDocuments": []
  }
}
```

## Scores

### `POST /scores`
- Auth: Bearer
- Body:
```json
{
  "registrationId": "reg_xxx",
  "vaiTroCham": "SUPERVISOR",
  "score1": 8,
  "score2": 8.5,
  "score3": 9,
  "totalScore": 8.5,
  "comments": "Lam tot",
  "questions": ""
}
```

### `PATCH /scores/:id`
- Auth: Bearer
- Body: partial fields from create score body

### `GET /scores/registration/:registrationId`
- Auth: Bearer
- Response:
```json
{
  "success": true,
  "data": {
    "supervisor": {},
    "reviewer": {},
    "committee": [],
    "final": {
      "average": 8.6
    }
  }
}
```

### `POST /scores/registration/:registrationId/finalize`
- Auth: Bearer
- Body:
```json
{
  "formula": "average"
}
```
- Response:
```json
{
  "success": true,
  "data": {
    "finalScore": 8.6
  }
}
```

## Committees

### `GET /committees`
- Auth: Bearer
- Query:
  - `dot`

### `POST /committees`
- Auth: `ADMIN`, `HEAD_OF_DEPARTMENT`
- Body:
```json
{
  "committeeName": "HD 01",
  "dot": "DOT2-2026",
  "chairEmail": "gv10@ute.edu.vn",
  "secretaryEmail": "gv11@ute.edu.vn",
  "member1Email": "gv12@ute.edu.vn",
  "member2Email": "gv13@ute.edu.vn",
  "location": "Phong A1",
  "defenseDate": "2026-07-20T08:00:00.000Z"
}
```

### `PATCH /committees/:id`
- Auth: `ADMIN`, `HEAD_OF_DEPARTMENT`
- Body: partial fields from create committee body

### `POST /committees/:id/assign-registration`
- Auth: `ADMIN`, `HEAD_OF_DEPARTMENT`
- Body:
```json
{
  "registrationId": "reg_xxx"
}
```

## Minutes

### `GET /minutes/registration/:registrationId`
- Auth: Bearer

### `POST /minutes/registration/:registrationId/generate`
- Auth: Bearer

### `PATCH /minutes/:registrationId`
- Auth: Bearer
- Body:
```json
{
  "content": "Cac gop y cua hoi dong...",
  "fileUrl": "https://res.cloudinary.com/.../minutes.pdf"
}
```

## Notifications

### `GET /notifications/me`
- Auth: Bearer
- Query:
  - `unreadOnly=true|false`

### `PATCH /notifications/:id/read`
- Auth: Bearer

## Dashboards

### `GET /dashboards/student`
- Auth: `STUDENT`

### `GET /dashboards/lecturer`
- Auth: `LECTURER`

### `GET /dashboards/head`
- Auth: `ADMIN`, `HEAD_OF_DEPARTMENT`
