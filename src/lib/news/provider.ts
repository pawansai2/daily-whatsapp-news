import { XMLParser } from 'fast-xml-parser';


export interface NewsLocation {
    country?: string;
    state?: string;
    district?: string;
    city?: string;
}
export interface NewsStory {
    id: string;
    title: string;
    description: string;
    source: string;
    originalUrl: string;
    category: string;
    region: string;
    publishedAt: string;
    score: number;
}

const TRUSTED_RSS_FEEDS = [
    { url: 'https://techcrunch.com/feed/', category: 'Tech', region: 'global' },
    // Add more trusted fixed RSS feeds
];

export async function fetchNewsFromRSS(): Promise<NewsStory[]> {
    const stories: NewsStory[] = [];
    const parser = new XMLParser();

    for (const feed of TRUSTED_RSS_FEEDS) {
        try {
            // HTTPS only validation
            if (!feed.url.startsWith('https://')) continue;

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

            const response = await fetch(feed.url, { signal: controller.signal });
            clearTimeout(timeoutId);

            if (!response.ok) continue;

            const text = await response.text();

            // Limit response size
            if (text.length > 1024 * 500) continue; // max 500kb

            const result = parser.parse(text);
            const items = result?.rss?.channel?.item || [];

            // Limit article count
            const topItems = Array.isArray(items) ? items.slice(0, 10) : [items];

            for (const item of topItems) {
                if (item.title && item.link) {
                    stories.push({
                        id: Buffer.from(item.link).toString('base64'),
                        title: item.title,
                        description: item.description || '',
                        source: feed.url,
                        originalUrl: item.link,
                        category: feed.category,
                        region: feed.region,
                        publishedAt: item.pubDate || new Date().toISOString(),
                        score: 0 // to be calculated later
                    });
                }
            }
        } catch (error) {
            console.error(`Failed to fetch RSS feed: ${feed.url}`, error);
        }
    }
    return stories;
}

export async function fetchNews(interests: string[], language: string, location: NewsLocation): Promise<NewsStory[]> {
    void interests;
    void language;
    void location;
    if (process.env.NEWS_PROVIDER_MODE === 'mock') {
        return [
            {
                id: 'mock-1',
                title: 'Mock AI Startup raises $10M',
                description: 'A new startup in the AI space...',
                source: 'MockTech',
                originalUrl: 'https://example.com/mock-1',
                category: 'AI',
                region: 'interest',
                publishedAt: new Date().toISOString(),
                score: 100
            }
        ];
    }
    return fetchNewsFromRSS();
}

export function filterAndRankStories(stories: NewsStory[], sentHashes: string[]): NewsStory[] {
    const uniqueStories = new Map<string, NewsStory>();

    // Duplicate detection and freshness
    const ONE_DAY = 24 * 60 * 60 * 1000;
    const now = Date.now();

    for (const story of stories) {
        const publishedTime = new Date(story.publishedAt).getTime();
        // Freshness filtering (within last 48 hours)
        if (now - publishedTime > 2 * ONE_DAY) continue;

        // URL deduplication
        if (!uniqueStories.has(story.originalUrl)) {
            uniqueStories.set(story.originalUrl, story);
        }
    }

    const filtered = Array.from(uniqueStories.values()).filter(s => !sentHashes.includes(s.id));

    // Simple deterministic scoring
    for (const story of filtered) {
        story.score = new Date(story.publishedAt).getTime(); // Rank by newest
    }

    return filtered.sort((a, b) => b.score - a.score);
}