import { Injectable, Logger } from '@nestjs/common';
import { NotificationPreferenceRepo } from '@docmost/db/repos/notification/notification-preference.repo';
import { UpdateNotificationPreferencesDto } from '../dto/update-preference.dto';
import { NotificationPreference } from '@docmost/db/types/entity.types';
import {
  NotificationType,
  NotificationPriority,
} from '../types/notification.types';
import { 
  addDays, 
  setHours, 
  setMinutes, 
  setSeconds,
  getDay,
  differenceInMilliseconds,
  startOfDay,
  addHours
} from 'date-fns';

interface NotificationDecision {
  shouldNotify: boolean;
  channels: ('email' | 'in_app')[];
  delay?: number;
  batchingEnabled: boolean;
}

@Injectable()
export class NotificationPreferenceService {
  private readonly logger = new Logger(NotificationPreferenceService.name);

  constructor(private readonly preferenceRepo: NotificationPreferenceRepo) {}

  async getUserPreferences(
    userId: string,
    workspaceId: string,
  ): Promise<NotificationPreference> {
    return await this.preferenceRepo.findOrCreate(userId, workspaceId);
  }

  async updateUserPreferences(
    userId: string,
    workspaceId: string,
    updates: UpdateNotificationPreferencesDto,
  ): Promise<NotificationPreference> {
    const existing = await this.getUserPreferences(userId, workspaceId);

    // Merge notification settings if provided
    let mergedSettings = existing.notificationSettings;
    if (updates.notificationSettings) {
      mergedSettings = {
        ...((existing.notificationSettings as Record<string, any>) || {}),
        ...(updates.notificationSettings || {}),
      };
    }

    // Validate batch window
    if (updates.batchWindowMinutes !== undefined) {
      updates.batchWindowMinutes = Math.max(
        5,
        Math.min(60, updates.batchWindowMinutes),
      );
    }

    const updated = await this.preferenceRepo.updatePreference(
      userId,
      workspaceId,
      {
        ...updates,
        notificationSettings: mergedSettings,
      },
    );

    this.logger.log(`User ${userId} updated notification preferences`, {
      userId,
      workspaceId,
      changes: updates,
    });

    return updated;
  }

  async shouldNotify(
    recipientId: string,
    type: NotificationType,
    workspaceId: string,
  ): Promise<boolean> {
    const preferences = await this.getUserPreferences(recipientId, workspaceId);
    const decision = await this.makeNotificationDecision(
      recipientId,
      workspaceId,
      type,
      NotificationPriority.NORMAL,
    );

    return decision.shouldNotify;
  }

  async makeNotificationDecision(
    userId: string,
    workspaceId: string,
    type: NotificationType,
    priority: NotificationPriority = NotificationPriority.NORMAL,
  ): Promise<NotificationDecision> {
    const preferences = await this.getUserPreferences(userId, workspaceId);

    // Global check
    if (!preferences.emailEnabled && !preferences.inAppEnabled) {
      return {
        shouldNotify: false,
        channels: [],
        batchingEnabled: false,
      };
    }

    // Type-specific settings
    const typeSettings = this.getTypeSettings(preferences, type);

    const channels: ('email' | 'in_app')[] = [];
    if (preferences.emailEnabled && typeSettings.email) channels.push('email');
    if (preferences.inAppEnabled && typeSettings.in_app)
      channels.push('in_app');

    if (channels.length === 0) {
      return {
        shouldNotify: false,
        channels: [],
        batchingEnabled: false,
      };
    }

    // Check quiet hours
    const quietHoursDelay = this.calculateQuietHoursDelay(
      preferences,
      priority,
    );

    // Check weekend preferences
    if (
      !preferences.weekendNotifications &&
      this.isWeekend(preferences.timezone)
    ) {
      if (priority !== NotificationPriority.HIGH) {
        const mondayDelay = this.getDelayUntilMonday(preferences.timezone);
        return {
          shouldNotify: true,
          channels,
          delay: mondayDelay,
          batchingEnabled: true,
        };
      }
    }

    return {
      shouldNotify: true,
      channels,
      delay: quietHoursDelay,
      batchingEnabled:
        typeSettings.batch && preferences.emailFrequency === 'smart',
    };
  }

  private getTypeSettings(
    preferences: NotificationPreference,
    type: NotificationType,
  ): any {
    const settings = preferences.notificationSettings as any;
    return settings[type] || { email: true, in_app: true, batch: false };
  }

  private calculateQuietHoursDelay(
    preferences: NotificationPreference,
    priority: NotificationPriority,
  ): number | undefined {
    if (
      !preferences.quietHoursEnabled ||
      priority === NotificationPriority.HIGH
    ) {
      return undefined;
    }

    // TODO: Implement proper timezone conversion
    const now = new Date();
    const quietStart = this.parseTime(
      preferences.quietHoursStart,
      preferences.timezone,
    );
    const quietEnd = this.parseTime(
      preferences.quietHoursEnd,
      preferences.timezone,
    );

    if (this.isInQuietHours(now, quietStart, quietEnd)) {
      return this.getDelayUntilEndOfQuietHours(now, quietEnd);
    }

    return undefined;
  }

  private parseTime(timeStr: string, timezone: string): Date {
    const [hours, minutes, seconds] = timeStr.split(':').map(Number);
    // TODO: Implement proper timezone conversion
    const now = new Date();
    return setSeconds(setMinutes(setHours(now, hours), minutes), seconds || 0);
  }

  private isInQuietHours(
    now: Date,
    start: Date,
    end: Date,
  ): boolean {
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const startMinutes = start.getHours() * 60 + start.getMinutes();
    const endMinutes = end.getHours() * 60 + end.getMinutes();

    if (startMinutes <= endMinutes) {
      // Quiet hours don't cross midnight
      return nowMinutes >= startMinutes && nowMinutes < endMinutes;
    } else {
      // Quiet hours cross midnight
      return nowMinutes >= startMinutes || nowMinutes < endMinutes;
    }
  }

  private getDelayUntilEndOfQuietHours(now: Date, end: Date): number {
    let endTime = end;

    // If end time is before current time, it means quiet hours end tomorrow
    if (
      end.getHours() < now.getHours() ||
      (end.getHours() === now.getHours() && end.getMinutes() <= now.getMinutes())
    ) {
      endTime = addDays(endTime, 1);
    }

    return differenceInMilliseconds(endTime, now);
  }

  private isWeekend(timezone: string): boolean {
    // TODO: Implement proper timezone conversion
    const now = new Date();
    const dayOfWeek = getDay(now);
    return dayOfWeek === 0 || dayOfWeek === 6; // 0 = Sunday, 6 = Saturday
  }

  private getDelayUntilMonday(timezone: string): number {
    // TODO: Implement proper timezone conversion
    const now = new Date();
    const currentDay = getDay(now);
    const daysUntilMonday = currentDay === 0 ? 1 : (8 - currentDay) % 7 || 7;
    const nextMonday = addDays(now, daysUntilMonday);
    const mondayMorning = addHours(startOfDay(nextMonday), 9); // 9 AM Monday
    return differenceInMilliseconds(mondayMorning, now);
  }

  async getNotificationStats(
    userId: string,
    workspaceId: string,
  ): Promise<{
    preferences: NotificationPreference;
    stats: {
      emailEnabled: boolean;
      inAppEnabled: boolean;
      quietHoursActive: boolean;
      batchingEnabled: boolean;
      typesDisabled: string[];
    };
  }> {
    const preferences = await this.getUserPreferences(userId, workspaceId);
    // TODO: Implement proper timezone conversion
    const now = new Date();
    const quietStart = this.parseTime(
      preferences.quietHoursStart,
      preferences.timezone,
    );
    const quietEnd = this.parseTime(
      preferences.quietHoursEnd,
      preferences.timezone,
    );

    const typesDisabled: string[] = [];
    const settings = preferences.notificationSettings as any;

    for (const [type, config] of Object.entries(settings)) {
      const typeSettings = config as any;
      if (!typeSettings.email && !typeSettings.in_app) {
        typesDisabled.push(type);
      }
    }

    return {
      preferences,
      stats: {
        emailEnabled: preferences.emailEnabled,
        inAppEnabled: preferences.inAppEnabled,
        quietHoursActive:
          preferences.quietHoursEnabled &&
          this.isInQuietHours(now, quietStart, quietEnd),
        batchingEnabled: preferences.emailFrequency !== 'instant',
        typesDisabled,
      },
    };
  }
}
