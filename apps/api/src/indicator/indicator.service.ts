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
  private readonly openai: OpenAI;
  private bitcoinPrice: string = '94000';
  private readonly telegramBotToken: string;
  private readonly telegramChatId: string;

  constructor(
    @InjectModel(Tweet.name) private tweetModel: Model<Tweet>,
    private readonly configService: ConfigService,
  ) {
    this.openai = new OpenAI({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: this.configService.get('openrouter.apiKey'),
    });

    this.telegramBotToken = this.configService.get<string>('telegram.botToken');
    this.telegramChatId = this.configService.get<string>('telegram.chatId');

    if (!this.telegramBotToken || !this.telegramChatId) {
      this.logger.error('Telegram configuration is missing:', {
        botToken: this.telegramBotToken ? 'Set' : 'Missing',
        chatId: this.telegramChatId ? 'Set' : 'Missing',
      });
    }
  }

  async onModuleInit() {
    this.startContinuousProcessing();
  }

  private async startContinuousProcessing() {
    while (true) {
      try {
        await this.processTweets();
      } catch (error) {
        this.logger.error('Error in continuous processing:', error);
      }
      
      await new Promise((resolve) => setTimeout(resolve, 5 * 60 * 1000));
    }
  }

  private async processTweets() {
    const startTime = Date.now();
    let processedCount = 0;
    let successCount = 0;

    this.logger.log('Starting tweet analysis process');

    const tweets = await this.tweetModel
      .find({
        isIndicated: { $ne: true },
        indicator: { $exists: false },
      })
      .sort({ 'tweetDetail.tweetCreatedAt': -1 })
      .limit(100);

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

          if (!analysis) {
            continue;
          }

          if (analysis.isTradeRelated) {
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

            void this.sendTelegramNotification(tweet, analysis);

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
`,
        },
      ];

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
        model: 'openai/gpt-4o-mini',
        messages,
        temperature: 0,
        max_tokens: 1000,
        tools: [
          {
            type: 'function',
            function: {
              name: 'analysis',
              description: 'Analyze Bitcoin trading signals from tweet',
              parameters: {
                type: 'object',
                properties: {
                  isTradeRelated: {
                    type: 'boolean',
                    description:
                      'Whether the tweet contains specific Bitcoin price analysis or trading signals',
                  },
                  type: {
                    type: 'string',
                    enum: ['long', 'short', null],
                    description: 'The type of trading signal',
                  },
                  entry: {
                    type: 'number',
                    description: 'The entry price for the trading signal',
                    nullable: true,
                  },
                  takeProfit: {
                    type: 'number',
                    description: 'The take profit price for the trading signal',
                    nullable: true,
                  },
                  stopLoss: {
                    type: 'number',
                    description: 'The stop loss price for the trading signal',
                    nullable: true,
                  },
                  timeframe: {
                    type: 'object',
                    nullable: true,
                    properties: {
                      type: {
                        type: 'string',
                        enum: ['short', 'medium', 'long'],
                        description: 'The timeframe type',
                      },
                      duration: {
                        type: 'object',
                        required: ['value', 'unit'],
                        properties: {
                          value: {
                            type: 'number',
                            description: 'The duration value',
                          },
                          unit: {
                            type: 'string',
                            enum: ['hour', 'day', 'week'],
                            description: 'The duration unit',
                          },
                        },
                      },
                    },
                    required: ['type', 'duration'],
                  },
                  confidence: {
                    type: 'number',
                    minimum: 0,
                    maximum: 1,
                    description:
                      'The confidence level of the trading signal (0-1)',
                  },
                  reasoning: {
                    type: 'string',
                    description: 'The reasoning behind the trading signal',
                  },
                },
                required: ['isTradeRelated', 'confidence', 'reasoning'],
              },
            },
          },
        ],
        tool_choice: {
          type: 'function',
          function: { name: 'analysis' },
        },
      });

      if (
        !response?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments
      ) {
        return null;
      }

      try {
        const analysis = JSON.parse(
          response.choices[0].message.tool_calls[0].function.arguments,
        );

        if (
          !analysis.isTradeRelated ||
          analysis.confidence < 0.7 ||
          !analysis.type ||
          !analysis.entry ||
          !analysis.takeProfit ||
          !analysis.stopLoss
        ) {
          return {
            isTradeRelated: false,
          };
        }

        return analysis;
      } catch (error) {
        this.logger.error('Failed to parse AI response:', {
          response: response.choices[0].message,
          error,
        });
        return null;
      }
    } catch (error) {
      if (retries > 0) {
        this.logger.warn(`Retrying AI analysis, ${retries} attempts remaining`);
        await new Promise((resolve) => setTimeout(resolve, 1000));
        return this._analyzeWithAI(tweetText, tweet, retries - 1);
      }
      return null;
    }
  }

  private async _getBitCoinPrice(): Promise<string> {
    try {
      const response = await fetch(
        'https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT',
      );
      const data = await response.json();
      return Number(data.price).toFixed(0);
    } catch (error) {
      this.logger.error('Error getting Bitcoin price:', error);
      return '';
    }
  }

  private async sendTelegramNotification(
    tweet: Tweet,
    analysis: AIAnalysisResponse,
  ) {
    if (!this.telegramBotToken || !this.telegramChatId) {
      this.logger.warn('Telegram bot token or chat ID not configured');
      return;
    }

    try {
      const formatPrice = (price: number) =>
        price?.toLocaleString('en-US') || 'N/A';

      const message = `🚨 <b>New Trading Signal</b>

<b>Type:</b> ${analysis.type?.toUpperCase() || 'N/A'} 
<b>Entry:</b> $${formatPrice(analysis.entry)}
<b>Target:</b> $${formatPrice(analysis.takeProfit)}
<b>Stop Loss:</b> $${formatPrice(analysis.stopLoss)}
<b>Timeframe:</b> ${analysis.timeframe ? `${analysis.timeframe.duration.value} ${analysis.timeframe.duration.unit}(s)` : 'N/A'}
<b>Confidence:</b> ${(analysis.confidence * 100).toFixed(1)}%

🔗 <a href="https://bidicator.online">View Detail</a>
`;

      const url = `https://api.telegram.org/bot${this.telegramBotToken}/sendMessage`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: this.telegramChatId,
          text: message,
          parse_mode: 'HTML',
          disable_web_page_preview: false,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Telegram API error: ${error}`);
      }
    } catch (error) {
      this.logger.error('Error sending Telegram notification:', error);
    }
  }
}
