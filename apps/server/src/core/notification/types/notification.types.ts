export enum NotificationType {
  // Mentions
  MENTION_IN_PAGE = 'mention_in_page',
  MENTION_IN_COMMENT = 'mention_in_comment',
  
  // Comments
  COMMENT_ON_PAGE = 'comment_on_page',
  REPLY_TO_COMMENT = 'reply_to_comment',
  COMMENT_IN_THREAD = 'comment_in_thread',
  COMMENT_RESOLVED = 'comment_resolved',
  
  // Exports
  EXPORT_COMPLETED = 'export_completed',
  EXPORT_FAILED = 'export_failed',
  
  // Pages
  PAGE_SHARED = 'page_shared',
  PAGE_UPDATED = 'page_updated',
  
  // Tasks (Future)
  TASK_ASSIGNED = 'task_assigned',
  TASK_DUE = 'task_due',
  TASK_COMPLETED = 'task_completed',
  
  // System
  SYSTEM_UPDATE = 'system_update',
  SYSTEM_ANNOUNCEMENT = 'system_announcement',
}

export enum NotificationStatus {
  UNREAD = 'unread',
  READ = 'read',
  ARCHIVED = 'archived',
}

export enum NotificationPriority {
  HIGH = 'high',
  NORMAL = 'normal',
  LOW = 'low',
}

export enum EmailFrequency {
  INSTANT = 'instant',
  SMART = 'smart',
  DIGEST_DAILY = 'digest_daily',
  DIGEST_WEEKLY = 'digest_weekly',
}

export interface NotificationTypeSettings {
  email: boolean;
  in_app: boolean;
  batch: boolean;
}

export enum BatchType {
  SIMILAR_ACTIVITY = 'similar_activity',
  DIGEST = 'digest',
  GROUPED_MENTIONS = 'grouped_mentions',
}

export enum AggregationType {
  COMMENTS_ON_PAGE = 'comments_on_page',
  MENTIONS_IN_PAGE = 'mentions_in_page',
  MENTIONS_IN_COMMENTS = 'mentions_in_comments',
  THREAD_ACTIVITY = 'thread_activity',
}

export interface AggregationSummaryData {
  total_count: number;
  actor_count: number;
  first_actor_id: string;
  recent_actors: string[];
  time_span: {
    start: Date;
    end: Date;
  };
  [key: string]: any; // Allow additional type-specific data
}

export interface AggregatedNotificationMessage {
  id: string;
  title: string;
  message: string;
  actors: Array<{
    id: string;
    name: string;
    avatarUrl?: string;
  }>;
  totalCount: number;
  entityId: string;
  entityType: string;
  createdAt: Date;
  updatedAt: Date;
}

// Context interfaces for different notification types
export interface MentionInPageContext {
  pageId: string;
  pageTitle: string;
  mentionContext: string;
  mentionBy: string;
}

export interface MentionInCommentContext {
  pageId: string;
  pageTitle: string;
  commentId: string;
  commentText: string;
  mentionBy: string;
}

export interface CommentOnPageContext {
  pageId: string;
  pageTitle: string;
  commentId: string;
  commentText: string;
  commentBy: string;
}

export interface ReplyToCommentContext {
  pageId: string;
  pageTitle: string;
  commentId: string;
  parentCommentId: string;
  commentText: string;
  replyBy: string;
}

export interface CommentInThreadContext {
  pageId: string;
  pageTitle: string;
  threadId: string;
  commentId: string;
  commentText: string;
  commentBy: string;
}

export interface CommentResolvedContext {
  pageId: string;
  pageTitle: string;
  threadId: string;
  resolvedBy: string;
}

export interface ExportCompletedContext {
  exportId: string;
  exportType: string;
  downloadUrl: string;
  expiresAt: string;
}

export interface ExportFailedContext {
  exportId: string;
  exportType: string;
  errorMessage: string;
}

export interface PageSharedContext {
  pageId: string;
  pageTitle: string;
  sharedBy: string;
  sharedWith: string[];
  permissions: string[];
}

export interface PageUpdatedContext {
  pageId: string;
  pageTitle: string;
  updatedBy: string;
  changeType: 'content' | 'title' | 'permissions';
}

export interface TaskAssignedContext {
  taskId: string;
  taskTitle: string;
  assignedBy: string;
  dueDate?: string;
}

export interface TaskDueContext {
  taskId: string;
  taskTitle: string;
  dueDate: string;
  daysOverdue?: number;
}

export interface TaskCompletedContext {
  taskId: string;
  taskTitle: string;
  completedBy: string;
}

export interface SystemUpdateContext {
  updateType: string;
  version?: string;
  description: string;
}

export interface SystemAnnouncementContext {
  message: string;
  link?: string;
}

export type NotificationContext = 
  | MentionInPageContext
  | MentionInCommentContext
  | CommentOnPageContext
  | ReplyToCommentContext
  | CommentInThreadContext
  | CommentResolvedContext
  | ExportCompletedContext
  | ExportFailedContext
  | PageSharedContext
  | PageUpdatedContext
  | TaskAssignedContext
  | TaskDueContext
  | TaskCompletedContext
  | SystemUpdateContext
  | SystemAnnouncementContext
  | Record<string, unknown>;