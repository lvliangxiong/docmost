# Notification System Integration Guide

This guide explains how to integrate the notification system into existing services.

## Quick Start

### 1. Import NotificationService

```typescript
import { NotificationService } from '@/core/notification/services/notification.service';
import { NotificationType } from '@/core/notification/types/notification.types';
```

### 2. Inject the Service

```typescript
constructor(
  private readonly notificationService: NotificationService,
  // ... other dependencies
) {}
```

### 3. Create Notifications

```typescript
// Example: Notify user when mentioned in a comment
await this.notificationService.createNotification({
  workspaceId: workspace.id,
  recipientId: mentionedUserId,
  actorId: currentUser.id,
  type: NotificationType.MENTION_IN_COMMENT,
  entityType: 'comment',
  entityId: comment.id,
  context: {
    pageId: page.id,
    pageTitle: page.title,
    commentText: comment.content.substring(0, 100),
    actorName: currentUser.name,
    threadRootId: comment.parentCommentId || comment.id,
  },
  priority: NotificationPriority.HIGH,
  groupKey: `comment:${comment.id}:mentions`,
  deduplicationKey: `mention:${mentionedUserId}:comment:${comment.id}`,
});
```

## Integration Examples

### CommentService Integration

```typescript
// In comment.service.ts
import { NotificationService } from '@/core/notification/services/notification.service';
import { NotificationType, NotificationPriority } from '@/core/notification/types/notification.types';

export class CommentService {
  constructor(
    private readonly notificationService: NotificationService,
    // ... other dependencies
  ) {}

  async createComment(dto: CreateCommentDto, user: User): Promise<Comment> {
    const comment = await this.commentRepo.create(dto);
    
    // Notify page owner about new comment
    if (page.creatorId !== user.id) {
      await this.notificationService.createNotification({
        workspaceId: workspace.id,
        recipientId: page.creatorId,
        actorId: user.id,
        type: NotificationType.COMMENT_ON_PAGE,
        entityType: 'comment',
        entityId: comment.id,
        context: {
          pageId: page.id,
          pageTitle: page.title,
          commentText: comment.content.substring(0, 100),
          actorName: user.name,
        },
        groupKey: `page:${page.id}:comments`,
      });
    }
    
    // Check for mentions and notify mentioned users
    const mentionedUserIds = this.extractMentions(comment.content);
    for (const mentionedUserId of mentionedUserIds) {
      await this.notificationService.createNotification({
        workspaceId: workspace.id,
        recipientId: mentionedUserId,
        actorId: user.id,
        type: NotificationType.MENTION_IN_COMMENT,
        entityType: 'comment',
        entityId: comment.id,
        context: {
          pageId: page.id,
          pageTitle: page.title,
          commentText: comment.content.substring(0, 100),
          actorName: user.name,
          threadRootId: comment.parentCommentId || comment.id,
        },
        priority: NotificationPriority.HIGH,
        deduplicationKey: `mention:${mentionedUserId}:comment:${comment.id}`,
      });
    }
    
    return comment;
  }
  
  async resolveComment(commentId: string, user: User): Promise<void> {
    const comment = await this.commentRepo.findById(commentId);
    
    // Notify comment creator that their comment was resolved
    if (comment.creatorId !== user.id) {
      await this.notificationService.createNotification({
        workspaceId: workspace.id,
        recipientId: comment.creatorId,
        actorId: user.id,
        type: NotificationType.COMMENT_RESOLVED,
        entityType: 'comment',
        entityId: comment.id,
        context: {
          pageId: page.id,
          pageTitle: page.title,
          resolverName: user.name,
        },
      });
    }
  }
}
```

### PageService Integration

```typescript
// In page.service.ts
async exportPage(pageId: string, format: string, user: User): Promise<void> {
  // Start export process...
  
  // When export is complete
  await this.notificationService.createNotification({
    workspaceId: workspace.id,
    recipientId: user.id,
    actorId: user.id, // System notification
    type: NotificationType.EXPORT_COMPLETED,
    entityType: 'page',
    entityId: pageId,
    context: {
      pageTitle: page.title,
      exportFormat: format,
      downloadUrl: exportUrl,
      expiresAt: expiryDate.toISOString(),
    },
    priority: NotificationPriority.LOW,
  });
}

async updatePage(pageId: string, content: any, user: User): Promise<void> {
  // Check for mentions in the content
  const mentionedUserIds = this.extractMentionsFromContent(content);
  
  for (const mentionedUserId of mentionedUserIds) {
    await this.notificationService.createNotification({
      workspaceId: workspace.id,
      recipientId: mentionedUserId,
      actorId: user.id,
      type: NotificationType.MENTION_IN_PAGE,
      entityType: 'page',
      entityId: pageId,
      context: {
        pageTitle: page.title,
        actorName: user.name,
        mentionContext: this.extractMentionContext(content, mentionedUserId),
      },
      priority: NotificationPriority.HIGH,
      deduplicationKey: `mention:${mentionedUserId}:page:${pageId}:${Date.now()}`,
    });
  }
}
```

### WsGateway Integration for Real-time Notifications

The notification system automatically sends real-time updates through WebSocket. The WsGateway is already injected into NotificationDeliveryService.

```typescript
// In ws.gateway.ts - Already implemented in NotificationDeliveryService
async sendNotificationToUser(userId: string, notification: any): Promise<void> {
  const userSockets = await this.getUserSockets(userId);
  
  for (const socketId of userSockets) {
    this.server.to(socketId).emit('notification:new', {
      id: notification.id,
      type: notification.type,
      entityType: notification.entityType,
      entityId: notification.entityId,
      context: notification.context,
      createdAt: notification.createdAt,
      readAt: notification.readAt,
    });
  }
}
```

## Notification Types

Available notification types:
- `MENTION_IN_PAGE` - User mentioned in a page
- `MENTION_IN_COMMENT` - User mentioned in a comment
- `COMMENT_ON_PAGE` - New comment on user's page
- `COMMENT_IN_THREAD` - Reply to user's comment
- `COMMENT_RESOLVED` - User's comment was resolved
- `EXPORT_COMPLETED` - Export job finished

## Best Practices

1. **Use Deduplication Keys**: Prevent duplicate notifications for the same event
   ```typescript
   deduplicationKey: `mention:${userId}:comment:${commentId}`
   ```

2. **Set Appropriate Priority**: 
   - HIGH: Mentions, direct replies
   - NORMAL: Comments on owned content
   - LOW: System notifications, exports

3. **Group Related Notifications**: Use groupKey for notifications that should be batched
   ```typescript
   groupKey: `page:${pageId}:comments`
   ```

4. **Include Relevant Context**: Provide enough information for email templates
   ```typescript
   context: {
     pageId: page.id,
     pageTitle: page.title,
     actorName: user.name,
     // ... other relevant data
   }
   ```

5. **Check User Preferences**: The notification service automatically checks user preferences, but you can pre-check if needed:
   ```typescript
   const preferences = await notificationPreferenceService.getUserPreferences(userId, workspaceId);
   if (preferences.emailEnabled) {
     // Create notification
   }
   ```

## Testing Notifications

Use the test endpoint to send test notifications:

```bash
curl -X POST http://localhost:3000/api/notifications/test \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "MENTION_IN_PAGE",
    "recipientId": "USER_ID"
  }'
```

## Email Templates

Email templates are located in `/core/notification/templates/`. To add a new template:

1. Create a new React component in the templates directory
2. Update the email sending logic in NotificationDeliveryService
3. Test the template using the React Email preview server

## Monitoring

Monitor notification delivery through logs:
- Check for `NotificationService` logs for creation events
- Check for `NotificationDeliveryService` logs for delivery status
- Check for `NotificationBatchProcessor` logs for batch processing