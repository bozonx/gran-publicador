export interface ProjectAuthorSignatureVariant {
  id: string;
  signatureId: string;
  language: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectAuthorSignature {
  id: string;
  projectId: string;
  userId: string;
  order: number;
  createdAt: string;
  updatedAt: string;
  variants: ProjectAuthorSignatureVariant[];
  user?: {
    id: string;
    fullName?: string;
    telegramUsername?: string;
  };
}

export interface CreateAuthorSignatureInput {
  content: string;
  language?: string;
}

export interface UpdateAuthorSignatureInput {
  order?: number;
}

export interface UpdateSignatureWithVariantsInput {
  order?: number;
  variants?: {
    language: string;
    content: string;
  }[];
}

export interface ReorderSignaturesInput {
  signatureIds: string[];
}

export interface UpsertVariantInput {
  content: string;
}
