import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Tweet } from '@app/database/schemas/tweet';
import OpenAI from 'openai';

interface AIAnalysisResponse {
  isTradeRelated: boolean;
  type?: 'long' | 'short';
  entry?: number;
  takeProfit?: number;
  stopLoss?: number;
  timeframe?: {
    type: 'short' | 'medium' | 'long';
    duration: {
      value: number;
      unit: 'hour' | 'day' | 'week';
    };
  };
  confidence?: number;
  reasoning?: string;
}

@Injectable()
export class IndicatorService implements OnModuleInit {
  private readonly logger = new Logger(IndicatorService.name);
  private isProcessing = false;
  private lastProcessedAt: Date = null;
  private readonly openai: OpenAI;
  private bitcoinPrice: string = '94000';

  constructor(
    @InjectModel(Tweet.name) private tweetModel: Model<Tweet>,
    private readonly configService: ConfigService,
  ) {
    this.openai = new OpenAI({
      apiKey: this.configService.get('openai.apiKey'),
    });
  }

  async onModuleInit() {
    this.startContinuousProcessing();
  }

  private async startContinuousProcessing() {
    while (true) {
      if (!this.isProcessing) {
        try {
          this.isProcessing = true;
          await this.processTweets();
          this.lastProcessedAt = new Date();
        } catch (error) {
          this.logger.error('Error in continuous processing:', error);
        } finally {
          this.isProcessing = false;
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 5 * 60 * 1000)); // 5 minutes
    }
  }

  private async processTweets() {
    const startTime = Date.now();
    let processedCount = 0;
    let successCount = 0;

    this.logger.log('Starting tweet analysis process');

    // Get all non-indicated tweets first
    const tweets = await this.tweetModel
      .find({
        isIndicated: { $ne: true },
        indicator: { $exists: false },
      })
      .sort({ 'tweetDetail.tweetCreatedAt': -1 })
      .limit(20);

    if (tweets.length === 0) {
      this.logger.log('No new tweets to process');
      return;
    }

    this.logger.log(`Found ${tweets.length} non-indicated tweets`);

    const bitcoinPrice = await this._getBitCoinPrice();
    if (bitcoinPrice) {
      this.bitcoinPrice = bitcoinPrice;
    }

    const bitcoinKeywords = ['btc', 'bitcoin'];

    for (const tweet of tweets) {
      try {
        processedCount++;

        const isTextRelevant = bitcoinKeywords.some((keyword) =>
          tweet.tweetDetail.fullText.toLowerCase().includes(keyword),
        );

        if (
          !isTextRelevant ||
          tweet?.tweetDetail?.entities?.media?.length === 0
        ) {
          await this.tweetModel.updateOne(
            { _id: tweet._id },
            { $set: { isIndicated: true } },
          );
          this.logger.log(
            `Tweet ${tweet.tweetDetail.id} is not bitcoin related`,
          );
        } else {
          const analysis = await this._analyzeWithAI(
            tweet.tweetDetail.fullText,
            tweet,
          );

          if (
            analysis.isTradeRelated &&
            analysis.confidence >= 0.7 &&
            !!analysis.type &&
            !!analysis.entry &&
            !!analysis.takeProfit &&
            !!analysis.stopLoss
          ) {
            const indicatorData = {
              type: analysis.type,
              entry: analysis.entry,
              target: analysis.takeProfit,
              stopLoss: analysis.stopLoss,
              indicatedAt: new Date(),
              timeframe: analysis.timeframe
                ? {
                    type: analysis.timeframe.type,
                    duration: {
                      value: analysis.timeframe.duration.value,
                      unit: analysis.timeframe.duration.unit,
                    },
                  }
                : undefined,
              confidence: analysis.confidence,
              reasoning: analysis.reasoning,
            };

            this.logger.log('Saving indicator data:', indicatorData);

            await this.tweetModel.updateOne(
              { _id: tweet._id },
              {
                $set: {
                  isIndicated: true,
                  indicator: indicatorData,
                },
              },
            );
            successCount++;
            this.logger.log(
              `Successfully analyzed and updated tweet ${tweet.tweetDetail.id}`,
            );
          } else {
            await this.tweetModel.updateOne(
              { _id: tweet._id },
              { $set: { isIndicated: true } },
            );
            this.logger.log(
              `Tweet ${tweet.tweetDetail.id} is not a valid trading signal`,
            );
          }
        }
      } catch (error) {
        this.logger.error(
          `Error processing tweet ${tweet.tweetDetail.id}:`,
          error,
        );
      }
    }

    const duration = Date.now() - startTime;
    this.logger.log(`
      Processing completed:
      - Duration: ${duration}ms
      - Total non-indicated tweets: ${tweets.length}
      - Processed: ${processedCount}
      - Successful signals: ${successCount}
      - Average time per tweet: ${processedCount ? duration / processedCount : 0}ms
    `);
  }

  private async _analyzeWithAI(
    tweetText: string,
    tweet: Tweet,
    retries = 3,
  ): Promise<AIAnalysisResponse> {
    try {
      const messages: any[] = [
        {
          role: 'system',
          content:
            'You are a cryptocurrency trading analyst specializing in Bitcoin price analysis. Your task is to identify valid Bitcoin price trading signals from tweets and images. Current Bitcoin price is ' +
            this.bitcoinPrice +
            ' USDT.',
        },
        {
          role: 'user',
          content: `Analyze this tweet for Bitcoin price trading signals. The current Bitcoin price is ${this.bitcoinPrice} USDT.

Important validation rules:
1. Only return isTradeRelated=true if the tweet contains specific Bitcoin PRICE analysis or trading signals
2. Use the current Bitcoin price (${this.bitcoinPrice} USDT) to validate if the chart or analysis is about Bitcoin
3. Ignore signals about other cryptocurrencies or non-price Bitcoin metrics (like hash rate, difficulty, etc.)
4. For images, only consider price charts that clearly show Bitcoin price movements
5. The confidence should reflect:
   - How clear the price signal is
   - How close the chart price range is to current Bitcoin price
   - How specific the analysis is about entry/target/stop levels

Tweet: "${tweetText}"

Return ONLY a JSON object with the following structure:
{
  "isTradeRelated": boolean,
  "type": "long" | "short" | null,
  "entry": number | null,
  "takeProfit": number | null,
  "stopLoss": number | null,
  "timeframe": {
    "type": "short" | "medium" | "long",
    "duration": {
      "value": number,
      "unit": "hour" | "day" | "week"
    }
  } | null,
  "confidence": number (0-1),
  "reasoning": string
}

Example valid response:
{
  "isTradeRelated": true,
  "type": "long",
  "entry": 93500,
  "takeProfit": 95000,
  "stopLoss": 92000,
  "timeframe": {
    "type": "medium",
    "duration": {
      "value": 2,
      "unit": "day"
    }
  },
  "confidence": 0.85,
  "reasoning": "Clear Bitcoin price chart with current price zone around ${this.bitcoinPrice}. Shows strong support at 93.5k with RSI divergence. Entry and risk levels are well-defined with good risk/reward ratio."
}

Example invalid responses that should return isTradeRelated=false:
1. "Just bought some Bitcoin!" (no specific price levels)
2. "Bitcoin hash rate reaching new highs" (not price related)
3. "ETH looking bullish" (not Bitcoin)
4. Price chart showing values very different from current Bitcoin price (likely old chart or different asset)
5. Charts or metrics not related to price

IMPORTANT: Return ONLY the JSON object, no additional text.`,
        },
      ];

      // Add images if present
      if (tweet.tweetDetail.entities?.media?.length > 0) {
        for (const media of tweet.tweetDetail.entities.media) {
          if (media.mediaUrlHttps) {
            messages.push({
              role: 'user',
              content: [
                {
                  type: 'image_url',
                  image_url: {
                    url: media.mediaUrlHttps,
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
        max_tokens: 1000,
        response_format: { type: 'json_object' },
      });

      return JSON.parse(response.choices[0].message.content);
    } catch (error) {
      if (retries > 0) {
        this.logger.warn(`Retrying AI analysis, ${retries} attempts remaining`);
        await new Promise((resolve) => setTimeout(resolve, 1000));
        return this._analyzeWithAI(tweetText, tweet, retries - 1);
      }
      throw error;
    }
  }

  private async _getBitCoinPrice(): Promise<string> {
    try {
      const response = await fetch(
        'https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT',
      );
      const data = await response.json();
      // Format price to always show full number
      return Number(data.price).toFixed(0);
    } catch (error) {
      this.logger.error('Error getting Bitcoin price:', error);
      return '';
    }
  }
}
