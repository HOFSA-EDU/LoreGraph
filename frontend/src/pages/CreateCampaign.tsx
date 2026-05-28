import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export default function CreateCampaign() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [system, setSystem] = useState('');
  const [tone, setTone] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const created = await api.createCampaign({
        name: name.trim(),
        system: system.trim() || null,
        tone: tone.trim() || null,
        description: description.trim() || null,
      });
      navigate(`/campaigns/${created.id}/analyze`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container max-w-2xl py-10">
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-2xl">Neue Kampagne</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="system">Spielsystem</Label>
                <Input
                  id="system"
                  placeholder="z. B. D&D 5e, Pathfinder, DSA"
                  value={system}
                  onChange={(e) => setSystem(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tone">Tonalität</Label>
                <Input
                  id="tone"
                  placeholder="z. B. düster, heroisch, Mystery"
                  value={tone}
                  onChange={(e) => setTone(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Beschreibung</Label>
              <Textarea
                id="description"
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            {error && (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => navigate('/')}>
                Abbrechen
              </Button>
              <Button type="submit" disabled={busy || !name.trim()}>
                {busy ? 'Erstelle…' : 'Kampagne erstellen'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
