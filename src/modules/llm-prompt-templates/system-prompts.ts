export interface SystemLlmPromptTemplate {
  id: string;
  name: string;
  note?: string;
  prompt: string;
  category: string;
}

export const SYSTEM_LLM_PROMPT_TEMPLATES: SystemLlmPromptTemplate[] = [
  {
    id: 'sys-editing-rewrite-clear',
    name: 'Rewrite: clear and concise',
    note: 'Rewrite text to improve clarity without changing meaning.',
    category: 'Editing',
    prompt:
      'Rewrite the text below to be clearer and easier to read. Keep meaning, facts, and tone. Avoid fluff.\n\nTEXT:\n',
  },
  {
    id: 'sys-editing-shorten',
    name: 'Rewrite: shorter',
    note: 'Make the text shorter while preserving meaning.',
    category: 'Editing',
    prompt:
      'Rewrite the text below to be 30-40% shorter without losing meaning. Keep the tone.\n\nTEXT:\n',
  },
  {
    id: 'sys-editing-proofread',
    name: 'Proofread',
    note: 'Fix grammar, spelling, and punctuation.',
    category: 'Editing',
    prompt:
      'Proofread the text below. Fix grammar, spelling, and punctuation. Improve readability but do not change meaning. Return only the corrected text.\n\nTEXT:\n',
  },
  {
    id: 'sys-content-structure',
    name: 'Structure content',
    note: 'Turn raw text into a structured publication draft.',
    category: 'Content',
    prompt:
      'Restructure the text below into a clear publication draft with headings and short paragraphs. Preserve facts. Return only the rewritten text.\n\nTEXT:\n',
  },
  {
    id: 'sys-metadata-title-variants',
    name: 'Metadata: title variants',
    note: 'Generate multiple title options.',
    category: 'Metadata',
    prompt:
      'Generate 10 title options for the content below. Provide a mix of neutral and SEO-friendly titles. Return as a numbered list.\n\nCONTENT:\n',
  },
  {
    id: 'sys-metadata-seo-description',
    name: 'Metadata: SEO description',
    note: 'Create a short SEO meta description.',
    category: 'Metadata',
    prompt:
      'Write an SEO meta description (140-160 characters) for the content below. Avoid clickbait. Return only the description.\n\nCONTENT:\n',
  },
];
