import { useEffect, useState } from 'react';
import { Trash2, X } from 'lucide-react';
import { api } from '@/lib/api';
import type {
  Entity,
  Relationship,
  RelationshipStatus,
  RelationshipType,
  Visibility,
} from '@/types/loregraph';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RELATIONSHIP_LABEL } from '@/lib/entityStyles';

const TYPES: RelationshipType[] = [
  'allied_with', 'hates', 'loves', 'owes', 'manipulates', 'protects', 'hunts',
  'works_for', 'betrayed_by', 'related_to', 'controls', 'knows_secret_of',
  'competes_with', 'located_in', 'owns', 'involved_in', 'unknown_connection',
];
const STATUSES: RelationshipStatus[] = ['stable', 'unstable', 'escalating', 'broken', 'secret'];
const VISIBILITIES: Visibility[] = ['public', 'gm_only'];

export function RelationshipPanel({
  relationship,
  entities,
  onClose,
  onChanged,
  onDeleted,
}: {
  relationship: Relationship;
  entities: Entity[];
  onClose: () => void;
  onChanged: (r: Relationship) => void;
  onDeleted: (id: string) => void;
}) {
  const [draft, setDraft] = useState<Relationship>(relationship);
  const [busy, setBusy] = useState(false);

  useEffect(() => setDraft(relationship), [relationship]);

  const src = entities.find((e) => e.id === draft.sourceEntityId);
  const tgt = entities.find((e) => e.id === draft.targetEntityId);

  async function save() {
    setBusy(true);
    try {
      const updated = await api.updateRelationship(relationship.id, {
        type: draft.type,
        description: draft.description,
        intensity: draft.intensity,
        visibility: draft.visibility,
        status: draft.status,
        confidenceScore: draft.confidenceScore,
      });
      onChanged(updated);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm('Diese Beziehung wirklich löschen?')) return;
    setBusy(true);
    try {
      await api.deleteRelationship(relationship.id);
      onDeleted(relationship.id);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div>
          <div className="font-display text-base">
            {src?.name ?? '?'} <span className="text-muted-foreground">{RELATIONSHIP_LABEL[draft.type]}</span> {tgt?.name ?? '?'}
          </div>
          <p className="text-xs text-muted-foreground mt-1">Beziehung bearbeiten</p>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Typ</Label>
            <Select value={draft.type} onValueChange={(v) => setDraft({ ...draft, type: v as RelationshipType })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TYPES.map((t) => (
                  <SelectItem key={t} value={t}>{RELATIONSHIP_LABEL[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={draft.status} onValueChange={(v) => setDraft({ ...draft, status: v as RelationshipStatus })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUSES.map((s) => (
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
          <div className="space-y-2">
            <Label>Intensität: {draft.intensity}</Label>
            <input
              type="range"
              min={1}
              max={5}
              step={1}
              value={draft.intensity}
              onChange={(e) => setDraft({ ...draft, intensity: Number(e.target.value) })}
              className="w-full"
            />
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

        {relationship.sourceExcerpt && (
          <div className="rounded-md border border-border/60 bg-muted/30 p-3 text-xs italic text-muted-foreground">
            Aus Originaltext: „{relationship.sourceExcerpt}"
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
