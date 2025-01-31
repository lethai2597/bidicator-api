import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

export enum IndicatorTrend {
  UP = 'up',
  DOWN = 'down',
}

@Schema({
  collection: 'indicators',
  timestamps: true,
})
export class Indicator {
  @Prop({ type: String, enum: IndicatorTrend })
  trend: IndicatorTrend;

  @Prop({ type: String })
  tweetId: string;

  @Prop({ type: String })
  userId: string;

  @Prop({ type: Number })
  score: number;

  @Prop({ type: Date })
  indicateFor: Date;

  @Prop({ type: Date })
  createdAt: Date;
}

export const IndicatorSchema = SchemaFactory.createForClass(Indicator);

IndicatorSchema.index({ tweetId: 1, indicateFor: 1 }, { unique: true });