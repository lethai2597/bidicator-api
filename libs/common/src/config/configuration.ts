export const configurations = () => ({
  database: {
    url: process.env.DATABASE_URL,
  },
  twitterCrawler: {
    socialDataToken: process.env.SOCIAL_DATA_TOKEN,
  },
  indicator: {
    deepseekApiKey: process.env.DEEPSEEK_API_KEY,
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
  },
});
