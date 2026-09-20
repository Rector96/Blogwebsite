export type NewsSource = {
  url: string;
  name: string;
  region?: string;
  category?: string;
  kind?: "news" | "business" | "technology" | "sports" | "finance";
};

export const GLOBAL_NEWS_SOURCES: NewsSource[] = [
  // Global
  { url: "https://feeds.bbci.co.uk/news/world/rss.xml", name: "BBC World" },
  { url: "https://feeds.bbci.co.uk/news/rss.xml", name: "BBC News" },
  { url: "https://www.aljazeera.com/xml/rss/all.xml", name: "Al Jazeera" },
  { url: "https://www.theguardian.com/world/rss", name: "The Guardian World" },
  { url: "https://feeds.skynews.com/feeds/rss/world.xml", name: "Sky News World" },

  // Africa / Nigeria / Ghana
  { url: "https://www.africanews.com/feed/", name: "Africanews", region: "Africa", category: "Africa" },
  { url: "https://feeds.bbci.co.uk/news/world/africa/rss.xml", name: "BBC Africa", region: "Africa", category: "Africa" },
  { url: "https://www.theguardian.com/world/africa/rss", name: "Guardian Africa", region: "Africa", category: "Africa" },
  { url: "https://rss.punchng.com/v1/category/latest_news", name: "PUNCH", region: "Nigeria", category: "Nigeria" },
  { url: "https://www.premiumtimesng.com/feed", name: "Premium Times", region: "Nigeria", category: "Nigeria" },
  { url: "https://www.vanguardngr.com/feed/", name: "Vanguard Nigeria", region: "Nigeria", category: "Nigeria" },
  { url: "https://guardian.ng/feed/", name: "The Guardian Nigeria", region: "Nigeria", category: "Nigeria" },
  { url: "https://www.channelstv.com/feed/", name: "Channels TV", region: "Nigeria", category: "Nigeria" },
  { url: "https://www.thisdaylive.com/feed/", name: "THISDAY", region: "Nigeria", category: "Nigeria" },
  { url: "https://businessday.ng/feed/", name: "BusinessDay", region: "Nigeria", category: "Business", kind: "business" },
  { url: "https://www.myjoyonline.com/feed/", name: "MyJoyOnline", region: "Ghana", category: "Ghana" },
  { url: "https://citinewsroom.com/feed/", name: "Citi Newsroom", region: "Ghana", category: "Ghana" },
  { url: "https://www.nation.africa/kenya/rss", name: "Nation Africa", region: "Africa", category: "Africa" },

  // Business / finance
  { url: "https://www.theguardian.com/business/rss", name: "The Guardian Business", category: "Business", kind: "business" },
  { url: "https://finance.yahoo.com/news/rssindex", name: "Yahoo Finance", category: "Business", kind: "finance" },
  { url: "https://feeds.content.dowjones.io/public/rss/mw_topstories", name: "MarketWatch", category: "Business", kind: "finance" },
  { url: "https://www.cnbc.com/id/100003114/device/rss/rss.html", name: "CNBC Business", category: "Business", kind: "finance" },
  { url: "https://www.finextra.com/rss/headlines.aspx", name: "Finextra", category: "Business", kind: "finance" },

  // Technology (expanded)
  { url: "https://techcrunch.com/feed/", name: "TechCrunch", category: "Tech", kind: "technology" },
  { url: "https://feeds.arstechnica.com/arstechnica/index", name: "Ars Technica", category: "Tech", kind: "technology" },
  { url: "https://www.theverge.com/rss/index.xml", name: "The Verge", category: "Tech", kind: "technology" },
  { url: "https://www.wired.com/feed/rss", name: "WIRED", category: "Tech", kind: "technology" },
  { url: "https://feeds.bbci.co.uk/news/technology/rss.xml", name: "BBC Technology", category: "Tech", kind: "technology" },
  { url: "https://www.theguardian.com/technology/rss", name: "Guardian Technology", category: "Tech", kind: "technology" },
  { url: "https://www.engadget.com/rss.xml", name: "Engadget", category: "Tech", kind: "technology" },
  { url: "https://www.techradar.com/rss", name: "TechRadar", category: "Tech", kind: "technology" },

  // Crypto
  { url: "https://www.coindesk.com/arc/outboundfeeds/rss/", name: "CoinDesk", category: "Crypto", kind: "finance" },

  // Sports
  { url: "https://www.espn.com/espn/rss/news", name: "ESPN", category: "Sports", kind: "sports" },
  { url: "https://www.espn.com/espn/rss/soccer/news", name: "ESPN Soccer", category: "Sports", kind: "sports" },
  { url: "https://www.espn.com/espn/rss/nba/news", name: "ESPN NBA", category: "Sports", kind: "sports" },
  { url: "https://www.espn.com/espn/rss/nfl/news", name: "ESPN NFL", category: "Sports", kind: "sports" },
  { url: "https://feeds.bbci.co.uk/sport/rss.xml", name: "BBC Sport", category: "Sports", kind: "sports" },
  { url: "https://feeds.bbci.co.uk/sport/football/rss.xml", name: "BBC Football", category: "Sports", kind: "sports" },
  { url: "https://www.theguardian.com/sport/rss", name: "The Guardian Sport", category: "Sports", kind: "sports" },
  { url: "https://www.theguardian.com/football/rss", name: "The Guardian Football", category: "Sports", kind: "sports" },
  { url: "https://www.skysports.com/rss/12040", name: "Sky Sports", category: "Sports", kind: "sports" },
  { url: "https://www.goal.com/feeds/en/news", name: "Goal.com", category: "Sports", kind: "sports" },
  { url: "https://www.marca.com/en/rss/football/rss.xml", name: "Marca", category: "Sports", kind: "sports" },
  { url: "https://www.cbssports.com/rss/headlines/", name: "CBS Sports", category: "Sports", kind: "sports" },
  { url: "https://sports.yahoo.com/rss/", name: "Yahoo Sports", category: "Sports", kind: "sports" },
  { url: "https://www.completesports.com/feed/", name: "Complete Sports", category: "Sports", kind: "sports", region: "Nigeria" },
  { url: "https://www.kickoff.com/rss", name: "KickOff", category: "Sports", kind: "sports", region: "Africa" },
];
