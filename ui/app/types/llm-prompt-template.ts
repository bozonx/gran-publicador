export interface LlmPromptTemplate {
  id: string;
  userId?: string;
  projectId?: string;
  name: string;
  description?: string;
  category?: 'GENERAL' | 'CHAT' | 'CONTENT' | 'EDITING' | 'METADATA';
  prompt: string;
  order: number;
  createdAt: string;
  updatedAt: string;
}
