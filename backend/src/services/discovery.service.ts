import crypto from 'crypto';
import { Topic } from '../models/topic.interface';
import { ITopicRepository } from '../repositories/topic.repository';
import { AgentService } from './agent.service';
import { parseRssXml } from '../utils/rssParser';
import { expandDomainQueries } from '../utils/domainQueryExpander';
import { normalizeText } from '../utils/textNormalizer';
import { globalActivityService } from './activity.service';

export interface DiscoverySource {
  name: string;
  url: string;
  type: 'rss' | 'query_rss';
  enabled: boolean;
  query?: string;
}

export class DiscoveryService {
  private sources: DiscoverySource[] = [
    {
      name: 'TechCrunch AI',
      url: 'https://techcrunch.com/category/artificial-intelligence/feed/',
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

  getSources(): DiscoverySource[] {
    return [...this.sources];
  }

  private topicRepository: ITopicRepository;
  private agentService: AgentService;

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
    let cleaned = text
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&apos;/g, "'")
      .replace(/&amp;/g, '&')
      .replace(/&nbsp;/g, ' ');

    cleaned = cleaned.replace(/<(script|style|iframe)[^>]*>[\s\S]*?<\/\1>/gi, '');
    cleaned = cleaned.replace(/<[^>]+>/g, ' ');
    return cleaned.replace(/\s+/g, ' ').trim();
  }

  /**
   * Parses publication timestamp into ISO 8601 UTC string.
   */
  private parsePublishedAt(pubDate?: string): string {
    if (!pubDate) return new Date().toISOString();
    const parsed = Date.parse(pubDate);
    if (!isNaN(parsed)) {
      return new Date(parsed).toISOString();
    }
    return new Date().toISOString();
  }

  /**
   * Calculates Freshness Score (0–100) based on age in hours.
   */
  private calculateFreshness(publishedAt: string): number {
    const pubTime = Date.parse(publishedAt);
    if (isNaN(pubTime)) return 50;
    const diffMs = Math.max(0, Date.now() - pubTime);
    const diffHours = diffMs / (1000 * 60 * 60);

    if (diffHours <= 6) return 100;
    if (diffHours <= 24) return 85;
    if (diffHours <= 48) return 65;
    if (diffHours <= 72) return 40;
    return 15;
  }

  /**
   * Computes weighted domain relevance score (0–100).
   */
  private calculateWeightedRelevance(
    title: string,
    summary: string,
    domain: string,
    expandedQueries: string[],
    interests: string[] = []
  ): number {
    const content = `${title} ${summary}`.toLowerCase();
    const lowerDomain = domain.toLowerCase().trim();

    // 1. Check exact domain phrase match
    if (content.includes(lowerDomain)) {
      return 100;
    }

    // 2. Check concept matches from expanded queries
    let conceptHits = 0;
    for (const query of expandedQueries) {
      const lowerQuery = query.toLowerCase().trim();
      if (lowerQuery.length >= 3 && content.includes(lowerQuery)) {
        conceptHits++;
      }
    }
    if (conceptHits >= 2) return 95;
    if (conceptHits === 1) return 85;

    // 3. Check persona interests match
    let interestHits = 0;
    for (const interest of interests) {
      const lowerInterest = interest.toLowerCase().trim();
      if (lowerInterest.length >= 3 && content.includes(lowerInterest)) {
        interestHits++;
      }
    }
    if (interestHits >= 1) return 75;

    // 4. Check domain word breakdown
    const domainWords = lowerDomain.split(/\s+/).filter((w) => w.length >= 3);
    let wordHits = 0;
    for (const w of domainWords) {
      if (content.includes(w)) {
        wordHits++;
      }
    }
    if (domainWords.length > 0 && wordHits === domainWords.length) {
      return 70;
    }

    if (wordHits > 0) return 30;

    return 0;
  }

  /**
   * Performs story cluster deduplication by title similarity.
   */
  private deduplicateCandidates(
    candidates: Array<{ item: any; relevance: number; freshness: number }>
  ): Array<{ item: any; relevance: number; freshness: number; multiSourceBoost: number }> {
    const clusters: Array<{
      canonical: { item: any; relevance: number; freshness: number; multiSourceBoost: number };
      titleTokens: Set<string>;
    }> = [];

    for (const c of candidates) {
      const normalizedTitle = normalizeText(c.item.title);
      const tokens = new Set(normalizedTitle.split(' ').filter((t) => t.length >= 3));

      let matchedCluster = false;
      for (const cluster of clusters) {
        // Compute Jaccard token overlap
        let overlap = 0;
        for (const t of tokens) {
          if (cluster.titleTokens.has(t)) {
            overlap++;
          }
        }
        const union = new Set([...tokens, ...cluster.titleTokens]).size;
        const similarity = union > 0 ? overlap / union : 0;

        if (similarity >= 0.5 || c.item.link === cluster.canonical.item.link) {
          matchedCluster = true;
          cluster.canonical.multiSourceBoost += 10; // Boost multi-source coverage signal
          // Retain fresher/higher relevant canonical item
          if (c.relevance > cluster.canonical.relevance || (c.relevance === cluster.canonical.relevance && c.freshness > cluster.canonical.freshness)) {
            cluster.canonical.item = c.item;
            cluster.canonical.relevance = c.relevance;
            cluster.canonical.freshness = c.freshness;
          }
          break;
        }
      }

      if (!matchedCluster) {
        clusters.push({
          canonical: {
            item: c.item,
            relevance: c.relevance,
            freshness: c.freshness,
            multiSourceBoost: 0,
          },
          titleTokens: tokens,
        });
      }
    }

    return clusters.map((cl) => cl.canonical);
  }

  /**
   * Performs Live Domain-Aware Topic Discovery for an agent.
   */
  async discover(agentId: string): Promise<number> {
    // 1. Confirm the agent exists
    const agent = await this.agentService.getAgentById(agentId);
    if (!agent) {
      throw new Error('Agent not found');
    }

    const persona = agent.persona;
    const domain = persona.domain;
    const interests = persona.interests || [];

    // 2. Expand domain queries
    const expandedQueries = expandDomainQueries(domain, interests);

    // Record activity events
    try {
      await globalActivityService.recordEvent(
        agentId,
        'DISCOVERY_STARTED',
        `Started domain-aware discovery for persona "${persona.name}" (Domain: "${domain}").`
      );
      await globalActivityService.recordEvent(
        agentId,
        'TOPICS_DISCOVERED',
        `Generated ${expandedQueries.length} domain search queries: ${expandedQueries.slice(0, 4).join(', ')}...`
      );
    } catch (_) {}

    // 3. Construct live domain discovery sources combining domain queries and configured sources
    const sourcesToCrawl: DiscoverySource[] = [
      ...expandedQueries.slice(0, 4).map((q) => ({
        name: `Google News (${q})`,
        url: `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-US&gl=US&ceid=US:en`,
        type: 'query_rss' as const,
        enabled: true,
        query: q,
      })),
      ...this.sources.filter((s) => s.enabled),
    ];

    const rawCandidates: Array<{ item: any; relevance: number; freshness: number }> = [];
    const rejectedLog: Array<{ title: string; reason: string }> = [];

    // 4. Crawl sources concurrently
    await Promise.allSettled(
      sourcesToCrawl.map(async (source) => {
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
            5000
          );

          if (!response || !response.ok) {
            throw new Error(`HTTP status ${response ? response.status : 'no response'}`);
          }

          const xmlText = await response.text();
          const parsedItems = parseRssXml(xmlText);

          for (const item of parsedItems) {
            const cleanedTitle = this.cleanHtml(item.title);
            const cleanedSummary = this.cleanHtml(item.description);

            if (!cleanedTitle || cleanedTitle.length < 5) continue;

            const publishedAt = this.parsePublishedAt(item.pubDate);
            const freshness = this.calculateFreshness(publishedAt);
            const relevance = this.calculateWeightedRelevance(
              cleanedTitle,
              cleanedSummary,
              domain,
              expandedQueries,
              interests
            );

            // Pre-filtering Hard Rejection Rules
            if (relevance < 40) {
              if (rejectedLog.length < 20) {
                rejectedLog.push({
                  title: cleanedTitle,
                  reason: `Low domain relevance (${relevance}/100) to domain "${domain}".`,
                });
              }
              continue;
            }

            if (freshness <= 15 && relevance < 85) {
              if (rejectedLog.length < 20) {
                rejectedLog.push({
                  title: cleanedTitle,
                  reason: `Publication date expired (${freshness}/100 freshness).`,
                });
              }
              continue;
            }

            rawCandidates.push({
              item: {
                title: cleanedTitle,
                summary: cleanedSummary || cleanedTitle,
                link: item.link || '',
                pubDate: publishedAt,
                sourceName: source.name,
              },
              relevance,
              freshness,
            });
          }
        } catch (err: any) {
          console.error(`[Discovery] Error fetching source "${source.name}":`, err.message);
          try {
            await globalActivityService.recordEvent(
              agentId,
              'SOURCE_ERROR',
              `Failed to crawl discovery source "${source.name}": ${err.message}`
            );
          } catch (_) {}
        }
      })
    );

    // 5. Deduplicate story clusters
    const deduplicated = this.deduplicateCandidates(rawCandidates);

    // 6. Rank candidates by (Relevance * 0.5 + Freshness * 0.3 + MultiSource * 0.2)
    deduplicated.sort((a, b) => {
      const scoreA = a.relevance * 0.5 + a.freshness * 0.3 + a.multiSourceBoost * 0.2;
      const scoreB = b.relevance * 0.5 + b.freshness * 0.3 + b.multiSourceBoost * 0.2;
      return scoreB - scoreA;
    });

    // 7. Save top 20 candidates to Topic Repository (reusing existing topic record if present)
    const topCandidates = deduplicated.slice(0, 20);
    const existingTopics = await this.topicRepository.findByAgentId(agentId);
    let newSavedCount = 0;

    for (const c of topCandidates) {
      const normTitle = normalizeText(c.item.title);
      const existing = existingTopics.find(
        (t) => (c.item.link && t.source.url === c.item.link) || normalizeText(t.title) === normTitle
      );

      if (existing) {
        // Topic already exists for this agent; update metadata
        existing.summary = c.item.summary || existing.summary;
        existing.discoveredAt = new Date().toISOString();
        await this.topicRepository.save(existing);
      } else {
        const topicId = `topic-${crypto.randomBytes(4).toString('hex')}`;
        const newTopic: Topic = {
          id: topicId,
          agentId,
          title: c.item.title,
          summary: c.item.summary,
          source: {
            name: c.item.sourceName,
            url: c.item.link,
          },
          publishedAt: c.item.pubDate,
          discoveredAt: new Date().toISOString(),
        };

        await this.topicRepository.save(newTopic);
        newSavedCount++;
      }
    }

    try {
      await globalActivityService.recordEvent(
        agentId,
        'TOPICS_DISCOVERED',
        `Discovery completed for domain "${domain}". Discovered: ${rawCandidates.length} raw, Saved: ${newSavedCount} candidates.`
      );
    } catch (_) {}

    return newSavedCount;
  }
}
