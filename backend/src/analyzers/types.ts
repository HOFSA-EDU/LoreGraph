// Shared analyzer types. The interface is intentionally narrow so the analyzer
// is swappable (mock <-> llm <-> future variants) without leaking implementation.

export type AnalyzerEntityType =
  | 'player_character'
  | 'npc'
  | 'faction'
  | 'location'
  | 'item'
  | 'secret'
  | 'event'
  | 'unknown';

export type AnalyzerRelationshipType =
  | 'allied_with'
  | 'hates'
  | 'loves'
  | 'owes'
  | 'manipulates'
  | 'protects'
  | 'hunts'
  | 'works_for'
  | 'betrayed_by'
  | 'related_to'
  | 'controls'
  | 'knows_secret_of'
  | 'competes_with'
  | 'located_in'
  | 'owns'
  | 'involved_in'
  | 'unknown_connection';

export type Visibility = 'public' | 'gm_only';
export type EntityStatus = 'active' | 'dead' | 'missing' | 'destroyed' | 'unknown';
export type RelationshipStatus =
  | 'stable'
  | 'unstable'
  | 'escalating'
  | 'broken'
  | 'secret';
export type Importance = 'low' | 'medium' | 'high' | 'critical';
export type SourceType =
  | 'lore'
  | 'session_notes'
  | 'adventure'
  | 'character_backstory'
  | 'other';
export type PromptType =
  | 'conflict'
  | 'reveal'
  | 'debt'
  | 'betrayal'
  | 'alliance'
  | 'mystery'
  | 'session_hook';

export interface AnalyzerEntity {
  name: string;
  type: AnalyzerEntityType;
  description?: string;
  visibility?: Visibility;
  status?: EntityStatus;
  importance?: Importance;
  confidenceScore: number;
  sourceExcerpt?: string;
  // Optional image-generation prompt (English, photo / illustration style).
  // null/undefined for abstract entities (events, secrets, concepts).
  imagePrompt?: string | null;
  // Optional explicit "this is a guess, please confirm" flag set by the LLM.
  // Low confidenceScore (< 0.6) also implies uncertainty.
  isUncertain?: boolean;
}

export interface AnalyzerRelationship {
  sourceName: string;
  targetName: string;
  type: AnalyzerRelationshipType;
  description?: string;
  intensity?: number;
  visibility?: Visibility;
  status?: RelationshipStatus;
  confidenceScore: number;
  sourceExcerpt?: string;
  isUncertain?: boolean;
}

export interface AnalyzerPrompt {
  title: string;
  description: string;
  type: PromptType;
  relatedEntityNames?: string[];
}

export interface AnalyzerOpenQuestion {
  question: string;
  relatedEntityNames?: string[];
}

export interface AnalyzerResult {
  entities: AnalyzerEntity[];
  relationships: AnalyzerRelationship[];
  generatedPrompts: AnalyzerPrompt[];
  openQuestions: AnalyzerOpenQuestion[];
}

export interface AnalyzerInput {
  text: string;
  sourceType?: SourceType;
}

export interface CampaignTextAnalyzer {
  readonly mode: 'mock' | 'llm';
  analyze(input: AnalyzerInput): Promise<AnalyzerResult>;
}
