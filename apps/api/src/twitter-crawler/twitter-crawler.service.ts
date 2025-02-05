import { TWITTER_KOLS, TwitterKol } from '@app/common/config/twitter-kols';
import { Tweet } from '@app/database/schemas/tweet';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

@Injectable()
export class TwitterCrawlerService {
  private readonly logger = new Logger(TwitterCrawlerService.name);
  private readonly BEARER_TOKEN: string;
  private readonly AUTH_TOKEN: string;
  private readonly CT0_TOKEN: string;
  private currentKolIndex = 0;

  constructor(
    @InjectModel(Tweet.name) private tweetModel: Model<Tweet>,
    private configService: ConfigService,
  ) {
    this.BEARER_TOKEN = this.configService.get<string>('twitter.bearerToken');
    this.AUTH_TOKEN = this.configService.get<string>('twitter.authToken');
    this.CT0_TOKEN = this.configService.get<string>('twitter.ct0Token');

    this.logger.log('Twitter tokens initialized from config');

    this.startCrawling();
  }

  private async startCrawling() {
    while (true) {
      try {
        const kol = TWITTER_KOLS[this.currentKolIndex];
        this.logger.log(`Starting tweet crawl for ${kol.screenName}`);

        await this.crawlTweetsForUser(kol);

        this.currentKolIndex++;
        if (this.currentKolIndex >= TWITTER_KOLS.length) {
          this.currentKolIndex = 0;
          this.logger.log(
            'Completed one full cycle of all users, starting over...',
          );
        }

        this.logger.log(`Waiting 3 minutes before crawling next user...`);
        await new Promise((resolve) => setTimeout(resolve, 3 * 60 * 1000));
      } catch (error) {
        this.logger.error('Error in crawl process:', error);
        await new Promise((resolve) => setTimeout(resolve, 3 * 60 * 1000));
      }
    }
  }

  private async crawlTweetsForUser(kol: TwitterKol) {
    const startTime = Date.now();
    try {
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const tweets = await this._crawlUserTweets(kol);

      this.logger.log(`Found ${tweets.length} tweets for ${kol.screenName}`);

      const newTweetsBulk = [];

      for (const tweet of tweets) {
        const tweetDate = new Date(tweet.tweetCreatedAt);
        if (tweetDate < twentyFourHoursAgo) {
          continue;
        }

        newTweetsBulk.push({
          updateOne: {
            filter: { 'tweetDetail.id': tweet.id },
            update: {
              $set: {
                tweetDetail: tweet,
              },
            },
            upsert: true,
          },
        });
      }

      if (newTweetsBulk.length > 0) {
        this.logger.log(
          `Attempting to save ${newTweetsBulk.length} tweets for ${kol.screenName}...`,
        );
        try {
          const bulkWriteResult =
            await this.tweetModel.bulkWrite(newTweetsBulk);
          this.logger.log(
            `${kol.screenName}: Bulk write result: Matched: ${bulkWriteResult.matchedCount}, Modified: ${bulkWriteResult.modifiedCount}, Inserted: ${bulkWriteResult.insertedCount}, Upserted: ${bulkWriteResult.upsertedCount}`,
          );
        } catch (error) {
          this.logger.error(`Error saving tweets to database:`, error);
          throw error;
        }
      } else {
        this.logger.log(`${kol.screenName}: No new tweets to save`);
      }

      // Clean up old tweets for this user
      const deleteResult = await this.tweetModel.deleteMany({
        'tweetDetail.user.id': kol.id,
        'tweetDetail.tweetCreatedAt': { $lt: twentyFourHoursAgo },
      });

      if (deleteResult.deletedCount > 0) {
        this.logger.log(
          `Cleaned up ${deleteResult.deletedCount} old tweets for ${kol.screenName}`,
        );
      }

      const duration = (Date.now() - startTime) / 1000;
      this.logger.log(
        `Crawl process for ${kol.screenName} completed in ${duration}s`,
      );
    } catch (error) {
      this.logger.error(`Error crawling tweets for ${kol.screenName}:`, error);
      throw error;
    }
  }

  private async _crawlUserTweets(kol: TwitterKol) {
    const url = 'https://api.x.com/graphql/Y9WM4Id6UcGFE8Z-hbnixw/UserTweets';

    try {
      const variables = {
        userId: kol.id,
        count: 5,
        includePromotedContent: false,
        withQuickPromoteEligibilityTweetFields: false,
        withVoice: false,
        withV2Timeline: true,
      };

      const features = {
        profile_label_improvements_pcf_label_in_post_enabled: true,
        rweb_tipjar_consumption_enabled: true,
        responsive_web_graphql_exclude_directive_enabled: true,
        verified_phone_label_enabled: false,
        creator_subscriptions_tweet_preview_api_enabled: true,
        responsive_web_graphql_timeline_navigation_enabled: true,
        responsive_web_graphql_skip_user_profile_image_extensions_enabled:
          false,
        premium_content_api_read_enabled: false,
        communities_web_enable_tweet_community_results_fetch: true,
        c9s_tweet_anatomy_moderator_badge_enabled: true,
        responsive_web_grok_analyze_button_fetch_trends_enabled: false,
        responsive_web_grok_analyze_post_followups_enabled: false,
        responsive_web_jetfuel_frame: false,
        responsive_web_grok_share_attachment_enabled: true,
        articles_preview_enabled: true,
        responsive_web_edit_tweet_api_enabled: true,
        graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
        view_counts_everywhere_api_enabled: true,
        longform_notetweets_consumption_enabled: true,
        responsive_web_twitter_article_tweet_consumption_enabled: true,
        tweet_awards_web_tipping_enabled: false,
        responsive_web_grok_analysis_button_from_backend: true,
        creator_subscriptions_quote_tweet_preview_enabled: false,
        freedom_of_speech_not_reach_fetch_enabled: true,
        standardized_nudges_misinfo: true,
        tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled:
          true,
        rweb_video_timestamps_enabled: true,
        longform_notetweets_rich_text_read_enabled: true,
        longform_notetweets_inline_media_enabled: true,
        responsive_web_grok_image_annotation_enabled: true,
        responsive_web_enhance_cards_enabled: false,
      };

      const params = new URLSearchParams({
        variables: JSON.stringify(variables),
        features: JSON.stringify(features),
        fieldToggles: JSON.stringify({ withArticlePlainText: false }),
      });

      // Make the request
      const response = await fetch(`${url}?${params.toString()}`, {
        headers: {
          accept: '*/*',
          'accept-language': 'en',
          authorization: `Bearer ${this.BEARER_TOKEN}`,
          'content-type': 'application/json',
          cookie: `auth_token=${this.AUTH_TOKEN}; ct0=${this.CT0_TOKEN}`,
          'x-csrf-token': this.CT0_TOKEN,
          'x-twitter-auth-type': 'OAuth2Session',
          origin: 'https://x.com',
          referer: 'https://x.com/',
          'sec-ch-ua':
            '"Not A(Brand";v="8", "Chromium";v="132", "Google Chrome";v="132"',
          'sec-ch-ua-mobile': '?0',
          'sec-ch-ua-platform': '"macOS"',
          'sec-fetch-dest': 'empty',
          'sec-fetch-mode': 'cors',
          'sec-fetch-site': 'same-site',
          'user-agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36',
          'x-twitter-active-user': 'yes',
          'x-twitter-client-language': 'en',
        },
      });

      if (!response.ok) {
        const responseText = await response.text();
        throw new Error(
          `HTTP error! status: ${response.status}, body: ${responseText}`,
        );
      }

      const data = await response.json();

      // Extract tweets from the response
      const tweets = this._extractTweetsFromResponse(data, kol);

      return tweets;
    } catch (error) {
      this.logger.error(`Error fetching tweets for ${kol.screenName}:`, error);
      return [];
    }
  }

  private _extractTweetsFromResponse(data: any, kol: TwitterKol) {
    try {
      const tweets = [];
      const instructions =
        data?.data?.user?.result?.timeline_v2?.timeline?.instructions || [];

      for (const instruction of instructions) {
        if (
          instruction.type === 'TimelinePinEntry' ||
          instruction.type === 'TimelineAddEntries'
        ) {
          const entries =
            instruction.type === 'TimelinePinEntry'
              ? [instruction.entry]
              : instruction.entries || [];

          for (const entry of entries) {
            if (!entry?.content?.itemContent?.tweet_results?.result) continue;

            const tweet = entry.content.itemContent.tweet_results.result;
            if (!tweet?.legacy || !tweet?.core?.user_results?.result?.legacy)
              continue;

            const user = tweet.core.user_results.result;
            const legacy = user.legacy;

            // Extract media from extended_entities for better media quality
            const media =
              tweet.legacy?.extended_entities?.media?.map((m) => ({
                mediaUrlHttps: m.media_url_https,
              })) || [];

            // If no media in extended_entities, try entities
            if (media.length === 0 && tweet.legacy?.entities?.media) {
              media.push(
                ...tweet.legacy.entities.media.map((m) => ({
                  mediaUrlHttps: m.media_url_https,
                })),
              );
            }

            const tweetData = {
              id: tweet.rest_id,
              fullText: tweet.legacy.full_text || '',
              tweetCreatedAt: new Date(tweet.legacy.created_at),
              user: {
                id: kol.id,
                name: legacy.name,
                profileImageUrlHttps: legacy.profile_image_url_https?.replace(
                  '_normal',
                  '',
                ),
                screenName: legacy.screen_name,
              },
              entities: {
                media,
              },
            };

            tweets.push(tweetData);
          }
        }
      }

      return tweets.sort(
        (a, b) => b.tweetCreatedAt.getTime() - a.tweetCreatedAt.getTime(),
      );
    } catch (error) {
      this.logger.error('Error extracting tweets from response:', error);
      return [];
    }
  }
}
