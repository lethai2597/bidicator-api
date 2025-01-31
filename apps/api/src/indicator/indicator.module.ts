import { Module } from '@nestjs/common';
import { IndicatorService } from './indicator.service';
import { DatabaseModule } from '@app/database';

@Module({
  imports: [DatabaseModule],
  providers: [IndicatorService],
})
export class IndicatorModule {}
