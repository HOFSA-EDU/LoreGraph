import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Sparkles, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import type { Campaign } from '@/types/loregraph';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function Dashboard() {
  const [campaigns, setCampaigns] = useState<Campaign[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  async function reload() {
    try {
      const items = await api.listCampaigns();
      setCampaigns(items);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  useEffect(() => {
    reload();
  }, []);

  async function handleDelete(id: string) {
    if (!confirm('Diese Kampagne wirklich löschen?')) return;
    await api.deleteCampaign(id);
    await reload();
  }

  return (
    <div className="container py-10">
      <div className="flex items-end justify-between gap-4 mb-8">
        <div>
          <h1 className="font-display text-3xl tracking-wide">Deine Kampagnen</h1>
          <p className="text-muted-foreground mt-1">
            Füge Kampagnentext ein und LoreGraph baut dir eine Beziehungskarte.
          </p>
        </div>
        <Button onClick={() => navigate('/campaigns/new')}>
          <Plus className="h-4 w-4" />
          Neue Kampagne
        </Button>
      </div>

      {error && (
        <div className="mb-6 rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {campaigns === null && (
        <div className="text-muted-foreground">Lade…</div>
      )}

      {campaigns && campaigns.length === 0 && (
        <Card className="text-center">
          <CardContent className="py-16">
            <Sparkles className="mx-auto mb-4 h-10 w-10 text-primary/70" />
            <p className="text-lg font-medium mb-2">Noch keine Kampagne vorhanden.</p>
            <p className="text-muted-foreground mb-6">
              Füge deinen Kampagnentext ein, um deine Beziehungskarte zu erstellen.
            </p>
            <Button onClick={() => navigate('/campaigns/new')}>
              <Plus className="h-4 w-4" />
              Erste Kampagne anlegen
            </Button>
          </CardContent>
        </Card>
      )}

      {campaigns && campaigns.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {campaigns.map((c) => (
            <Card key={c.id} className="group flex flex-col">
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="font-display text-xl">{c.name}</CardTitle>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => handleDelete(c.id)}
                    title="Löschen"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <CardDescription className="line-clamp-2 min-h-[2.5rem]">
                  {c.description || 'Keine Beschreibung'}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-1 space-y-3">
                <div className="flex flex-wrap gap-2 text-xs">
                  {c.system && <Badge variant="secondary">{c.system}</Badge>}
                  {c.tone && <Badge variant="muted">{c.tone}</Badge>}
                </div>
                <div className="flex gap-3 text-xs text-muted-foreground">
                  <span>{c._count?.entities ?? 0} Entitäten</span>
                  <span>{c._count?.relationships ?? 0} Beziehungen</span>
                  <span>{c._count?.sourceTexts ?? 0} Texte</span>
                </div>
                <div className="flex flex-wrap gap-2 pt-2">
                  <Button asChild size="sm" variant="default">
                    <Link to={`/campaigns/${c.id}/graph`}>Graph</Link>
                  </Button>
                  <Button asChild size="sm" variant="outline">
                    <Link to={`/campaigns/${c.id}/analyze`}>Analyse</Link>
                  </Button>
                  <Button asChild size="sm" variant="ghost">
                    <Link to={`/campaigns/${c.id}/session-prep`}>Session Prep</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
