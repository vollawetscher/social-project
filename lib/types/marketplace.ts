export interface MarketplaceProfile {
  id: string
  marketplace_username: string | null
  display_name: string | null
  marketplace_avatar_url: string | null
  marketplace_bio: string | null
}

export interface MarketplaceCategory {
  id: string
  name: string
  slug: string
  description: string | null
  icon: string | null
  sort_order: number
}

export type Perspective = 'party_a' | 'party_b' | 'observer'
export type Audience = 'internal' | 'external' | 'client_facing' | 'legal' | 'executive'
export type Tone = 'direct' | 'neutral' | 'formal' | 'casual' | 'funny' | 'technical'
export type OutputFormat = 'markdown' | 'json'
export type OutputLanguage = 'en' | 'de' | 'fr' | 'es' | 'it' | 'pt' | 'nl' | 'pl'
export type MarketplaceDomain = 'psychology' | 'medical' | 'sales' | 'legal' | 'education' | 'it' | 'consulting' | 'hr' | 'general' | 'meetings' | 'business' | 'support' | 'technical'

export interface NotissimaTemplateConfig {
  perspectives: Perspective[]
  audiences: Audience[]
  tone: Tone
  output_format: OutputFormat
  languages: OutputLanguage[]
  domains: MarketplaceDomain[]
  generation_prompt: string
  do_include: string
  do_not_include: string
}

export interface NotissimaExportJSON {
  v: 1
  name: string
  description: string
  perspectives: Perspective[]
  audiences: Audience[]
  tone: Tone
  output_format: OutputFormat
  languages: OutputLanguage[]
  domains: MarketplaceDomain[]
  generation_prompt: string
  do_include: string
  do_not_include: string
}

export interface MarketplaceTemplate {
  id: string
  author_id: string
  title: string
  description: string
  instructions: string
  template_config: NotissimaTemplateConfig
  category_id: string | null
  tags: string[]
  download_count: number
  avg_rating: number
  is_published: boolean
  lead_capture_enabled: boolean
  language: string
  created_at: string
  updated_at: string
  author?: MarketplaceProfile
  category?: MarketplaceCategory
}

export interface MarketplaceRating {
  id: string
  template_id: string
  user_id: string
  rating: number
  review: string | null
  created_at: string
  user?: MarketplaceProfile
}

export interface MarketplaceDownload {
  id: string
  template_id: string
  user_id: string
  downloaded_at: string
}

export type PostType = 'article' | 'question' | 'tip'

export interface CommunityPost {
  id: string
  author_id: string
  type: PostType
  title: string
  content: string
  category: string | null
  tags: string[]
  upvote_count: number
  comment_count: number
  view_count: number
  is_resolved: boolean
  is_published: boolean
  created_at: string
  updated_at: string
  author?: MarketplaceProfile
}

export interface CommunityComment {
  id: string
  post_id: string
  author_id: string
  content: string
  parent_id: string | null
  is_accepted_answer: boolean
  upvote_count: number
  created_at: string
  author?: MarketplaceProfile
  replies?: CommunityComment[]
}

export interface CommunityVote {
  id: string
  user_id: string
  post_id: string | null
  comment_id: string | null
}
