import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type IndicatorDocument = HydratedDocument<Indicator>;

export type IndicatorTrend = 'up' | 'down';

@Schema({
  timestamps: true,
  collection: 'indicators',
})
export class Indicator {
  @Prop({ required: true })
  tweetId: string;

  @Prop({ required: true })
  userId: string;

  @Prop({ required: true, enum: ['up', 'down'] })
  trend: IndicatorTrend;

  @Prop({ required: true })
  score: number;

  @Prop({ type: Date, required: true })
  indicateFor: Date;

  @Prop({ type: Date })
  createdAt: Date;
}

export const IndicatorSchema = SchemaFactory.createForClass(Indicator);

IndicatorSchema.index({ indicateFor: 1 });

IndicatorSchema.index({ tweetId: 1 });

IndicatorSchema.index({ 
  indicateFor: 1, 
  createdAt: -1,
});

IndicatorSchema.index({ userId: 1, indicateFor: 1 });
