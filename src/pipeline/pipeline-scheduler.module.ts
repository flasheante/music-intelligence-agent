import { Module } from '@nestjs/common';
import { QueuesModule } from '../queues/queues.module';
import { PipelineModule } from './pipeline.module';
import { PipelineProcessor, PipelineScheduler } from './pipeline.scheduler';

/** Worker + repeat schedule. Left out of CLI runs so they exit when done. */
@Module({
  imports: [QueuesModule, PipelineModule],
  providers: [PipelineProcessor, PipelineScheduler],
})
export class PipelineSchedulerModule {}
