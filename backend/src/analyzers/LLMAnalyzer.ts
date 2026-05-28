import {
  AnalyzerInput,
  AnalyzerResult,
  CampaignTextAnalyzer,
} from './types';

// System prompt for the LLM. Single source of truth — also exported so that
// the route layer can log what version of the instructions produced a given
// analysis if needed.
export const LLM_SYSTEM_PROMPT = `Du bist ein semantischer Analysator für Pen-&-Paper-Kampagnentexte.

EINGABE: unstrukturierter Kampagnentext (Lore, Session Notes, Charakterhintergründe, Abenteuerbeschreibungen).

AUFGABE: Verstehe den Text semantisch und extrahiere strukturierte Information für eine Beziehungskarte. Verlasse dich NICHT nur auf Keywords. Verstehe Kontext, Subtext, Implikationen.

Frage dich bei jeder Aussage:
- Wer kennt wen, und wie tief?
- Wer arbeitet (offen oder verdeckt) gegen wen?
- Wer manipuliert wen?
- Wer verschweigt wem welche Information?
- Welche Fraktionen stehen in offenem oder verdecktem Konflikt?
- Welche NPCs sind plotrelevant, welche nur Hintergrundkulisse?
- Welche Orte und Gegenstände treiben die Handlung an?
- Welche Beziehungen kann jeder wissen — welche sind nur SL-Wissen?
- Was wird im Text NICHT gesagt und müsste noch geklärt werden?

VISIBILITY-REGEL:
- "public": Information, die Spielfiguren im Spiel kennen können.
- "gm_only": Information, die der Text als geheim markiert (durch "verschweigt", "in Wahrheit", "niemand weiß") oder die per Subtext klar nur dem SL gehört.

UNSICHERHEIT:
- Setze "confidenceScore" < 0.6 für Informationen, die du erschlossen hast und die der Nutzer bestätigen sollte.
- Setze zusätzlich "isUncertain": true, wenn die Information explizit eine Vermutung ist.

ANTWORTFORMAT: Ausschließlich gültiges JSON nach folgendem Schema. Keine Erklärung, kein Codeblock, kein Prosa-Vorspann.

{
  "entities": [
    {
      "name": "string",
      "type": "player_character | npc | faction | location | item | secret | event | unknown",
      "description": "string — kurzer Beschreibungssatz",
      "visibility": "public | gm_only",
      "status": "active | dead | missing | destroyed | unknown",
      "importance": "low | medium | high | critical",
      "confidenceScore": 0.0,
      "sourceExcerpt": "string — Originalsatz oder Absatz",
      "imagePrompt": "string | null — englischer KI-Bild-Prompt, 8–25 Wörter, Fantasy-Stil. null für abstrakte Entitäten (events, secrets).",
      "isUncertain": false
    }
  ],
  "relationships": [
    {
      "sourceName": "string — Name einer Entität aus entities",
      "targetName": "string — Name einer Entität aus entities",
      "type": "allied_with | hates | loves | owes | manipulates | protects | hunts | works_for | betrayed_by | related_to | controls | knows_secret_of | competes_with | located_in | owns | involved_in | unknown_connection",
      "description": "string — knappe Beschreibung der Beziehung",
      "intensity": 1,
      "visibility": "public | gm_only",
      "status": "stable | unstable | escalating | broken | secret",
      "confidenceScore": 0.0,
      "sourceExcerpt": "string",
      "isUncertain": false
    }
  ],
  "generatedPrompts": [
    {
      "title": "string",
      "description": "string — konkreter Spielimpuls für die nächste Session",
      "type": "conflict | reveal | debt | betrayal | alliance | mystery | session_hook",
      "relatedEntityNames": ["string"]
    }
  ],
  "openQuestions": [
    {
      "question": "string — eine konkrete offene Frage an den SL",
      "relatedEntityNames": ["string"]
    }
  ]
}

REGELN:
- Wenn unsicher: type "unknown" bzw. "unknown_connection".
- confidenceScore ∈ [0, 1]. intensity ∈ [1, 5].
- 3–7 generatedPrompts. 2–5 openQuestions, falls der Text Lücken hat.
- imagePrompt nur für player_character, npc, location, item, faction. Andere: null.
- Alle relationship-Endpunkte müssen in entities vorkommen.
- Antworte ausschließlich mit dem JSON-Objekt.`;

// ---------- config ----------

export interface LLMProviderConfig {
  /** Base URL of the OpenAI-compatible API, e.g. https://api.openai.com/v1 */
  baseUrl: string;
  /** Optional bearer token. Empty/undefined is fine for local providers
   *  like LM Studio or Ollama. */
  apiKey?: string;
  /** Model identifier as the provider expects it. */
  model: string;
  /** 0..2. Lower = more deterministic. */
  temperature?: number;
  /** Hard cap on output tokens. Useful for cost control. */
  maxTokens?: number;
  /** Override fetch — used by tests. */
  fetchImpl?: typeof fetch;
  /** Override the system prompt — used by tests / advanced users. */
  systemPrompt?: string;
  /** Send `response_format: {type: "json_object"}` in the request body.
   *  Default true. Some self-hosted providers reject this — set to false then. */
  requestJsonMode?: boolean;
  /** HTTP timeout in milliseconds. */
  timeoutMs?: number;
}

// ---------- analyzer ----------

export class LLMAnalyzer implements CampaignTextAnalyzer {
  readonly mode = 'llm' as const;
  private readonly cfg: LLMProviderConfig;

  constructor(cfg: LLMProviderConfig) {
    if (!cfg.baseUrl) throw new Error('LLMAnalyzer: baseUrl is required');
    if (!cfg.model) throw new Error('LLMAnalyzer: model is required');
    this.cfg = cfg;
  }

  async analyze(input: AnalyzerInput): Promise<AnalyzerResult> {
    const fetchImpl = this.cfg.fetchImpl ?? fetch;
    const url = this.cfg.baseUrl.replace(/\/+$/, '') + '/chat/completions';

    const body: Record<string, unknown> = {
      model: this.cfg.model,
      temperature: this.cfg.temperature ?? 0.2,
      messages: [
        { role: 'system', content: this.cfg.systemPrompt ?? LLM_SYSTEM_PROMPT },
        { role: 'user', content: input.text },
      ],
    };
    if (this.cfg.maxTokens) body.max_tokens = this.cfg.maxTokens;
    if (this.cfg.requestJsonMode !== false) body.response_format = { type: 'json_object' };

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.cfg.apiKey) headers['Authorization'] = `Bearer ${this.cfg.apiKey}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.cfg.timeoutMs ?? 60_000);

    let res: Response;
    try {
      res = await fetchImpl(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (err) {
      const message = (err as Error).name === 'AbortError'
        ? `LLM request timed out after ${this.cfg.timeoutMs ?? 60_000}ms`
        : `LLM request failed: ${(err as Error).message}`;
      throw new LLMAnalyzerError(message, { cause: err });
    } finally {
      clearTimeout(timeout);
    }

    if (!res.ok) {
      const bodyText = await safeReadBody(res);
      throw new LLMAnalyzerError(
        `LLM provider returned ${res.status} ${res.statusText}: ${truncate(bodyText, 500)}`,
      );
    }

    const json = (await res.json()) as ChatCompletionResponse;
    const content = json?.choices?.[0]?.message?.content;
    if (!content || typeof content !== 'string') {
      throw new LLMAnalyzerError('LLM response did not contain message content');
    }

    const parsed = parseLooseJson(content);
    if (!parsed) {
      throw new LLMAnalyzerError(
        `LLM did not return valid JSON. First 200 chars: ${truncate(content, 200)}`,
      );
    }

    // Don't run normalization here — the route layer calls
    // normalizeAnalyzerResult() on every analyzer output, so unknown enum
    // values pass cleanly through both code paths.
    return parsed as AnalyzerResult;
  }
}

// ---------- helpers ----------

interface ChatCompletionResponse {
  choices?: Array<{
    message?: { content?: string };
  }>;
}

export class LLMAnalyzerError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = 'LLMAnalyzerError';
    if (options?.cause !== undefined) (this as { cause?: unknown }).cause = options.cause;
  }
}

// Tries hard to find a JSON object in the model's output:
//   1. direct JSON.parse
//   2. extract a ```json ... ``` markdown block
//   3. extract the largest brace-balanced { … } substring
export function parseLooseJson(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    // fall through
  }

  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(trimmed);
  if (fenced) {
    try { return JSON.parse(fenced[1]); } catch {}
  }

  const first = trimmed.indexOf('{');
  const last = trimmed.lastIndexOf('}');
  if (first >= 0 && last > first) {
    try { return JSON.parse(trimmed.slice(first, last + 1)); } catch {}
  }

  return null;
}

async function safeReadBody(res: Response): Promise<string> {
  try { return await res.text(); } catch { return ''; }
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n) + '…' : s;
}
