import crypto from 'crypto';
import { Topic } from '../models/topic.interface';
import { ITopicRepository } from '../repositories/topic.repository';
import { AgentService } from './agent.service';
import { parseRssXml } from '../utils/rssParser';

export interface DiscoverySource {
  name: string;
  url: string;
  type: 'rss';
  enabled: boolean;
}

export class DiscoveryService {
  private topicRepository: ITopicRepository;
  private agentService: AgentService;

  // Configure discovery sources
  private sources: DiscoverySource[] = [
    {
      name: 'TechCrunch',
      url: 'https://techcrunch.com/feed/',
      type: 'rss',
      enabled: true,
    },
    {
      name: 'Hacker News',
      url: 'https://news.ycombinator.com/rss',
      type: 'rss',
      enabled: true,
    },
  ];

  constructor(topicRepository: ITopicRepository, agentService: AgentService) {
    this.topicRepository = topicRepository;
    this.agentService = agentService;
  }

  /**
   * Fetches an external URL with an AbortController timeout.
   */
  private async fetchWithTimeout(
    url: string,
    options: RequestInit = {},
    timeoutMs = 5000
  ): Promise<Response> {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, {
        ...options,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(id);
    }
  }

  /**
   * Dependency-free HTML tag stripper and decoder helper.
   */
  private cleanHtml(text: string): string {
    if (!text) return '';
    // Strip script, style, iframe blocks
    let cleaned = text.replace(/<(script|style|iframe)[^>]*>[\s\S]*?<\/\1>/gi, '');
    // Strip HTML tags
    cleaned = cleaned.replace(/<[^>]+>/g, ' ');
    // Decode common HTML entities
    cleaned = cleaned
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&apos;/g, "'")
      .replace(/&nbsp;/g, ' ');
    // Clean excessive whitespaces
    return cleaned.replace(/\s+/g, ' ').trim();
  }

  /**
   * Computes simple keyword domain relevance score.
   */
  private calculateRelevance(
    title: string,
    summary: string,
    domain: string
  ): number {
    const domainWords = domain
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 2);

    if (domainWords.length === 0) return 0;

    const content = `${title} ${summary}`.toLowerCase();
    let score = 0;

    for (const word of domainWords) {
      if (content.includes(word)) {
        score += 1;
      }
    }
    return score;
  }

  /**
   * Gets the list of discovery sources configured in the engine.
   */
  getSources(): DiscoverySource[] {
    return [...this.sources];
  }

  /**
   * Performs the Live Topic Discovery cycle for a specific agent.
   */
  async discover(agentId: string): Promise<number> {
    // 1. Confirm the agent exists
    const agent = await this.agentService.getAgentById(agentId);
    if (!agent) {
      throw new Error('Agent not found');
    }

    const domain = agent.persona.domain;
    const enabledSources = this.sources.filter((s) => s.enabled);
    const discoveredCandidates: Array<{ item: any; relevance: number }> = [];

    // 2. Fetch live sources concurrently
    const fetchPromises = enabledSources.map(async (source) => {
      try {
        const response = await this.fetchWithTimeout(
          source.url,
          {
            headers: {
              'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              Accept: 'application/xml, text/xml, */*',
            },
          },
          5000 // 5 seconds timeout
        );

        if (!response.ok) {
          throw new Error(`Failed with status: ${response.status}`);
        }

        const xmlText = await response.text();
        const parsedItems = parseRssXml(xmlText);

        for (const item of parsedItems) {
          const cleanedTitle = this.cleanHtml(item.title);
          const cleanedSummary = this.cleanHtml(item.description);

          // Perform relevance scoring
          const relevance = this.calculateRelevance(
            cleanedTitle,
            cleanedSummary,
            domain
          );

          discoveredCandidates.push({
            item: {
              title: cleanedTitle,
              summary: cleanedSummary,
              link: item.link,
              pubDate: item.pubDate,
              sourceName: source.name,
            },
            relevance,
          });
        }
      } catch (err: any) {
        // Record failure of single source, do not crash other streams
        console.error(`[Discovery] Error fetching source "${source.name}":`, err.message);
      }
    });

    await Promise.allSettled(fetchPromises);

    // 3. Sort candidates by keyword relevance match (highest first)
    discoveredCandidates.sort((a, b) => b.relevance - a.relevance);

    const now = new Date().toISOString();
    const topicsToSave: Topic[] = [];

    // 4. Normalize and create Topic objects
    for (const cand of discoveredCandidates) {
      const { title, summary, link, pubDate, sourceName } = cand.item;

      // Generate unique topic ID
      const randomHex = crypto.randomBytes(4).toString('hex');
      const topicId = `topic-${randomHex}`;

      // Handle pubDate parsing, fall back to current time
      let publishedAt = now;
      if (pubDate) {
        const parsedUnix = Date.parse(pubDate);
        if (!isNaN(parsedUnix)) {
          publishedAt = new Date(parsedUnix).toISOString();
        }
      }

      topicsToSave.push({
        id: topicId,
        agentId,
        title,
        summary: summary || 'No summary available.',
        source: {
          name: sourceName,
          url: link,
        },
        publishedAt,
        discoveredAt: now,
      });
    }

    // Save batch to repository
    if (topicsToSave.length > 0) {
      await this.topicRepository.saveAll(topicsToSave);
    }

    return topicsToSave.length;
  }
}
