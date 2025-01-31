import { Module } from '@nestjs/common';
import { TwitterCrawlerService } from './twitter-crawler.service';
import { DatabaseModule } from '@app/database';

@Module({
  imports: [DatabaseModule],
  providers: [TwitterCrawlerService],
})
export class TwitterCrawlerModule {}
