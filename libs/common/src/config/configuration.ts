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
  openrouter: {
    apiKey: process.env.OPEN_ROUTER_API_KEY,
  },
  twitter: {
    bearerToken: process.env.TWITTER_BEARER_TOKEN,
    authToken: process.env.TWITTER_AUTH_TOKEN,
    ct0Token: process.env.TWITTER_CT0_TOKEN,
  },
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN,
    chatId: process.env.TELEGRAM_CHAT_ID,
  },
});
