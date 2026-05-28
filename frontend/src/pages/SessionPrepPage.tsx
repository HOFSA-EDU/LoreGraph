import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { AlertTriangle, EyeOff, HandCoins, HelpCircle, ShieldHalf, Sparkles, Swords } from 'lucide-react';
import { api } from '@/lib/api';
import type { SessionPrep } from '@/types/loregraph';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ENTITY_LABEL, RELATIONSHIP_LABEL } from '@/lib/entityStyles';

function RelRow({
  r,
}: {
  r: SessionPrep['criticalConflicts'][number];
}) {
  return (
    <li className="rounded-md border border-border/60 bg-card/40 p-3 text-sm">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-medium">{r.sourceEntity?.name ?? '?'}</span>
        <Badge variant="default">{RELATIONSHIP_LABEL[r.type]}</Badge>
        <span className="font-medium">{r.targetEntity?.name ?? '?'}</span>
        {r.status && <Badge variant="muted">{r.status}</Badge>}
      </div>
      {r.sourceExcerpt && (
        <p className="mt-1 text-xs italic text-muted-foreground">„{r.sourceExcerpt}"</p>
      )}
    </li>
  );
}

export default function SessionPrepPage() {
  const { id } = useParams();
  const [data, setData] = useState<SessionPrep | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        setData(await api.sessionPrep(id));
      } catch (e) {
        setError((e as Error).message);
      }
    })();
  }, [id]);

  if (error) {
    return (
      <div className="container py-10">
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      </div>
    );
  }

  if (!data) {
    return <div className="container py-10 text-muted-foreground">Lade…</div>;
  }

  const empty =
    data.criticalConflicts.length === 0 &&
    data.secretRelationships.length === 0 &&
    data.openDebts.length === 0 &&
    data.unstableAlliances.length === 0 &&
    data.possibleReveals.length === 0 &&
    data.sessionHooks.length === 0 &&
    data.openQuestions.length === 0;

  return (
    <div className="container py-8 max-w-5xl">
      <div className="mb-6">
        <h1 className="font-display text-2xl tracking-wide">Session Prep</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Automatisch aus dem Graphen abgeleitete Spannungspunkte und Impulse.
        </p>
      </div>

      {empty && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Noch keine ableitbaren Spannungspunkte. Analysiere zuerst etwas Text.
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Swords className="h-4 w-4 text-destructive" />
              Kritische Konflikte
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.criticalConflicts.length === 0 ? (
              <p className="text-sm text-muted-foreground">Keine.</p>
            ) : (
              <ul className="space-y-2">
                {data.criticalConflicts.map((r) => <RelRow key={r.id} r={r} />)}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <EyeOff className="h-4 w-4 text-primary" />
              Geheime Beziehungen
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.secretRelationships.length === 0 ? (
              <p className="text-sm text-muted-foreground">Keine.</p>
            ) : (
              <ul className="space-y-2">
                {data.secretRelationships.map((r) => <RelRow key={r.id} r={r} />)}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <HandCoins className="h-4 w-4 text-primary" />
              Offene Schulden
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.openDebts.length === 0 ? (
              <p className="text-sm text-muted-foreground">Keine.</p>
            ) : (
              <ul className="space-y-2">
                {data.openDebts.map((r) => <RelRow key={r.id} r={r} />)}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldHalf className="h-4 w-4 text-primary" />
              Instabile Allianzen
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.unstableAlliances.length === 0 ? (
              <p className="text-sm text-muted-foreground">Keine.</p>
            ) : (
              <ul className="space-y-2">
                {data.unstableAlliances.map((r) => <RelRow key={r.id} r={r} />)}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-primary" />
              Mögliche Reveals
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.possibleReveals.length === 0 ? (
              <p className="text-sm text-muted-foreground">Keine.</p>
            ) : (
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {data.possibleReveals.map((e) => (
                  <li
                    key={e.id}
                    className="rounded-md border border-border/60 bg-card/40 p-3 text-sm"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{e.name}</span>
                      <Badge variant="muted">{ENTITY_LABEL[e.type]}</Badge>
                    </div>
                    {e.description && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {e.description}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <HelpCircle className="h-4 w-4 text-primary" />
              Offene Fragen
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.openQuestions.length === 0 ? (
              <p className="text-sm text-muted-foreground">Keine offenen Fragen.</p>
            ) : (
              <ul className="space-y-1.5">
                {data.openQuestions.map((q) => (
                  <li
                    key={q.id}
                    className="rounded-md border border-border/60 bg-card/40 p-3 text-sm"
                  >
                    {q.question}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-primary" />
              Session-Hooks
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.allPrompts.length === 0 ? (
              <p className="text-sm text-muted-foreground">Noch keine Impulse erzeugt.</p>
            ) : (
              <ul className="space-y-2">
                {data.allPrompts.map((p) => (
                  <li
                    key={p.id}
                    className="rounded-md border border-border/60 bg-card/40 p-3 text-sm"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{p.title}</span>
                      <Badge variant="default">{p.type}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{p.description}</p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
