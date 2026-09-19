export type NewsSource = {
  url: string;
  name: string;
  region?: string;
  category?: string;
  kind?: "news" | "business" | "technology" | "sports" | "finance";
};

export const GLOBAL_NEWS_SOURCES: NewsSource[] = [
  // Global
  { url:"https://feeds.bbci.co.uk/news/world/rss.xml", name:"BBC World" },
  { url:"https://feeds.bbci.co.uk/news/rss.xml", name:"BBC News" },
  { url:"https://www.aljazeera.com/xml/rss/all.xml", name:"Al Jazeera" },
  { url:"https://www.france24.com/en/rss", name:"France 24" },
  { url:"https://rss.dw.com/rdf/rss-en-all", name:"DW" },
  { url:"https://www.theguardian.com/world/rss", name:"The Guardian World" },
  { url:"https://www.euronews.com/rss?level=theme&name=news", name:"Euronews" },
  { url:"https://feeds.skynews.com/feeds/rss/world.xml", name:"Sky News World" },
  { url:"https://www.npr.org/rss/rss.php?id=1001", name:"NPR World" },
  { url:"https://www3.nhk.or.jp/rss/news/cat0.xml", name:"NHK World", region:"Asia" },
  { url:"https://www.scmp.com/rss/91/feed", name:"South China Morning Post", region:"Asia" },

  // Africa
  { url:"https://www.africanews.com/feed/", name:"Africanews", region:"Africa" },
  { url:"https://african.business/feed/", name:"African Business", region:"Africa", category:"Business", kind:"business" },
  { url:"https://www.premiumtimesng.com/feed", name:"Premium Times", region:"Nigeria" },
  { url:"https://rss.punchng.com/v1/category/latest_news", name:"PUNCH", region:"Nigeria" },
  { url:"https://www.vanguardngr.com/feed/", name:"Vanguard Nigeria", region:"Nigeria" },
  { url:"https://www.channelstv.com/feed/", name:"Channels TV", region:"Nigeria" },
  { url:"https://dailytrust.com/feed/", name:"Daily Trust", region:"Nigeria" },
  { url:"https://guardian.ng/feed/", name:"The Guardian Nigeria", region:"Nigeria" },
  { url:"https://www.thisdaylive.com/feed", name:"ThisDay", region:"Nigeria" },
  { url:"https://businessday.ng/feed/", name:"BusinessDay", region:"Nigeria", category:"Business", kind:"business" },
  { url:"https://www.myjoyonline.com/feed/", name:"MyJoyOnline", region:"Ghana" },
  { url:"https://www.citinewsroom.com/feed/", name:"Citi Newsroom", region:"Ghana" },
  { url:"https://www.ghanaweb.com/GhanaHomePage/rss/", name:"GhanaWeb", region:"Ghana" },

  // Europe
  { url:"https://www.theguardian.com/europe/rss", name:"The Guardian Europe", region:"Europe" },
  { url:"https://www.euronews.com/rss?level=theme&name=europe", name:"Euronews Europe", region:"Europe" },
  { url:"https://rss.dw.com/rdf/rss-en-eu", name:"DW Europe", region:"Europe" },

  // Middle East
  { url:"https://www.timesofisrael.com/feed/", name:"The Times of Israel", region:"Middle East" },
  { url:"https://www.jpost.com/rss/rssfeedsfrontpage.aspx", name:"The Jerusalem Post", region:"Middle East" },
  { url:"https://www.arabnews.com/rss.xml", name:"Arab News", region:"Middle East" },
  { url:"https://www.aljazeera.com/xml/rss/all.xml", name:"Al Jazeera Middle East", region:"Middle East" },

  // Asia
  { url:"https://www.thehindu.com/news/national/feeder/default.rss", name:"The Hindu", region:"Asia" },
  { url:"https://www.dawn.com/feeds/home", name:"Dawn", region:"Asia" },
  { url:"https://www3.nhk.or.jp/rss/news/cat1.xml", name:"NHK Japan", region:"Asia" },

  // North America / Latin America
  { url:"https://www.theguardian.com/us/rss", name:"The Guardian US", region:"North America" },
  { url:"https://feeds.npr.org/1004/rss.xml", name:"NPR US", region:"North America" },
  { url:"https://www.theguardian.com/world/americas/rss", name:"The Guardian Americas", region:"South America" },

  // Business / finance
  { url:"https://www.theguardian.com/business/rss", name:"The Guardian Business", category:"Business", kind:"business" },
  { url:"https://finance.yahoo.com/news/rssindex", name:"Yahoo Finance", category:"Business", kind:"finance" },
  { url:"https://feeds.content.dowjones.io/public/rss/mw_topstories", name:"MarketWatch", category:"Business", kind:"finance" },
  { url:"https://www.finextra.com/rss/headlines.aspx", name:"Finextra", category:"Business", kind:"finance" },
  { url:"https://www.cnbc.com/id/100003114/device/rss/rss.html", name:"CNBC Business", category:"Business", kind:"finance" },
  { url:"https://fortune.com/feed/", name:"Fortune", category:"Business", kind:"business" },
  { url:"https://www.ft.com/?format=rss", name:"Financial Times", category:"Business", kind:"finance" },

  // Technology
  { url:"https://techcrunch.com/feed/", name:"TechCrunch", category:"Tech", kind:"technology" },
  { url:"https://feeds.arstechnica.com/arstechnica/index", name:"Ars Technica", category:"Tech", kind:"technology" },
  { url:"https://www.theverge.com/rss/index.xml", name:"The Verge", category:"Tech", kind:"technology" },
  { url:"https://www.npr.org/rss/rss.php?id=1045", name:"NPR Technology", category:"Tech", kind:"technology" },

  // Sports
  { url:"https://www.espn.com/espn/rss/news", name:"ESPN", category:"Sports", kind:"sports" },
  { url:"https://www.theguardian.com/sport/rss", name:"The Guardian Sport", category:"Sports", kind:"sports" },
  { url:"https://feeds.bbci.co.uk/sport/rss.xml", name:"BBC Sport", category:"Sports", kind:"sports" },

  // Crypto
  { url:"https://www.coindesk.com/arc/outboundfeeds/rss/", name:"CoinDesk", category:"Crypto", kind:"finance" },
];

export const DOCUMENTARY_TOPICS = [
  "Mossad", "CIA", "MI6", "intelligence agencies", "declassified operations",
  "geopolitical conflicts", "wars", "major corporate investigations",
  "financial scandals", "historical investigations", "organized crime",
  "technology history", "energy geopolitics", "major political events"
] as const;
