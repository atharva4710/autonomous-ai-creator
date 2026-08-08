import { Persona } from '../models/agent.interface';
import { Topic } from '../models/topic.interface';

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
}

export interface IAIProvider {
  generateText(input: GenerationInput): Promise<GeneratedContent>;
}

export class MockAIProvider implements IAIProvider {
  async generateText(input: GenerationInput): Promise<GeneratedContent> {
    const { name, role, domain, tone, editorialPrinciples } = input.persona;
    const { title, summary, source } = input.topic;

    // Simulate different angles for regeneration
    const timestamp = Date.now();
    const angleIndex = (timestamp % 3);

    let angle = `Technical analysis of ${title} by ${name}`;
    let hook = `[${role} Perspective] ${title}`;
    let reasoning = `Evaluating the real-world implications of this development within ${domain}.`;

    if (angleIndex === 1) {
      angle = `Deep-dive study of the structural impact of ${title}`;
      hook = `[Detailed Review by ${name}] Critical shift: ${title}`;
      reasoning = `A closer look at how this changes the landscape for ${domain}.`;
    } else if (angleIndex === 2) {
      angle = `Strategic summary of the recent announcement: ${title}`;
      hook = `[Strategic Take] ${title} - Analysis by ${name}`;
      reasoning = `Why this news is a pivotal point for specialists in ${domain}.`;
    }

    const firstPrinciple = editorialPrinciples[0] || 'Evidence over hype';
    const toneString = tone.join(', ');

    // Compile text body under Configurable limit validation checks
    const p1 = `${hook}\n\nAccording to report details from ${source.name}, ${summary}`;
    const p2 = `${reasoning} In align with our core focus of "${firstPrinciple}", it is vital to assess the direct consequences here.`;
    const p3 = `Key Takeaway: Practitioners should monitor this closely. Tone: [${toneString}].`;
    const text = `${p1}\n\n${p2}\n\n${p3}\n\nSource reference: ${source.url}`;

    const keyPoints = [
      `Announcement details: ${title}`,
      `Analyzed from a ${tone[0] || 'analytical'} standpoint.`,
      `Aligned with ${firstPrinciple} standards.`
    ];

    return {
      text,
      angle,
      keyPoints,
    };
  }
}
export const globalAIProvider = new MockAIProvider();
