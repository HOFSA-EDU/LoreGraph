import { describe, expect, it } from 'vitest';
import { MockAnalyzer } from './MockAnalyzer';
import { normalizeAnalyzerResult } from '../validators/analyzerResult';

// ---------- original Graufurt sample ----------

const GRAUFURT = `Die Stadt Graufurt wird vom Orden der Silbernen Maske kontrolliert. Hauptmann Elric vertraut der Abenteurergruppe, verschweigt ihnen aber, dass seine Schwester Mara für den Kult der Asche arbeitet. Der Kult sucht den Splitter von Veyra, ein Artefakt, das unter der alten Brücke verborgen liegt. Mara hasst Elric, weil er sie einst verraten hat. Die Diebesgilde von Graufurt schuldet der Gruppe noch einen Gefallen.`;

function lowerNames(items: { name: string }[]): string[] {
  return items.map((i) => i.name.toLowerCase());
}

describe('MockAnalyzer — Graufurt sample (regression)', () => {
  it('returns empty result for empty input', async () => {
    const result = await new MockAnalyzer().analyze({ text: '' });
    expect(result.entities).toEqual([]);
    expect(result.relationships).toEqual([]);
    expect(result.generatedPrompts).toEqual([]);
  });

  it('extracts ≥5 entities, ≥4 relationships, ≥2 prompts from the Graufurt sample', async () => {
    const raw = await new MockAnalyzer().analyze({ text: GRAUFURT });
    const result = normalizeAnalyzerResult(raw);
    expect(result.entities.length).toBeGreaterThanOrEqual(5);
    expect(result.relationships.length).toBeGreaterThanOrEqual(4);
    expect(result.generatedPrompts.length).toBeGreaterThanOrEqual(2);
  });

  it('recognises specific named entities from the Graufurt sample', async () => {
    const raw = await new MockAnalyzer().analyze({ text: GRAUFURT });
    const result = normalizeAnalyzerResult(raw);
    const names = lowerNames(result.entities);
    expect(names).toContain('stadt graufurt');
    expect(names).toContain('orden der silbernen maske');
    expect(names).toContain('kult der asche');
    expect(names.some((n) => n.includes('mara'))).toBe(true);
    expect(names.some((n) => n.includes('elric'))).toBe(true);
  });

  it('classifies factions, locations and items correctly (Graufurt)', async () => {
    const raw = await new MockAnalyzer().analyze({ text: GRAUFURT });
    const result = normalizeAnalyzerResult(raw);
    const byName = new Map(result.entities.map((e) => [e.name.toLowerCase(), e]));
    expect(byName.get('stadt graufurt')?.type).toBe('location');
    expect(byName.get('orden der silbernen maske')?.type).toBe('faction');
    expect(byName.get('kult der asche')?.type).toBe('faction');
    expect(byName.get('diebesgilde von graufurt')?.type).toBe('faction');
    expect(byName.get('splitter von veyra')?.type).toBe('item');
  });

  it('produces controls/hates/owes/works_for from Graufurt', async () => {
    const raw = await new MockAnalyzer().analyze({ text: GRAUFURT });
    const result = normalizeAnalyzerResult(raw);
    const types = result.relationships.map((r) => r.type);
    expect(types).toContain('controls');
    expect(types).toContain('hates');
    expect(types).toContain('owes');
    expect(types).toContain('works_for');
  });

  it('marks the Mara/Kult connection as a secret', async () => {
    const raw = await new MockAnalyzer().analyze({ text: GRAUFURT });
    const result = normalizeAnalyzerResult(raw);
    const worksFor = result.relationships.find((r) => r.type === 'works_for');
    expect(worksFor).toBeDefined();
    expect(worksFor?.visibility).toBe('gm_only');
    expect(worksFor?.status).toBe('secret');
  });

  it('attaches a sourceExcerpt to every entity and relationship', async () => {
    const raw = await new MockAnalyzer().analyze({ text: GRAUFURT });
    const result = normalizeAnalyzerResult(raw);
    for (const e of result.entities) expect(e.sourceExcerpt).toBeTruthy();
    for (const r of result.relationships) expect(r.sourceExcerpt).toBeTruthy();
  });

  it('confidence scores are within [0, 1]', async () => {
    const raw = await new MockAnalyzer().analyze({ text: GRAUFURT });
    const result = normalizeAnalyzerResult(raw);
    for (const e of result.entities) {
      expect(e.confidenceScore).toBeGreaterThanOrEqual(0);
      expect(e.confidenceScore).toBeLessThanOrEqual(1);
    }
  });

  it('emits at least one conflict prompt and one session_hook prompt', async () => {
    const raw = await new MockAnalyzer().analyze({ text: GRAUFURT });
    const result = normalizeAnalyzerResult(raw);
    const types = result.generatedPrompts.map((p) => p.type);
    expect(types).toContain('conflict');
    expect(types).toContain('session_hook');
  });
});

// ---------- new Eisenfeld sample exercising every requested pattern ----------

const EISENFELD = `Die Stadt Eisenfeld liegt am alten Hafen und wird vom Rat der Sieben kontrolliert. Ratsherr Aldric vertraut der Abenteurergruppe. Aldric misstraut jedoch dem Kult des Schwarzen Flusses. Aldric hasst seinen Bruder Tavin, weil dieser ihn einst verraten hat. Tavin ist der Bruder von Aldric und arbeitet für die Diebesgilde der Schatten. Die Magierin Lyra liebt den Hauptmann Erran. Lyra schuldet der Akademie der Sterne eine alte Schuld. Die Akademie sucht den Splitter der Ewigkeit, ein Artefakt, das in der Ruine von Veyra verborgen liegt. Hauptmann Erran beschützt die Stadt Eisenfeld. Der Kult jagt die Magierin Lyra. Aldric verschweigt der Gruppe, dass sein Sohn Iven im Tempel der Stille gefangen ist. Iven gehört zu dem Orden vom Silbernen Auge.`;

describe('MockAnalyzer — Eisenfeld sample (extended patterns)', () => {
  it('extracts a large number of entities, relationships and prompts', async () => {
    const raw = await new MockAnalyzer().analyze({ text: EISENFELD });
    const result = normalizeAnalyzerResult(raw);
    expect(result.entities.length).toBeGreaterThanOrEqual(15);
    expect(result.relationships.length).toBeGreaterThanOrEqual(10);
    expect(result.generatedPrompts.length).toBeGreaterThanOrEqual(5);
  });

  it('classifies factions via Orden/Kult/Gilde/Rat/Akademie', async () => {
    const raw = await new MockAnalyzer().analyze({ text: EISENFELD });
    const result = normalizeAnalyzerResult(raw);
    const factions = result.entities.filter((e) => e.type === 'faction').map((e) => e.name.toLowerCase());

    expect(factions.some((n) => n.includes('rat der sieben'))).toBe(true);
    expect(factions.some((n) => n.includes('kult des schwarzen flusses'))).toBe(true);
    expect(factions.some((n) => n.includes('diebesgilde der schatten'))).toBe(true);
    expect(factions.some((n) => n.includes('akademie der sterne'))).toBe(true);
    expect(factions.some((n) => n.includes('orden vom silbernen auge'))).toBe(true);
  });

  it('does NOT misclassify "Ratsherr Aldric" as a faction (rat as substring)', async () => {
    const raw = await new MockAnalyzer().analyze({ text: EISENFELD });
    const result = normalizeAnalyzerResult(raw);
    const ratsherr = result.entities.find((e) => e.name.toLowerCase() === 'ratsherr aldric');
    expect(ratsherr).toBeDefined();
    expect(ratsherr?.type).toBe('npc');
  });

  it('classifies locations via Stadt/Hafen/Ruine/Tempel', async () => {
    const raw = await new MockAnalyzer().analyze({ text: EISENFELD });
    const result = normalizeAnalyzerResult(raw);
    const locations = result.entities.filter((e) => e.type === 'location').map((e) => e.name.toLowerCase());

    expect(locations.some((n) => n.includes('stadt eisenfeld'))).toBe(true);
    expect(locations.some((n) => n === 'hafen' || n.endsWith('hafen'))).toBe(true);
    expect(locations.some((n) => n.includes('ruine von veyra'))).toBe(true);
    expect(locations.some((n) => n.includes('tempel der stille'))).toBe(true);
  });

  it('classifies items via Splitter/Artefakt', async () => {
    const raw = await new MockAnalyzer().analyze({ text: EISENFELD });
    const result = normalizeAnalyzerResult(raw);
    const items = result.entities.filter((e) => e.type === 'item').map((e) => e.name.toLowerCase());
    expect(items.some((n) => n.includes('splitter der ewigkeit'))).toBe(true);
    expect(items.some((n) => n === 'artefakt')).toBe(true);
  });

  it('produces every requested relationship type', async () => {
    const raw = await new MockAnalyzer().analyze({ text: EISENFELD });
    const result = normalizeAnalyzerResult(raw);
    const types = new Set(result.relationships.map((r) => r.type));

    // Each pattern the user listed should surface at least once.
    expect(types.has('allied_with')).toBe(true);   // vertraut
    expect(types.has('hates')).toBe(true);         // misstraut + hasst
    expect(types.has('loves')).toBe(true);         // liebt
    expect(types.has('owes')).toBe(true);          // schuldet
    expect(types.has('works_for')).toBe(true);     // arbeitet für + gehört zu
    expect(types.has('controls')).toBe(true);      // kontrolliert
    expect(types.has('hunts')).toBe(true);         // sucht + jagt
    expect(types.has('protects')).toBe(true);      // beschützt
    expect(types.has('betrayed_by')).toBe(true);   // verraten
    expect(types.has('knows_secret_of')).toBe(true); // verschweigt
    expect(types.has('related_to')).toBe(true);    // Bruder von
  });

  it('resolves "Tavin arbeitet für die Diebesgilde" correctly via objectPreposition', async () => {
    const raw = await new MockAnalyzer().analyze({ text: EISENFELD });
    const result = normalizeAnalyzerResult(raw);
    const link = result.relationships.find(
      (r) =>
        r.type === 'works_for' &&
        r.sourceName.toLowerCase().includes('tavin') &&
        r.targetName.toLowerCase().includes('diebesgilde'),
    );
    expect(link).toBeDefined();
  });

  it('resolves "Iven gehört zu dem Orden" via gehört+zu preposition', async () => {
    const raw = await new MockAnalyzer().analyze({ text: EISENFELD });
    const result = normalizeAnalyzerResult(raw);
    const link = result.relationships.find(
      (r) =>
        r.type === 'works_for' &&
        r.sourceName.toLowerCase().includes('iven') &&
        r.targetName.toLowerCase().includes('orden'),
    );
    expect(link).toBeDefined();
  });

  it('captures the family relationship "Tavin ist der Bruder von Aldric"', async () => {
    const raw = await new MockAnalyzer().analyze({ text: EISENFELD });
    const result = normalizeAnalyzerResult(raw);
    const familyLink = result.relationships.find(
      (r) =>
        r.type === 'related_to' &&
        r.sourceName.toLowerCase().includes('tavin') &&
        r.targetName.toLowerCase() === 'aldric',
    );
    expect(familyLink).toBeDefined();
    expect(familyLink?.description?.toLowerCase()).toContain('bruder');
  });

  it('marks the "verschweigt"-relationship as secret', async () => {
    const raw = await new MockAnalyzer().analyze({ text: EISENFELD });
    const result = normalizeAnalyzerResult(raw);
    const secretLink = result.relationships.find((r) => r.type === 'knows_secret_of');
    expect(secretLink).toBeDefined();
    expect(secretLink?.visibility).toBe('gm_only');
    expect(secretLink?.status).toBe('secret');
  });

  it('attaches a short description to apposition-based entities (Splitter, Artefakt)', async () => {
    const raw = await new MockAnalyzer().analyze({ text: EISENFELD });
    const result = normalizeAnalyzerResult(raw);
    const splitter = result.entities.find((e) => e.name.toLowerCase().includes('splitter der ewigkeit'));
    expect(splitter?.description?.toLowerCase()).toContain('artefakt');
  });

  it('mistraut & vertraut produce DIFFERENT relationship endpoints', async () => {
    const raw = await new MockAnalyzer().analyze({ text: EISENFELD });
    const result = normalizeAnalyzerResult(raw);
    const trustHates = result.relationships.filter((r) =>
      r.sourceName.toLowerCase().startsWith('aldric') || r.sourceName.toLowerCase().includes('ratsherr aldric'),
    );
    // vertraut → Abenteurergruppe (allied_with)
    expect(trustHates.some((r) => r.type === 'allied_with' && r.targetName.toLowerCase().includes('abenteurergruppe'))).toBe(true);
    // misstraut → Kult (hates with intensity 2)
    expect(trustHates.some((r) => r.type === 'hates' && r.targetName.toLowerCase().includes('kult'))).toBe(true);
  });
});
