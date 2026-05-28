import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type EdgeProps,
} from '@xyflow/react';
import type {
  RelationshipStatus,
  RelationshipType,
  Visibility,
} from '@/types/loregraph';
import { RELATIONSHIP_COLOR, RELATIONSHIP_LABEL } from '@/lib/entityStyles';

export interface LoreEdgeData {
  relationshipType: RelationshipType;
  description: string | null;
  intensity: number;
  visibility: Visibility;
  status: RelationshipStatus;
  confidenceScore: number;
  sourceExcerpt: string | null;
  [key: string]: unknown;
}

export function LoreEdge(props: EdgeProps) {
  const { id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, selected } = props;
  const d = data as LoreEdgeData;
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const color = RELATIONSHIP_COLOR[d.relationshipType] ?? '#888';
  const isSecret = d.visibility === 'gm_only' || d.status === 'secret';
  const escalating = d.status === 'escalating';

  const strokeWidth = 1 + Math.min(4, Math.max(0, (d.intensity ?? 3) - 1)) * 0.6;

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: color,
          strokeWidth: selected ? strokeWidth + 1.5 : strokeWidth,
          strokeDasharray: isSecret ? '6 4' : undefined,
          filter: escalating ? 'drop-shadow(0 0 4px ' + color + ')' : undefined,
          opacity: d.confidenceScore < 0.5 ? 0.6 : 1,
        }}
      />
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            pointerEvents: 'all',
          }}
          className="px-2 py-0.5 rounded-md bg-card/90 border border-border text-[11px] font-medium shadow-sm"
        >
          {RELATIONSHIP_LABEL[d.relationshipType]}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
