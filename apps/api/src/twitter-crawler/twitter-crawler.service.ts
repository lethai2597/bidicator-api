import { TWITTER_KOLS } from '@app/common/config/twitter-kols';
import { Tweet } from '@app/database/schemas/tweet';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import axios from 'axios';
import { SocialDataTweet } from './types/social-data';
import { Cron } from '@nestjs/schedule';

@Injectable()
export class TwitterCrawlerService {
  private readonly logger = new Logger(TwitterCrawlerService.name);

  constructor(
    private configService: ConfigService,
    @InjectModel(Tweet.name) private tweetModel: Model<Tweet>,
  ) {}

  @Cron('0 0 * * *', {
    timeZone: 'UTC',
  })
  async crawlTweets() {
    this.logger.log('Starting daily tweet crawl at UTC midnight');
    try {
      for (const kol of TWITTER_KOLS) {
        const tweetsResponse = await this._getSocialData(kol.id);

        const newTweetsBulk = [];

        for (const tweetItem of tweetsResponse) {
          const tweetDate = new Date(tweetItem.tweet_created_at);

          const uniqueMediaUrls = tweetItem?.entities?.media
            ? [
                ...new Set(
                  tweetItem.entities.media.map((m) => m.media_url_https),
                ),
              ]
                .filter((url) => url)
                .map((url) => ({ mediaUrlHttps: url }))
            : [];

          newTweetsBulk.push({
            updateOne: {
              filter: { 'tweetDetail.id': tweetItem?.id_str },
              update: {
                $set: {
                  tweetDetail: {
                    id: tweetItem?.id_str,
                    fullText: tweetItem?.full_text,
                    tweetCreatedAt: tweetDate,
                    user: {
                      id: tweetItem?.user?.id_str,
                      name: tweetItem?.user?.name,
                      profileImageUrlHttps:
                        tweetItem?.user?.profile_image_url_https,
                      screenName: tweetItem?.user?.screen_name,
                    },
                    entities: {
                      media: uniqueMediaUrls,
                    },
                  },
                  isIndicated: false,
                },
              },
              upsert: true,
            },
          });
        }

        if (newTweetsBulk.length > 0) {
          await this.tweetModel.bulkWrite(newTweetsBulk);
          this.logger.log(
            `${kol.username}: ${newTweetsBulk.length} new tweets saved to database`,
          );
        } else {
          this.logger.log(`${kol.username}: No new tweets to save`);
        }
      }

      this.logger.log('Daily tweet crawl completed');
    } catch (error) {
      this.logger.error('Error crawling tweets: ', error);
    }
  }

  private async _getSocialData(userId: string): Promise<SocialDataTweet[]> {
    return axios
      .get(`https://api.socialdata.tools/twitter/user/${userId}/tweets`, {
        headers: {
          Authorization: `Bearer ${this.configService.get('twitterCrawler.socialDataToken')}`,
        },
      })
      .then((response) => response.data.tweets);
  }
}
