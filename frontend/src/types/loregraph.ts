export type EntityType =
  | 'player_character'
  | 'npc'
  | 'faction'
  | 'location'
  | 'item'
  | 'secret'
  | 'event'
  | 'unknown';

export type RelationshipType =
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
export type RelationshipStatus = 'stable' | 'unstable' | 'escalating' | 'broken' | 'secret';
export type Importance = 'low' | 'medium' | 'high' | 'critical';
export type SourceType = 'lore' | 'session_notes' | 'adventure' | 'character_backstory' | 'other';
export type PromptType = 'conflict' | 'reveal' | 'debt' | 'betrayal' | 'alliance' | 'mystery' | 'session_hook';

export interface Campaign {
  id: string;
  name: string;
  description: string | null;
  system: string | null;
  tone: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: { entities: number; relationships: number; sourceTexts: number };
}

export interface Entity {
  id: string;
  campaignId: string;
  name: string;
  type: EntityType;
  description: string | null;
  confidenceScore: number;
  visibility: Visibility;
  status: EntityStatus;
  importance: Importance;
  sourceExcerpt: string | null;
  imagePrompt: string | null;
  imageUrl: string | null;
  imageGeneratedAt: string | null;
  isUncertain: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Relationship {
  id: string;
  campaignId: string;
  sourceEntityId: string;
  targetEntityId: string;
  type: RelationshipType;
  description: string | null;
  intensity: number;
  confidenceScore: number;
  visibility: Visibility;
  status: RelationshipStatus;
  sourceExcerpt: string | null;
  isUncertain: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface OpenQuestion {
  id: string;
  campaignId: string;
  question: string;
  relatedEntityIds: string[];
  resolved: boolean;
  createdAt: string;
}

export interface GeneratedPrompt {
  id: string;
  campaignId: string;
  title: string;
  description: string;
  type: PromptType;
  relatedEntityIds: string[];
  relatedRelationshipIds: string[];
  createdAt: string;
}

export interface AnalyzerEntity {
  name: string;
  type: EntityType;
  description?: string;
  visibility?: Visibility;
  status?: EntityStatus;
  importance?: Importance;
  confidenceScore: number;
  sourceExcerpt?: string;
  imagePrompt?: string | null;
  isUncertain?: boolean;
}

export interface AnalyzerRelationship {
  sourceName: string;
  targetName: string;
  type: RelationshipType;
  description?: string;
  intensity?: number;
  visibility?: Visibility;
  status?: RelationshipStatus;
  confidenceScore: number;
  sourceExcerpt?: string;
  isUncertain?: boolean;
}

export interface AnalyzerOpenQuestion {
  question: string;
  relatedEntityNames?: string[];
}

export interface AnalyzerPreview {
  entities: AnalyzerEntity[];
  relationships: AnalyzerRelationship[];
  generatedPrompts: {
    title: string;
    description: string;
    type: PromptType;
    relatedEntityNames?: string[];
  }[];
  openQuestions: AnalyzerOpenQuestion[];
}

export interface AnalyzeResponse {
  analyzed: AnalyzerPreview;
  persisted: {
    entityCount: number;
    relationshipCount: number;
    promptCount: number;
    openQuestionCount: number;
    sourceTextId: string | null;
  } | null;
  analyzerMode: 'mock' | 'llm';
  fellBackFromLLM?: { reason: string };
}

export interface AnalyzerStatus {
  defaultMode: 'mock' | 'llm';
  llmConfigured: boolean;
  llmConfigError?: string;
  llmModel?: string;
  llmBaseUrl?: string;
}

export interface GraphResponse {
  nodes: {
    id: string;
    type: 'loreNode';
    position: { x: number; y: number };
    data: {
      name: string;
      entityType: EntityType;
      description: string | null;
      visibility: Visibility;
      status: EntityStatus;
      importance: Importance;
      confidenceScore: number;
      sourceExcerpt: string | null;
    };
  }[];
  edges: {
    id: string;
    source: string;
    target: string;
    type: 'loreEdge';
    animated?: boolean;
    data: {
      relationshipType: RelationshipType;
      description: string | null;
      intensity: number;
      visibility: Visibility;
      status: RelationshipStatus;
      confidenceScore: number;
      sourceExcerpt: string | null;
    };
  }[];
}

export interface SessionPrep {
  criticalConflicts: (Relationship & { sourceEntity: Entity | null; targetEntity: Entity | null })[];
  secretRelationships: (Relationship & { sourceEntity: Entity | null; targetEntity: Entity | null })[];
  openDebts: (Relationship & { sourceEntity: Entity | null; targetEntity: Entity | null })[];
  unstableAlliances: (Relationship & { sourceEntity: Entity | null; targetEntity: Entity | null })[];
  possibleReveals: Entity[];
  sessionHooks: GeneratedPrompt[];
  allPrompts: GeneratedPrompt[];
  openQuestions: OpenQuestion[];
}
