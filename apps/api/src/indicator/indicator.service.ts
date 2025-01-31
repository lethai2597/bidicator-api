import { Tweet } from '@app/database/schemas/tweet';
import { Indicator, IndicatorTrend } from '@app/database/schemas/indicator';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import OpenAI from 'openai';
import { getTwitterScoreByKolId } from '@app/common/config/twitter-kols';
import { Cron } from '@nestjs/schedule';

interface AIIndicatorResponse {
  isRelevant: boolean;
  predictions: {
    date: string;
    trend: IndicatorTrend | null;
  }[];
}

@Injectable()
export class IndicatorService {
  private readonly logger = new Logger(IndicatorService.name);
  private readonly openai: OpenAI;

  constructor(
    @InjectModel(Tweet.name) private tweetModel: Model<Tweet>,
    @InjectModel(Indicator.name) private indicatorModel: Model<Indicator>,
    private readonly configService: ConfigService,
  ) {
    this.openai = new OpenAI({
      apiKey: this.configService.get('openai.apiKey'),
    });
  }

  @Cron('0 1 * * *', {
    timeZone: 'UTC',
  })
  async indicateTweets() {
    this.logger.log('Starting tweet indication');

    // Get yesterday's start in UTC
    const now = new Date();
    const yesterdayStartUtc = new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate() - 1,
        0,
        0,
        0,
        0,
      ),
    );

    this.logger.log('Fetching tweets from:', {
      start: yesterdayStartUtc.toISOString(),
      end: now.toISOString(),
    });

    const tweets = await this.tweetModel
      .find({
        isIndicated: { $ne: true },
        'tweetDetail.tweetCreatedAt': {
          $gte: yesterdayStartUtc,
          $lte: now,
        },
      })
      .sort({ 'tweetDetail.tweetCreatedAt': -1 })
      .limit(1000);

    this.logger.log(
      `Found ${tweets.length} tweets to indicate from ${yesterdayStartUtc.toISOString()} to ${now.toISOString()}`,
    );

    for (const tweet of tweets) {
      try {
        const tweetDate = new Date(tweet.tweetDetail.tweetCreatedAt);

        const nextThreeDays = Array.from({ length: 3 }, (_, i) => {
          const nextDate = new Date(
            Date.UTC(
              tweetDate.getUTCFullYear(),
              tweetDate.getUTCMonth(),
              tweetDate.getUTCDate() + i + 1,
              0,
              0,
              0,
              0,
            ),
          );
          return nextDate;
        });

        this.logger.log(
          `Processing tweet ${tweet.tweetDetail.id} for UTC dates: ${nextThreeDays.map((d) => d.toISOString()).join(', ')}`,
        );

        const aiResponse = await this._analyzeTweetWithAI(
          tweet.tweetDetail.fullText,
          tweet,
          nextThreeDays,
        );

        if (!aiResponse.isRelevant) {
          continue;
        }

        const score = getTwitterScoreByKolId(tweet.tweetDetail.user.id);

        for (const prediction of aiResponse.predictions) {
          if (!prediction.trend) {
            continue;
          }

          await this.indicatorModel.create({
            tweetId: tweet.tweetDetail.id,
            userId: tweet.tweetDetail.user.id,
            trend: prediction.trend,
            score,
            indicateFor: new Date(prediction.date),
            createdAt: new Date(),
          });
        }

        await this.tweetModel.findByIdAndUpdate(tweet._id, {
          isIndicated: true,
        });

        this.logger.log(`Completed processing tweet ${tweet.tweetDetail.id}`);
      } catch (error) {
        this.logger.error(
          `Error processing tweet ${tweet.tweetDetail.id}:`,
          error,
        );
      }
    }

    this.logger.log('Daily tweet indication completed');
  }

  private async _analyzeTweetWithAI(
    tweetText: string,
    tweet: Tweet,
    targetDates: Date[],
  ): Promise<AIIndicatorResponse> {
    const messages: any[] = [
      {
        role: 'system',
        content: `You are a cryptocurrency market analyst. This tweet was posted on ${tweet.tweetDetail.tweetCreatedAt.toISOString()}. 
        Analyze the given tweet content (text and images if any) and determine if it's relevant to Bitcoin price movement for the following dates:
        ${targetDates.map((d) => d.toISOString()).join('\n')}
        
        Look for price charts, technical analysis patterns, or any visual indicators that might suggest price movement.
        Consider the time difference between tweet date and target dates for your analysis.

        For each date, determine the trend:
        - "up": If you're confident the price will go up
        - "down": If you're confident the price will go down
        - null: If you're uncertain or the tweet doesn't provide enough information for that specific date

        IMPORTANT: Return ONLY a raw JSON object, no markdown, no code blocks, no additional text. The response must be parseable by JSON.parse().
        Example of valid response formats:

        Example 1 - Relevant tweet with mixed predictions:
        {
          "isRelevant": true,
          "predictions": [
            { "date": "2025-01-30", "trend": "up" },
            { "date": "2025-01-31", "trend": "down" },
            { "date": "2025-02-01", "trend": null }
          ]
        }

        Example 2 - Irrelevant tweet:
        {
          "isRelevant": false,
          "predictions": []
        }

        Set isRelevant to false if:
        - The tweet is not about Bitcoin price analysis
        - The tweet doesn't contain any meaningful price predictions
        - The tweet is just news or general discussion without price implications`,
      },
    ];

    messages.push({
      role: 'user',
      content: tweetText,
    });

    if (tweet.tweetDetail.entities?.media?.length > 0) {
      const imageUrls = tweet.tweetDetail.entities.media
        .map((m) => m.mediaUrlHttps)
        .filter((url) => url);

      if (imageUrls.length > 0) {
        for (const url of imageUrls) {
          messages.push({
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: {
                  url: url,
                },
              },
            ],
          });
        }
      }
    }

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o-mini-2024-07-18',
      messages,
      temperature: 0,
      max_tokens: 150,
      response_format: { type: 'json_object' }, // Force JSON response
    });

    try {
      // Clean the response content before parsing
      const cleanContent = response.choices[0].message.content
        .trim()
        .replace(/^```json\s*/, '') // Remove leading ```json
        .replace(/\s*```$/, ''); // Remove trailing ```

      const result = JSON.parse(cleanContent);
      return {
        isRelevant: result.isRelevant,
        predictions: result.predictions.map((p) => ({
          date: p.date,
          trend: p.trend,
        })),
      };
    } catch (error) {
      this.logger.error('Error parsing OpenAI response:', error);
      this.logger.error('Raw response:', response.choices[0].message.content);
      throw new Error('Failed to parse OpenAI response');
    }
  }
}
