import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ImageGenerationError,
  buildImagePrompt,
  generateImage,
  loadImageConfigFromEnv,
  supportsImageType,
} from './imageGenerator';

describe('loadImageConfigFromEnv', () => {
  const ENV_KEYS = [
    'IMAGE_BASE_URL', 'IMAGE_API_KEY', 'IMAGE_MODEL', 'IMAGE_SIZE',
    'IMAGE_TIMEOUT_MS', 'LLM_BASE_URL', 'LLM_API_KEY',
  ] as const;
  let saved: Record<string, string | undefined>;

  beforeEach(() => {
    saved = {};
    for (const k of ENV_KEYS) {
      saved[k] = process.env[k];
      delete process.env[k];
    }
  });
  afterEach(() => {
    for (const k of ENV_KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  it('falls back to LLM_* when IMAGE_* are empty strings (docker-compose case)', () => {
    process.env.IMAGE_BASE_URL = '';
    process.env.IMAGE_API_KEY = '';
    process.env.LLM_BASE_URL = 'https://api.openai.com/v1';
    process.env.LLM_API_KEY = 'sk-real-key';

    const cfg = loadImageConfigFromEnv();
    expect(cfg.baseUrl).toBe('https://api.openai.com/v1');
    expect(cfg.apiKey).toBe('sk-real-key');
    expect(cfg.model).toBe('gpt-image-1');
  });

  it('prefers IMAGE_* overrides when set', () => {
    process.env.IMAGE_BASE_URL = 'https://images.example.com/v1';
    process.env.LLM_BASE_URL = 'https://api.openai.com/v1';
    expect(loadImageConfigFromEnv().baseUrl).toBe('https://images.example.com/v1');
  });

  it('throws when no base URL is configured at all', () => {
    expect(() => loadImageConfigFromEnv()).toThrow(ImageGenerationError);
  });
});

describe('supportsImageType', () => {
  it('supports person/place/object types and faction', () => {
    expect(supportsImageType('player_character')).toBe(true);
    expect(supportsImageType('npc')).toBe(true);
    expect(supportsImageType('location')).toBe(true);
    expect(supportsImageType('item')).toBe(true);
    expect(supportsImageType('faction')).toBe(true);
  });

  it('rejects abstract types', () => {
    expect(supportsImageType('secret')).toBe(false);
    expect(supportsImageType('event')).toBe(false);
    expect(supportsImageType('unknown')).toBe(false);
  });
});

describe('buildImagePrompt', () => {
  it('adds the character style for person-like types', () => {
    const prompt = buildImagePrompt({
      name: 'Elric',
      type: 'npc',
      imagePrompt: 'weary captain in tarnished silver armor',
    });
    expect(prompt).toContain('weary captain in tarnished silver armor');
    expect(prompt).toContain('character illustration');
  });

  it('adds the environment style for places', () => {
    const prompt = buildImagePrompt({ name: 'Graufurt', type: 'location' });
    expect(prompt).toContain('environment illustration');
  });

  it('adds the item style for objects', () => {
    const prompt = buildImagePrompt({ name: 'Splitter von Veyra', type: 'item' });
    expect(prompt).toContain('item illustration');
  });

  it('falls back to description, then name, when no imagePrompt', () => {
    expect(buildImagePrompt({ name: 'X', type: 'npc', description: 'a hooded figure' })).toContain(
      'a hooded figure',
    );
    expect(buildImagePrompt({ name: 'Bob', type: 'npc' })).toContain('Bob');
  });

  it('throws for unsupported types', () => {
    expect(() => buildImagePrompt({ name: 'S', type: 'secret' })).toThrow(ImageGenerationError);
  });
});

const TINY_PNG_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQAY3Z2VAAAAAElFTkSuQmCC';

describe('generateImage (fetch-mocked)', () => {
  it('returns the decoded buffer from a base64 response', async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(JSON.stringify({ data: [{ b64_json: TINY_PNG_B64 }] }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
    );

    const { buffer, ext } = await generateImage('a prompt', {
      baseUrl: 'https://api.example.com/v1',
      apiKey: 'sk-test',
      model: 'gpt-image-1',
      size: '1024x1024',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
    expect(ext).toBe('png');

    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://api.example.com/v1/images/generations');
    const body = JSON.parse((init as RequestInit).body as string);
    // gpt-image-1 must NOT receive response_format
    expect(body.response_format).toBeUndefined();
    expect(body.model).toBe('gpt-image-1');
  });

  it('requests base64 for dall-e models', async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(JSON.stringify({ data: [{ b64_json: TINY_PNG_B64 }] }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
    );

    await generateImage('a prompt', {
      baseUrl: 'https://api.example.com/v1',
      model: 'dall-e-3',
      size: '1024x1024',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    const body = JSON.parse((fetchImpl.mock.calls[0][1] as RequestInit).body as string);
    expect(body.response_format).toBe('b64_json');
  });

  it('downloads the image when the provider returns a URL', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: [{ url: 'https://cdn.example.com/img.png' }] }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(Buffer.from(TINY_PNG_B64, 'base64'), {
          status: 200,
          headers: { 'content-type': 'image/png' },
        }),
      );

    const { buffer, ext } = await generateImage('a prompt', {
      baseUrl: 'https://api.example.com/v1',
      model: 'gpt-image-1',
      size: '1024x1024',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(ext).toBe('png');
    expect(buffer.length).toBeGreaterThan(0);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('throws on a non-ok provider response', async () => {
    const fetchImpl = vi.fn(
      async () => new Response('rate limited', { status: 429, statusText: 'Too Many Requests' }),
    );

    await expect(
      generateImage('a prompt', {
        baseUrl: 'https://api.example.com/v1',
        model: 'gpt-image-1',
        size: '1024x1024',
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
    ).rejects.toThrow(ImageGenerationError);
  });
});
