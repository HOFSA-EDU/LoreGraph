import { Handle, Position, type NodeProps } from '@xyflow/react';
import { cn } from '@/lib/utils';
import type { EntityType, Importance, EntityStatus, Visibility } from '@/types/loregraph';
import { ENTITY_COLOR, ENTITY_LABEL, IMPORTANCE_RING } from '@/lib/entityStyles';
import {
  Castle,
  Crown,
  EyeOff,
  Flag,
  Gem,
  Sparkles,
  User,
  Users,
  HelpCircle,
} from 'lucide-react';

export interface LoreNodeData {
  name: string;
  entityType: EntityType;
  description: string | null;
  visibility: Visibility;
  status: EntityStatus;
  importance: Importance;
  confidenceScore: number;
  sourceExcerpt: string | null;
  [key: string]: unknown;
}

const ICONS: Record<EntityType, typeof User> = {
  player_character: Crown,
  npc: User,
  faction: Users,
  location: Castle,
  item: Gem,
  secret: EyeOff,
  event: Sparkles,
  unknown: HelpCircle,
};

export function LoreNode({ data, selected }: NodeProps) {
  const d = data as LoreNodeData;
  const Icon = ICONS[d.entityType] ?? HelpCircle;
  const color = ENTITY_COLOR[d.entityType];

  const dim = d.confidenceScore < 0.5 ? 'opacity-70' : '';
  const dead = d.status === 'dead' || d.status === 'destroyed';

  return (
    <div
      className={cn(
        'rounded-lg bg-card text-card-foreground shadow-md border border-border/80 px-3 py-2 min-w-[160px] max-w-[220px] transition-shadow',
        IMPORTANCE_RING[d.importance],
        selected && 'shadow-lg ring-2 ring-primary',
        dim,
        dead && 'line-through',
      )}
    >
      <Handle type="target" position={Position.Top} className="!bg-border !w-2 !h-2" />
      <div className="flex items-center gap-2">
        <div
          className="flex h-7 w-7 items-center justify-center rounded-md"
          style={{ backgroundColor: `${color}22`, color }}
        >
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium truncate" title={d.name}>
            {d.name}
          </div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {ENTITY_LABEL[d.entityType]}
            {d.visibility === 'gm_only' && <span className="ml-1 text-primary">• GM</span>}
          </div>
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-border !w-2 !h-2" />
    </div>
  );
}
