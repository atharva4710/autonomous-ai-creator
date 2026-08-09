export interface Post {
  id: string;
  agentId: string;
  topicId: string;
  decisionId: string;
  status: 'DRAFT' | 'VALIDATED' | 'PUBLISHED' | 'FAILED';
  text: string;
  angle?: string;
  keyPoints?: string[];
  sources: string[];
  rationale?: string;
  regenerationsCount: number;
  createdAt: string; // ISO 8601 UTC
  publishedAt?: string; // ISO 8601 UTC
  content?: {
    blog: {
      title: string;
      text: string;
    };
    linkedin: {
      text: string;
    };
    x: {
      text: string;
    };
  };
  selectedFormat?: 'blog' | 'linkedin' | 'x';
}
