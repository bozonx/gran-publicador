import type { SocialMedia, MediaType } from '@gran/shared/social-media-platforms'

export interface SocialMediaValidationRules {
  maxTextLength: number
  maxCaptionLength: number
  maxMediaCount: number
  minMediaCount?: number
  allowedMediaTypes?: MediaType[]
  allowedGalleryMediaTypes?: MediaType[]
  maxMediaCountForGallery?: number
}

export interface ValidationError {
  field: string
  message: string
}

export interface ValidationResult {
  isValid: boolean
  errors: ValidationError[]
}
