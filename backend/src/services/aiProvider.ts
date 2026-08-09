import Groq from 'groq-sdk';
import { Persona } from '../models/agent.interface';
import { Topic } from '../models/topic.interface';
import { config, validateConfig } from '../config';
import { AppError, AIProviderError } from '../utils/errors';

export interface GenerationInput {
  persona: Persona;
  topic: Topic;
  editorialDecision: {
    decision: 'ACCEPT' | 'REJECT';
    overallScore: number;
    reason: string;
  };
  memoryContext: {
    isKnown: boolean;
    matchType?: string;
  };
}

export interface GeneratedContent {
  text: string;
  angle: string;
  keyPoints: string[];
  content?: {
    blog: {
      title: string;
      text: string;
    };
    linkedin: {
      text: string;
      hashtags?: string[];
    };
    x: {
      text: string;
      hashtags?: string[];
    };
  };
}

export interface IAIProvider {
  generateText(input: GenerationInput): Promise<GeneratedContent>;
  setFailureMode(mode: 'rate_limit' | 'unavailable' | 'invalid_key' | 'timeout' | 'malformed' | 'empty' | null, attempts?: number): void;
}

export class GroqAIProvider implements IAIProvider {
  setFailureMode(mode: 'rate_limit' | 'unavailable' | 'invalid_key' | 'timeout' | 'malformed' | 'empty' | null, attempts = 0): void {
    // No-op for real LLM provider during test simulations
  }

  private getClient(): Groq {
    const apiKey = (process.env.GROQ_API_KEY !== undefined ? process.env.GROQ_API_KEY : (config.groqApiKey || '')).trim();
    if (!apiKey) {
      const { AIProviderError } = require('../utils/errors');
      throw new AIProviderError('GROQ_API_KEY environment variable is required when AI_PROVIDER is set to "groq".', false);
    }
    return new Groq({ apiKey });
  }

  async generateText(input: GenerationInput): Promise<GeneratedContent> {
    const groq = this.getClient();
    const model = (process.env.GROQ_MODEL || config.groqModel || 'llama-3.3-70b-versatile').trim();

    const { name, role, domain, description, tone, editorialPrinciples, interests, expertise } = input.persona;
    const { title, summary, source } = input.topic;
    const { overallScore, reason } = input.editorialDecision;

    const cleanDomainTag = domain.replace(/[^a-zA-Z0-9]/g, '');

    const systemPrompt = `You are ${name}, a seasoned, highly respected technology professional working as a "${role || 'Senior Researcher'}" specializing in "${domain}".

PERSONA PROFILE:
- Domain Focus: ${domain}
- Role & Expertise: ${role || 'Expert'} (${description || domain})
- Tone & Style: ${tone ? tone.join(', ') : 'analytical, authoritative, concise, pragmatic'}
- Editorial Principles: ${editorialPrinciples ? editorialPrinciples.join('; ') : 'Evidence over hype; focus on practical implications'}
- Core Interests: ${interests ? interests.join(', ') : domain}

WRITING & EDITORIAL MANDATES:
1. VOICE & PERSPECTIVE:
   - Write like an experienced human technology professional explaining developments to another technically informed peer.
   - Express a clear, informed, authoritative point of view aligned with your persona (${role}).
   - Tailor all analysis specifically to ${domain}: explain what happened, why it matters, who is affected, and what changes for practitioners.
   - DO NOT repeatedly write "As an AI security researcher...". Express your persona naturally through tone, depth, and choice of focus.

2. ABSOLUTE BAN ON GENERIC AI CLICHÉS & BOILERPLATE:
   - STRICTLY FORBIDDEN PHRASES: "In today's rapidly evolving world", "In the ever-changing landscape", "It is important to note", "This groundbreaking development", "AI continues to revolutionise", "Let's dive in", "Exciting times ahead", "In conclusion", "Here are some key takeaways".
   - FORBIDDEN PREFIXES: "Here is your blog post", "Here is a LinkedIn post", "Sure! Here is", "As requested".
   - Avoid fake enthusiasm, exaggerated claims, corporate marketing buzzwords, and repetitive sentence structures.

3. STRICT FACTUAL GROUNDING & NO INVENTED FACTS:
   - Base all factual claims STRICTLY on information contained in the provided topic summary and source metadata.
   - DO NOT invent quotes, statistics, research papers, company statements, benchmark numbers, dates, or product capabilities that are not in the source text.
   - DO NOT fabricate source URLs.
   - Clearly distinguish between FACT (what the source reports) and INTERPRETATION (what your persona analyzes it to mean).

PLATFORM FORMATTING SPECIFICATIONS (RETURN VALID JSON ONLY):
Produce THREE distinct, non-overlapping content formats tailored specifically for their respective platforms:

1. "blog": Short-form technical editorial article (500–800 words).
   - "title": Clean, compelling headline. DO NOT prepend "[Analysis]" or clickbait prefixes.
   - "text": Full Markdown article structured with short paragraphs and clear section headings:
     - 2 short opening paragraphs introducing the event and immediate relevance.
     - "## What Happened": Core factual breakdown based strictly on source material.
     - "## Why It Matters": Strategic and technical significance for ${domain}.
     - "## Practical Implications": Direct impact for developers, engineers, or leaders in ${domain}.
     - "## Key Takeaways": 3–5 bullet points (\`- ...\`).
     - "## Final Take": Concise concluding perspective. DO NOT use "In conclusion".

2. "linkedin": Professional LinkedIn post (180–300 words).
   - "text": Structured post with short paragraphs, double line breaks, and Unicode bullets (\`•\` or \`→\`).
     - HOOK: 1–2 line strong, natural observation.
     - CONTEXT & ANALYSIS: What happened and why it matters in ${domain}.
     - KEY TAKEAWAYS: 3–5 bullet points (\`• ...\`).
     - PERSPECTIVE: Your editorial opinion as a ${role}.
     - HASHTAGS: Appended with 4–6 topic-specific hashtags at the very bottom (e.g. #${cleanDomainTag} #TechNews). DO NOT use generic spam hashtags (#Success #Future #AI).
   - "hashtags": Array of 4–6 topic-specific hashtag strings.

3. "x": Concise X post / tweet.
   - "text": Exactly ONE post strictly UNDER 280 CHARACTERS total (including text & 1–2 hashtags).
   - "hashtags": Array of 1–2 hashtag strings.

RETURN ONLY RAW VALID JSON MATCHING THIS EXACT SCHEMA:
{
  "blog": {
    "title": "Editorial Headline",
    "text": "Full markdown blog content..."
  },
  "linkedin": {
    "text": "Full formatted LinkedIn post with line breaks and hashtags...",
    "hashtags": ["#Hashtag1", "#Hashtag2"]
  },
  "x": {
    "text": "Sharp concise tweet strictly under 280 chars #Hashtag",
    "hashtags": ["#Hashtag1"]
  }
}`;

    const userPrompt = `TOPIC TITLE: ${title}
SOURCE NAME: ${source.name}
SOURCE URL: ${source.url}
SUMMARY: ${summary}

EDITORIAL EVALUATION REASONING: ${reason} (Overall Score: ${overallScore}/100)
MEMORY CONTEXT: ${input.memoryContext.isKnown ? `Previously evaluated topic (Match: ${input.memoryContext.matchType})` : 'New topic'}`;

    try {
      const response = await groq.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
        response_format: { type: 'json_object' },
      });

      const rawJson = response.choices[0]?.message?.content || '';
      if (!rawJson.trim()) {
        const { AIProviderError } = require('../utils/errors');
        throw new AIProviderError('Groq LLM returned an empty response', true);
      }

      let parsed: any;
      try {
        parsed = JSON.parse(rawJson);
      } catch (parseErr) {
        const retryResponse = await groq.chat.completions.create({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
            { role: 'assistant', content: rawJson },
            { role: 'user', content: 'Your output was not valid JSON. Return ONLY raw JSON with keys "blog", "linkedin", and "x".' },
          ],
          temperature: 0.2,
          response_format: { type: 'json_object' },
        });
        const retryRaw = retryResponse.choices[0]?.message?.content || '';
        parsed = JSON.parse(retryRaw);
      }

      if (!parsed || !parsed.blog || !parsed.blog.title || !parsed.blog.text || !parsed.linkedin?.text || !parsed.x?.text) {
        const { AIProviderError } = require('../utils/errors');
        throw new AIProviderError('Groq LLM returned invalid content structure missing required format keys', true);
      }

      let linkedinText = String(parsed.linkedin.text).trim();
      const linkedinHashtags = Array.isArray(parsed.linkedin.hashtags) ? parsed.linkedin.hashtags : [];
      if (linkedinHashtags.length > 0 && !linkedinText.includes('#')) {
        linkedinText += `\n\n${linkedinHashtags.join(' ')}`;
      }

      let xText = String(parsed.x.text).trim();
      const xHashtags = Array.isArray(parsed.x.hashtags) ? parsed.x.hashtags : [];
      if (xHashtags.length > 0 && !xText.includes('#') && (xText.length + xHashtags.join(' ').length + 2) <= 280) {
        xText += ` ${xHashtags.join(' ')}`;
      }
      if (xText.length > 280) {
        xText = xText.slice(0, 277) + '...';
      }

      let blogTitle = String(parsed.blog.title).trim();
      if (blogTitle.startsWith('[Analysis] ')) {
        blogTitle = blogTitle.replace('[Analysis] ', '');
      }

      const content = {
        blog: {
          title: blogTitle,
          text: String(parsed.blog.text).trim(),
        },
        linkedin: {
          text: linkedinText,
          hashtags: linkedinHashtags,
        },
        x: {
          text: xText,
          hashtags: xHashtags,
        },
      };

      const angle = `Editorial analysis by ${name} on ${title}`;
      const keyPoints = [
        `Topic: ${title}`,
        `Editorial Score: ${overallScore}/100`,
        `Source: ${source.name}`,
      ];

      return {
        text: content.blog.text,
        angle,
        keyPoints,
        content,
      };
    } catch (err: any) {
      const { AIProviderError } = require('../utils/errors');
      if (err instanceof AIProviderError) {
        throw err;
      }
      const msg = String(err?.message || '').toLowerCase();
      const isRateLimit = err?.status === 429 || msg.includes('429') || msg.includes('rate limit') || msg.includes('rate_limit') || msg.includes('tpd');
      throw new AIProviderError(`Groq API Error: ${err.message}`, !isRateLimit);
    }
  }
}

export class MockAIProvider implements IAIProvider {
  private failureMode: 'rate_limit' | 'unavailable' | 'invalid_key' | 'timeout' | 'malformed' | 'empty' | null = null;
  private failureAttempts = 0;
  private currentAttempts = 0;

  setFailureMode(mode: 'rate_limit' | 'unavailable' | 'invalid_key' | 'timeout' | 'malformed' | 'empty' | null, attempts = 0) {
    this.failureMode = mode;
    this.failureAttempts = attempts;
    this.currentAttempts = 0;
  }

  async generateText(input: GenerationInput): Promise<GeneratedContent> {
    if (this.failureMode && this.currentAttempts < this.failureAttempts) {
      this.currentAttempts++;

      if (this.failureMode === 'rate_limit') {
        throw new AIProviderError('AI provider rate limit reached (HTTP 429)', true);
      } else if (this.failureMode === 'unavailable') {
        throw new AIProviderError('AI provider temporarily down (HTTP 503)', true);
      } else if (this.failureMode === 'invalid_key') {
        throw new AIProviderError('Invalid API Key provided', false);
      } else if (this.failureMode === 'timeout') {
        throw new AppError('TIMEOUT', 'AI provider call timed out', true, 504);
      } else if (this.failureMode === 'malformed') {
        return { random: 'data' } as any;
      } else if (this.failureMode === 'empty') {
        return { text: '', angle: '', keyPoints: [], content: { blog: { title: '', text: '' }, linkedin: { text: '' }, x: { text: '' } } };
      }
    }

    const sanitizeString = (str?: string): string => {
      if (!str) return '';
      return str
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&apos;/g, "'")
        .replace(/&amp;/g, '&')
        .replace(/&nbsp;/g, ' ')
        .replace(/<a\s+href[^>]*>[\s\S]*?<\/a>/gi, '')
        .replace(/<[^>]+>/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    };

    const { name, role, domain, tone, editorialPrinciples } = input.persona;
    const title = sanitizeString(input.topic.title);
    const summary = sanitizeString(input.topic.summary);
    const source = input.topic.source;

    const angle = `Editorial perspective by ${name} on ${title}`;
    const firstPrinciple = editorialPrinciples && editorialPrinciples.length > 0 ? editorialPrinciples[0] : 'technical accuracy';

    const blogTitle = `Editorial Analysis: ${title}`;
    const blogText = `In-depth editorial analysis on ${title} by ${name}, ${role}.\n\n` +
      `## Overview\n${summary}\n\n` +
      `## Professional Analysis\nAs a ${role} specializing in ${domain}, analyzing this development requires evaluating fundamental impact and long-term implications.\n\n` +
      `## Key Takeaways\n- Key takeaway 1 regarding ${domain}\n- Key takeaway 2 from ${source.name}\n\n` +
      `## Conclusion\nMaintaining focus on ${firstPrinciple} will remain crucial.\n\n` +
      `Source reference: ${source.url}`;

    const content = {
      blog: {
        title: blogTitle,
        text: blogText,
      },
      linkedin: {
        text: `Insights on ${title} by ${name}.\n\nKey takeaways:\n• ${summary.slice(0, 100)}...\n• Industry impact for ${domain}\n\n#${domain.replace(/\s+/g, '')} #Technology`,
      },
      x: {
        text: `Analysis: ${title.slice(0, 180)}... #${domain.replace(/\s+/g, '')}`,
      },
    };

    const keyPoints = [
      `Announcement details: ${title}`,
      `Analyzed from a ${tone ? tone[0] : 'analytical'} standpoint.`,
      `Aligned with ${firstPrinciple} standards.`
    ];

    return {
      text: blogText,
      angle,
      keyPoints,
      content,
    };
  }
}

/**
 * Returns active provider instance based on explicit environment configuration.
 */
export function getAIProvider(overrideProvider?: string): IAIProvider {
  let provider = (overrideProvider || process.env.AI_PROVIDER || config.aiProvider || '').trim().toLowerCase();

  if (process.env.NODE_ENV === 'test' && !overrideProvider) {
    provider = 'mock';
  }

  if (provider === 'mock') {
    return new MockAIProvider();
  }
  if (provider === 'groq') {
    const apiKey = (process.env.GROQ_API_KEY !== undefined ? process.env.GROQ_API_KEY : (config.groqApiKey || '')).trim();
    if (!apiKey) {
      const { AIProviderError } = require('../utils/errors');
      throw new AIProviderError('GROQ_API_KEY environment variable is required when AI_PROVIDER is set to "groq".', false);
    }
    return new GroqAIProvider();
  }

  throw new Error(`Invalid AI_PROVIDER: "${provider}". Supported values are "groq" or "mock".`);
}

export const globalAIProvider: IAIProvider = getAIProvider();
