/**
 * Phát hiện bot / crawler dựa vào User-Agent.
 * Dùng để lọc trước khi ghi lượt truy cập / click thực.
 */

const BOT_PATTERNS = [
  /googlebot/i,
  /bingbot/i,
  /slurp/i, // Yahoo
  /duckduckbot/i,
  /baiduspider/i,
  /yandexbot/i,
  /yandex\.com\/bots/i,
  /sogou/i,
  /exabot/i,
  /facebookexternalhit/i,
  /facebot/i,
  /twitterbot/i,
  /linkedinbot/i,
  /whatsapp\//i,
  /telegrambot/i,
  /slackbot/i,
  /discordbot/i,
  /applebot/i,
  /googleother/i,
  /gptbot/i,
  /claudebot/i,
  /anthropic-ai/i,
  /oai-searchbot/i,
  /crawler/i,
  /spider/i,
  /scraper/i,
  /\bbot\b/i,
  /curl\//i,
  /wget\//i,
  /python-requests/i,
  /python-urllib/i,
  /go-http-client/i,
  /axios\//i,
  /node-fetch/i,
  /node\.js/i,
  /scrapy/i,
  /headlesschrome/i,
  /phantomjs/i,
  /selenium/i,
  /puppeteer/i,
  /playwright/i,
  /httpclient/i,
  /java\//i,
  /libwww/i,
  /lwp-trivial/i,
  /okhttp\//i,
  /apache-httpclient/i,
  /petalbot/i,
  /semrushbot/i,
  /ahrefsbot/i,
  /mj12bot/i,
  /dotbot/i,
  /rogerbot/i,
  /archive\.org_bot/i,
]

export function isBot(userAgent: string | null | undefined): boolean {
  if (!userAgent || userAgent.trim() === '') return true
  return BOT_PATTERNS.some((p) => p.test(userAgent))
}
