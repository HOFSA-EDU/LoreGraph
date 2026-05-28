import { LLMAnalyzer, LLMProviderConfig } from './LLMAnalyzer';
import { MockAnalyzer } from './MockAnalyzer';
import { CampaignTextAnalyzer } from './types';

export type AnalyzerMode = 'mock' | 'llm';

export interface AnalyzerStatus {
  /** Mode that the analyze endpoint defaults to when the client doesn't
   *  override it (driven by ANALYZER_PROVIDER). */
  defaultMode: AnalyzerMode;
  /** LLM is properly configured and ready to be called. */
  llmConfigured: boolean;
  /** Human-readable diagnostic when llmConfigured is false. */
  llmConfigError?: string;
  llmModel?: string;
  llmBaseUrl?: string;
}

/** Inspect the environment and report whether each mode is usable. The route
 *  layer uses this both for the /api/analyzer/status endpoint and for "is
 *  llm requestable?" gating before instantiating an analyzer. */
export function getAnalyzerStatus(): AnalyzerStatus {
  const defaultMode: AnalyzerMode =
    (process.env.ANALYZER_PROVIDER ?? 'mock').toLowerCase() === 'llm' ? 'llm' : 'mock';

  const baseUrl = process.env.LLM_BASE_URL?.trim();
  const model = process.env.LLM_MODEL?.trim();
  // apiKey is optional — local providers (LM Studio, Ollama) often don't
  // require it. We only treat baseUrl + model as hard requirements.
  const errors: string[] = [];
  if (!baseUrl) errors.push('LLM_BASE_URL is not set');
  if (!model) errors.push('LLM_MODEL is not set');

  return {
    defaultMode,
    llmConfigured: errors.length === 0,
    llmConfigError: errors.length ? errors.join('; ') : undefined,
    llmModel: model,
    llmBaseUrl: baseUrl,
  };
}

/** Pick the effective mode for a request given an optional client-supplied
 *  override. Always falls back to "mock" when LLM is requested but not
 *  configured; pass `{strict: true}` to surface that as an error instead. */
export function resolveAnalyzerMode(
  requested?: AnalyzerMode,
  options?: { strict?: boolean },
): { mode: AnalyzerMode; fellBackFromLLM: boolean; reason?: string } {
  const status = getAnalyzerStatus();
  const wanted = requested ?? status.defaultMode;

  if (wanted === 'llm' && !status.llmConfigured) {
    if (options?.strict) {
      const err = new Error(
        `LLM analyzer is not configured: ${status.llmConfigError}. ` +
          `Set LLM_BASE_URL + LLM_MODEL (and optionally LLM_API_KEY) or request mode "mock".`,
      );
      (err as { code?: string }).code = 'llm_not_configured';
      throw err;
    }
    return { mode: 'mock', fellBackFromLLM: true, reason: status.llmConfigError };
  }

  return { mode: wanted, fellBackFromLLM: false };
}

export function getAnalyzer(mode: AnalyzerMode): CampaignTextAnalyzer {
  if (mode === 'llm') return new LLMAnalyzer(loadLLMConfigFromEnv());
  return new MockAnalyzer();
}

function loadLLMConfigFromEnv(): LLMProviderConfig {
  const baseUrl = process.env.LLM_BASE_URL?.trim();
  const model = process.env.LLM_MODEL?.trim();
  if (!baseUrl) throw new Error('LLM_BASE_URL is not set');
  if (!model) throw new Error('LLM_MODEL is not set');

  const temperature = process.env.LLM_TEMPERATURE
    ? Number(process.env.LLM_TEMPERATURE)
    : undefined;
  const maxTokens = process.env.LLM_MAX_TOKENS
    ? Number(process.env.LLM_MAX_TOKENS)
    : undefined;
  const requestJsonMode = process.env.LLM_JSON_MODE
    ? process.env.LLM_JSON_MODE !== 'false'
    : undefined;
  const timeoutMs = process.env.LLM_TIMEOUT_MS
    ? Number(process.env.LLM_TIMEOUT_MS)
    : undefined;

  return {
    baseUrl,
    apiKey: process.env.LLM_API_KEY?.trim() || undefined,
    model,
    temperature: Number.isFinite(temperature) ? temperature : undefined,
    maxTokens: Number.isFinite(maxTokens) ? maxTokens : undefined,
    requestJsonMode,
    timeoutMs: Number.isFinite(timeoutMs) ? timeoutMs : undefined,
  };
}

export * from './types';
export { MockAnalyzer } from './MockAnalyzer';
export { LLMAnalyzer, LLM_SYSTEM_PROMPT, LLMAnalyzerError, parseLooseJson } from './LLMAnalyzer';
