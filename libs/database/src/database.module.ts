import { Module, DynamicModule } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Tweet, TweetSchema } from './schemas/tweet';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Indicator, IndicatorSchema } from './schemas/indicator';

@Module({
  imports: [
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        uri: configService.get('database.url'),
      }),
      inject: [ConfigService],
    }),
    MongooseModule.forFeature([
      { name: Tweet.name, schema: TweetSchema },
      { name: Indicator.name, schema: IndicatorSchema },
    ]),
  ],
  exports: [MongooseModule],
})
export class DatabaseModule {}
