export interface SocialDataTweet {
  id: number;
  id_str: string;
  full_text: string;
  tweet_created_at: string;
  user: {
    id: string;
    id_str: string;
    name: string;
    profile_image_url_https: string;
    screen_name: string;
  };
  entities: {
    media: {
      media_url_https: string;
    }[];
  };
}
