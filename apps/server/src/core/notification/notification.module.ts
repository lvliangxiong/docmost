import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { NotificationService } from './services/notification.service';
import { NotificationPreferenceService } from './services/notification-preference.service';
import { NotificationDeduplicationService } from './services/notification-deduplication.service';
import { NotificationDeliveryService } from './services/notification-delivery.service';
import { NotificationBatchingService } from './services/notification-batching.service';
import { NotificationAggregationService } from './services/notification-aggregation.service';
import { NotificationController } from './controllers/notification.controller';
import { NotificationBatchProcessor } from './queues/notification-batch.processor';
import { WsModule } from '../../ws/ws.module';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'notification-batch',
    }),
    WsModule,
  ],
  controllers: [NotificationController],
  providers: [
    NotificationService,
    NotificationPreferenceService,
    NotificationDeduplicationService,
    NotificationDeliveryService,
    NotificationBatchingService,
    NotificationAggregationService,
    NotificationBatchProcessor,
  ],
  exports: [NotificationService, NotificationPreferenceService],
})
export class NotificationModule {}
