import { useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Download, Upload } from 'lucide-react';
import { api, API_BASE } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function ImportExportPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleExport() {
    if (!id) return;
    setBusy(true);
    setError(null);
    try {
      const data = await api.exportCampaign(id);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `loregraph-campaign-${id}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setMessage('Export heruntergeladen.');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleImport(file: File) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const text = await file.text();
      const payload = JSON.parse(text);
      const result = await api.importCampaign(payload);
      setMessage(`Kampagne importiert: ${result.id}`);
      navigate(`/campaigns/${result.id}/graph`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container py-8 max-w-3xl">
      <h1 className="font-display text-2xl tracking-wide mb-6">Import & Export</h1>

      <div className="space-y-4">
        {id && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Download className="h-4 w-4 text-primary" />
                Export
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Lädt diese Kampagne komplett als JSON-Datei herunter.
              </p>
              <div className="flex items-center gap-2">
                <Button onClick={handleExport} disabled={busy}>
                  Herunterladen
                </Button>
                <a
                  className="text-xs text-muted-foreground underline"
                  href={`${API_BASE}/api/campaigns/${id}/export`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Direkt-URL
                </a>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Upload className="h-4 w-4 text-primary" />
              Import
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Importiert eine zuvor exportierte JSON-Datei als neue Kampagne.
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleImport(f);
                e.target.value = '';
              }}
            />
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={busy}
            >
              Datei wählen…
            </Button>
          </CardContent>
        </Card>

        {message && (
          <div className="rounded-md border border-primary/40 bg-primary/10 p-3 text-sm">
            {message}
          </div>
        )}
        {error && (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
