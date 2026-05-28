import { z } from 'zod';
import {
  AnalyzerEntityType,
  AnalyzerRelationshipType,
  AnalyzerResult,
} from '../analyzers/types';

const ENTITY_TYPES: AnalyzerEntityType[] = [
  'player_character', 'npc', 'faction', 'location', 'item', 'secret', 'event', 'unknown',
];
const RELATIONSHIP_TYPES: AnalyzerRelationshipType[] = [
  'allied_with', 'hates', 'loves', 'owes', 'manipulates', 'protects', 'hunts',
  'works_for', 'betrayed_by', 'related_to', 'controls', 'knows_secret_of',
  'competes_with', 'located_in', 'owns', 'involved_in', 'unknown_connection',
];

// Permissive schema: unknown enum values pass through and are mapped to
// "unknown" / "unknown_connection" by normalizeAnalyzerResult below.
const entitySchema = z.object({
  name: z.string().min(1),
  type: z.string().optional(),
  description: z.string().optional().nullable(),
  visibility: z.string().optional(),
  status: z.string().optional(),
  importance: z.string().optional(),
  confidenceScore: z.number().min(0).max(1).optional(),
  sourceExcerpt: z.string().optional().nullable(),
  imagePrompt: z.string().optional().nullable(),
  isUncertain: z.boolean().optional(),
});

const relationshipSchema = z.object({
  sourceName: z.string().min(1),
  targetName: z.string().min(1),
  type: z.string().optional(),
  description: z.string().optional().nullable(),
  intensity: z.number().min(1).max(5).optional(),
  visibility: z.string().optional(),
  status: z.string().optional(),
  confidenceScore: z.number().min(0).max(1).optional(),
  sourceExcerpt: z.string().optional().nullable(),
  isUncertain: z.boolean().optional(),
});

const promptSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  type: z.string().optional(),
  relatedEntityNames: z.array(z.string()).optional(),
});

const openQuestionSchema = z.object({
  question: z.string().min(1),
  relatedEntityNames: z.array(z.string()).optional(),
});

export const rawAnalyzerResultSchema = z.object({
  entities: z.array(entitySchema).default([]),
  relationships: z.array(relationshipSchema).default([]),
  generatedPrompts: z.array(promptSchema).default([]),
  openQuestions: z.array(openQuestionSchema).default([]),
});

const ALLOWED_VISIBILITY = new Set(['public', 'gm_only']);
const ALLOWED_ENTITY_STATUS = new Set(['active', 'dead', 'missing', 'destroyed', 'unknown']);
const ALLOWED_RELATIONSHIP_STATUS = new Set(['stable', 'unstable', 'escalating', 'broken', 'secret']);
const ALLOWED_IMPORTANCE = new Set(['low', 'medium', 'high', 'critical']);
const ALLOWED_PROMPT_TYPES = new Set([
  'conflict', 'reveal', 'debt', 'betrayal', 'alliance', 'mystery', 'session_hook',
]);

export function normalizeAnalyzerResult(raw: unknown): AnalyzerResult {
  const parsed = rawAnalyzerResultSchema.parse(raw);

  const entities = parsed.entities.map((e) => ({
    name: e.name.trim(),
    type: (ENTITY_TYPES.includes(e.type as AnalyzerEntityType)
      ? e.type
      : 'unknown') as AnalyzerEntityType,
    description: e.description ?? undefined,
    visibility: (ALLOWED_VISIBILITY.has(e.visibility ?? '') ? e.visibility : 'public') as 'public' | 'gm_only',
    status: (ALLOWED_ENTITY_STATUS.has(e.status ?? '') ? e.status : 'active') as
      | 'active' | 'dead' | 'missing' | 'destroyed' | 'unknown',
    importance: (ALLOWED_IMPORTANCE.has(e.importance ?? '') ? e.importance : 'medium') as
      | 'low' | 'medium' | 'high' | 'critical',
    confidenceScore: clamp01(e.confidenceScore ?? 0.5),
    sourceExcerpt: e.sourceExcerpt ?? undefined,
    imagePrompt: e.imagePrompt && e.imagePrompt.trim() ? e.imagePrompt.trim() : null,
    isUncertain: e.isUncertain ?? undefined,
  }));

  // Deduplicate by case-insensitive name; keep highest confidence and the more
  // specific type (anything beats "unknown").
  const byName = new Map<string, (typeof entities)[number]>();
  for (const e of entities) {
    const key = e.name.toLowerCase();
    const existing = byName.get(key);
    if (!existing) {
      byName.set(key, e);
    } else {
      if (existing.type === 'unknown' && e.type !== 'unknown') existing.type = e.type;
      existing.confidenceScore = Math.max(existing.confidenceScore, e.confidenceScore);
      if (!existing.description && e.description) existing.description = e.description;
      if (!existing.sourceExcerpt && e.sourceExcerpt) existing.sourceExcerpt = e.sourceExcerpt;
      if (!existing.imagePrompt && e.imagePrompt) existing.imagePrompt = e.imagePrompt;
    }
  }

  const relationships = parsed.relationships.map((r) => ({
    sourceName: r.sourceName.trim(),
    targetName: r.targetName.trim(),
    type: (RELATIONSHIP_TYPES.includes(r.type as AnalyzerRelationshipType)
      ? r.type
      : 'unknown_connection') as AnalyzerRelationshipType,
    description: r.description ?? undefined,
    intensity: clampIntensity(r.intensity ?? 3),
    visibility: (ALLOWED_VISIBILITY.has(r.visibility ?? '') ? r.visibility : 'public') as 'public' | 'gm_only',
    status: (ALLOWED_RELATIONSHIP_STATUS.has(r.status ?? '') ? r.status : 'stable') as
      | 'stable' | 'unstable' | 'escalating' | 'broken' | 'secret',
    confidenceScore: clamp01(r.confidenceScore ?? 0.5),
    sourceExcerpt: r.sourceExcerpt ?? undefined,
    isUncertain: r.isUncertain ?? undefined,
  }));

  const generatedPrompts = parsed.generatedPrompts.map((p) => ({
    title: p.title.trim(),
    description: p.description.trim(),
    type: (ALLOWED_PROMPT_TYPES.has(p.type ?? '') ? p.type : 'session_hook') as
      | 'conflict' | 'reveal' | 'debt' | 'betrayal' | 'alliance' | 'mystery' | 'session_hook',
    relatedEntityNames: p.relatedEntityNames ?? [],
  }));

  const openQuestions = parsed.openQuestions.map((q) => ({
    question: q.question.trim(),
    relatedEntityNames: q.relatedEntityNames ?? [],
  }));

  return {
    entities: Array.from(byName.values()),
    relationships,
    generatedPrompts,
    openQuestions,
  };
}

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0.5;
  return Math.max(0, Math.min(1, n));
}

function clampIntensity(n: number): number {
  const i = Math.round(n);
  return Math.max(1, Math.min(5, Number.isFinite(i) ? i : 3));
}
