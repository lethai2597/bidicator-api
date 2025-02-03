import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Tweet, TweetSchema } from '@app/database/schemas/tweet';
import { IndicatorService } from './indicator.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Tweet.name, schema: TweetSchema },
    ]),
  ],
  providers: [IndicatorService],
})
export class IndicatorModule {}
