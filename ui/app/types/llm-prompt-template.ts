export interface LlmPromptTemplate {
  id: string;
  isSystem?: boolean;
  isHidden?: boolean;
  userId?: string;
  projectId?: string;
  name?: string;
  description?: string;
  category: string;
  prompt: string;
  order: number;
  createdAt: string;
  updatedAt: string;
}
