import { promises as fs } from 'fs';
import path from 'path';

// ---------- type-specific prompt styling ----------
//
// The campaign's EntityType enum is richer than person/place/object, so we map
// each supported type to one of three illustration intents:
//   person  -> character illustration   (player_character, npc)
//   place   -> environment illustration (location)
//   object  -> item illustration        (item)
// faction gets an emblem/group treatment. Abstract types (secret, event,
// unknown) have no meaningful single image and are not supported.

const TYPE_STYLE: Record<string, string> = {
  player_character: 'character illustration, full-body fantasy character portrait',
  npc: 'character illustration, fantasy character portrait',
  faction: 'heraldic emblem and group illustration, fantasy banner',
  location: 'environment illustration, fantasy location concept art, wide establishing shot',
  item: 'item illustration, single fantasy object centered on a neutral background',
};

const STYLE_SUFFIX =
  'Detailed digital fantasy art, dramatic lighting, high detail, no text, no watermark.';

export function supportsImageType(type: string): boolean {
  return Object.prototype.hasOwnProperty.call(TYPE_STYLE, type);
}

export interface PromptSource {
  name: string;
  type: string;
  imagePrompt?: string | null;
  description?: string | null;
}

/** Build the final image prompt from the entity's stored prompt (falling back
 *  to its description, then its name) plus the type-specific style. */
export function buildImagePrompt(entity: PromptSource): string {
  const style = TYPE_STYLE[entity.type];
  if (!style) {
    throw new ImageGenerationError(
      `Entity type "${entity.type}" does not support image generation`,
      { code: 'unsupported_type' },
    );
  }
  const base = (entity.imagePrompt?.trim() || entity.description?.trim() || entity.name).trim();
  return `${base}. ${style}. ${STYLE_SUFFIX}`;
}

// ---------- config ----------

export interface ImageGeneratorConfig {
  /** Base URL of the OpenAI-compatible image API, e.g. https://api.openai.com/v1 */
  baseUrl: string;
  /** Optional bearer token. Required by OpenAI; optional for local providers. */
  apiKey?: string;
  /** Image model, e.g. gpt-image-1 or dall-e-3. */
  model: string;
  /** Requested image size, e.g. 1024x1024. */
  size: string;
  /** HTTP timeout in milliseconds. */
  timeoutMs?: number;
  /** Override fetch — used by tests. */
  fetchImpl?: typeof fetch;
}

const DEFAULT_TIMEOUT_MS = 120_000;

/** Read image config from the environment. Falls back to the LLM_* variables so
 *  an existing OpenAI setup works without extra configuration. */
export function loadImageConfigFromEnv(): ImageGeneratorConfig {
  // Use `||` (not `??`) so empty strings fall back too: docker-compose passes
  // unset overrides like `IMAGE_BASE_URL: ${IMAGE_BASE_URL:-}` as "", which
  // would otherwise shadow the LLM_* fallback.
  const baseUrl = process.env.IMAGE_BASE_URL?.trim() || process.env.LLM_BASE_URL?.trim();
  const apiKey = process.env.IMAGE_API_KEY?.trim() || process.env.LLM_API_KEY?.trim() || undefined;
  const model = process.env.IMAGE_MODEL?.trim() || 'gpt-image-1';
  const size = process.env.IMAGE_SIZE?.trim() || '1024x1024';
  const timeoutEnv = process.env.IMAGE_TIMEOUT_MS ? Number(process.env.IMAGE_TIMEOUT_MS) : undefined;

  if (!baseUrl) {
    throw new ImageGenerationError(
      'No image API base URL configured. Set IMAGE_BASE_URL or LLM_BASE_URL.',
      { code: 'image_not_configured' },
    );
  }

  return {
    baseUrl,
    apiKey,
    model,
    size,
    timeoutMs: Number.isFinite(timeoutEnv) ? (timeoutEnv as number) : DEFAULT_TIMEOUT_MS,
  };
}

// ---------- generation ----------

export interface GeneratedImage {
  buffer: Buffer;
  ext: string;
}

/** Call the OpenAI-compatible image API and return the raw image bytes. */
export async function generateImage(
  prompt: string,
  cfg: ImageGeneratorConfig,
): Promise<GeneratedImage> {
  const fetchImpl = cfg.fetchImpl ?? fetch;
  const url = cfg.baseUrl.replace(/\/+$/, '') + '/images/generations';

  const body: Record<string, unknown> = {
    model: cfg.model,
    prompt,
    n: 1,
    size: cfg.size,
  };
  // dall-e models default to returning a URL; ask for base64 directly.
  // gpt-image-1 returns base64 by default and rejects response_format.
  if (cfg.model.startsWith('dall-e')) body.response_format = 'b64_json';

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (cfg.apiKey) headers['Authorization'] = `Bearer ${cfg.apiKey}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), cfg.timeoutMs ?? DEFAULT_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetchImpl(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err) {
    const message =
      (err as Error).name === 'AbortError'
        ? `Image request timed out after ${cfg.timeoutMs ?? DEFAULT_TIMEOUT_MS}ms`
        : `Image request failed: ${(err as Error).message}`;
    throw new ImageGenerationError(message, { cause: err });
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new ImageGenerationError(
      `Image provider returned ${res.status} ${res.statusText}: ${truncate(text, 500)}`,
    );
  }

  const json = (await res.json()) as ImageApiResponse;
  const first = json?.data?.[0];

  if (first?.b64_json) {
    return { buffer: Buffer.from(first.b64_json, 'base64'), ext: 'png' };
  }

  if (first?.url) {
    const imgRes = await fetchImpl(first.url);
    if (!imgRes.ok) {
      throw new ImageGenerationError(`Failed to download generated image: HTTP ${imgRes.status}`);
    }
    const arrayBuf = await imgRes.arrayBuffer();
    const contentType = imgRes.headers.get('content-type') ?? 'image/png';
    const ext = contentType.includes('jpeg') ? 'jpg' : contentType.includes('webp') ? 'webp' : 'png';
    return { buffer: Buffer.from(arrayBuf), ext };
  }

  throw new ImageGenerationError('Image provider response contained no image data');
}

// ---------- storage ----------

/** Root directory for persisted uploads. In Docker this is mounted as a volume
 *  at /app/uploads; locally it resolves to backend/uploads. */
export function uploadsRoot(): string {
  return process.env.UPLOADS_DIR?.trim() || path.resolve(process.cwd(), 'uploads');
}

/** Persist an entity image to disk and return its public URL path. The
 *  timestamped filename doubles as cache-busting on regeneration. */
export async function saveEntityImage(
  entityId: string,
  image: GeneratedImage,
): Promise<string> {
  const dir = path.join(uploadsRoot(), 'entities');
  await fs.mkdir(dir, { recursive: true });
  const filename = `${entityId}-${Date.now()}.${image.ext}`;
  await fs.writeFile(path.join(dir, filename), image.buffer);
  return `/uploads/entities/${filename}`;
}

// ---------- helpers ----------

interface ImageApiResponse {
  data?: Array<{ b64_json?: string; url?: string }>;
}

export class ImageGenerationError extends Error {
  readonly code?: string;
  constructor(message: string, options?: { code?: string; cause?: unknown }) {
    super(message);
    this.name = 'ImageGenerationError';
    this.code = options?.code;
    if (options?.cause !== undefined) (this as { cause?: unknown }).cause = options.cause;
  }
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n) + '…' : s;
}
