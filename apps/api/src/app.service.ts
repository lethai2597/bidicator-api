import { Indicator } from '@app/database/schemas/indicator';
import { Tweet } from '@app/database/schemas/tweet';
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { addDays, differenceInDays } from 'date-fns';

interface InternalDayScore {
  date: Date;
  upScore: number;
  downScore: number;
}

export interface DayScore {
  date: string;
  upPercentage: number;
  downPercentage: number;
}

interface InternalScores {
  today: InternalDayScore;
  tomorrow: InternalDayScore;
  dayAfterTomorrow: InternalDayScore;
}

export interface IndicatorScores {
  today: DayScore;
  tomorrow: DayScore;
  dayAfterTomorrow: DayScore;
}

interface TweetDetail {
  id: string;
  fullText: string;
  tweetCreatedAt: Date;
  user: {
    id: string;
    name: string;
    profileImageUrlHttps: string;
    screenName: string;
  };
  entities?: {
    media: { mediaUrlHttps: string }[];
  };
}

export interface IndicatorWithTweet {
  _id: string;
  tweetId: string;
  userId: string;
  trend: 'up' | 'down';
  score: number;
  indicateFor: string;
  createdAt: string;
  tweetDetail: TweetDetail;
}

@Injectable()
export class AppService {
  private readonly logger = new Logger(AppService.name);

  constructor(
    @InjectModel(Indicator.name) private indicatorModel: Model<Indicator>,
    @InjectModel(Tweet.name) private tweetModel: Model<Tweet>,
  ) {}

  async getIndicator(): Promise<IndicatorScores> {
    const now = new Date();
    const todayUtc = new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
        0,
        0,
        0,
        0,
      ),
    );

    const dates = Array.from({ length: 3 }, (_, i) => addDays(todayUtc, i));

    const indicators = await this.indicatorModel
      .find({
        indicateFor: {
          $gte: dates[0].toISOString(),
          $lte: dates[2].toISOString(),
        },
      })
      .sort({ createdAt: 1 });

    const scores: InternalScores = {
      today: {
        date: dates[0],
        upScore: 0,
        downScore: 0,
      },
      tomorrow: {
        date: dates[1],
        upScore: 0,
        downScore: 0,
      },
      dayAfterTomorrow: {
        date: dates[2],
        upScore: 0,
        downScore: 0,
      },
    };

    indicators.forEach((indicator) => {
      let targetDay: keyof IndicatorScores;
      const indicateForDate = new Date(indicator.indicateFor);
      const createdAt = new Date(indicator.createdAt);

      const indicateForDateStr = indicateForDate.toISOString().split('T')[0];
      for (let i = 0; i < dates.length; i++) {
        if (indicateForDateStr === dates[i].toISOString().split('T')[0]) {
          targetDay = ['today', 'tomorrow', 'dayAfterTomorrow'][
            i
          ] as keyof IndicatorScores;
          break;
        }
      }

      if (!targetDay) {
        this.logger.debug('No matching day found for indicator:', {
          indicateFor: indicateForDateStr,
          searchDates: dates.map((d) => d.toISOString().split('T')[0]),
        });
        return;
      }

      const createdAtDate = createdAt.toISOString().split('T')[0];
      const todayDate = new Date(todayUtc).toISOString().split('T')[0];

      const date1 = new Date(createdAtDate);
      const date2 = new Date(todayDate);
      const daysOld = Math.floor(
        (date2.getTime() - date1.getTime()) / (1000 * 60 * 60 * 24),
      );

      let weight = 1;
      if (daysOld >= 3) {
        weight = 1 / 3;
      } else if (daysOld === 2) {
        weight = 2 / 3;
      }

      const weightedScore = (indicator.score || 0) * weight;

      if (indicator.trend === 'up') {
        scores[targetDay].upScore += weightedScore;
      } else if (indicator.trend === 'down') {
        scores[targetDay].downScore += weightedScore;
      }
    });

    const result = {
      today: {
        date: scores.today.date.toISOString().split('T')[0],
        upPercentage: 0,
        downPercentage: 0,
      },
      tomorrow: {
        date: scores.tomorrow.date.toISOString().split('T')[0],
        upPercentage: 0,
        downPercentage: 0,
      },
      dayAfterTomorrow: {
        date: scores.dayAfterTomorrow.date.toISOString().split('T')[0],
        upPercentage: 0,
        downPercentage: 0,
      },
    };

    ['today', 'tomorrow', 'dayAfterTomorrow'].forEach((day) => {
      const totalScore = scores[day].upScore + scores[day].downScore;
      if (totalScore > 0) {
        let upPercentage = Number(
          ((scores[day].upScore / totalScore) * 100).toFixed(2),
        );
        let downPercentage = Number(
          ((scores[day].downScore / totalScore) * 100).toFixed(2),
        );

        const total = upPercentage + downPercentage;
        if (total !== 100) {
          const diff = 100 - total;
          if (scores[day].upScore >= scores[day].downScore) {
            upPercentage += diff;
          } else {
            downPercentage += diff;
          }
        }

        result[day].upPercentage = upPercentage;
        result[day].downPercentage = downPercentage;
      }
    });

    return result;
  }

  async getRecentIndicators(): Promise<IndicatorWithTweet[]> {
    const now = new Date();
    const todayUtc = new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
        0,
        0,
        0,
        0,
      ),
    );
    const tomorrowUtc = new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate() + 1,
        0,
        0,
        0,
        0,
      ),
    );

    const indicators = await this.indicatorModel.aggregate([
      {
        $match: {
          indicateFor: {
            $gte: todayUtc,
            $lt: tomorrowUtc,
          },
        },
      },
      {
        $lookup: {
          from: 'tweets',
          localField: 'tweetId',
          foreignField: 'tweetDetail.id',
          as: 'tweet',
        },
      },
      {
        $unwind: '$tweet',
      },
      {
        $sort: {
          'tweet.tweetDetail.tweetCreatedAt': -1,
        },
      },
      {
        $limit: 30,
      },
      {
        $project: {
          _id: 1,
          tweetId: 1,
          userId: 1,
          trend: 1,
          score: 1,
          indicateFor: 1,
          createdAt: 1,
          tweetDetail: '$tweet.tweetDetail',
        },
      },
    ]);

    return indicators.map((indicator) => ({
      ...indicator,
      indicateFor: new Date(indicator.indicateFor).toISOString(),
      createdAt: new Date(indicator.createdAt).toISOString(),
    }));
  }
}
