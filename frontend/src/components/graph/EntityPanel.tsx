import { useEffect, useState } from 'react';
import { ImageIcon, Loader2, Sparkles, Trash2, X } from 'lucide-react';
import { api, API_BASE } from '@/lib/api';
import type { Entity, EntityType, Importance, EntityStatus, Visibility } from '@/types/loregraph';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { ENTITY_LABEL } from '@/lib/entityStyles';

const TYPES: EntityType[] = [
  'player_character', 'npc', 'faction', 'location', 'item', 'secret', 'event', 'unknown',
];
const STATUSES: EntityStatus[] = ['active', 'dead', 'missing', 'destroyed', 'unknown'];
const IMPORTANCES: Importance[] = ['low', 'medium', 'high', 'critical'];
const VISIBILITIES: Visibility[] = ['public', 'gm_only'];

// Must mirror the backend's supported types (see services/imageGenerator.ts).
const IMAGE_TYPES: EntityType[] = ['player_character', 'npc', 'faction', 'location', 'item'];

export function EntityPanel({
  entity,
  onClose,
  onChanged,
  onDeleted,
}: {
  entity: Entity;
  onClose: () => void;
  onChanged: (e: Entity) => void;
  onDeleted: (id: string) => void;
}) {
  const [draft, setDraft] = useState<Entity>(entity);
  const [busy, setBusy] = useState(false);
  const [imgBusy, setImgBusy] = useState(false);
  const [imgError, setImgError] = useState<string | null>(null);

  useEffect(() => {
    setDraft(entity);
    setImgError(null);
  }, [entity]);

  function editablePayload(): Partial<Entity> {
    return {
      name: draft.name,
      type: draft.type,
      description: draft.description,
      visibility: draft.visibility,
      status: draft.status,
      importance: draft.importance,
      confidenceScore: draft.confidenceScore,
      imagePrompt: draft.imagePrompt,
      isUncertain: draft.isUncertain,
    };
  }

  async function save() {
    setBusy(true);
    try {
      const updated = await api.updateEntity(entity.id, editablePayload());
      onChanged(updated);
    } finally {
      setBusy(false);
    }
  }

  async function generateImage() {
    setImgError(null);
    setImgBusy(true);
    try {
      // Persist pending edits first (especially the image prompt) so the
      // backend generates from exactly what the user currently sees.
      await api.updateEntity(entity.id, editablePayload());
      const updated = await api.generateEntityImage(entity.id);
      onChanged(updated);
    } catch (e) {
      setImgError((e as Error).message);
    } finally {
      setImgBusy(false);
    }
  }

  async function remove() {
    if (!confirm(`"${entity.name}" wirklich löschen?`)) return;
    setBusy(true);
    try {
      await api.deleteEntity(entity.id);
      onDeleted(entity.id);
    } finally {
      setBusy(false);
    }
  }

  const supportsImage = IMAGE_TYPES.includes(entity.type);

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div>
          <h2 className="font-display text-lg">{entity.name}</h2>
          <Badge variant="secondary" className="mt-1">{ENTITY_LABEL[entity.type]}</Badge>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-4">
        <div className="space-y-2">
          <Label>Name</Label>
          <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Typ</Label>
            <Select value={draft.type} onValueChange={(v) => setDraft({ ...draft, type: v as EntityType })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TYPES.map((t) => (
                  <SelectItem key={t} value={t}>{ENTITY_LABEL[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={draft.status} onValueChange={(v) => setDraft({ ...draft, status: v as EntityStatus })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Wichtigkeit</Label>
            <Select value={draft.importance} onValueChange={(v) => setDraft({ ...draft, importance: v as Importance })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {IMPORTANCES.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Sichtbarkeit</Label>
            <Select value={draft.visibility} onValueChange={(v) => setDraft({ ...draft, visibility: v as Visibility })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {VISIBILITIES.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Confidence: {Math.round(draft.confidenceScore * 100)}%</Label>
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(draft.confidenceScore * 100)}
            onChange={(e) => setDraft({ ...draft, confidenceScore: Number(e.target.value) / 100 })}
            className="w-full"
          />
        </div>

        <div className="space-y-2">
          <Label>Beschreibung</Label>
          <Textarea
            rows={4}
            value={draft.description ?? ''}
            onChange={(e) => setDraft({ ...draft, description: e.target.value })}
          />
        </div>

        <div className="space-y-2">
          <Label>Bild-Prompt (KI)</Label>
          <Textarea
            rows={2}
            placeholder="z. B. fantasy portrait of a stern captain in tarnished silver armor"
            value={draft.imagePrompt ?? ''}
            onChange={(e) => setDraft({ ...draft, imagePrompt: e.target.value || null })}
          />
          <p className="text-[11px] text-muted-foreground">
            Englisch, knapp, für KI-Bildgeneratoren wie Midjourney, SDXL, Flux.
          </p>
        </div>

        <div className="space-y-2">
          <Label>Bild</Label>
          {entity.imageUrl ? (
            <img
              src={`${API_BASE}${entity.imageUrl}`}
              alt={`Generiertes Bild für ${entity.name}`}
              className="w-full rounded-md border border-border object-cover aspect-square bg-muted/30"
            />
          ) : (
            <div className="w-full rounded-md border border-dashed border-border bg-muted/20 aspect-square flex flex-col items-center justify-center text-muted-foreground gap-2">
              <ImageIcon className="h-8 w-8 opacity-40" />
              <span className="text-xs">Noch kein Bild generiert</span>
            </div>
          )}

          {supportsImage ? (
            <Button
              variant="outline"
              className="w-full"
              onClick={generateImage}
              disabled={imgBusy || busy}
            >
              {imgBusy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generiere Bild…
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  {entity.imageUrl ? 'Bild neu generieren' : 'Bild erstellen'}
                </>
              )}
            </Button>
          ) : (
            <p className="text-[11px] text-muted-foreground">
              Für den Typ „{ENTITY_LABEL[entity.type]}" ist keine Bildgenerierung verfügbar.
            </p>
          )}

          {imgError && (
            <p className="text-xs text-destructive">{imgError}</p>
          )}
        </div>

        {entity.sourceExcerpt && (
          <div className="rounded-md border border-border/60 bg-muted/30 p-3 text-xs italic text-muted-foreground">
            Aus Originaltext: „{entity.sourceExcerpt}"
          </div>
        )}
      </div>

      <div className="flex items-center justify-between p-4 border-t border-border">
        <Button variant="destructive" size="sm" onClick={remove} disabled={busy}>
          <Trash2 className="h-4 w-4" />
          Löschen
        </Button>
        <Button onClick={save} disabled={busy}>
          {busy ? 'Speichere…' : 'Speichern'}
        </Button>
      </div>
    </div>
  );
}
