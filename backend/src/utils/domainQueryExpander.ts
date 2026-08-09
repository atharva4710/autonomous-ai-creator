/**
 * Dynamic Domain Search Query Expander
 * Maps an agent's persona domain and interests into focused search query concepts.
 */
export function expandDomainQueries(domain: string, interests: string[] = []): string[] {
  if (!domain || typeof domain !== 'string' || !domain.trim()) {
    return ['Artificial Intelligence', 'AI Technology', 'Machine Learning'];
  }

  const cleanDomain = domain.trim();
  const lowerDomain = cleanDomain.toLowerCase();
  const querySet = new Set<string>();

  // Include primary domain
  querySet.add(cleanDomain);

  // Domain-specific mapping presets
  if (lowerDomain.includes('security') || lowerDomain.includes('cyber')) {
    querySet.add('AI Security');
    querySet.add('LLM Security');
    querySet.add('AI Vulnerability');
    querySet.add('AI Model Safety');
    querySet.add('AI Red Teaming');
    querySet.add('Prompt Injection');
    querySet.add('AI Cyberattack');
    querySet.add('Model Security');
    querySet.add('AI Security Research');
    querySet.add('AI Security Incidents');
  } else if (lowerDomain.includes('robot')) {
    querySet.add('Robotics AI');
    querySet.add('Humanoid Robot');
    querySet.add('Robotics Research');
    querySet.add('Robot Autonomy');
    querySet.add('Industrial Robotics');
    querySet.add('Robot Control');
    querySet.add('Embodied AI');
  } else if (lowerDomain.includes('machine learning') || lowerDomain.includes('ml')) {
    querySet.add('Machine Learning');
    querySet.add('ML Research');
    querySet.add('Foundation Model');
    querySet.add('Model Training');
    querySet.add('ML Benchmark');
    querySet.add('Deep Learning');
    querySet.add('Transformer Model');
  } else if (lowerDomain.includes('product') || lowerDomain.includes('analyst')) {
    querySet.add('AI Product');
    querySet.add('Generative AI');
    querySet.add('LLM Pricing');
    querySet.add('AI Adoption');
    querySet.add('AI Model Release');
    querySet.add('AI Startup');
    querySet.add('Enterprise AI');
  } else if (lowerDomain.includes('generative') || lowerDomain.includes('genai')) {
    querySet.add('Generative AI');
    querySet.add('LLM Research');
    querySet.add('Diffusion Model');
    querySet.add('Text to Image');
    querySet.add('AI Agent');
    querySet.add('Generative Models');
  } else if (lowerDomain.includes('open source') || lowerDomain.includes('open-source')) {
    querySet.add('Open Source AI');
    querySet.add('Open Weight Model');
    querySet.add('Llama Model');
    querySet.add('Hugging Face');
    querySet.add('Open LLM');
    querySet.add('Open Source ML');
  } else if (lowerDomain.includes('ethic') || lowerDomain.includes('align') || lowerDomain.includes('governance')) {
    querySet.add('AI Ethics');
    querySet.add('AI Governance');
    querySet.add('AI Alignment');
    querySet.add('Responsible AI');
    querySet.add('AI Regulation');
    querySet.add('Bias in AI');
  } else if (lowerDomain.includes('developer') || lowerDomain.includes('dev')) {
    querySet.add('AI Developer Tools');
    querySet.add('AI API SDK');
    querySet.add('Developer Experience');
    querySet.add('AI Code Assistant');
    querySet.add('Software Engineering AI');
  } else {
    // Dynamic fallback for custom domains
    const words = cleanDomain.split(/\s+/).filter((w) => w.length >= 3);
    for (const w of words) {
      querySet.add(`${w} AI`);
      querySet.add(`${w} Research`);
      querySet.add(`${w} Technology`);
    }
  }

  // Add explicit interests if provided
  if (Array.isArray(interests)) {
    for (const interest of interests) {
      if (interest && typeof interest === 'string' && interest.trim().length >= 3) {
        querySet.add(interest.trim());
      }
    }
  }

  return Array.from(querySet).slice(0, 12);
}
