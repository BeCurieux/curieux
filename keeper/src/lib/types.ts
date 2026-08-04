// Keeper — shared domain types.

export type MemoryType =
  | "photo" | "video" | "quote" | "voice" | "text" | "artwork" | "milestone";

export type ClusterStatus = "suggested" | "confirmed" | "rejected";
export type QuestionStatus = "pending" | "answered" | "dismissed";

export type BookStatus =
  | "collecting" | "drafting" | "review" | "approved" | "rendering"
  | "print_ready" | "ordered" | "in_production" | "shipped" | "delivered";

export type SectionType =
  | "opening" | "month" | "people" | "little_things" | "theme" | "trip"
  | "quotes" | "ordinary_days" | "change_over_time" | "closing";

export type BlockType = "text" | "photo" | "quote" | "heading" | "caption";

export interface Child {
  id: string;
  family_id: string;
  first_name: string;
  date_of_birth: string;
  pronouns: string | null;
}

export interface FamilyMember {
  id: string;
  family_id: string;
  name: string;
  relationship: string;
  nickname_used_by_child: string | null;
}

export interface Memory {
  id: string;
  child_id: string;
  memory_date: string | null;
  type: MemoryType;
  raw_text: string | null;
  transcript: string | null;
  location: string | null;
  metadata: Record<string, unknown>;
  tags?: string[];
  people?: string[]; // family_member names
}

export interface MediaAsset {
  id: string;
  memory_id: string;
  storage_path: string;
  thumbnail_path: string | null;
  mime_type: string;
  width: number | null;
  height: number | null;
  capture_timestamp: string | null;
  checksum: string;
}

export interface MemoryCluster {
  id?: string;
  child_id: string;
  title: string;
  summary: string | null;
  start_date: string | null;
  end_date: string | null;
  confidence: number;
  status: ClusterStatus;
  memory_ids: string[];
}

export interface FollowUpQuestion {
  id?: string;
  child_id: string;
  cluster_id?: string | null;
  question: string;
  reason: string;
  status: QuestionStatus;
  answer?: string | null;
}

export interface LittleThing {
  id?: string;
  child_id: string;
  recorded_date: string;
  category: string;
  value: string;
  source_memory_id?: string | null;
}

/**
 * A provenance source reference. Every AI-drafted factual statement must
 * carry at least one of these (brief §14).
 */
export type SourceRef =
  | { kind: "memory"; id: string }
  | { kind: "answer"; id: string }        // follow_up_questions.id
  | { kind: "little_thing"; id: string };

export interface ContentBlockDraft {
  type: BlockType;
  content: string;               // text content, or media_asset id for photos
  source_ids: SourceRef[];
  ai_generated: boolean;
}

export interface PageDraft {
  template_id: string;
  section_index: number;
  blocks: ContentBlockDraft[];
}

export interface SectionDraft {
  section_type: SectionType;
  title: string;
  summary?: string;
  /** memory ids this section draws on */
  memory_ids: string[];
}

export interface BookStructureDraft {
  title: string;
  subtitle?: string;
  sections: SectionDraft[];
}

/** Photo analysis output — editorial facts only, never invented memories (§8). */
export interface PhotoAnalysis {
  memory_id: string;
  likely_people: string[];
  scene: string | null;
  activity: string | null;
  objects: string[];
  setting: string | null;
  emotional_tone: string | null;
  visually_strong: boolean;
  near_duplicate_of: string | null;
  suggested_tags: string[];
}
