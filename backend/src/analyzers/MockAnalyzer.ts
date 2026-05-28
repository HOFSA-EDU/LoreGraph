import {
  AnalyzerEntity,
  AnalyzerEntityType,
  AnalyzerInput,
  AnalyzerOpenQuestion,
  AnalyzerPrompt,
  AnalyzerRelationship,
  AnalyzerRelationshipType,
  AnalyzerResult,
  CampaignTextAnalyzer,
} from './types';

// ---------- vocabularies ----------
//
// Two flavours:
//  - STRICT: matched with full word boundaries on both sides. Used for short
//    keywords like "rat" that would create false positives ("Ratsherr",
//    "Verrat") if matched as a substring.
//  - COMPOUND: matched as a word suffix (`\w*<kw>\b`). Used for keywords that
//    naturally appear in German compounds ("Diebesgilde", "Magiergilde").

const FACTION_KEYWORDS_STRICT = [
  'orden', 'kult', 'haus', 'clan', 'kirche', 'rat', 'akademie', 'kompanie',
  'bande', 'zirkel', 'fraktion', 'bruderschaft', 'schwesternschaft',
  'syndikat',
  'order', 'house', 'cult', 'church', 'council', 'academy', 'company',
  'faction',
];
const FACTION_KEYWORDS_COMPOUND = [
  'gilde', // "Diebesgilde", "Magiergilde"
  'guild',
];

const LOCATION_KEYWORDS_STRICT = [
  'stadt', 'dorf', 'burg', 'tempel', 'taverne', 'wald', 'ruine', 'höhle',
  'turm', 'kapelle', 'brücke', 'festung', 'gebirge', 'fluss', 'see', 'insel',
  'krypta', 'verlies', 'palast', 'schloss', 'hafen', 'mine', 'viertel',
  'stadtteil',
  'city', 'village', 'castle', 'temple', 'tavern', 'forest', 'ruin', 'tower',
  'bridge', 'port', 'harbor', 'mine',
];
const LOCATION_KEYWORDS_COMPOUND: string[] = [];

const ITEM_KEYWORDS_STRICT = [
  'artefakt', 'schwert', 'splitter', 'amulett', 'ring', 'krone', 'kelch',
  'relikt', 'buch', 'rolle', 'stab', 'dolch', 'orb', 'schlüssel',
  'artifact', 'sword', 'shard', 'amulet', 'crown', 'relic', 'key',
];
const ITEM_KEYWORDS_COMPOUND: string[] = [];

const SECRET_MARKERS = [
  'geheim', 'niemand weiß', 'niemand weiss', 'verborgen', 'in wahrheit',
  'eigentlich', 'verschweigt', 'verheimlicht', 'secret', 'in truth',
];

const FAMILY_ROLES = [
  'bruder', 'schwester', 'vater', 'mutter', 'sohn', 'tochter', 'kind',
  'onkel', 'tante', 'cousin', 'cousine', 'neffe', 'nichte',
];

const STOPWORDS_DE = new Set([
  'Der', 'Die', 'Das', 'Ein', 'Eine', 'Einen', 'Einem', 'Einer', 'Eines',
  'Und', 'Oder', 'Aber', 'Doch', 'Sie', 'Er', 'Es', 'Ich', 'Wir', 'Ihr',
  'Den', 'Dem', 'Des', 'Im', 'Am', 'Um', 'Zu', 'Zum', 'Zur', 'Auf', 'In',
  'Mit', 'Für', 'Fuer', 'Von', 'Vom', 'Bei', 'Nach', 'Aus', 'Über', 'Unter',
  'Wenn', 'Dann', 'Als', 'Weil', 'Dass', 'Daß', 'Noch', 'Schon', 'Auch',
  'Heute', 'Morgen', 'Gestern', 'Sehr', 'Mehr', 'Hier', 'Dort', 'Diese',
  'Dieser', 'Dieses', 'Jener', 'Jene', 'Jenes',
]);

const SINGLE_TOKEN_BLOCKLIST = new Set([
  'Gefallen', 'Gefahr', 'Wahrheit', 'Welt', 'Tag', 'Nacht', 'Zeit', 'Stunde',
  'Mann', 'Frau', 'Kind', 'Leute', 'Menschen', 'Gott', 'Götter', 'Tod',
  'Leben', 'Krieg', 'Frieden', 'Fall', 'Sache', 'Ding', 'Anfang', 'Ende',
  'Weg', 'Ort', 'Land', 'Teil', 'Seite', 'Schuld',
]);

const TITLE_PREFIXES = [
  'Hauptmann', 'Kapitän', 'Kapitaen', 'König', 'Koenig', 'Königin', 'Koenigin',
  'Prinz', 'Prinzessin', 'Lord', 'Lady', 'Sir', 'Bruder', 'Schwester', 'Vater',
  'Mutter', 'Sohn', 'Tochter', 'Meister', 'Herr', 'Frau', 'General',
  'Captain', 'Brother', 'Sister', 'Ratsherr', 'Magierin', 'Magier',
  'Priester', 'Priesterin', 'Ritter',
];

// ---------- relationship patterns ----------
//
// One pattern can fire at most once per sentence (deduped on the verb regex
// match). Multiple patterns can fire per sentence (e.g. hates + betrayed_by).
//
// `objectPreposition` disambiguates German verb-final clauses: when present,
// the object is the closest candidate AFTER that preposition (so "Mara für
// den Kult arbeitet" still resolves to subject=Mara, object=Kult).
interface RelationPattern {
  type: AnalyzerRelationshipType;
  verbs: RegExp;
  objectPreposition?: string;
  // Short phrase used as `description` on the relationship.
  descriptionVerb?: string;
  defaultIntensity?: number;
  // If true, mark the relationship as secret (visibility=gm_only, status=secret).
  alwaysSecret?: boolean;
}

const RELATION_PATTERNS: RelationPattern[] = [
  // Trust & mistrust — soft signals, low intensity.
  { type: 'allied_with', verbs: /\bvertraut\b|\btrusts\b/i, descriptionVerb: 'vertraut', defaultIntensity: 2 },
  { type: 'hates', verbs: /\bmisstraut\b|\bdistrusts\b/i, descriptionVerb: 'misstraut', defaultIntensity: 2 },

  // Strong emotions.
  { type: 'hates', verbs: /\bhasst\b|\bverabscheut\b|\bhates\b/i, descriptionVerb: 'hasst', defaultIntensity: 4 },
  { type: 'loves', verbs: /\bliebt\b|\bverliebt\b|\bloves\b/i, descriptionVerb: 'liebt', defaultIntensity: 4 },

  // Debts.
  { type: 'owes', verbs: /\bschuldet\b|\bschulden\b|\bowes\b/i, descriptionVerb: 'schuldet', defaultIntensity: 3 },

  // Hunting & seeking.
  { type: 'hunts', verbs: /\bjagt\b|\bverfolgt\b|\bhunts\b/i, descriptionVerb: 'jagt', defaultIntensity: 4 },
  { type: 'hunts', verbs: /\bsucht\b|\bseeks\b/i, descriptionVerb: 'sucht', defaultIntensity: 2 },

  // Protection.
  { type: 'protects', verbs: /\bbeschützt\b|\bbeschuetzt\b|\bprotects\b/i, descriptionVerb: 'beschützt', defaultIntensity: 3 },

  // Allegiance — verb-final friendly via `objectPreposition`.
  { type: 'works_for', verbs: /\barbeitet\b|\bworks for\b/i, objectPreposition: 'für', descriptionVerb: 'arbeitet für', defaultIntensity: 3 },
  { type: 'works_for', verbs: /\bdient\b|\bserves\b/i, descriptionVerb: 'dient', defaultIntensity: 3 },
  { type: 'works_for', verbs: /\bgehört\b|\bgehoert\b|\bbelongs\b/i, objectPreposition: 'zu', descriptionVerb: 'gehört zu', defaultIntensity: 3 },

  // Betrayal.
  { type: 'betrayed_by', verbs: /\bverrät\b|\bverraet\b|\bverraten\b|\bbetrayed\b/i, descriptionVerb: 'verrät', defaultIntensity: 5 },

  // Manipulation.
  { type: 'manipulates', verbs: /\bmanipuliert\b|\bbenutzt\b|\bmanipulates\b/i, descriptionVerb: 'manipuliert', defaultIntensity: 4 },

  // Control.
  { type: 'controls', verbs: /\bkontrolliert\b|\bbeherrscht\b|\bregiert\b|\bcontrols\b|\brules\b/i, descriptionVerb: 'kontrolliert', defaultIntensity: 4 },

  // Alliance / rivalry.
  { type: 'allied_with', verbs: /\bverbündet\b|\bverbuendet\b|\bbündnis\b|\ballied\b/i, descriptionVerb: 'verbündet', defaultIntensity: 3 },
  { type: 'competes_with', verbs: /\brivalisiert\b|\bkonkurriert\b|\bcompetes\b/i, descriptionVerb: 'rivalisiert', defaultIntensity: 3 },

  // Secret-keeping. "Verschweigt" both creates a knows_secret_of edge and
  // marks the whole sentence as gm-only/secret.
  { type: 'knows_secret_of', verbs: /\bverschweigt\b|\bverheimlicht\b/i, descriptionVerb: 'verschweigt etwas vor', defaultIntensity: 4, alwaysSecret: true },
  { type: 'knows_secret_of', verbs: /\bkennt das geheimnis\b|\bknows the secret\b/i, descriptionVerb: 'kennt das Geheimnis von', defaultIntensity: 3 },

  // Ownership.
  { type: 'owns', verbs: /\bbesitzt\b|\bowns\b/i, descriptionVerb: 'besitzt', defaultIntensity: 2 },

  // Generic kinship verb. The dedicated family pattern (X ist <role> von Y)
  // produces richer descriptions; this catches "X ist verwandt mit Y".
  { type: 'related_to', verbs: /\bverwandt\b|\brelated\b/i, objectPreposition: 'mit', descriptionVerb: 'verwandt mit', defaultIntensity: 2 },
];

// ---------- public class ----------

export class MockAnalyzer implements CampaignTextAnalyzer {
  readonly mode = 'mock' as const;

  async analyze(input: AnalyzerInput): Promise<AnalyzerResult> {
    const text = input.text.trim();
    if (!text) {
      return { entities: [], relationships: [], generatedPrompts: [], openQuestions: [] };
    }

    const sentences = splitSentences(text);

    const entityMap = new Map<string, AnalyzerEntity>();
    const relationships: AnalyzerRelationship[] = [];
    const relKey = new Set<string>();

    function upsertEntity(name: string, sentence: string, opts: { forceType?: AnalyzerEntityType; secret?: boolean } = {}) {
      const trimmed = name.trim();
      if (!trimmed) return;
      const lower = trimmed.toLowerCase();
      const type = opts.forceType ?? classifyEntity(trimmed);
      const desc = extractDescription(trimmed, sentence);
      const existing = entityMap.get(lower);

      if (existing) {
        existing.confidenceScore = Math.max(existing.confidenceScore, 0.55);
        if (existing.type === 'unknown' && type !== 'unknown') existing.type = type;
        if (!existing.sourceExcerpt) existing.sourceExcerpt = sentence;
        if (!existing.description && desc) existing.description = desc;
        // Don't downgrade a public entity to gm_only just because it shows up
        // in a secret-marked sentence — only the *information* in that
        // sentence is secret, not the entity itself.
      } else {
        entityMap.set(lower, {
          name: trimmed,
          type,
          confidenceScore: baseConfidenceFor(type),
          visibility: opts.secret && type === 'secret' ? 'gm_only' : 'public',
          status: 'active',
          importance: importanceFor(type),
          sourceExcerpt: sentence,
          description: desc,
        });
      }
    }

    function addRelationship(rel: AnalyzerRelationship) {
      const key = `${rel.sourceName.toLowerCase()}|${rel.targetName.toLowerCase()}|${rel.type}`;
      if (relKey.has(key)) return;
      relKey.add(key);
      relationships.push(rel);
    }

    for (const sentence of sentences) {
      const isSecret = SECRET_MARKERS.some((m) => sentence.toLowerCase().includes(m));

      const candidates = extractCapitalizedPhrases(sentence);
      for (const cand of candidates) upsertEntity(cand, sentence, { secret: isSecret });

      const secretEntity = synthesizeSecretEntity(sentence);
      if (secretEntity) upsertEntity(secretEntity, sentence, { forceType: 'secret', secret: true });

      // Family relations first — they pull a separate target out of the
      // sentence ("Bruder von Aldric") that the generic candidate extractor
      // would have swallowed.
      for (const rel of extractFamilyRelations(sentence, candidates, isSecret)) {
        upsertEntity(rel.targetName, sentence);
        addRelationship(rel);
      }

      for (const rel of extractRelationshipsForSentence(sentence, candidates, isSecret)) {
        addRelationship(rel);
      }
    }

    // Ensure every relationship endpoint has a corresponding entity, even if
    // it didn't pop up via the capitalized-phrase extractor (e.g. family
    // targets, or names mentioned only after "für").
    for (const rel of relationships) {
      for (const name of [rel.sourceName, rel.targetName]) {
        if (!entityMap.has(name.toLowerCase())) {
          entityMap.set(name.toLowerCase(), {
            name,
            type: classifyEntity(name),
            confidenceScore: 0.4,
            visibility: 'public',
            status: 'active',
            importance: 'medium',
            sourceExcerpt: rel.sourceExcerpt,
          });
        }
      }
    }

    const entities = Array.from(entityMap.values());
    const generatedPrompts = buildPrompts(entities, relationships);
    const openQuestions = buildOpenQuestions(entities, relationships);

    return { entities, relationships, generatedPrompts, openQuestions };
  }
}

// ---------- sentence / candidate helpers ----------

function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function extractCapitalizedPhrases(sentence: string): string[] {
  // Sequences like "Orden der Silbernen Maske", "Hauptmann Elric", "Splitter
  // von Veyra". Allow lowercase connectors and articles between capitalized
  // tokens.
  const re =
    /([A-ZÄÖÜ][a-zäöüß]+(?:\s+(?:der|die|das|den|dem|des|von|vom|zu|zur|zum|de|of|the|aus|im|am)\s+[A-ZÄÖÜ][a-zäöüß]+|\s+[A-ZÄÖÜ][a-zäöüß]+)*)/g;
  const found = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(sentence)) !== null) {
    const phrase = m[1].trim();
    const tokens = phrase.split(/\s+/);
    while (tokens.length > 1 && STOPWORDS_DE.has(tokens[0])) tokens.shift();
    const cleaned = tokens.join(' ');
    if (!cleaned) continue;
    if (tokens.length === 1 && STOPWORDS_DE.has(tokens[0])) continue;
    if (tokens.length === 1 && SINGLE_TOKEN_BLOCKLIST.has(tokens[0])) continue;
    if (cleaned.length < 3) continue;
    found.add(cleaned);
  }
  return Array.from(found);
}

function classifyEntity(name: string): AnalyzerEntityType {
  const lower = name.toLowerCase();

  if (
    hasKeywordStrict(lower, FACTION_KEYWORDS_STRICT) ||
    hasKeywordCompound(lower, FACTION_KEYWORDS_COMPOUND)
  ) return 'faction';

  if (
    hasKeywordStrict(lower, LOCATION_KEYWORDS_STRICT) ||
    hasKeywordCompound(lower, LOCATION_KEYWORDS_COMPOUND)
  ) return 'location';

  if (
    hasKeywordStrict(lower, ITEM_KEYWORDS_STRICT) ||
    hasKeywordCompound(lower, ITEM_KEYWORDS_COMPOUND)
  ) return 'item';

  const firstToken = name.split(/\s+/)[0];
  if (TITLE_PREFIXES.includes(firstToken)) return 'npc';

  if (/^[A-ZÄÖÜ][a-zäöüß]+$/.test(name)) return 'npc';

  return 'unknown';
}

function hasKeywordStrict(lowerText: string, keywords: string[]): boolean {
  for (const k of keywords) {
    if (new RegExp(`\\b${escapeRegex(k)}\\b`, 'i').test(lowerText)) return true;
  }
  return false;
}

function hasKeywordCompound(lowerText: string, keywords: string[]): boolean {
  for (const k of keywords) {
    // Matches the keyword at a word ending — picks up "Diebesgilde" but not
    // "Gildenmeister" (we want trailing position, not leading).
    if (new RegExp(`${escapeRegex(k)}\\b`, 'i').test(lowerText)) return true;
  }
  return false;
}

function baseConfidenceFor(type: AnalyzerEntityType): number {
  switch (type) {
    case 'npc': return 0.6;
    case 'faction':
    case 'location':
    case 'item': return 0.7;
    case 'secret': return 0.5;
    default: return 0.4;
  }
}

function importanceFor(type: AnalyzerEntityType): AnalyzerEntity['importance'] {
  if (type === 'secret') return 'high';
  if (type === 'faction' || type === 'location') return 'high';
  return 'medium';
}

function synthesizeSecretEntity(sentence: string): string | null {
  const lower = sentence.toLowerCase();
  if (!SECRET_MARKERS.some((m) => lower.includes(m))) return null;
  const short = sentence.length > 80 ? sentence.slice(0, 77) + '…' : sentence;
  return `Geheimnis: ${short}`;
}

// ---------- description extraction ----------

function extractDescription(name: string, sentence: string): string | undefined {
  const esc = escapeRegex(name);

  // 1) Apposition: "<name>, ein/eine <X>," or "<name>, <X>,"
  const appo = new RegExp(`\\b${esc}\\b\\s*,\\s*((?:ein|eine|einen|einem|einer|eines|der|die|das|den|dem|des)?\\s*[^,.;!?\\)]{4,120})`, 'i').exec(sentence);
  if (appo) {
    const desc = appo[1].trim();
    if (desc.length >= 4 && desc.length <= 120 && !startsWithLeadingArticleOnly(desc)) {
      return desc;
    }
  }

  // 2) Predicative "<name> ist <X>" — bounded by punctuation.
  const isMatch = new RegExp(`\\b${esc}\\b\\s+ist\\s+([^.,;!?]{4,120})`, 'i').exec(sentence);
  if (isMatch) {
    const desc = isMatch[1].trim();
    if (desc.length >= 4 && desc.length <= 120) return desc;
  }

  // 3) Verb-final German "<name> <X> ist." — capture the predicate.
  const verbFinal = new RegExp(`\\b${esc}\\b\\s+([^.,;!?]{4,120}?)\\s+ist\\b`, 'i').exec(sentence);
  if (verbFinal) {
    const desc = verbFinal[1].trim();
    if (desc.length >= 4 && desc.length <= 120) return desc;
  }

  return undefined;
}

function startsWithLeadingArticleOnly(s: string): boolean {
  // Reject e.g. "der" or "die" with nothing useful after.
  const tokens = s.trim().split(/\s+/);
  return tokens.length === 1 && /^(der|die|das|den|dem|des|ein|eine|einen|einem|einer|eines)$/i.test(tokens[0]);
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ---------- relationship extraction ----------

function extractFamilyRelations(
  sentence: string,
  candidates: string[],
  isSecret: boolean,
): AnalyzerRelationship[] {
  const out: AnalyzerRelationship[] = [];
  // Use explicit capitalization variants so we don't need the `i` flag —
  // with `i`, `[A-ZÄÖÜ]` becomes case-insensitive and the regex would greedily
  // swallow lowercase continuations like "und arbeitet …".
  const rolesAlt = FAMILY_ROLES.map(
    (r) => `${r.charAt(0).toUpperCase()}${r.slice(1)}|${r}`,
  ).join('|');
  const re = new RegExp(
    `\\b(${rolesAlt})\\s+von\\s+(?:der|die|das|den|dem|des)?\\s*([A-ZÄÖÜ][a-zäöüß]+(?:\\s+(?:von|vom|der|die|das|den|dem|des)\\s+[A-ZÄÖÜ][a-zäöüß]+|\\s+[A-ZÄÖÜ][a-zäöüß]+)*)`,
    'g',
  );

  let m: RegExpExecArray | null;
  while ((m = re.exec(sentence)) !== null) {
    const role = m[1].toLowerCase();
    const target = m[2].trim();
    const matchStart = m.index;

    const before = candidates
      .map((c) => ({ c, pos: sentence.indexOf(c) }))
      .filter((x) => x.pos >= 0 && x.pos < matchStart)
      .sort((a, b) => a.pos - b.pos);
    if (before.length === 0) continue;
    const subject = before[0].c;
    if (subject.toLowerCase() === target.toLowerCase()) continue;

    const roleCap = role.charAt(0).toUpperCase() + role.slice(1);
    out.push({
      sourceName: subject,
      targetName: target,
      type: 'related_to',
      description: `${subject} ist ${roleCap} von ${target}`,
      intensity: 3,
      visibility: isSecret ? 'gm_only' : 'public',
      status: isSecret ? 'secret' : 'stable',
      confidenceScore: 0.65,
      sourceExcerpt: sentence,
    });
  }
  return out;
}

function extractRelationshipsForSentence(
  sentence: string,
  candidates: string[],
  isSecret: boolean,
): AnalyzerRelationship[] {
  if (candidates.length === 0) return [];
  const out: AnalyzerRelationship[] = [];
  const posCache = new Map(candidates.map((c) => [c, sentence.indexOf(c)]));

  for (const pat of RELATION_PATTERNS) {
    const m = pat.verbs.exec(sentence);
    if (!m) continue;
    const verbIdx = m.index;
    const verbEnd = m.index + m[0].length;

    let subject: string | undefined;
    let object: string | undefined;

    if (pat.objectPreposition) {
      const prep = new RegExp(`\\b${escapeRegex(pat.objectPreposition)}\\b`, 'i').exec(sentence);
      if (prep) {
        const prepEnd = prep.index + prep[0].length;
        // object: closest candidate after the preposition (works for both
        // "arbeitet für X" and verb-final "für X arbeitet").
        object = candidates
          .map((c) => ({ c, pos: posCache.get(c)! }))
          .filter((x) => x.pos >= prepEnd)
          .sort((a, b) => a.pos - b.pos)[0]?.c;
        // subject: first candidate appearing before the preposition. For
        // German this is more robust than "closest before verb" in clauses
        // with intervening genitive constructions ("Tavin ist der Bruder
        // von Aldric und arbeitet für …").
        subject = candidates
          .map((c) => ({ c, pos: posCache.get(c)! }))
          .filter((x) => x.pos >= 0 && x.pos < prep.index && x.c !== object)
          .sort((a, b) => a.pos - b.pos)[0]?.c;
      }
    }

    if (!subject || !object) {
      const before = candidates
        .map((c) => ({ c, pos: posCache.get(c)! }))
        .filter((x) => x.pos >= 0 && x.pos < verbIdx)
        .sort((a, b) => b.pos - a.pos);
      const after = candidates
        .map((c) => ({ c, pos: posCache.get(c)! }))
        .filter((x) => x.pos >= verbEnd)
        .sort((a, b) => a.pos - b.pos);
      subject = subject ?? before[0]?.c;
      object = object ?? after[0]?.c ?? before[1]?.c;
    }

    if (!subject || !object || subject === object) continue;

    const effectiveSecret = isSecret || !!pat.alwaysSecret;
    out.push({
      sourceName: subject,
      targetName: object,
      type: pat.type,
      description: pat.descriptionVerb
        ? `${subject} ${pat.descriptionVerb} ${object}`
        : sentence,
      intensity: pat.defaultIntensity ?? 3,
      visibility: effectiveSecret ? 'gm_only' : 'public',
      status: effectiveSecret ? 'secret' : 'stable',
      confidenceScore: 0.55,
      sourceExcerpt: sentence,
    });
  }
  return out;
}

// ---------- prompt generation ----------

function buildPrompts(
  entities: AnalyzerEntity[],
  relationships: AnalyzerRelationship[],
): AnalyzerPrompt[] {
  const prompts: AnalyzerPrompt[] = [];

  for (const rel of relationships) {
    if (rel.type === 'hates' || rel.type === 'betrayed_by') {
      prompts.push({
        title: `Konflikt: ${rel.sourceName} ↔ ${rel.targetName}`,
        description: `${rel.description ?? rel.sourceExcerpt} – wie eskaliert das?`,
        type: rel.type === 'betrayed_by' ? 'betrayal' : 'conflict',
        relatedEntityNames: [rel.sourceName, rel.targetName],
      });
    }
    if (rel.type === 'owes') {
      prompts.push({
        title: `Offene Schuld: ${rel.sourceName} → ${rel.targetName}`,
        description: `${rel.sourceName} schuldet ${rel.targetName} etwas. Wird die Schuld eingefordert?`,
        type: 'debt',
        relatedEntityNames: [rel.sourceName, rel.targetName],
      });
    }
    if (rel.visibility === 'gm_only' || rel.status === 'secret') {
      prompts.push({
        title: `Möglicher Reveal: ${rel.sourceName} & ${rel.targetName}`,
        description: 'Diese Beziehung ist geheim. Was passiert, wenn die Gruppe sie aufdeckt?',
        type: 'reveal',
        relatedEntityNames: [rel.sourceName, rel.targetName],
      });
    }
    if (rel.type === 'allied_with') {
      prompts.push({
        title: `Bündnis: ${rel.sourceName} & ${rel.targetName}`,
        description: 'Wie könnte dieses Bündnis unter Druck zerbrechen?',
        type: 'alliance',
        relatedEntityNames: [rel.sourceName, rel.targetName],
      });
    }
    if (rel.type === 'hunts') {
      prompts.push({
        title: `Verfolgung: ${rel.sourceName} → ${rel.targetName}`,
        description: `${rel.sourceName} jagt/sucht ${rel.targetName}. Wann holt die Jagd die Gruppe ein?`,
        type: 'session_hook',
        relatedEntityNames: [rel.sourceName, rel.targetName],
      });
    }
  }

  // One mystery prompt per secret-typed entity (e.g. synthetic "Geheimnis: …").
  for (const ent of entities) {
    if (ent.type === 'secret') {
      prompts.push({
        title: `Mysterium: ${ent.name}`,
        description: ent.sourceExcerpt ?? ent.name,
        type: 'mystery',
        relatedEntityNames: [ent.name],
      });
    }
  }

  // Always offer at least one generic hook tied to a high-confidence entity.
  const focus = [...entities]
    .filter((e) => e.type !== 'secret')
    .sort((a, b) => b.confidenceScore - a.confidenceScore)[0];
  if (focus) {
    prompts.push({
      title: `Session-Hook: ${focus.name}`,
      description: `Bringe ${focus.name} aktiv ins Spiel. Was wollen sie? Was wissen sie?`,
      type: 'session_hook',
      relatedEntityNames: [focus.name],
    });
  }

  // Dedup by title — multiple identical prompts add no value.
  const seen = new Set<string>();
  const deduped: AnalyzerPrompt[] = [];
  for (const p of prompts) {
    if (seen.has(p.title)) continue;
    seen.add(p.title);
    deduped.push(p);
  }

  return deduped.slice(0, 12);
}

function buildOpenQuestions(
  entities: AnalyzerEntity[],
  relationships: AnalyzerRelationship[],
): AnalyzerOpenQuestion[] {
  const out: AnalyzerOpenQuestion[] = [];

  // Unknown-typed entities ↔ "wer/was ist X?"
  for (const e of entities) {
    if (e.type === 'unknown') {
      out.push({
        question: `Wer oder was ist „${e.name}" genau?`,
        relatedEntityNames: [e.name],
      });
    }
  }

  // Low-confidence relationships → user should confirm
  for (const r of relationships) {
    if (r.confidenceScore < 0.5) {
      out.push({
        question: `Stimmt die Beziehung „${r.sourceName} → ${r.targetName}"?`,
        relatedEntityNames: [r.sourceName, r.targetName],
      });
    }
  }

  // Synthetic secret entities → "was ist hier wirklich los?"
  for (const e of entities) {
    if (e.type === 'secret') {
      out.push({
        question: `Welche Auflösung hat dieses Geheimnis — und wer darf es erfahren?`,
        relatedEntityNames: [e.name],
      });
    }
  }

  return out.slice(0, 6);
}
