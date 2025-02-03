import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class Tweet extends Document {
  @Prop({
    type: {
      id: String,
      fullText: String,
      tweetCreatedAt: Date,
      user: {
        id: String,
        name: String,
        profileImageUrlHttps: String,
        screenName: String,
      },
      entities: {
        media: [
          {
            mediaUrlHttps: String,
          },
        ],
      },
    },
  })
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
    entities: {
      media: {
        mediaUrlHttps: string;
      }[];
    };
  };

  @Prop({ default: false })
  isIndicated: boolean;

  @Prop({
    type: Object,
    default: undefined,
  })
  indicator?: {
    type: string;
    entry: number;
    target: number;
    stopLoss: number;
    indicatedAt: Date;
    timeframe: {
      type: string;
      duration: {
        value: number;
        unit: string;
      };
    };
    confidence: number;
    reasoning: string;
  };
}

export const TweetSchema = SchemaFactory.createForClass(Tweet);

// Add indexes
TweetSchema.index({ 'tweetDetail.tweetCreatedAt': -1 });
TweetSchema.index({ isIndicated: 1 });
TweetSchema.index({ 'indicator.indicatedAt': -1 });
TweetSchema.index({ 'tweetDetail.fullText': 'text' });
