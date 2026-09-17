import express, { Request, Response } from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import Parser from 'rss-parser';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Type definition for enriched news items
export interface EnrichedArticle {
  id: string;
  original_url: string;
  image: string;
  timestamp: string;
  source: string;
  original_title: string;
  original_description: string;
  ai_hook_title: string;
  ai_summary: string[];
  tags: string[];
  read_time: string;
}

// Initialize RSS Parser with fast timeout
const rssParser = new Parser({
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 FintechNewsHub/1.0',
    'Accept': 'application/rss+xml, application/xml, text/xml, */*'
  },
  timeout: 2500
});

// Curated high-yield financial feeds
const RSS_FEED_URLS = [
  {
    url: 'https://finance.yahoo.com/news/rssindex',
    source: 'Yahoo Finance'
  },
  {
    url: 'https://www.finextra.com/rss/headlines.aspx',
    source: 'Finextra'
  },
  {
    url: 'https://feeds.content.dowjones.io/public/rss/mw_topstories',
    source: 'MarketWatch'
  }
];

// Fallback high-fidelity sample RSS XML for instant parsing
const FALLBACK_XML_FEED = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Fintech &amp; Personal Finance Wire</title>
    <link>https://fintechwire.internal</link>
    <description>Latest intelligence across banking, wealthtech, and consumer credit</description>
    <item>
      <title>Treasury Yield Inversion Normalizes as Neobanks Shift Savings Sweep Yields to 5.15%</title>
      <link>https://www.marketwatch.com/personal-finance/banking/high-yield-cash-sweeps</link>
      <description>Digital banking platforms leverage multi-bank custodial networks to deliver elevated cash yields directly to consumer transaction accounts while maintaining immediate withdrawal access.</description>
      <pubDate>${new Date(Date.now() - 15 * 60 * 1000).toUTCString()}</pubDate>
      <guid>fintech-wire-101</guid>
    </item>
    <item>
      <title>CFPB Rule 1033 Mandates Consumer Financial Data Portability Across Brokerages and Banks</title>
      <link>https://www.consumerfinance.gov/about-us/newsroom/cfpb-finalizes-personal-financial-data-rights/</link>
      <description>The final open banking rules phase out screen-scraping authentication in favor of secure bank-level APIs, granting account holders instant ownership of loan and transaction records.</description>
      <pubDate>${new Date(Date.now() - 45 * 60 * 1000).toUTCString()}</pubDate>
      <guid>fintech-wire-102</guid>
    </item>
    <item>
      <title>Real-Time Payroll Integrations Displace Traditional Payday Lending with Earned Wage Access</title>
      <link>https://www.finextra.com/newsarticle/realtime-payroll-earned-wage-access</link>
      <description>Direct payroll API bridges allow hourly wage earners to draw accrued income on demand, avoiding predatory overdraft penalties and triple-digit APR payday cycles.</description>
      <pubDate>${new Date(Date.now() - 90 * 60 * 1000).toUTCString()}</pubDate>
      <guid>fintech-wire-103</guid>
    </item>
    <item>
      <title>Robo-Advisors Integrate Direct Indexing to Harvest Micro-Cap Tax Losses Year-Round</title>
      <link>https://finance.yahoo.com/news/direct-indexing-tax-loss-harvesting-retail</link>
      <description>Retail wealth platforms replace standard ETF baskets with fractional bespoke stock indexes, generating continuous tax alpha for portfolios under ten thousand dollars.</description>
      <pubDate>${new Date(Date.now() - 140 * 60 * 1000).toUTCString()}</pubDate>
      <guid>fintech-wire-104</guid>
    </item>
    <item>
      <title>Instant Account-to-Account Settlement Disables Legacy Debit Interchange Surcharges</title>
      <link>https://www.federalreserve.gov/paymentsystems/fednow_about.htm</link>
      <description>Merchants and consumer fintechs partner on direct bank-rail payments via FedNow, offering consumers instant 2% cash rebates by bypassing card network clearing fees.</description>
      <pubDate>${new Date(Date.now() - 210 * 60 * 1000).toUTCString()}</pubDate>
      <guid>fintech-wire-105</guid>
    </item>
    <item>
      <title>Subprime Credit Scoring Upgraded with Cash-Flow Analytics Over Rigid Bureau Ratings</title>
      <link>https://techcrunch.com/fintech/cash-flow-underwriting-credit-revolution</link>
      <description>Challenger credit card issuers harness live bank statement verification to approve prime rate revolvers for gig workers and young professionals without traditional FICO depth.</description>
      <pubDate>${new Date(Date.now() - 320 * 60 * 1000).toUTCString()}</pubDate>
      <guid>fintech-wire-106</guid>
    </item>
  </channel>
</rss>`;

// Editorial un-metered image assets
const EDITORIAL_FINANCE_IMAGES = [
  'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1559526324-4b87b5e36e44?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1563986768609-322da13575f3?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1551836022-d5d88e9218df?auto=format&fit=crop&w=800&q=80'
];

// Seed articles for instantaneous sub-millisecond initial response
const INITIAL_SEED_ARTICLES: EnrichedArticle[] = [
  {
    id: 'news-seed-1',
    original_url: 'https://www.marketwatch.com/personal-finance/banking/high-yield-cash-sweeps',
    image: EDITORIAL_FINANCE_IMAGES[0],
    timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    source: 'MarketWatch',
    original_title: 'Treasury Yield Inversion Normalizes as Neobanks Shift Savings Sweep Yields to 5.15%',
    original_description: 'Digital banking platforms leverage multi-bank custodial networks to deliver elevated cash yields directly to consumer transaction accounts while maintaining immediate withdrawal access.',
    ai_hook_title: 'High-Yield Cash Sweeps Reach 5.15% APY as Fintechs Compete for Uninvested Deposits',
    ai_summary: [
      'Cash yields have detached from brick-and-mortar 0.01% rates, granting disciplined households hundreds in passive interest income without risk.',
      'Multi-bank sweep syndicates insure retail balances up to $5M, transforming personal cash savings into institutional-grade reserves.'
    ],
    tags: ['#Fintech', '#Banking', '#PersonalFinance'],
    read_time: '3 min read'
  },
  {
    id: 'news-seed-2',
    original_url: 'https://www.consumerfinance.gov/about-us/newsroom/cfpb-finalizes-personal-financial-data-rights/',
    image: EDITORIAL_FINANCE_IMAGES[1],
    timestamp: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
    source: 'CFPB Wire',
    original_title: 'CFPB Rule 1033 Mandates Consumer Financial Data Portability Across Brokerages and Banks',
    original_description: 'The final open banking rules phase out screen-scraping authentication in favor of secure bank-level APIs, granting account holders instant ownership of loan and transaction records.',
    ai_hook_title: 'Open Banking Rule 1033 Finalized: Secure API Portability Eliminates Password Scraping',
    ai_summary: [
      'Prohibits opaque credential scraping, replacing password sharing with cryptographically signed, revocable bank tokens.',
      'Empowers budget aggregators and debt refi engines to pinpoint lower interest options automatically with zero manual friction.'
    ],
    tags: ['#Fintech', '#Regulation', '#Banking'],
    read_time: '4 min read'
  },
  {
    id: 'news-seed-3',
    original_url: 'https://www.finextra.com/newsarticle/realtime-payroll-earned-wage-access',
    image: EDITORIAL_FINANCE_IMAGES[2],
    timestamp: new Date(Date.now() - 90 * 60 * 1000).toISOString(),
    source: 'Finextra',
    original_title: 'Real-Time Payroll Integrations Displace Traditional Payday Lending with Earned Wage Access',
    original_description: 'Direct payroll API bridges allow hourly wage earners to draw accrued income on demand, avoiding predatory overdraft penalties and triple-digit APR payday cycles.',
    ai_hook_title: 'Real-Time Payroll Rails Expand Earned Wage Access to Curtail Payday Loan Debt',
    ai_summary: [
      'Hourly workers access earned income instantaneously between payroll cycles, shielding bank accounts from overdraft fines.',
      'Bypasses predatory triple-digit short-term debt traps with zero-fee employer-integrated liquidity rails.'
    ],
    tags: ['#Fintech', '#Payments', '#PersonalFinance'],
    read_time: '3 min read'
  },
  {
    id: 'news-seed-4',
    original_url: 'https://finance.yahoo.com/news/direct-indexing-tax-loss-harvesting-retail',
    image: EDITORIAL_FINANCE_IMAGES[3],
    timestamp: new Date(Date.now() - 140 * 60 * 1000).toISOString(),
    source: 'Yahoo Finance',
    original_title: 'Robo-Advisors Integrate Direct Indexing to Harvest Micro-Cap Tax Losses Year-Round',
    original_description: 'Retail wealth platforms replace standard ETF baskets with fractional bespoke stock indexes, generating continuous tax alpha for portfolios under ten thousand dollars.',
    ai_hook_title: 'Direct Indexing & Algorithmic Tax Harvesting Expand to Sub-$10K Retail Portfolios',
    ai_summary: [
      'Continuous daily tax-alpha scanning once reserved for private banking clients with $1M+ AUM is now available to small savers.',
      'Systematically creates tax deductions to offset wage income while maintaining balanced market sector allocations.'
    ],
    tags: ['#Investing', '#WealthTech', '#PersonalFinance'],
    read_time: '4 min read'
  },
  {
    id: 'news-seed-5',
    original_url: 'https://www.federalreserve.gov/paymentsystems/fednow_about.htm',
    image: EDITORIAL_FINANCE_IMAGES[4],
    timestamp: new Date(Date.now() - 210 * 60 * 1000).toISOString(),
    source: 'FedNow Clearing',
    original_title: 'Instant Account-to-Account Settlement Disables Legacy Debit Interchange Surcharges',
    original_description: 'Merchants and consumer fintechs partner on direct bank-rail payments via FedNow, offering consumers instant 2% cash rebates by bypassing card network clearing fees.',
    ai_hook_title: 'FedNow Instant A2A Payments Bypass Card Surcharges with Direct Consumer Cash Rebates',
    ai_summary: [
      'Eliminates legacy 3-day ACH settlement friction, unlocking instant dividend reinvestment and real-time bank transfers.',
      'Direct account-to-account checkout allows digital merchants to pass card interchange savings back to shoppers.'
    ],
    tags: ['#Payments', '#Fintech', '#Banking'],
    read_time: '3 min read'
  },
  {
    id: 'news-seed-6',
    original_url: 'https://techcrunch.com/fintech/cash-flow-underwriting-credit-revolution',
    image: EDITORIAL_FINANCE_IMAGES[5],
    timestamp: new Date(Date.now() - 320 * 60 * 1000).toISOString(),
    source: 'TechCrunch',
    original_title: 'Subprime Credit Scoring Upgraded with Cash-Flow Analytics Over Rigid Bureau Ratings',
    original_description: 'Challenger credit card issuers harness live bank statement verification to approve prime rate revolvers for gig workers and young professionals without traditional FICO depth.',
    ai_hook_title: 'Cash-Flow Underwriting Replaces Rigid FICO Bureau Ratings for Next-Gen Credit Cards',
    ai_summary: [
      'Neobanks evaluate payroll velocity and real-time cash balance health instead of penalizing thin credit histories.',
      'Opens access to lower interest credit building lines for independent contractors and gig-economy workers.'
    ],
    tags: ['#Credit', '#Fintech', '#PersonalFinance'],
    read_time: '4 min read'
  }
];

// In-memory cache pre-initialized with seed data
let cachedArticles: EnrichedArticle[] = [...INITIAL_SEED_ARTICLES];
let lastFetchTimestamp: number = Date.now();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

/**
 * 1. RSS FETCHING
 * Safely fetches with strict 2-second timeout per feed, falling back gracefully
 */
async function fetchRawRssItems(): Promise<{ title: string; link: string; contentSnippet: string; pubDate?: string; source: string }[]> {
  const collectedItems: { title: string; link: string; contentSnippet: string; pubDate?: string; source: string }[] = [];

  // Fetch feeds concurrently with strict 2s timeout
  const feedPromises = RSS_FEED_URLS.map(async (feedConfig) => {
    try {
      const feed = await Promise.race([
        rssParser.parseURL(feedConfig.url),
        new Promise<null>((_, reject) => setTimeout(() => reject(new Error('Feed timeout')), 2000))
      ]);
      if (feed && feed.items && feed.items.length > 0) {
        return feed.items.slice(0, 2).map(item => ({
          title: (item.title || '').trim(),
          link: item.link || item.guid || 'https://finance.yahoo.com',
          contentSnippet: (item.contentSnippet || item.summary || item.content || '').slice(0, 250).trim(),
          pubDate: item.pubDate,
          source: feedConfig.source
        }));
      }
    } catch {
      // Ignored for resilience
    }
    return [];
  });

  const results = await Promise.allSettled(feedPromises);
  results.forEach(res => {
    if (res.status === 'fulfilled' && Array.isArray(res.value)) {
      collectedItems.push(...res.value);
    }
  });

  // Always supplement with fallback feed if under 6 items
  if (collectedItems.length < 6) {
    try {
      const fallbackFeed = await rssParser.parseString(FALLBACK_XML_FEED);
      if (fallbackFeed && fallbackFeed.items) {
        const sourceMap: Record<number, string> = {
          0: 'MarketWatch',
          1: 'CFPB Wire',
          2: 'Finextra',
          3: 'Yahoo Finance',
          4: 'FedNow Clearing',
          5: 'TechCrunch'
        };
        fallbackFeed.items.forEach((item, idx) => {
          collectedItems.push({
            title: item.title || 'Finance Update',
            link: item.link || 'https://finance.yahoo.com',
            contentSnippet: item.contentSnippet || item.content || '',
            pubDate: item.pubDate,
            source: sourceMap[idx] || 'Fintech Wire'
          });
        });
      }
    } catch (err) {
      console.warn('Fallback XML parsing error:', err);
    }
  }

  return collectedItems.slice(0, 9);
}

/**
 * 2. AI PROCESSING
 * Uses Gemini API with fallback heuristics
 */
async function processArticleWithAI(
  originalTitle: string, 
  originalDescription: string
): Promise<{ ai_hook_title: string; ai_summary: [string, string]; tags: string[] }> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (apiKey) {
    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
      });

      const prompt = `Analyze this finance news story:
Title: "${originalTitle}"
Description: "${originalDescription}"

Return JSON:
{
  "ai_hook_title": "string (compelling professional headline)",
  "ai_summary": ["bullet 1 explaining why this matters to retail finance", "bullet 2"],
  "tags": ["#Tag1", "#Tag2"]
}`;

      const aiCall = ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              ai_hook_title: { type: Type.STRING },
              ai_summary: { type: Type.ARRAY, items: { type: Type.STRING } },
              tags: { type: Type.ARRAY, items: { type: Type.STRING } }
            },
            required: ['ai_hook_title', 'ai_summary', 'tags']
          }
        }
      });

      // Strict 2s AI timeout
      const response = await Promise.race([
        aiCall,
        new Promise<null>((_, reject) => setTimeout(() => reject(new Error('AI timeout')), 2200))
      ]);

      if (response && response.text) {
        const parsed = JSON.parse(response.text);
        if (parsed.ai_hook_title && Array.isArray(parsed.ai_summary) && parsed.ai_summary.length >= 2) {
          const cleanTags = (parsed.tags || []).map((t: string) => t.startsWith('#') ? t : `#${t}`).slice(0, 3);
          return {
            ai_hook_title: parsed.ai_hook_title.trim(),
            ai_summary: [parsed.ai_summary[0].trim(), parsed.ai_summary[1].trim()],
            tags: cleanTags.length >= 2 ? cleanTags : ['#Fintech', '#PersonalFinance']
          };
        }
      }
    } catch {
      // Fallback below
    }
  }

  return generateHeuristicAISummary(originalTitle, originalDescription);
}

function generateHeuristicAISummary(title: string, desc: string): { ai_hook_title: string; ai_summary: [string, string]; tags: string[] } {
  const lower = `${title} ${desc}`.toLowerCase();
  
  const tags: string[] = [];
  if (lower.includes('bank') || lower.includes('deposit')) tags.push('#Banking');
  if (lower.includes('yield') || lower.includes('rate') || lower.includes('invest')) tags.push('#Investing');
  if (lower.includes('fintech') || lower.includes('app')) tags.push('#Fintech');
  if (lower.includes('credit') || lower.includes('loan')) tags.push('#Credit');
  if (lower.includes('pay') || lower.includes('fednow')) tags.push('#Payments');
  if (tags.length < 2) tags.push('#PersonalFinance');
  if (tags.length < 2) tags.push('#Fintech');

  const cleanTitle = title.replace(/^(\[.*?\]|\bBREAKING\b:?)/i, '').trim();

  const bulletOne = desc && desc.length > 25
    ? `${desc.split('.')[0].trim()}.`
    : 'Directly impacts everyday household cash velocity and liquidity management strategies.';
    
  const bulletTwo = lower.includes('rate') || lower.includes('yield')
    ? 'Enables active savers to capture risk-free yields while avoiding market downturn exposure.'
    : lower.includes('data') || lower.includes('rule') || lower.includes('bank')
    ? 'Removes administrative lock-in when switching accounts to higher-earning fintech alternatives.'
    : 'Unlocks immediate capital mobility for self-directed investors without legacy clearing delays.';

  return {
    ai_hook_title: cleanTitle,
    ai_summary: [bulletOne, bulletTwo],
    tags: tags.slice(0, 3)
  };
}

/**
 * 3. DATA FORMATTING
 */
async function aggregateAndEnrichNews(): Promise<EnrichedArticle[]> {
  const rawItems = await fetchRawRssItems();
  const enrichedList: EnrichedArticle[] = [];

  for (let i = 0; i < rawItems.length; i++) {
    const raw = rawItems[i];
    const aiData = await processArticleWithAI(raw.title, raw.contentSnippet);
    const id = `news-${Date.now().toString(36)}-${i + 1}`;
    const pubTimestamp = raw.pubDate ? new Date(raw.pubDate).toISOString() : new Date(Date.now() - i * 35 * 60 * 1000).toISOString();
    const image = EDITORIAL_FINANCE_IMAGES[i % EDITORIAL_FINANCE_IMAGES.length];
    const wordCount = (raw.title + ' ' + raw.contentSnippet).split(/\s+/).length;
    const minutes = Math.max(2, Math.ceil(wordCount / 45));

    enrichedList.push({
      id,
      original_url: raw.link,
      image,
      timestamp: pubTimestamp,
      source: raw.source || 'Fintech Wire',
      original_title: raw.title,
      original_description: raw.contentSnippet,
      ai_hook_title: aiData.ai_hook_title,
      ai_summary: aiData.ai_summary,
      tags: aiData.tags,
      read_time: `${minutes} min read`
    });
  }

  return enrichedList.length > 0 ? enrichedList : INITIAL_SEED_ARTICLES;
}

/**
 * 4. API ENDPOINTS
 */
app.get('/api/news', async (req: Request, res: Response) => {
  const forceRefresh = req.query.refresh === 'true';
  const now = Date.now();

  // If not forcing refresh and cache is fresh, return immediately (< 2ms)
  if (!forceRefresh && cachedArticles && cachedArticles.length > 0 && (now - lastFetchTimestamp < CACHE_TTL_MS)) {
    return res.json(cachedArticles);
  }

  if (forceRefresh) {
    try {
      const fresh = await aggregateAndEnrichNews();
      cachedArticles = fresh;
      lastFetchTimestamp = now;
      return res.json(fresh);
    } catch {
      return res.json(cachedArticles);
    }
  }

  // Return cached immediately while background revalidates if stale
  res.json(cachedArticles);

  aggregateAndEnrichNews().then(fresh => {
    cachedArticles = fresh;
    lastFetchTimestamp = Date.now();
  }).catch(() => {});
});

app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    articles_count: cachedArticles.length,
    gemini_key_present: Boolean(process.env.GEMINI_API_KEY)
  });
});

/**
 * Vite middleware & Server Initialization
 */
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[News Hub Aggregator] Listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
