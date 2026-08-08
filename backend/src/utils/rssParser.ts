export interface RawSourceItem {
  title: string;
  link: string;
  description: string;
  pubDate?: string;
}

/**
 * Dependency-free helper to extract items from RSS XML string.
 * Handles CDATA wrappers safely.
 */
export function parseRssXml(xml: string): RawSourceItem[] {
  const items: RawSourceItem[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const itemContent = match[1];

    const titleMatch = itemContent.match(/<title>(?:<!\[CDATA\[([\s\S]*?)\]\]>|([\s\S]*?))<\/title>/i);
    const linkMatch = itemContent.match(/<link>(?:<!\[CDATA\[([\s\S]*?)\]\]>|([\s\S]*?))<\/link>/i);
    const descMatch = itemContent.match(/<description>(?:<!\[CDATA\[([\s\S]*?)\]\]>|([\s\S]*?))<\/description>/i);
    const pubDateMatch = itemContent.match(/<pubDate>(?:<!\[CDATA\[([\s\S]*?)\]\]>|([\s\S]*?))<\/pubDate>/i);

    const title = (titleMatch ? (titleMatch[1] || titleMatch[2]) : '').trim();
    const link = (linkMatch ? (linkMatch[1] || linkMatch[2]) : '').trim();
    const description = (descMatch ? (descMatch[1] || descMatch[2]) : '').trim();
    const pubDate = pubDateMatch ? (pubDateMatch[1] || pubDateMatch[2]).trim() : undefined;

    if (title || link) {
      items.push({ title, link, description, pubDate });
    }
  }

  return items;
}
