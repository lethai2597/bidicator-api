import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { IndicatorScores, IndicatorWithTweet } from './app.service';

interface DayScore {
  date: string;
  upScore: number;
  downScore: number;
}

interface IndicatorResponse {
  today: DayScore;
  tomorrow: DayScore;
  dayAfterTomorrow: DayScore;
}

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getIndicator(): Promise<IndicatorScores> {
    return this.appService.getIndicator();
  }

  @Get('recent-indicators')
  getRecentIndicators(): Promise<IndicatorWithTweet[]> {
    return this.appService.getRecentIndicators();
  }
}
