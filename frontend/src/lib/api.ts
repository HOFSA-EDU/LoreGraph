import type {
  AnalyzeResponse,
  AnalyzerStatus,
  Campaign,
  Entity,
  GeneratedPrompt,
  GraphResponse,
  OpenQuestion,
  Relationship,
  SessionPrep,
  SourceType,
} from '@/types/loregraph';

const BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://localhost:4000';

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    ...init,
  });
  if (!res.ok) {
    let detail: unknown = undefined;
    try {
      detail = await res.json();
    } catch {
      detail = await res.text();
    }
    const err = new Error(
      typeof detail === 'object' && detail && 'message' in detail
        ? String((detail as { message: unknown }).message)
        : `HTTP ${res.status}`,
    );
    (err as Error & { detail?: unknown }).detail = detail;
    throw err;
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  // Campaigns
  listCampaigns: () => http<Campaign[]>('/api/campaigns'),
  getCampaign: (id: string) => http<Campaign>(`/api/campaigns/${id}`),
  createCampaign: (data: Partial<Campaign>) =>
    http<Campaign>('/api/campaigns', { method: 'POST', body: JSON.stringify(data) }),
  updateCampaign: (id: string, data: Partial<Campaign>) =>
    http<Campaign>(`/api/campaigns/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteCampaign: (id: string) =>
    http<void>(`/api/campaigns/${id}`, { method: 'DELETE' }),

  // Analyzer
  analyzerStatus: () => http<AnalyzerStatus>('/api/analyzer/status'),

  analyze: (
    campaignId: string,
    body: {
      text: string;
      sourceType: SourceType;
      mode?: 'mock' | 'llm';
      preview?: boolean;
      storeSourceText?: boolean;
      title?: string;
      allowFallback?: boolean;
    },
  ) =>
    http<AnalyzeResponse>(`/api/campaigns/${campaignId}/analyze`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  // Open questions
  listOpenQuestions: (campaignId: string) =>
    http<OpenQuestion[]>(`/api/campaigns/${campaignId}/open-questions`),
  updateOpenQuestion: (campaignId: string, questionId: string, data: Partial<OpenQuestion>) =>
    http<OpenQuestion>(`/api/campaigns/${campaignId}/open-questions/${questionId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  deleteOpenQuestion: (campaignId: string, questionId: string) =>
    http<void>(`/api/campaigns/${campaignId}/open-questions/${questionId}`, {
      method: 'DELETE',
    }),

  // Entities
  listEntities: (campaignId: string) => http<Entity[]>(`/api/campaigns/${campaignId}/entities`),
  updateEntity: (entityId: string, data: Partial<Entity>) =>
    http<Entity>(`/api/entities/${entityId}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteEntity: (entityId: string) =>
    http<void>(`/api/entities/${entityId}`, { method: 'DELETE' }),

  // Relationships
  listRelationships: (campaignId: string) =>
    http<Relationship[]>(`/api/campaigns/${campaignId}/relationships`),
  updateRelationship: (relationshipId: string, data: Partial<Relationship>) =>
    http<Relationship>(`/api/relationships/${relationshipId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  deleteRelationship: (relationshipId: string) =>
    http<void>(`/api/relationships/${relationshipId}`, { method: 'DELETE' }),

  // Graph
  graph: (campaignId: string) => http<GraphResponse>(`/api/campaigns/${campaignId}/graph`),

  // Prompts
  prompts: (campaignId: string) =>
    http<GeneratedPrompt[]>(`/api/campaigns/${campaignId}/generated-prompts`),

  // Session prep
  sessionPrep: (campaignId: string) =>
    http<SessionPrep>(`/api/campaigns/${campaignId}/session-prep`),

  // Export / Import
  exportCampaign: (campaignId: string) =>
    http<{ version: number; campaign: unknown }>(`/api/campaigns/${campaignId}/export`),
  importCampaign: (payload: unknown) =>
    http<{ id: string }>('/api/campaigns/import', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};

export { BASE as API_BASE };
