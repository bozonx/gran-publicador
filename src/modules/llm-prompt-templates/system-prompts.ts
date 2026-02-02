import { LlmPromptTemplateCategory } from '../../generated/prisma/index.js';

export interface SystemLlmPromptTemplate {
  key: string;
  name: string;
  description?: string;
  prompt: string;
  category: LlmPromptTemplateCategory;
}

export const SYSTEM_LLM_PROMPT_TEMPLATES: SystemLlmPromptTemplate[] = [
  {
    key: 'general/brainstorm-ideas',
    name: 'Brainstorm ideas',
    description: 'Generate multiple ideas and variations for a given topic.',
    category: LlmPromptTemplateCategory.GENERAL,
    prompt:
      'Generate 10 diverse ideas for the following topic. For each idea, provide a short title and 2-3 bullet points explaining it. Topic: {{topic}}',
  },
  {
    key: 'general/summarize',
    name: 'Summarize clearly',
    description: 'Create a clear, structured summary.',
    category: LlmPromptTemplateCategory.GENERAL,
    prompt:
      'Summarize the text below in 5-8 bullet points. Then provide: (1) key facts, (2) open questions, (3) suggested next actions. Text: {{text}}',
  },
  {
    key: 'general/outline',
    name: 'Create an outline',
    description: 'Build a structured outline for a piece of content.',
    category: LlmPromptTemplateCategory.GENERAL,
    prompt:
      'Create a detailed outline for a publication on the topic below. Include sections, sub-sections, and what each should cover. Topic: {{topic}}',
  },

  {
    key: 'chat/assistant-style',
    name: 'Assistant style: concise',
    description: 'Answer concisely and ask clarifying questions if needed.',
    category: LlmPromptTemplateCategory.CHAT,
    prompt:
      'Act as a senior editor. Reply concisely. If the request is ambiguous, ask 2-4 clarifying questions before writing. Input: {{input}}',
  },
  {
    key: 'chat/socratic',
    name: 'Socratic questioning',
    description: 'Help refine thinking using questions.',
    category: LlmPromptTemplateCategory.CHAT,
    prompt:
      'Use the Socratic method to help me refine my thinking. Ask one question at a time, and wait for my answer. Goal: {{goal}}',
  },
  {
    key: 'chat/critic',
    name: 'Critique & improve',
    description: 'Critique the draft and propose improvements.',
    category: LlmPromptTemplateCategory.CHAT,
    prompt:
      'Critique the draft below. Point out unclear parts, missing context, and logical gaps. Then propose a revised version. Draft: {{draft}}',
  },

  {
    key: 'content/write-post',
    name: 'Write a post',
    description: 'Write a social media post from notes.',
    category: LlmPromptTemplateCategory.CONTENT,
    prompt:
      'Write a social media post based on the notes below. Provide 3 variants: short, medium, long. Notes: {{notes}}',
  },
  {
    key: 'content/restructure',
    name: 'Restructure content',
    description: 'Turn raw text into a clear structured piece.',
    category: LlmPromptTemplateCategory.CONTENT,
    prompt:
      'Restructure the text below into a clear publication with headings, short paragraphs, and bullet lists where appropriate. Keep facts unchanged. Text: {{text}}',
  },
  {
    key: 'content/expand',
    name: 'Expand with details',
    description: 'Expand a draft while preserving tone.',
    category: LlmPromptTemplateCategory.CONTENT,
    prompt:
      'Expand the draft below by adding details, examples, and smoother transitions, while keeping the same tone and meaning. Draft: {{draft}}',
  },

  {
    key: 'editing/proofread',
    name: 'Proofread & fix',
    description: 'Fix grammar, clarity, and readability.',
    category: LlmPromptTemplateCategory.EDITING,
    prompt:
      'Proofread the text below. Fix grammar, spelling, and punctuation. Improve clarity but do not change meaning. Return the corrected text and a short list of key changes. Text: {{text}}',
  },
  {
    key: 'editing/shorten',
    name: 'Shorten without losing meaning',
    description: 'Make the text shorter and clearer.',
    category: LlmPromptTemplateCategory.EDITING,
    prompt:
      'Rewrite the text below to be 30-40% shorter without losing meaning. Keep the tone. Text: {{text}}',
  },
  {
    key: 'editing/tone',
    name: 'Adjust tone',
    description: 'Adjust style for a target audience.',
    category: LlmPromptTemplateCategory.EDITING,
    prompt:
      'Rewrite the text below for the target tone: {{tone}}. Keep meaning and facts. Text: {{text}}',
  },

  {
    key: 'metadata/title-variants',
    name: 'Title variants',
    description: 'Generate multiple title options.',
    category: LlmPromptTemplateCategory.METADATA,
    prompt:
      'Generate 15 title options for the content below. Provide 5 neutral, 5 curiosity-driven, 5 SEO-friendly. Content: {{content}}',
  },
  {
    key: 'metadata/seo-description',
    name: 'SEO description',
    description: 'Create an SEO meta description.',
    category: LlmPromptTemplateCategory.METADATA,
    prompt:
      'Write an SEO meta description (140-160 characters) for the content below. Avoid clickbait. Content: {{content}}',
  },
  {
    key: 'metadata/hashtags',
    name: 'Hashtags',
    description: 'Generate relevant hashtags.',
    category: LlmPromptTemplateCategory.METADATA,
    prompt:
      'Suggest 15 relevant hashtags for the content below. Output as a single line, space-separated. Content: {{content}}',
  },
];
