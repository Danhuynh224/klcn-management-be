import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { SHEET_REPOSITORY } from '../common/constants/injection-tokens';
import { SheetName } from '../common/constants/sheet-definitions';
import { ErrorCode } from '../common/enums/error-code.enum';
import { AppException } from '../common/exceptions/app.exception';
import { NotificationRow } from '../common/types/domain.types';
import { successResponse } from '../common/utils/api-response.util';
import { isTruthy, toIsoNow } from '../common/utils/date.util';
import { createId } from '../common/utils/id.util';
import type { SheetRepository } from '../common/types/sheet-repository.interface';

@Injectable()
export class NotificationsService {
  constructor(
    @Inject(SHEET_REPOSITORY)
    private readonly repository: SheetRepository,
  ) {}

  async createNotification(
    receiverEmail: string,
    title: string,
    content: string,
    type: string,
    referenceId = '',
  ) {
    const notification: NotificationRow = {
      id: createId('noti'),
      receiverEmail,
      title,
      content,
      type,
      referenceId,
      isRead: false,
      createdAt: toIsoNow(),
    };

    await this.repository.insertRow<NotificationRow>(
      SheetName.NOTIFICATIONS,
      notification,
    );

    return notification;
  }

  async createMany(
    receiverEmails: string[],
    title: string,
    content: string,
    type: string,
    referenceId = '',
  ) {
    const uniqueEmails = Array.from(
      new Set(receiverEmails.filter((email) => Boolean(email))),
    );

    return Promise.all(
      uniqueEmails.map((email) =>
        this.createNotification(email, title, content, type, referenceId),
      ),
    );
  }

  async getMine(receiverEmail: string, unreadOnly?: boolean) {
    const notifications = await this.repository.getAllRows<NotificationRow>(
      SheetName.NOTIFICATIONS,
    );

    const data = notifications
      .filter((notification) => {
        if (notification.receiverEmail !== receiverEmail) {
          return false;
        }

        if (typeof unreadOnly === 'boolean' && unreadOnly) {
          return !isTruthy(notification.isRead);
        }

        return true;
      })
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .map((notification) => ({
        id: notification.id,
        title: notification.title,
        content: notification.content,
        isRead: isTruthy(notification.isRead),
        createdAt: notification.createdAt,
      }));

    return successResponse(data);
  }

  async markAsRead(id: string, receiverEmail: string) {
    const notification = await this.repository.findOne<NotificationRow>(
      SheetName.NOTIFICATIONS,
      (row) => row.id === id,
    );

    if (!notification || notification.receiverEmail !== receiverEmail) {
      throw new AppException(
        'Notification không tồn tại',
        HttpStatus.NOT_FOUND,
        ErrorCode.RESOURCE_NOT_FOUND,
      );
    }

    const updated = await this.repository.updateRow<NotificationRow>(
      SheetName.NOTIFICATIONS,
      id,
      { isRead: true },
    );

    return successResponse(
      {
        id: updated.id,
        title: updated.title,
        content: updated.content,
        isRead: true,
        createdAt: updated.createdAt,
      },
      'Đã đánh dấu thông báo là đã đọc',
    );
  }
}
