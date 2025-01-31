import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type TweetDocument = HydratedDocument<Tweet>;

@Schema({
  timestamps: true,
  collection: 'tweets',
})
export class Tweet {
  @Prop({ required: true, type: Object })
  tweetDetail: {
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
  };

  @Prop({ default: false })
  isIndicated: boolean;
}

export const TweetSchema = SchemaFactory.createForClass(Tweet);

TweetSchema.index({ 'tweetDetail.id': 1 }, { unique: true });

TweetSchema.index({ 'tweetDetail.tweetCreatedAt': -1 });

TweetSchema.index({ isIndicated: 1 });

TweetSchema.index({ 
  isIndicated: 1, 
  'tweetDetail.tweetCreatedAt': -1,
});

TweetSchema.index({ 'tweetDetail.user.id': 1, 'tweetDetail.tweetCreatedAt': -1 });
