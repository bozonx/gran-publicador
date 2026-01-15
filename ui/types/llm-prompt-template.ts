export interface LlmPromptTemplate {
  id: string
  userId?: string
  projectId?: string
  name: string
  description?: string
  prompt: string
  order: number
  createdAt: string
  updatedAt: string
}
