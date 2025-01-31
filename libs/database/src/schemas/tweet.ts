import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { HydratedDocument } from 'mongoose';
import { TweetV2 } from 'twitter-api-v2';

export type TweetDocument = HydratedDocument<Tweet>;

export interface TweetDetail {
  id: string;
  tweetCreatedAt: Date;
  fullText: string;
  user: {
    id: string;
    name: string;
    profileImageUrlHttps: string;
    screenName: string;
  };
  entities: {
    media: {
      mediaUrlHttps: string;
    }[];
  };
}

@Schema({
  collection: 'tweets',
})
export class Tweet {
  @Prop({ type: mongoose.Schema.Types.Mixed })
  tweetDetail: TweetDetail;

  @Prop({ type: Boolean, default: false })
  isIndicated: boolean;
}

export const TweetSchema = SchemaFactory.createForClass(Tweet);

TweetSchema.index({ 'tweetDetail.id': 1 }, { unique: true });
