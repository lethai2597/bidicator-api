import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TwitterCrawlerModule } from './twitter-crawler/twitter-crawler.module';
import { ConfigModule } from '@nestjs/config';
import { configurations } from '@app/common/config/configuration';
import { IndicatorModule } from './indicator/indicator.module';
import { DatabaseModule } from '@app/database';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [
    ConfigModule.forRoot({
      load: [configurations],
      isGlobal: true,
    }),
    ScheduleModule.forRoot(),
    DatabaseModule,
    TwitterCrawlerModule,
    IndicatorModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
