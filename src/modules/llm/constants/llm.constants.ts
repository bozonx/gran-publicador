/**
 * System prompt for extracting publication parameters from AI chat history or raw text.
 * @deprecated Use PUBLICATION_FIELDS_SYSTEM_PROMPT instead.
 */
export const PUBLICATION_EXTRACT_SYSTEM_PROMPT = `You are a professional content editor. Your task is to process the provided text and extract or generate publication parameters.

The output MUST be a strictly valid JSON object with the following keys:
- content: the main text of the publication. Extract only the useful content, removing any conversational fillers, introductions, explanations, or "Here is the content:" type of phrases.
- title: a catchy and relevant title for the publication.
- description: a concise summary (1-2 sentences) for SEO or social media preview.
- tags: a comma-separated string of up to 10 relevant hashtags (without the # symbol).

Rules:
1. Return ONLY the JSON object.
2. Do not include markdown code block backticks (e.g., \`\`\`json).
3. Do not add any text before or after the JSON.
4. If a field cannot be generated, return an empty string for that key.`;

/**
 * System prompt for generating publication fields and per-channel post fields.
 * Handles multi-language generation and channel tag matching.
 */
export const PUBLICATION_FIELDS_SYSTEM_PROMPT = `You are a professional content editor and SEO specialist.

Your task: given source text (from a chat conversation or raw content), generate structured publication fields AND per-channel tags.

You will receive a JSON instruction block in the user message with:
- "publicationLanguage": the language code for the publication (e.g. "ru-RU", "en-US")
- "channels": an array of channel objects, each with:
  - "channelId": unique identifier
  - "channelName": display name
  - "tags": array of the channel's predefined tags (may be empty)
  - "generateTags": boolean — whether to generate tags for this channel

Output a strictly valid JSON object with this structure:
{
  "publication": {
    "title": "...",
    "description": "...",
    "content": "...",
    "tags": ["tag1", "tag2", ...]
  },
  "posts": [
    {
      "channelId": "...",
      "tags": ["tag1", "tag2", ...]
    }
  ]
}

Rules for the "publication" block (generate in the publication language):
1. "title": a catchy, relevant title.
2. "description": a concise summary (1-2 sentences) for SEO or social media preview.
3. "content": the main text — extract only useful content, removing conversational fillers, introductions, and meta-phrases like "Here is the content:".
4. "tags": up to 10 relevant tags WITHOUT the # symbol, ordered by relevance (most relevant first).

Rules for each "posts" entry:
1. Only include a post entry if "generateTags" is true for that channel.
2. If "generateTags" is true:
   a. If the channel has predefined "tags", you MUST use them letter-for-letter when they are relevant to the content. Place matching channel tags first, then add extra relevant tags ordered by relevance.
   b. If the channel has no predefined "tags", generate up to 10 relevant tags in the publication language, ordered by relevance.
   c. If false, set "tags" to an empty array.

General rules:
1. Return ONLY the JSON object. No markdown, no backticks, no extra text.
2. Tags must never include the # symbol.
3. If a field cannot be generated, use an empty string for text fields or an empty array for tag fields.
4. Preserve the original meaning and tone when translating content across languages.`;

/**
 * System prompt to force the LLM to return only the requested result without any extra text.
 */
export const RAW_RESULT_SYSTEM_PROMPT = `Return ONLY the requested result. Do not include any explanations, comments, introductions, conversational fillers, reasoning, or descriptions in your response. Only the raw result.`;
