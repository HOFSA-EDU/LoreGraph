import { describe, expect, it, vi } from 'vitest';
import { LLMAnalyzer, LLMAnalyzerError, LLM_SYSTEM_PROMPT, parseLooseJson } from './LLMAnalyzer';
import { normalizeAnalyzerResult } from '../validators/analyzerResult';

function makeFetchReturningContent(content: string, status = 200) {
  return vi.fn(async () =>
    new Response(JSON.stringify({ choices: [{ message: { content } }] }), {
      status,
      headers: { 'content-type': 'application/json' },
    }),
  );
}

const VALID_PAYLOAD = {
  entities: [
    {
      name: 'Hauptmann Elric',
      type: 'npc',
      description: 'Hauptmann der Stadtwache',
      visibility: 'public',
      status: 'active',
      importance: 'high',
      confidenceScore: 0.85,
      sourceExcerpt: 'Hauptmann Elric vertraut der Gruppe.',
      imagePrompt: 'fantasy portrait of a weary captain in tarnished silver armor',
      isUncertain: false,
    },
    {
      name: 'Mara',
      type: 'npc',
      description: 'Schwester von Elric',
      visibility: 'gm_only',
      status: 'active',
      importance: 'critical',
      confidenceScore: 0.7,
      sourceExcerpt: '… seine Schwester Mara …',
      imagePrompt: 'fantasy portrait of a young woman, ash-stained robes, hidden cult symbol',
      isUncertain: false,
    },
  ],
  relationships: [
    {
      sourceName: 'Mara',
      targetName: 'Hauptmann Elric',
      type: 'hates',
      description: 'Mara hasst ihren Bruder',
      intensity: 4,
      visibility: 'public',
      status: 'escalating',
      confidenceScore: 0.8,
      sourceExcerpt: 'Mara hasst Elric.',
      isUncertain: false,
    },
  ],
  generatedPrompts: [
    {
      title: 'Konflikt: Mara ↔ Elric',
      description: 'Wie eskaliert der Streit?',
      type: 'conflict',
      relatedEntityNames: ['Mara', 'Hauptmann Elric'],
    },
  ],
  openQuestions: [
    {
      question: 'Was hat Elric Mara wirklich angetan?',
      relatedEntityNames: ['Mara', 'Hauptmann Elric'],
    },
  ],
};

describe('parseLooseJson', () => {
  it('parses plain JSON', () => {
    expect(parseLooseJson('{"a":1}')).toEqual({ a: 1 });
  });

  it('extracts JSON from a markdown fence', () => {
    expect(parseLooseJson('```json\n{"a":2}\n```')).toEqual({ a: 2 });
  });

  it('extracts the first balanced brace block from chatty output', () => {
    expect(parseLooseJson('Sure! Here you go: {"a":3} cheers')).toEqual({ a: 3 });
  });

  it('returns null on garbage', () => {
    expect(parseLooseJson('this is not json at all')).toBeNull();
  });
});

describe('LLMAnalyzer (fetch-mocked)', () => {
  it('constructs the correct OpenAI-compatible request', async () => {
    const fetchImpl = makeFetchReturningContent(JSON.stringify(VALID_PAYLOAD));
    const analyzer = new LLMAnalyzer({
      baseUrl: 'https://api.example.com/v1',
      apiKey: 'sk-test-123',
      model: 'gpt-4.1-mini',
      temperature: 0.2,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    await analyzer.analyze({ text: 'Kampagnentext.' });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.example.com/v1/chat/completions');
    expect((init.headers as Record<string, string>)['Authorization']).toBe('Bearer sk-test-123');
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json');

    const body = JSON.parse(init.body as string);
    expect(body.model).toBe('gpt-4.1-mini');
    expect(body.temperature).toBe(0.2);
    expect(body.response_format).toEqual({ type: 'json_object' });
    expect(body.messages[0].role).toBe('system');
    expect(body.messages[0].content).toBe(LLM_SYSTEM_PROMPT);
    expect(body.messages[1].role).toBe('user');
    expect(body.messages[1].content).toBe('Kampagnentext.');
  });

  it('omits Authorization header when no apiKey is configured (local providers)', async () => {
    const fetchImpl = makeFetchReturningContent(JSON.stringify(VALID_PAYLOAD));
    const analyzer = new LLMAnalyzer({
      baseUrl: 'http://localhost:1234/v1',
      model: 'local-model',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    await analyzer.analyze({ text: 'foo' });
    const init = fetchImpl.mock.calls[0]?.[1] as RequestInit;
    expect((init.headers as Record<string, string>)['Authorization']).toBeUndefined();
  });

  it('strips trailing slashes on baseUrl', async () => {
    const fetchImpl = makeFetchReturningContent(JSON.stringify(VALID_PAYLOAD));
    const analyzer = new LLMAnalyzer({
      baseUrl: 'https://api.example.com/v1////',
      model: 'gpt-4.1-mini',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    await analyzer.analyze({ text: 'foo' });
    expect(fetchImpl.mock.calls[0]?.[0]).toBe('https://api.example.com/v1/chat/completions');
  });

  it('parses a valid JSON response and produces an AnalyzerResult', async () => {
    const fetchImpl = makeFetchReturningContent(JSON.stringify(VALID_PAYLOAD));
    const analyzer = new LLMAnalyzer({
      baseUrl: 'https://api.example.com/v1',
      apiKey: 'sk',
      model: 'm',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    const raw = await analyzer.analyze({ text: 'foo' });
    const result = normalizeAnalyzerResult(raw);
    expect(result.entities).toHaveLength(2);
    expect(result.relationships).toHaveLength(1);
    expect(result.generatedPrompts).toHaveLength(1);
    expect(result.openQuestions).toHaveLength(1);
    expect(result.entities[0].imagePrompt).toContain('fantasy portrait');
  });

  it('parses JSON that comes wrapped in a markdown code block', async () => {
    const fetchImpl = makeFetchReturningContent('```json\n' + JSON.stringify(VALID_PAYLOAD) + '\n```');
    const analyzer = new LLMAnalyzer({
      baseUrl: 'https://api.example.com/v1',
      apiKey: 'sk',
      model: 'm',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    const raw = await analyzer.analyze({ text: 'foo' });
    const result = normalizeAnalyzerResult(raw);
    expect(result.entities).toHaveLength(2);
  });

  it('throws LLMAnalyzerError on non-2xx', async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ error: 'bad request' }), {
        status: 401,
        statusText: 'Unauthorized',
      }),
    );
    const analyzer = new LLMAnalyzer({
      baseUrl: 'https://api.example.com/v1',
      apiKey: 'sk-wrong',
      model: 'm',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    await expect(analyzer.analyze({ text: 'foo' })).rejects.toBeInstanceOf(LLMAnalyzerError);
  });

  it('throws LLMAnalyzerError when content is missing', async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ choices: [] }), { status: 200 }),
    );
    const analyzer = new LLMAnalyzer({
      baseUrl: 'https://api.example.com/v1',
      apiKey: 'sk',
      model: 'm',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    await expect(analyzer.analyze({ text: 'foo' })).rejects.toBeInstanceOf(LLMAnalyzerError);
  });

  it('throws LLMAnalyzerError when content is not parseable JSON', async () => {
    const fetchImpl = makeFetchReturningContent('I am sorry Dave, I cannot do that.');
    const analyzer = new LLMAnalyzer({
      baseUrl: 'https://api.example.com/v1',
      apiKey: 'sk',
      model: 'm',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    await expect(analyzer.analyze({ text: 'foo' })).rejects.toBeInstanceOf(LLMAnalyzerError);
  });

  it('omits response_format when requestJsonMode is false', async () => {
    const fetchImpl = makeFetchReturningContent(JSON.stringify(VALID_PAYLOAD));
    const analyzer = new LLMAnalyzer({
      baseUrl: 'http://localhost:11434/v1',
      model: 'llama3',
      requestJsonMode: false,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    await analyzer.analyze({ text: 'foo' });
    const body = JSON.parse(fetchImpl.mock.calls[0]?.[1]?.body as string);
    expect(body.response_format).toBeUndefined();
  });
});

describe('LLM_SYSTEM_PROMPT', () => {
  it('includes the response schema with the new fields', () => {
    expect(LLM_SYSTEM_PROMPT).toContain('"imagePrompt"');
    expect(LLM_SYSTEM_PROMPT).toContain('"openQuestions"');
    expect(LLM_SYSTEM_PROMPT).toContain('isUncertain');
    expect(LLM_SYSTEM_PROMPT).toContain('gm_only');
  });
});
