import React, { useState, useEffect, useMemo } from 'react';
import { Helmet, HelmetProvider } from 'react-helmet-async';
import { 
  ExternalLink, 
  Search, 
  Bookmark, 
  BookmarkCheck, 
  RotateCw, 
  Clock, 
  Sparkles,
  Shield,
  ShieldAlert,
  X,
  FileText,
  CheckCircle2,
  TrendingUp,
  Star,
  Award,
  Database
} from 'lucide-react';
import { supabase, isSupabaseConfigured } from './lib/supabase';

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
  read_time?: string;
}

export interface SponsoredOffer {
  id: string;
  sponsorName: string;
  sponsorBadge: string;
  tags: string[];
  headline: string;
  whyMatters: string[];
  ctaText: string;
  ctaUrl: string;
  rateHighlight: string;
  disclosure: string;
}

// Initial default articles ensure zero flash of empty content
const INITIAL_ARTICLES: EnrichedArticle[] = [
  {
    id: 'news-init-1',
    original_url: 'https://www.marketwatch.com/personal-finance/banking/high-yield-cash-sweeps',
    image: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=800&q=80',
    timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    source: 'MarketWatch',
    original_title: 'Treasury Yield Inversion Normalizes as Neobanks Shift Savings Sweep Yields to 5.15%',
    original_description: 'Digital banking platforms leverage multi-bank custodial networks to deliver elevated cash yields directly to consumer transaction accounts while maintaining immediate withdrawal access.',
    ai_hook_title: 'High-Yield Cash Sweeps Reach 5.15% APY as Fintechs Compete for Uninvested Deposits',
    ai_summary: [
      'Cash yields have detached from legacy 0.01% savings rates, granting disciplined households hundreds in passive interest income without risk.',
      'Multi-bank sweep syndicates insure retail balances up to $5M, transforming personal cash savings into institutional-grade reserves.'
    ],
    tags: ['#Fintech', '#Banking', '#PersonalFinance'],
    read_time: '3 min read'
  },
  {
    id: 'news-init-2',
    original_url: 'https://www.consumerfinance.gov/about-us/newsroom/cfpb-finalizes-personal-financial-data-rights/',
    image: 'https://images.unsplash.com/photo-1559526324-4b87b5e36e44?auto=format&fit=crop&w=800&q=80',
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
    id: 'news-init-3',
    original_url: 'https://www.finextra.com/newsarticle/realtime-payroll-earned-wage-access',
    image: 'https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?auto=format&fit=crop&w=800&q=80',
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
    id: 'news-init-4',
    original_url: 'https://finance.yahoo.com/news/direct-indexing-tax-loss-harvesting-retail',
    image: 'https://images.unsplash.com/photo-1563986768609-322da13575f3?auto=format&fit=crop&w=800&q=80',
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
    id: 'news-init-5',
    original_url: 'https://www.federalreserve.gov/paymentsystems/fednow_about.htm',
    image: 'https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?auto=format&fit=crop&w=800&q=80',
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
    id: 'news-init-6',
    original_url: 'https://techcrunch.com/fintech/cash-flow-underwriting-credit-revolution',
    image: 'https://images.unsplash.com/photo-1551836022-d5d88e9218df?auto=format&fit=crop&w=800&q=80',
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

// Requirement 1 & 4: In-feed native sponsored placements styled cohesively
const SPONSORED_OFFERS: SponsoredOffer[] = [
  {
    id: 'ad-apex-cash',
    sponsorName: 'Apex Prime Cash Management',
    sponsorBadge: 'SPONSORED / ADVERTISEMENT',
    tags: ['#FeaturedPick', '#HighYield', '#Banking'],
    headline: 'Apex Prime Cash Reserves: 5.25% Liquid APY with $5M Aggregate FDIC Insurance',
    whyMatters: [
      'Automated multi-bank sweep distribution provides 20x standard $250K coverage for cash while maintaining same-day liquidity.',
      'Zero account maintenance fees or minimum deposit requirements, paired with instant FedNow payment clearing.'
    ],
    ctaText: 'Claim 5.25% APY Rate',
    ctaUrl: 'https://www.marketwatch.com/personal-finance/banking/high-yield-cash-sweeps',
    rateHighlight: '5.25% APY',
    disclosure: 'Partner Offer • Member FDIC • Rate variable'
  },
  {
    id: 'ad-titan-indexing',
    sponsorName: 'Titan Algorithmic Wealth',
    sponsorBadge: 'SPONSORED / ADVERTISEMENT',
    tags: ['#WealthTech', '#DirectIndexing', '#TaxAlpha'],
    headline: 'Automated 365-Day Tax-Loss Harvesting for Portfolios Over $5,000',
    whyMatters: [
      'Direct-indexing technology replaces static ETF shares with bespoke stock baskets, continuously converting volatility into tax deductions.',
      'Delivered an audited +1.38% average annual after-tax alpha boost across retail taxable accounts in 2025.'
    ],
    ctaText: 'Explore Tax Alpha Engine',
    ctaUrl: 'https://finance.yahoo.com/news/direct-indexing-tax-loss-harvesting-retail',
    rateHighlight: '+1.38% Tax Alpha',
    disclosure: 'Partner Offer • SEC Registered Advisor'
  },
  {
    id: 'ad-earnflow-liquidity',
    sponsorName: 'EarnFlow Payroll Network',
    sponsorBadge: 'SPONSORED / ADVERTISEMENT',
    tags: ['#Fintech', '#EarnedWage', '#Liquidity'],
    headline: '0% APR Real-Time Payroll Rails: End Predatory Payday Loan Cycles',
    whyMatters: [
      'Direct employer HRIS integration allows workers to stream already-earned wages instantaneously to avert $35 overdraft fines.',
      'Instant FedNow account-to-account disbursements bypass triple-digit interest short-term lenders with zero hidden fees.'
    ],
    ctaText: 'Check Free Eligibility',
    ctaUrl: 'https://www.finextra.com/newsarticle/realtime-payroll-earned-wage-access',
    rateHighlight: '0% APR Rails',
    disclosure: 'Partner Offer • Employer Integrated'
  }
];

function NewsHubContent() {
  const [articles, setArticles] = useState<EnrichedArticle[]>(INITIAL_ARTICLES);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [selectedTag, setSelectedTag] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [savedStories, setSavedStories] = useState<string[]>([]);
  const [activeStory, setActiveStory] = useState<EnrichedArticle | null>(null);
  
  // Rule 3: Robots Noindex - Allows protecting the core brand domain from automated indexing
  const [isNoIndexActive, setIsNoIndexActive] = useState<boolean>(false);

  // Requirement 2: Mobile dismissible floating affiliate banner state
  const [isMobileBannerDismissed, setIsMobileBannerDismissed] = useState<boolean>(false);

  // Fetch news from Supabase (if keys provided) or /api/news with automatic fallback to seed data
  const fetchNews = async (forceRefresh = false) => {
    try {
      setRefreshing(true);

      // Check if user has connected Supabase
      if (isSupabaseConfigured && supabase) {
        const { data, error } = await supabase
          .from('articles')
          .select('*')
          .order('timestamp', { ascending: false })
          .limit(30);

        if (!error && data && data.length > 0) {
          setArticles(data as EnrichedArticle[]);
          return;
        }
      }

      const url = forceRefresh ? '/api/news?refresh=true' : '/api/news';
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : (data.articles || []);
        if (list.length > 0) {
          setArticles(list);
        }
      }
    } catch (err) {
      console.warn('Using seeded article cache:', err);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchNews(false);
  }, []);

  // Compute unique tag categories dynamically
  const allTags = useMemo(() => {
    const set = new Set<string>();
    articles.forEach(a => {
      if (Array.isArray(a.tags)) {
        a.tags.forEach(t => set.add(t));
      }
    });
    return ['All', ...Array.from(set)];
  }, [articles]);

  // Client-side instant filter and search
  const filteredArticles = useMemo(() => {
    return articles.filter(article => {
      const matchesTag = selectedTag === 'All' || (article.tags && article.tags.includes(selectedTag));
      const q = searchQuery.trim().toLowerCase();
      if (!q) return matchesTag;

      const headlineMatch = (article.ai_hook_title || article.original_title || '').toLowerCase().includes(q);
      const tagMatch = article.tags && article.tags.some(t => t.toLowerCase().includes(q));
      const summaryMatch = article.ai_summary && article.ai_summary.some(s => s.toLowerCase().includes(q));
      const sourceMatch = (article.source || '').toLowerCase().includes(q);

      return matchesTag && (headlineMatch || tagMatch || summaryMatch || sourceMatch);
    });
  }, [articles, selectedTag, searchQuery]);

  const toggleBookmark = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSavedStories(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const formatRelativeTime = (isoString: string) => {
    try {
      const diffMs = Date.now() - new Date(isoString).getTime();
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      return new Date(isoString).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } catch {
      return 'Recently';
    }
  };

  // Rule 1: Dynamic SEO canonical calculation
  const currentCanonicalUrl = activeStory 
    ? activeStory.original_url 
    : (typeof window !== 'undefined' ? window.location.href.split('?')[0] : 'https://fintechnewshub.app');

  const pageTitle = activeStory 
    ? `${activeStory.ai_hook_title || activeStory.original_title} | Personal Finance News Hub`
    : 'Personal Finance & Fintech News Hub – Market Catalysts & Wealth Tech';

  const metaDescription = activeStory
    ? (activeStory.ai_summary && activeStory.ai_summary[0]) || activeStory.original_description.slice(0, 150)
    : 'Curated intelligence on high-yield cash accounts, neobanking, open banking APIs, and retail wealth rails.';

  return (
    <div 
      id="fintech-hub-app"
      style={{
        backgroundColor: '#ffffff',
        minHeight: '100vh',
        color: '#0f172a',
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        WebkitFontSmoothing: 'antialiased'
      }}
    >
      {/* 
        Rule 1 & Rule 3: SEO CANONICALS & ROBOTS NOINDEX via react-helmet-async 
        - Injects <link rel="canonical" href={article.original_url} /> pointing to original source for modal/story view.
        - Injects conditional <meta name="robots" content="noindex, nofollow" /> when bot protection is active.
      */}
      <Helmet>
        <title>{pageTitle}</title>
        <meta name="description" content={metaDescription} />
        
        {/* Dynamic Canonical pointing strictly to original publisher source */}
        <link rel="canonical" href={currentCanonicalUrl} />

        {/* Dynamic Robots Meta Tag: conditionally protect domain from automated crawling */}
        {isNoIndexActive ? (
          <meta name="robots" content="noindex, nofollow" />
        ) : (
          <meta name="robots" content="index, follow" />
        )}

        <meta property="og:title" content={pageTitle} />
        <meta property="og:description" content={metaDescription} />
        <meta property="og:url" content={currentCanonicalUrl} />
        <meta property="og:type" content="website" />
      </Helmet>

      {/* Pure CSS Styles for responsive layout, ad injection, and sticky widget */}
      <style>{`
        * {
          box-sizing: border-box;
        }

        /* Responsive Layout Container with Sticky Sidebar on Desktop */
        .layout-container {
          display: flex;
          flex-direction: column;
          gap: 2rem;
          width: 100%;
        }

        @media (min-width: 1024px) {
          .layout-container {
            flex-direction: row;
            align-items: flex-start;
            gap: 2.25rem;
          }
          .main-feed-column {
            flex: 1;
            min-width: 0;
          }
          .sticky-affiliate-sidebar {
            width: 320px;
            flex-shrink: 0;
            position: sticky;
            top: 5.5rem;
            display: block;
          }
        }

        @media (max-width: 1023px) {
          .sticky-affiliate-sidebar {
            display: none;
          }
        }

        /* Desktop 3-column grid & mobile single-column list stack */
        .news-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 1.75rem;
          width: 100%;
        }

        @media (min-width: 768px) and (max-width: 1279px) {
          .news-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 1.75rem;
          }
        }

        @media (min-width: 1280px) {
          .news-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 2rem;
          }
        }

        /* Article Card styling: Pure white with subtle light gray border (#e2e8f0) */
        .article-card {
          background-color: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 0.75rem;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          overflow: hidden;
          transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.2s ease, border-color 0.2s ease;
        }

        .article-card:hover {
          transform: translateY(-3px);
          border-color: #cbd5e1;
          box-shadow: 0 10px 25px -5px rgba(15, 23, 42, 0.05), 0 8px 10px -6px rgba(15, 23, 42, 0.03);
        }

        /* In-feed Sponsored Ad Card: Cohesive pure white styling with subtle emerald accent */
        .sponsored-card {
          border: 1px solid #e2e8f0;
          background-color: #ffffff;
          position: relative;
        }

        .sponsored-card:hover {
          border-color: #10b981;
          box-shadow: 0 12px 28px -6px rgba(16, 185, 129, 0.08), 0 8px 10px -6px rgba(15, 23, 42, 0.03);
        }

        /* Secure Link Action Buttons */
        .read-story-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          width: 100%;
          padding: 0.75rem 1.25rem;
          border-radius: 0.5rem;
          font-weight: 600;
          font-size: 0.9375rem;
          color: #ffffff;
          background-color: #3b82f6;
          border: 1px solid #3b82f6;
          cursor: pointer;
          transition: background-color 0.15s ease, box-shadow 0.15s ease, transform 0.1s ease;
          text-decoration: none;
        }

        .read-story-btn:hover {
          background-color: #2563eb;
          border-color: #2563eb;
          box-shadow: 0 4px 12px rgba(59, 130, 246, 0.25);
        }

        .read-story-btn:active {
          transform: scale(0.99);
        }

        /* Emerald CTA for Monetization / Sponsored / Affiliate Links */
        .emerald-cta-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          width: 100%;
          padding: 0.75rem 1.25rem;
          border-radius: 0.5rem;
          font-weight: 700;
          font-size: 0.9375rem;
          color: #ffffff;
          background-color: #10b981;
          border: 1px solid #10b981;
          cursor: pointer;
          transition: background-color 0.15s ease, box-shadow 0.15s ease, transform 0.1s ease;
          text-decoration: none;
        }

        .emerald-cta-btn:hover {
          background-color: #059669;
          border-color: #059669;
          box-shadow: 0 4px 14px rgba(16, 185, 129, 0.3);
        }

        .emerald-cta-btn:active {
          transform: scale(0.99);
        }

        /* Secondary briefing trigger button */
        .briefing-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.375rem;
          width: 100%;
          padding: 0.45rem 1rem;
          border-radius: 0.375rem;
          font-weight: 500;
          font-size: 0.8125rem;
          color: #64748b;
          background-color: #ffffff;
          border: 1px solid #e2e8f0;
          cursor: pointer;
          margin-top: 0.5rem;
          transition: background-color 0.15s ease, color 0.15s ease;
        }

        .briefing-btn:hover {
          background-color: #f8fafc;
          color: #0f172a;
          border-color: #cbd5e1;
        }

        /* Tag pill styling */
        .tag-pill {
          display: inline-flex;
          align-items: center;
          font-size: 0.75rem;
          font-weight: 600;
          padding: 0.2rem 0.55rem;
          border-radius: 9999px;
          background-color: #eff6ff;
          color: #3b82f6;
          border: 1px solid #dbeafe;
          text-decoration: none;
        }

        .tag-pill.emerald {
          background-color: #ecfdf5;
          color: #10b981;
          border-color: #d1fae5;
        }

        /* Tiny, elegant Sponsored / Advertisement label */
        .sponsored-tag {
          display: inline-flex;
          align-items: center;
          gap: 0.25rem;
          font-size: 0.6875rem;
          font-weight: 700;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          padding: 0.2rem 0.5rem;
          border-radius: 0.25rem;
          background-color: #f8fafc;
          color: #64748b;
          border: 1px solid #e2e8f0;
        }

        .filter-btn {
          padding: 0.35rem 0.8rem;
          border-radius: 9999px;
          font-size: 0.8125rem;
          font-weight: 500;
          cursor: pointer;
          border: 1px solid #e2e8f0;
          background-color: #ffffff;
          color: #64748b;
          transition: all 0.15s ease;
          white-space: nowrap;
        }

        .filter-btn:hover {
          border-color: #cbd5e1;
          color: #0f172a;
        }

        .filter-btn.active {
          background-color: #0f172a;
          color: #ffffff;
          border-color: #0f172a;
        }

        /* Bulleted "Why This Matters" Section */
        .why-matters-list {
          list-style: none;
          padding: 0;
          margin: 0;
        }

        .why-matters-item {
          position: relative;
          padding-left: 1.25rem;
          margin-bottom: 0.625rem;
          font-size: 0.875rem;
          line-height: 1.55;
          color: #64748b;
        }

        .why-matters-item:last-child {
          margin-bottom: 0;
        }

        .why-matters-item::before {
          content: "";
          position: absolute;
          left: 0;
          top: 0.5rem;
          width: 0.375rem;
          height: 0.375rem;
          border-radius: 50%;
          background-color: #10b981;
        }

        /* Mobile Bottom-Floating Banner */
        .mobile-floating-banner {
          position: fixed;
          bottom: 1.25rem;
          left: 1rem;
          right: 1rem;
          z-index: 40;
          background-color: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 0.75rem;
          box-shadow: 0 20px 25px -5px rgba(15, 23, 42, 0.15), 0 8px 10px -6px rgba(15, 23, 42, 0.1);
          padding: 1rem 1.25rem;
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }

        @keyframes slideUp {
          from {
            transform: translateY(100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }

        /* Modal Backdrop */
        .modal-backdrop {
          position: fixed;
          inset: 0;
          background-color: rgba(15, 23, 42, 0.45);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1.25rem;
          z-index: 50;
        }

        .modal-box {
          background-color: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 1rem;
          max-width: 44rem;
          width: 100%;
          max-height: 90vh;
          overflow-y: auto;
          padding: 2rem;
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
        }
      `}</style>

      {/* SIMPLE & MODERN HEADER */}
      <header 
        id="simple-header"
        style={{
          borderBottom: '1px solid #e2e8f0',
          backgroundColor: '#ffffff',
          position: 'sticky',
          top: 0,
          zIndex: 30
        }}
      >
        <div 
          style={{
            maxWidth: '86rem',
            margin: '0 auto',
            padding: '1.25rem 1.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
            flexWrap: 'wrap'
          }}
        >
          {/* Simple Clean Title & Subtitle */}
          <div>
            <h1 
              style={{
                fontSize: '1.375rem',
                fontWeight: 700,
                color: '#0f172a',
                margin: 0,
                letterSpacing: '-0.025em',
                lineHeight: 1.2
              }}
            >
              Personal Finance & Fintech News Hub
            </h1>
            <p 
              style={{
                fontSize: '0.875rem',
                color: '#64748b',
                margin: '0.25rem 0 0 0'
              }}
            >
              Curated market catalysts, neobanking shifts, and retail wealth intelligence.
            </p>
          </div>

          {/* Simple Actions & Rule 3: Robots Noindex Toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            {/* Database & Backend Status Badge */}
            <div
              id="backend-status-badge"
              title={isSupabaseConfigured ? "Connected to Supabase PostgreSQL" : "Connected to Express RSS Aggregator"}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.375rem',
                padding: '0.375rem 0.65rem',
                borderRadius: '0.5rem',
                border: isSupabaseConfigured ? '1px solid #a7f3d0' : '1px solid #e2e8f0',
                backgroundColor: isSupabaseConfigured ? '#ecfdf5' : '#f8fafc',
                color: isSupabaseConfigured ? '#047857' : '#64748b',
                fontSize: '0.75rem',
                fontWeight: 600
              }}
            >
              <Database size={13} color={isSupabaseConfigured ? '#059669' : '#64748b'} />
              <span>{isSupabaseConfigured ? 'Supabase Live' : 'Express / Cloud API'}</span>
            </div>

            {/* Rule 3: Robots Noindex Control Toggle */}
            <button
              id="toggle-noindex-btn"
              onClick={() => setIsNoIndexActive(prev => !prev)}
              title={isNoIndexActive ? "Currently: NOINDEX active (Domain Protected)" : "Currently: INDEXABLE by search engines"}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.375rem',
                padding: '0.375rem 0.75rem',
                borderRadius: '0.5rem',
                border: isNoIndexActive ? '1px solid #fca5a5' : '1px solid #e2e8f0',
                backgroundColor: isNoIndexActive ? '#fef2f2' : '#ffffff',
                color: isNoIndexActive ? '#b91c1c' : '#64748b',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              {isNoIndexActive ? <ShieldAlert size={14} /> : <Shield size={14} />}
              <span>{isNoIndexActive ? 'Robots: Noindex Active' : 'Robots: Indexable'}</span>
            </button>

            {/* Refresh Button */}
            <button
              id="refresh-feed-btn"
              onClick={() => fetchNews(true)}
              disabled={refreshing}
              title="Refresh from aggregator backend"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.375rem',
                padding: '0.4rem 0.85rem',
                borderRadius: '0.5rem',
                border: '1px solid #e2e8f0',
                backgroundColor: '#ffffff',
                color: '#0f172a',
                fontSize: '0.8125rem',
                fontWeight: 500,
                cursor: refreshing ? 'not-allowed' : 'pointer'
              }}
            >
              <RotateCw size={14} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
              <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
            </button>
          </div>
        </div>

        {/* Minimal Category Filter & Search Bar */}
        <div 
          style={{
            maxWidth: '86rem',
            margin: '0 auto',
            padding: '0.625rem 1.5rem',
            borderTop: '1px solid #f8fafc',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
            flexWrap: 'wrap'
          }}
        >
          {/* Category Filter Pills */}
          <div 
            id="category-pills"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              overflowX: 'auto',
              maxWidth: '100%',
              paddingBottom: '0.2rem'
            }}
          >
            {allTags.map(tag => (
              <button
                key={tag}
                id={`filter-${tag.replace('#', '').toLowerCase()}`}
                className={`filter-btn ${selectedTag === tag ? 'active' : ''}`}
                onClick={() => setSelectedTag(tag)}
              >
                {tag}
              </button>
            ))}
          </div>

          {/* Simple Search Input */}
          <div style={{ position: 'relative', width: '100%', maxWidth: '18rem' }}>
            <Search 
              size={15} 
              color="#94a3b8" 
              style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)' }} 
            />
            <input
              id="search-input"
              type="text"
              placeholder="Search news or source..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '0.4rem 0.75rem 0.4rem 2.25rem',
                fontSize: '0.8125rem',
                border: '1px solid #e2e8f0',
                borderRadius: '0.5rem',
                outline: 'none',
                color: '#0f172a',
                backgroundColor: '#ffffff'
              }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                style={{
                  position: 'absolute',
                  right: '0.5rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer'
                }}
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* MAIN VIEWPORT WITH OPEN SPACING AND RESPONSIVE LAYOUT */}
      <main 
        id="main-content"
        style={{
          maxWidth: '86rem',
          margin: '0 auto',
          padding: '2.5rem 1.5rem 5rem 1.5rem'
        }}
      >
        {/* SEO & Canonical Notice Banner (when Noindex is active) */}
        {isNoIndexActive && (
          <div 
            id="noindex-notice"
            style={{
              padding: '0.75rem 1rem',
              backgroundColor: '#fffbeb',
              border: '1px solid #fef3c7',
              borderRadius: '0.5rem',
              color: '#92400e',
              fontSize: '0.8125rem',
              marginBottom: '1.75rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            <ShieldAlert size={16} color="#d97706" />
            <span>
              <strong>Robots Noindex Active:</strong> Automated search bots are instructed not to index this aggregation feed, protecting brand authority and preventing duplicate content penalties.
            </span>
          </div>
        )}

        {/* Empty state if search returns nothing */}
        {filteredArticles.length === 0 && (
          <div 
            id="empty-state"
            style={{
              padding: '4rem 1.5rem',
              textAlign: 'center',
              border: '1px dashed #cbd5e1',
              borderRadius: '0.75rem',
              backgroundColor: '#ffffff'
            }}
          >
            <p style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600, color: '#0f172a' }}>
              No stories match your criteria
            </p>
            <p style={{ margin: '0.5rem 0 1.25rem 0', fontSize: '0.875rem', color: '#64748b' }}>
              Try searching for a different keyword or resetting your filters.
            </p>
            <button
              onClick={() => { setSelectedTag('All'); setSearchQuery(''); }}
              className="filter-btn active"
              style={{ padding: '0.5rem 1.25rem' }}
            >
              Reset Filters
            </button>
          </div>
        )}

        {/* 
          Requirement 2: Responsive Two-Column Layout on Desktop
          Left: Articles with conditional in-feed ad injection after every 3rd story
          Right: Sticky Affiliate Widget ("Top Financial Pick" promoting 5.15% APY Savings)
        */}
        <div className="layout-container">
          {/* Main News Feed Column */}
          <div className="main-feed-column">
            <div className="news-grid" id="article-grid">
              {filteredArticles.map((article, index) => {
                const isSaved = savedStories.includes(article.id);
                const headline = article.ai_hook_title || article.original_title;
                const bullets = (article.ai_summary && article.ai_summary.length > 0) 
                  ? article.ai_summary.slice(0, 2)
                  : [article.original_description.slice(0, 100) + '...', 'Key financial impact for active consumer accounts.'];

                // Requirement 1: Conditional statement injecting an Ad Component after every 3rd news item
                const shouldInjectAd = (index + 1) % 3 === 0;
                const adIndex = Math.floor(index / 3);
                const adData = SPONSORED_OFFERS[adIndex % SPONSORED_OFFERS.length];

                return (
                  <React.Fragment key={article.id}>
                    {/* Standard Editorial Article Card */}
                    <article 
                      id={`article-${article.id}`}
                      className="article-card"
                    >
                      {/* Card Content Top Container */}
                      <div style={{ padding: '1.75rem 1.75rem 1rem 1.75rem' }}>
                        {/* Tags row & Bookmark button */}
                        <div 
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '0.5rem',
                            marginBottom: '1rem'
                          }}
                        >
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
                            {article.tags && article.tags.map((tag, tIdx) => (
                              <span 
                                key={tag} 
                                className={`tag-pill ${tIdx === 0 ? 'emerald' : ''}`}
                              >
                                {tag}
                              </span>
                            ))}
                          </div>

                          <button
                            id={`bookmark-${article.id}`}
                            onClick={(e) => toggleBookmark(article.id, e)}
                            title={isSaved ? "Saved" : "Save for later"}
                            aria-label="Save story"
                            style={{
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              padding: '0.35rem',
                              color: isSaved ? '#3b82f6' : '#94a3b8',
                              display: 'flex',
                              alignItems: 'center'
                            }}
                          >
                            {isSaved ? <BookmarkCheck size={18} /> : <Bookmark size={18} />}
                          </button>
                        </div>

                        {/* Credit Metadata */}
                        <div 
                          id={`credit-${article.id}`}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            gap: '0.5rem',
                            fontSize: '0.75rem',
                            color: '#64748b',
                            marginBottom: '0.75rem'
                          }}
                        >
                          <span 
                            style={{ 
                              fontWeight: 700, 
                              color: '#0f172a',
                              backgroundColor: '#f8fafc',
                              padding: '0.15rem 0.4rem',
                              borderRadius: '0.25rem',
                              border: '1px solid #e2e8f0'
                            }}
                          >
                            Source: {article.source}
                          </span>
                          <span>•</span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            <Clock size={12} /> {formatRelativeTime(article.timestamp)}
                          </span>
                          {article.read_time && (
                            <>
                              <span>•</span>
                              <span>{article.read_time}</span>
                            </>
                          )}
                        </div>

                        {/* Bold, modern headline */}
                        <h2 
                          id={`headline-${article.id}`}
                          style={{
                            fontSize: '1.1875rem',
                            fontWeight: 700,
                            lineHeight: 1.4,
                            color: '#0f172a',
                            margin: '0 0 1.25rem 0',
                            letterSpacing: '-0.015em'
                          }}
                        >
                          {headline}
                        </h2>

                        {/* Bulleted "Why This Matters" summary section (strictly 2 bullet points max) */}
                        <div 
                          style={{
                            paddingTop: '0.75rem',
                            borderTop: '1px solid #f1f5f9',
                            marginBottom: '1rem'
                          }}
                        >
                          <div 
                            style={{
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              textTransform: 'uppercase',
                              letterSpacing: '0.04em',
                              color: '#0f172a',
                              marginBottom: '0.625rem',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.375rem'
                            }}
                          >
                            <Sparkles size={13} color="#10b981" />
                            <span>Why This Matters</span>
                          </div>
                          <ul className="why-matters-list">
                            {bullets.map((bullet, bIdx) => (
                              <li key={bIdx} className="why-matters-item">
                                {bullet}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>

                      {/* Prominent "Read Full Story ↗" action button with target="_blank" and rel="noopener noreferrer" */}
                      <div style={{ padding: '0 1.75rem 1.75rem 1.75rem' }}>
                        <a
                          id={`read-story-${article.id}`}
                          href={article.original_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="read-story-btn"
                        >
                          <span>Read Full Story</span>
                          <ExternalLink size={16} strokeWidth={2.4} />
                        </a>

                        {/* Optional Executive Analysis View Modal */}
                        <button
                          id={`briefing-btn-${article.id}`}
                          className="briefing-btn"
                          onClick={() => setActiveStory(article)}
                        >
                          <FileText size={14} />
                          <span>View Executive Briefing</span>
                        </button>
                      </div>
                    </article>

                    {/* 
                      Requirement 1 & 4: IN-FEED AD INJECTION 
                      Conditional statement injecting an Ad Component styled exactly like an article card after every 3rd news item.
                      Clearly labeled with a tiny, elegant "SPONSORED / ADVERTISEMENT" tag at the top.
                    */}
                    {shouldInjectAd && (
                      <article 
                        key={`ad-slot-${index + 1}`}
                        id={`ad-slot-${index + 1}`}
                        className="article-card sponsored-card"
                      >
                        <div style={{ padding: '1.75rem 1.75rem 1rem 1.75rem' }}>
                          {/* Sponsored Tag & Rate Pill */}
                          <div 
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: '0.5rem',
                              marginBottom: '1rem'
                            }}
                          >
                            <span 
                              id={`ad-label-${index + 1}`}
                              className="sponsored-tag"
                            >
                              <Award size={12} color="#10b981" />
                              <span>{adData.sponsorBadge}</span>
                            </span>

                            <span 
                              style={{
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                color: '#10b981',
                                backgroundColor: '#ecfdf5',
                                border: '1px solid #d1fae5',
                                padding: '0.2rem 0.55rem',
                                borderRadius: '9999px'
                              }}
                            >
                              {adData.rateHighlight}
                            </span>
                          </div>

                          {/* Sponsor Metadata Citation */}
                          <div 
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              flexWrap: 'wrap',
                              gap: '0.5rem',
                              fontSize: '0.75rem',
                              color: '#64748b',
                              marginBottom: '0.75rem'
                            }}
                          >
                            <span 
                              style={{ 
                                fontWeight: 700, 
                                color: '#0f172a',
                                backgroundColor: '#f8fafc',
                                padding: '0.15rem 0.4rem',
                                borderRadius: '0.25rem',
                                border: '1px solid #e2e8f0'
                              }}
                            >
                              {adData.sponsorName}
                            </span>
                            <span>•</span>
                            <span style={{ color: '#10b981', fontWeight: 600 }}>Verified Partner</span>
                          </div>

                          {/* Bold, modern sponsored headline */}
                          <h2 
                            style={{
                              fontSize: '1.1875rem',
                              fontWeight: 700,
                              lineHeight: 1.4,
                              color: '#0f172a',
                              margin: '0 0 1.25rem 0',
                              letterSpacing: '-0.015em'
                            }}
                          >
                            {adData.headline}
                          </h2>

                          {/* Bulleted "Why This Matters" summary section */}
                          <div 
                            style={{
                              paddingTop: '0.75rem',
                              borderTop: '1px solid #f1f5f9',
                              marginBottom: '1rem'
                            }}
                          >
                            <div 
                              style={{
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                textTransform: 'uppercase',
                                letterSpacing: '0.04em',
                                color: '#0f172a',
                                marginBottom: '0.625rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.375rem'
                              }}
                            >
                              <TrendingUp size={13} color="#10b981" />
                              <span>Key Financial Advantage</span>
                            </div>
                            <ul className="why-matters-list">
                              {adData.whyMatters.map((bullet, bIdx) => (
                                <li key={bIdx} className="why-matters-item">
                                  {bullet}
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>

                        {/* Cohesive Emerald High-Contrast Action Button */}
                        <div style={{ padding: '0 1.75rem 1.75rem 1.75rem' }}>
                          <a
                            id={`ad-cta-${index + 1}`}
                            href={adData.ctaUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="emerald-cta-btn"
                          >
                            <span>{adData.ctaText}</span>
                            <ExternalLink size={16} strokeWidth={2.4} />
                          </a>

                          <div 
                            style={{
                              marginTop: '0.625rem',
                              textAlign: 'center',
                              fontSize: '0.6875rem',
                              color: '#94a3b8'
                            }}
                          >
                            {adData.disclosure}
                          </div>
                        </div>
                      </article>
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </div>

          {/* 
            Requirement 2 & 3: STICKY AFFILIATE WIDGET (Desktop Viewport)
            Dedicated widget space displayed as a modern, sticky right-hand sidebar.
            Populated with clean mockup for "Top Financial Pick" (High-Yield Savings Account paying 5.15% APY).
          */}
          <aside 
            id="desktop-sticky-affiliate-sidebar"
            className="sticky-affiliate-sidebar"
            aria-label="Sponsored Financial Opportunities"
          >
            <div 
              style={{
                backgroundColor: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '0.75rem',
                overflow: 'hidden',
                boxShadow: '0 4px 20px -4px rgba(15, 23, 42, 0.06)'
              }}
            >
              {/* Widget Header Badge */}
              <div 
                style={{
                  padding: '1.25rem 1.25rem 1rem 1.25rem',
                  borderBottom: '1px solid #f1f5f9',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                  <Star size={14} color="#10b981" fill="#10b981" />
                  <span 
                    style={{
                      fontSize: '0.6875rem',
                      fontWeight: 800,
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                      color: '#0f172a'
                    }}
                  >
                    Top Financial Pick
                  </span>
                </div>

                <span 
                  style={{
                    fontSize: '0.6875rem',
                    color: '#64748b',
                    fontWeight: 600,
                    textTransform: 'uppercase'
                  }}
                >
                  Partner Pick
                </span>
              </div>

              {/* Widget Core Content */}
              <div style={{ padding: '1.25rem' }}>
                <div style={{ marginBottom: '0.75rem' }}>
                  <span 
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: '#64748b'
                    }}
                  >
                    High-Yield Cash Management
                  </span>
                  <h3 
                    style={{
                      fontSize: '1.125rem',
                      fontWeight: 800,
                      color: '#0f172a',
                      margin: '0.25rem 0 0.5rem 0',
                      lineHeight: 1.3
                    }}
                  >
                    VaultPrime Liquid Savings
                  </h3>
                </div>

                {/* Rate Showcase Callout */}
                <div 
                  style={{
                    backgroundColor: '#ecfdf5',
                    border: '1px solid #d1fae5',
                    borderRadius: '0.5rem',
                    padding: '0.875rem 1rem',
                    marginBottom: '1.25rem',
                    textAlign: 'center'
                  }}
                >
                  <div 
                    style={{
                      fontSize: '1.75rem',
                      fontWeight: 900,
                      color: '#059669',
                      letterSpacing: '-0.03em',
                      lineHeight: 1
                    }}
                  >
                    5.15% APY
                  </div>
                  <div 
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: '#065f46',
                      marginTop: '0.375rem'
                    }}
                  >
                    Variable APY • 12x National Average
                  </div>
                </div>

                {/* Key Benefits Checklist */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem', marginBottom: '1.25rem' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', fontSize: '0.8125rem', color: '#334155' }}>
                    <CheckCircle2 size={16} color="#10b981" style={{ flexShrink: 0, marginTop: '0.125rem' }} />
                    <span><strong>$2.5M FDIC Insurance</strong> across program bank custodial network</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', fontSize: '0.8125rem', color: '#334155' }}>
                    <CheckCircle2 size={16} color="#10b981" style={{ flexShrink: 0, marginTop: '0.125rem' }} />
                    <span><strong>$0 Monthly Fees</strong> and no minimum deposit balance</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', fontSize: '0.8125rem', color: '#334155' }}>
                    <CheckCircle2 size={16} color="#10b981" style={{ flexShrink: 0, marginTop: '0.125rem' }} />
                    <span><strong>Instant Liquidity</strong> with same-day ACH & FedNow transfers</span>
                  </div>
                </div>

                {/* High-Contrast Action Button */}
                <a
                  id="affiliate-widget-cta-btn"
                  href="https://www.marketwatch.com/personal-finance/banking/high-yield-cash-sweeps"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="emerald-cta-btn"
                  style={{ width: '100%' }}
                >
                  <span>Open Account & Earn 5.15%</span>
                  <ExternalLink size={15} strokeWidth={2.4} />
                </a>

                {/* Editorial Disclosure */}
                <p 
                  style={{
                    fontSize: '0.6875rem',
                    color: '#94a3b8',
                    lineHeight: 1.4,
                    margin: '0.875rem 0 0 0',
                    textAlign: 'center'
                  }}
                >
                  Sponsored Partner • Member FDIC. We may earn a commission when you register through our links at no cost to you.
                </p>
              </div>
            </div>
          </aside>
        </div>
      </main>

      {/* 
        Requirement 2 & 3: MOBILE DISMISSIBLE BOTTOM-FLOATING BANNER
        On mobile viewports (<1024px), transforms the affiliate offer into an elegant, dismissible bottom-floating banner.
      */}
      {!isMobileBannerDismissed && (
        <aside 
          id="mobile-affiliate-floating-banner"
          className="mobile-floating-banner"
          aria-label="Special Financial Opportunity"
          style={{
            display: 'flex'
          }}
        >
          {/* Top header row inside banner */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
              <span 
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  fontSize: '0.6875rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  color: '#0f172a'
                }}
              >
                <Star size={13} color="#10b981" fill="#10b981" />
                <span>Top Cash Pick: VaultPrime</span>
              </span>
              <span 
                style={{
                  fontSize: '0.6875rem',
                  fontWeight: 800,
                  color: '#059669',
                  backgroundColor: '#ecfdf5',
                  padding: '0.125rem 0.375rem',
                  borderRadius: '9999px',
                  border: '1px solid #d1fae5'
                }}
              >
                5.15% APY
              </span>
            </div>

            {/* Dismiss Button */}
            <button
              id="dismiss-mobile-banner-btn"
              onClick={() => setIsMobileBannerDismissed(true)}
              aria-label="Dismiss affiliate banner"
              style={{
                background: 'none',
                border: 'none',
                padding: '0.25rem',
                color: '#94a3b8',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center'
              }}
            >
              <X size={16} />
            </button>
          </div>

          {/* Banner Description */}
          <p style={{ margin: 0, fontSize: '0.8125rem', color: '#475569', lineHeight: 1.4 }}>
            Earn <strong>5.15% APY</strong> with $2.5M FDIC sweep insurance and $0 fees.
          </p>

          {/* Action Button & Link */}
          <a
            id="mobile-affiliate-cta-btn"
            href="https://www.marketwatch.com/personal-finance/banking/high-yield-cash-sweeps"
            target="_blank"
            rel="noopener noreferrer"
            className="emerald-cta-btn"
            style={{ padding: '0.625rem 1rem', fontSize: '0.875rem' }}
          >
            <span>Claim 5.15% APY ↗</span>
          </a>
        </aside>
      )}

      {/* 
        Rule 1: Modal View with Dynamic Canonical Update
        When open, the canonical URL dynamically shifts to activeStory.original_url
      */}
      {activeStory && (
        <div 
          id="reader-modal-overlay"
          className="modal-backdrop"
          onClick={() => setActiveStory(null)}
        >
          <div 
            id="reader-modal-card"
            className="modal-box"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Top Bar */}
            <div 
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between', 
                marginBottom: '1.25rem' 
              }}
            >
              <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
                {activeStory.tags && activeStory.tags.map((tag, idx) => (
                  <span key={tag} className={`tag-pill ${idx === 0 ? 'emerald' : ''}`}>
                    {tag}
                  </span>
                ))}
              </div>

              <button
                id="close-reader-modal"
                onClick={() => setActiveStory(null)}
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '0.375rem',
                  padding: '0.4rem',
                  cursor: 'pointer',
                  color: '#64748b',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Headline */}
            <h2 
              style={{
                fontSize: '1.5rem',
                fontWeight: 800,
                color: '#0f172a',
                lineHeight: 1.3,
                margin: '0 0 0.75rem 0',
                letterSpacing: '-0.02em'
              }}
            >
              {activeStory.ai_hook_title || activeStory.original_title}
            </h2>

            {/* Credit Metadata inside Modal */}
            <div 
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                fontSize: '0.8125rem',
                color: '#64748b',
                paddingBottom: '1.25rem',
                marginBottom: '1.5rem',
                borderBottom: '1px solid #e2e8f0'
              }}
            >
              <span>Source: <strong>{activeStory.source}</strong></span>
              <span>•</span>
              <span>{formatRelativeTime(activeStory.timestamp)}</span>
              <span>•</span>
              <span style={{ color: '#10b981', fontWeight: 600 }}>Canonical Verified</span>
            </div>

            {/* Why This Matters Box */}
            <div 
              style={{
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderLeft: '4px solid #10b981',
                borderRadius: '0.5rem',
                padding: '1.25rem',
                marginBottom: '1.5rem'
              }}
            >
              <div 
                style={{
                  fontSize: '0.8125rem',
                  fontWeight: 700,
                  color: '#0f172a',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  marginBottom: '0.75rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.375rem'
                }}
              >
                <Sparkles size={14} color="#10b981" />
                <span>Executive Analysis (Why This Matters)</span>
              </div>
              <ul className="why-matters-list">
                {activeStory.ai_summary && activeStory.ai_summary.map((item, idx) => (
                  <li key={idx} className="why-matters-item" style={{ fontSize: '0.9375rem', color: '#334155' }}>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Story Description / Original Abstract */}
            <div style={{ fontSize: '1rem', lineHeight: 1.7, color: '#334155', marginBottom: '2rem' }}>
              <p style={{ margin: 0 }}>
                {activeStory.original_description}
              </p>
            </div>

            {/* Bottom Actions: Safe target="_blank" rel="noopener noreferrer" link */}
            <div 
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingTop: '1.25rem',
                borderTop: '1px solid #e2e8f0',
                flexWrap: 'wrap',
                gap: '1rem'
              }}
            >
              <button
                onClick={() => toggleBookmark(activeStory.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.375rem',
                  background: 'none',
                  border: 'none',
                  color: savedStories.includes(activeStory.id) ? '#3b82f6' : '#64748b',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                {savedStories.includes(activeStory.id) ? <BookmarkCheck size={18} /> : <Bookmark size={18} />}
                <span>{savedStories.includes(activeStory.id) ? 'Saved in Reading List' : 'Save for Later'}</span>
              </button>

              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <a
                  id="modal-external-link"
                  href={activeStory.original_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="read-story-btn"
                  style={{ width: 'auto', padding: '0.625rem 1.25rem', display: 'inline-flex' }}
                >
                  <span>Open Original Source</span>
                  <ExternalLink size={15} />
                </a>
                
                <button
                  onClick={() => setActiveStory(null)}
                  style={{
                    padding: '0.625rem 1.25rem',
                    borderRadius: '0.5rem',
                    border: '1px solid #e2e8f0',
                    backgroundColor: '#f8fafc',
                    color: '#0f172a',
                    fontWeight: 600,
                    fontSize: '0.875rem',
                    cursor: 'pointer'
                  }}
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer 
        id="simple-footer"
        style={{
          borderTop: '1px solid #e2e8f0',
          padding: '1.75rem 1.5rem',
          textAlign: 'center',
          fontSize: '0.8125rem',
          color: '#64748b',
          backgroundColor: '#ffffff'
        }}
      >
        <div style={{ maxWidth: '86rem', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
          <span>Personal Finance & Fintech News Hub • RSS & AI Aggregator</span>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <span>SEO Canonical Active</span>
            <span>•</span>
            <span>rel="noopener noreferrer" Enforced</span>
            <span>•</span>
            <span>Sponsored Disclosures Active</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <HelmetProvider>
      <NewsHubContent />
    </HelmetProvider>
  );
}
