import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import { SKIP, visit } from 'unist-util-visit'
import { toString } from 'mdast-util-to-string'
import {
  getPostTypeConfig,
  MediaType,
  PostType,
  SocialMedia,
} from '@gran/shared/social-media-platforms'

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

/**
 * Strip HTML tags from content for length calculation
 */
export function stripHtmlTags(html: string): string {
  return html.replace(/<[^>]*>/g, '')
}

export function htmlNodeToText(value: string): string {
  return stripHtmlTags(value)
}

export function getPlainTextFromMarkdown(markdown: string): string {
  const tree = unified().use(remarkParse).use(remarkGfm).parse(markdown)

  visit(tree as any, 'html', (_node: any, index?: number, parent?: any) => {
    if (!parent || typeof index !== 'number') return

    const node = _node as { value?: unknown }
    const val = typeof node.value === 'string' ? node.value : ''
    const replacement = { type: 'text', value: htmlNodeToText(val) }

    const children = (parent.children ?? []) as any[]
    children.splice(index, 1, replacement)

    return SKIP
  })

  return toString(tree as any)
}

export function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, code) => {
      const num = Number(code)
      return Number.isFinite(num) ? String.fromCodePoint(num) : _
    })
    .replace(/&#x([0-9a-fA-F]+);/g, (_, code) => {
      const num = Number.parseInt(code, 16)
      return Number.isFinite(num) ? String.fromCodePoint(num) : _
    })
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
}

export function getPlainTextForLength(content: string): string {
  return decodeHtmlEntities(stripHtmlTags(getPlainTextFromMarkdown(content)))
}

/**
 * Calculate text length without HTML tags
 */
export function getTextLength(content: string | null | undefined): number {
  if (!content) return 0
  return getPlainTextForLength(content).trim().length
}

/**
 * Get internal validation rules for a platform/postType
 */
export function getValidationRules(
  socialMedia: SocialMedia,
  postType?: PostType | string,
): SocialMediaValidationRules {
  const resolvedPostType =
    typeof postType === 'string' ? (postType as PostType) : (postType ?? PostType.POST)

  const cfg = getPostTypeConfig(socialMedia, resolvedPostType)
  if (!cfg) {
    return {
      maxTextLength: Number.MAX_SAFE_INTEGER,
      maxCaptionLength: Number.MAX_SAFE_INTEGER,
      maxMediaCount: Number.MAX_SAFE_INTEGER,
    }
  }

  return {
    maxTextLength: cfg.content.maxTextLength,
    maxCaptionLength: cfg.content.maxCaptionLength,
    maxMediaCount: cfg.media.maxCount,
    minMediaCount: cfg.media.minCount || undefined,
    maxMediaCountForGallery: cfg.media.maxGalleryCount || undefined,
    allowedMediaTypes: cfg.media.allowedTypes,
    allowedGalleryMediaTypes: cfg.media.allowedGalleryTypes,
  }
}

/**
 * Validate media types based on platform rules
 */
export function validateMediaTypes(
  media: Array<{ type: string }>,
  rules: SocialMediaValidationRules,
  platform: string,
): ValidationError[] {
  const errors: ValidationError[] = []
  const mediaCount = media.length

  // Check if this is a gallery (2+ files) or single file
  const isGallery = mediaCount > 1

  if (isGallery) {
    // Validate gallery media types
    if (rules.allowedGalleryMediaTypes && rules.allowedGalleryMediaTypes.length > 0) {
      const invalidMedia = media.filter(
        m => !rules.allowedGalleryMediaTypes!.includes(m.type as MediaType),
      )
      if (invalidMedia.length > 0) {
        const invalidTypes = [...new Set(invalidMedia.map(m => m.type))].join(', ')
        const allowedTypes = rules.allowedGalleryMediaTypes.join(', ')
        errors.push({
          field: 'media',
          message: `Gallery for ${platform} only allows ${allowedTypes}, but found: ${invalidTypes}`,
        })
      }
    }

    // Validate gallery count
    if (rules.maxMediaCountForGallery && mediaCount > rules.maxMediaCountForGallery) {
      errors.push({
        field: 'media',
        message: `Gallery has too many files (${mediaCount}) for ${platform}. Maximum for gallery: ${rules.maxMediaCountForGallery}`,
      })
    }
  } else if (mediaCount === 1) {
    // Validate single file media type
    if (rules.allowedMediaTypes && media[0]) {
      const mediaType = media[0].type
      if (!rules.allowedMediaTypes.includes(mediaType as MediaType)) {
        const allowedTypes = rules.allowedMediaTypes.join(', ')
        errors.push({
          field: 'media',
          message: `Media type ${mediaType} is not allowed for ${platform}. Allowed types: ${allowedTypes}`,
        })
      }
    }
  }

  return errors
}
