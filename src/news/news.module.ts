import { Module } from '@nestjs/common';
import { PipelineModule } from '../pipeline/pipeline.module';
import { NewsController } from './news.controller';

@Module({
  imports: [PipelineModule],
  controllers: [NewsController],
})
export class NewsModule {}
