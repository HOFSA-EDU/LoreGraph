import { useEffect, useState } from 'react';
import { Trash2, X } from 'lucide-react';
import { api } from '@/lib/api';
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

  useEffect(() => setDraft(entity), [entity]);

  async function save() {
    setBusy(true);
    try {
      const updated = await api.updateEntity(entity.id, {
        name: draft.name,
        type: draft.type,
        description: draft.description,
        visibility: draft.visibility,
        status: draft.status,
        importance: draft.importance,
        confidenceScore: draft.confidenceScore,
        imagePrompt: draft.imagePrompt,
        isUncertain: draft.isUncertain,
      });
      onChanged(updated);
    } finally {
      setBusy(false);
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
