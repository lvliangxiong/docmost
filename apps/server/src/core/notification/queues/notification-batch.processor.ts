import { Processor } from '@nestjs/bullmq';
import { WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { NotificationBatchingService } from '../services/notification-batching.service';

@Processor('notification-batch')
export class NotificationBatchProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationBatchProcessor.name);

  constructor(private readonly batchingService: NotificationBatchingService) {
    super();
  }

  async process(job: Job<any, any, string>) {
    if (job.name === 'process-batch') {
      return this.processBatch(job);
    } else if (job.name === 'check-pending-batches') {
      return this.checkPendingBatches(job);
    }
  }

  async processBatch(job: Job<{ batchId: string }>) {
    this.logger.debug(`Processing notification batch: ${job.data.batchId}`);

    try {
      await this.batchingService.processBatch(job.data.batchId);
      return { success: true, batchId: job.data.batchId };
    } catch (error) {
      this.logger.error(
        `Failed to process batch ${job.data.batchId}:`,
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }

  async checkPendingBatches(job: Job) {
    this.logger.debug('Checking for pending notification batches');

    try {
      const pendingBatches = await this.batchingService.getPendingBatches();

      for (const batch of pendingBatches) {
        // Calculate delay
        const delay = Math.max(0, batch.scheduled_for.getTime() - Date.now());

        // Add to queue with appropriate delay
        await this.queue.add('process-batch', { batchId: batch.id }, { delay });

        this.logger.debug(
          `Scheduled batch ${batch.id} for processing in ${delay}ms`,
        );
      }

      return { processedCount: pendingBatches.length };
    } catch (error) {
      this.logger.error(
        'Failed to check pending batches:',
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }

  // Reference to the queue (injected by Bull)
  private get queue() {
    return (this as any).queue;
  }
}
