import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  Bot,
  Brain,
  CheckCircle2,
  HelpCircle,
  Image as ImageIcon,
  Info,
  Loader2,
  Sparkles,
  Wand2,
} from 'lucide-react';
import { api } from '@/lib/api';
import type { AnalyzeResponse, AnalyzerStatus, SourceType } from '@/types/loregraph';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ENTITY_LABEL, RELATIONSHIP_LABEL } from '@/lib/entityStyles';

const SOURCE_OPTIONS: { value: SourceType; label: string }[] = [
  { value: 'lore', label: 'Lore' },
  { value: 'session_notes', label: 'Session Notes' },
  { value: 'adventure', label: 'Abenteuer' },
  { value: 'character_backstory', label: 'Charakter-Hintergrund' },
  { value: 'other', label: 'Sonstiges' },
];

const SAMPLE = `Die Stadt Graufurt wird vom Orden der Silbernen Maske kontrolliert. Hauptmann Elric vertraut der Abenteurergruppe, verschweigt ihnen aber, dass seine Schwester Mara für den Kult der Asche arbeitet. Der Kult sucht den Splitter von Veyra, ein Artefakt, das unter der alten Brücke verborgen liegt. Mara hasst Elric, weil er sie einst verraten hat. Die Diebesgilde von Graufurt schuldet der Gruppe noch einen Gefallen.`;

function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const tone = pct >= 70 ? 'bg-primary' : pct >= 40 ? 'bg-primary/60' : 'bg-muted-foreground/40';
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 rounded-full bg-muted overflow-hidden">
        <div className={`h-full ${tone}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[11px] tabular-nums text-muted-foreground">{pct}%</span>
    </div>
  );
}

export default function AnalyzePage() {
  const { id } = useParams();
  const [text, setText] = useState('');
  const [sourceType, setSourceType] = useState<SourceType>('session_notes');
  const [mode, setMode] = useState<'mock' | 'llm'>('mock');
  const [status, setStatus] = useState<AnalyzerStatus | null>(null);
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const s = await api.analyzerStatus();
        setStatus(s);
        // Default the dropdown to whatever the server thinks is best.
        setMode(s.llmConfigured ? s.defaultMode : 'mock');
      } catch (e) {
        // Status is optional — fall back to mock silently.
        setStatus({ defaultMode: 'mock', llmConfigured: false, llmConfigError: (e as Error).message });
      }
    })();
  }, []);

  async function handleAnalyze() {
    if (!id || !text.trim()) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const response = await api.analyze(id, {
        text,
        sourceType,
        mode,
        preview: false,
        storeSourceText: true,
        // We surface the misconfiguration explicitly via the UI, so don't
        // silently fall back if the user picked LLM.
        allowFallback: false,
      });
      setResult(response);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const llmAvailable = status?.llmConfigured ?? false;

  return (
    <div className="container py-8 max-w-5xl">
      <div className="mb-6">
        <h1 className="font-display text-2xl tracking-wide">Kampagnentext analysieren</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Füge Lore, Session Notes oder Abenteuerbeschreibungen ein. Die Analyse extrahiert
          Entitäten, Beziehungen, Geheimnisse, offene Fragen und Bild-Prompts.
        </p>
      </div>

      {status && (
        <div className="mb-4 text-xs text-muted-foreground flex items-center gap-2">
          <Info className="h-3.5 w-3.5" />
          <span>
            {llmAvailable
              ? `LLM aktiv: ${status.llmModel} @ ${status.llmBaseUrl}`
              : 'LLM nicht konfiguriert — setze LLM_BASE_URL / LLM_MODEL / LLM_API_KEY in der .env.'}
            {' · Default: '}
            <strong>{status.defaultMode}</strong>
          </span>
        </div>
      )}

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Kampagnentext einfügen</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Texttyp</Label>
              <Select value={sourceType} onValueChange={(v) => setSourceType(v as SourceType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SOURCE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Analysemodus</Label>
              <Select value={mode} onValueChange={(v) => setMode(v as 'mock' | 'llm')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mock">
                    <span className="flex items-center gap-2">
                      <Wand2 className="h-3.5 w-3.5" />
                      Mock (regelbasiert, offline)
                    </span>
                  </SelectItem>
                  <SelectItem value="llm" disabled={!llmAvailable}>
                    <span className="flex items-center gap-2">
                      <Brain className="h-3.5 w-3.5" />
                      LLM (semantisch){!llmAvailable && ' — nicht konfiguriert'}
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
              {!llmAvailable && status?.llmConfigError && (
                <p className="text-xs text-muted-foreground">{status.llmConfigError}</p>
              )}
            </div>
            <div className="space-y-2 flex flex-col">
              <Label>&nbsp;</Label>
              <Button
                variant="outline"
                onClick={() => setText(SAMPLE)}
                disabled={busy}
                title="Beispieltext einfügen"
              >
                <Sparkles className="h-4 w-4" />
                Beispieltext
              </Button>
            </div>
          </div>

          <Textarea
            placeholder="Füge deinen Kampagnentext ein, um deine Beziehungskarte zu erstellen."
            rows={12}
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={busy}
          />

          {error && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <div>
                <strong className="font-medium">Analyse fehlgeschlagen.</strong>
                <div className="opacity-90">{error}</div>
              </div>
            </div>
          )}

          <div className="flex justify-end">
            <Button onClick={handleAnalyze} disabled={busy || !text.trim()} size="lg">
              {busy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {mode === 'llm' ? 'Analysiere mit LLM…' : 'Analysiere…'}
                </>
              ) : (
                <>
                  {mode === 'llm' ? <Brain className="h-4 w-4" /> : <Wand2 className="h-4 w-4" />}
                  Beziehungskarte erstellen
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {result && <AnalyzeResultView result={result} campaignId={id!} />}
    </div>
  );
}

function AnalyzeResultView({
  result,
  campaignId,
}: {
  result: AnalyzeResponse;
  campaignId: string;
}) {
  const { analyzed, persisted, analyzerMode, fellBackFromLLM } = result;
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              Analyse abgeschlossen
              <Badge variant={analyzerMode === 'llm' ? 'default' : 'muted'} className="ml-1">
                {analyzerMode === 'llm' ? <Brain className="h-3 w-3 mr-1" /> : <Bot className="h-3 w-3 mr-1" />}
                {analyzerMode.toUpperCase()}
              </Badge>
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              {analyzed.entities.length} Entität(en), {analyzed.relationships.length} Beziehung(en),{' '}
              {analyzed.generatedPrompts.length} Spielimpuls(e), {analyzed.openQuestions.length} offene
              Frage(n).
              {persisted && (
                <>
                  {' '}
                  In der Kampagne stehen jetzt {persisted.entityCount} Entitäten /{' '}
                  {persisted.relationshipCount} Beziehungen.
                </>
              )}
            </p>
            {fellBackFromLLM && (
              <p className="text-xs text-amber-500 mt-1 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                Fallback auf Mock-Analyzer: {fellBackFromLLM.reason}
              </p>
            )}
          </div>
          <Button asChild>
            <Link to={`/campaigns/${campaignId}/graph`}>
              Zur Graph-Ansicht
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <section>
          <h3 className="text-sm font-semibold mb-2">
            Entitäten ({analyzed.entities.length})
          </h3>
          {analyzed.entities.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nichts erkannt.</p>
          ) : (
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {analyzed.entities.map((e, i) => (
                <li
                  key={i}
                  className="rounded-md border border-border/60 bg-card/50 p-3 text-sm"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium truncate">{e.name}</span>
                    <Badge variant="secondary">{ENTITY_LABEL[e.type]}</Badge>
                  </div>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <ConfidenceBar value={e.confidenceScore} />
                    {e.visibility === 'gm_only' && (
                      <Badge variant="muted" className="text-[10px]">GM-only</Badge>
                    )}
                    {e.isUncertain && (
                      <Badge variant="destructive" className="text-[10px]">unsicher</Badge>
                    )}
                  </div>
                  {e.description && (
                    <p className="mt-1.5 text-xs text-foreground/90">{e.description}</p>
                  )}
                  {e.sourceExcerpt && (
                    <p
                      className="mt-1.5 text-xs italic text-muted-foreground line-clamp-2"
                      title={e.sourceExcerpt}
                    >
                      „{e.sourceExcerpt}"
                    </p>
                  )}
                  {e.imagePrompt && (
                    <p className="mt-1.5 text-xs text-muted-foreground flex items-start gap-1">
                      <ImageIcon className="h-3 w-3 mt-0.5 shrink-0" />
                      <span className="italic">{e.imagePrompt}</span>
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h3 className="text-sm font-semibold mb-2">
            Beziehungen ({analyzed.relationships.length})
          </h3>
          {analyzed.relationships.length === 0 ? (
            <p className="text-sm text-muted-foreground">Keine Beziehung erkannt.</p>
          ) : (
            <ul className="space-y-2">
              {analyzed.relationships.map((r, i) => (
                <li
                  key={i}
                  className="rounded-md border border-border/60 bg-card/50 p-3 text-sm"
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">{r.sourceName}</span>
                    <Badge variant="default">{RELATIONSHIP_LABEL[r.type]}</Badge>
                    <span className="font-medium">{r.targetName}</span>
                    {r.visibility === 'gm_only' && (
                      <Badge variant="muted" className="text-[10px]">GM-only</Badge>
                    )}
                    {r.isUncertain && (
                      <Badge variant="destructive" className="text-[10px]">unsicher</Badge>
                    )}
                    <div className="ml-auto">
                      <ConfidenceBar value={r.confidenceScore} />
                    </div>
                  </div>
                  {r.description && (
                    <p className="mt-1 text-xs text-foreground/90">{r.description}</p>
                  )}
                  {r.sourceExcerpt && (
                    <p className="mt-1 text-xs italic text-muted-foreground line-clamp-2">
                      „{r.sourceExcerpt}"
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h3 className="text-sm font-semibold mb-2">
            Spielimpulse ({analyzed.generatedPrompts.length})
          </h3>
          {analyzed.generatedPrompts.length === 0 ? (
            <p className="text-sm text-muted-foreground">Keine Impulse erzeugt.</p>
          ) : (
            <ul className="space-y-2">
              {analyzed.generatedPrompts.map((p, i) => (
                <li
                  key={i}
                  className="rounded-md border border-border/60 bg-card/50 p-3 text-sm"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{p.title}</span>
                    <Badge variant="muted">{p.type}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{p.description}</p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
            <HelpCircle className="h-4 w-4 text-primary" />
            Offene Fragen ({analyzed.openQuestions.length})
          </h3>
          {analyzed.openQuestions.length === 0 ? (
            <p className="text-sm text-muted-foreground">Keine offenen Fragen.</p>
          ) : (
            <ul className="space-y-1.5">
              {analyzed.openQuestions.map((q, i) => (
                <li
                  key={i}
                  className="rounded-md border border-border/60 bg-card/50 p-3 text-sm"
                >
                  <p>{q.question}</p>
                  {q.relatedEntityNames && q.relatedEntityNames.length > 0 && (
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      bezogen auf: {q.relatedEntityNames.join(', ')}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="flex justify-end pt-2">
          <Button asChild size="lg">
            <Link to={`/campaigns/${campaignId}/graph`}>
              Zur Graph-Ansicht
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
