import { Tweet } from '@app/database/schemas/tweet';
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { subHours } from 'date-fns';

@Injectable()
export class AppService {
  private readonly logger = new Logger(AppService.name);

  constructor(@InjectModel(Tweet.name) private tweetModel: Model<Tweet>) {}

  async getRecentIndicatedTweets() {
    const twentyFourHoursAgo = subHours(new Date(), 48);

    return this.tweetModel
      .find({
        indicator: { $exists: true, $ne: null },
        'indicator.indicatedAt': { $gte: twentyFourHoursAgo },
      })
      .sort({ 'tweetDetail.tweetCreatedAt': -1 })
      .lean();
  }
}
