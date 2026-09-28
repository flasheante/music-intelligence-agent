import { Module } from '@nestjs/common';
import {
  CollectorService,
  defaultSourceAdapters,
  SOURCE_ADAPTERS,
} from '../sources/collector.service';
import { PipelineService } from './pipeline.service';

@Module({
  providers: [
    { provide: SOURCE_ADAPTERS, useFactory: defaultSourceAdapters },
    CollectorService,
    PipelineService,
  ],
  exports: [PipelineService],
})
export class PipelineModule {}
