import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { AuthUser } from '../../../common/decorators/auth-user.decorator';
import { AuthWorkspace } from '../../../common/decorators/auth-workspace.decorator';
import { User, Workspace } from '@docmost/db/types/entity.types';
import { NotificationService } from '../services/notification.service';
import { NotificationPreferenceService } from '../services/notification-preference.service';
import { GetNotificationsDto } from '../dto/get-notifications.dto';
import { UpdateNotificationPreferencesDto } from '../dto/update-preference.dto';
import { NotificationType } from '../types/notification.types';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationController {
  constructor(
    private readonly notificationService: NotificationService,
    private readonly preferenceService: NotificationPreferenceService,
  ) {}

  @Get()
  async getNotifications(
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
    @Query() query: GetNotificationsDto,
  ) {
    const { grouped = true, status, limit = 20, offset = 0 } = query;

    if (grouped) {
      return await this.notificationService.getGroupedNotifications(
        user.id,
        workspace.id,
        { status, limit, offset },
      );
    }

    return await this.notificationService.getNotifications(
      user.id,
      workspace.id,
      { status, limit, offset },
    );
  }

  @Get('unread-count')
  async getUnreadCount(@AuthUser() user: User) {
    const count = await this.notificationService.getUnreadCount(user.id);
    return { count };
  }

  @Post(':id/read')
  async markAsRead(
    @AuthUser() user: User,
    @Param('id') notificationId: string,
  ) {
    await this.notificationService.markAsRead(notificationId, user.id);
    return { success: true };
  }

  @Post('mark-all-read')
  async markAllAsRead(@AuthUser() user: User) {
    await this.notificationService.markAllAsRead(user.id);
    return { success: true };
  }

  @Get('preferences')
  async getPreferences(
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    return await this.preferenceService.getUserPreferences(
      user.id,
      workspace.id,
    );
  }

  @Put('preferences')
  async updatePreferences(
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
    @Body() dto: UpdateNotificationPreferencesDto,
  ) {
    return await this.preferenceService.updateUserPreferences(
      user.id,
      workspace.id,
      dto,
    );
  }

  @Get('preferences/stats')
  async getNotificationStats(
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    return await this.preferenceService.getNotificationStats(
      user.id,
      workspace.id,
    );
  }

  @Post('test')
  async sendTestNotification(
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
    @Body() dto: { type: NotificationType },
  ) {
    await this.notificationService.createTestNotification(
      user.id,
      workspace.id,
      dto.type,
    );

    return { success: true, message: 'Test notification sent' };
  }
}
