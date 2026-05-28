import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  type Edge,
  type Node,
  type NodeMouseHandler,
  type EdgeMouseHandler,
} from '@xyflow/react';
import { Search, SlidersHorizontal, RefreshCw } from 'lucide-react';
import { api } from '@/lib/api';
import type {
  Entity,
  EntityStatus,
  EntityType,
  Importance,
  Relationship,
  Visibility,
} from '@/types/loregraph';
import { LoreNode } from '@/components/graph/LoreNode';
import { LoreEdge } from '@/components/graph/LoreEdge';
import { layoutGraph } from '@/components/graph/layout';
import { EntityPanel } from '@/components/graph/EntityPanel';
import { RelationshipPanel } from '@/components/graph/RelationshipPanel';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ENTITY_LABEL } from '@/lib/entityStyles';

const nodeTypes = { loreNode: LoreNode };
const edgeTypes = { loreEdge: LoreEdge };

const ENTITY_TYPES: EntityType[] = [
  'player_character', 'npc', 'faction', 'location', 'item', 'secret', 'event', 'unknown',
];

interface Filters {
  search: string;
  types: Set<EntityType>;
  visibilities: Set<Visibility>;
  importances: Set<Importance>;
  statuses: Set<EntityStatus>;
  minConfidence: number;
}

function defaultFilters(): Filters {
  return {
    search: '',
    types: new Set(ENTITY_TYPES),
    visibilities: new Set<Visibility>(['public', 'gm_only']),
    importances: new Set<Importance>(['low', 'medium', 'high', 'critical']),
    statuses: new Set<EntityStatus>(['active', 'dead', 'missing', 'destroyed', 'unknown']),
    minConfidence: 0,
  };
}

export default function GraphPage() {
  return (
    <ReactFlowProvider>
      <GraphPageInner />
    </ReactFlowProvider>
  );
}

function GraphPageInner() {
  const { id } = useParams();
  const [entities, setEntities] = useState<Entity[]>([]);
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selectedEntity, setSelectedEntity] = useState<Entity | null>(null);
  const [selectedRelationship, setSelectedRelationship] = useState<Relationship | null>(null);
  const [filters, setFilters] = useState<Filters>(defaultFilters());
  const [showFilters, setShowFilters] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const [graph, ents, rels] = await Promise.all([
        api.graph(id),
        api.listEntities(id),
        api.listRelationships(id),
      ]);
      setEntities(ents);
      setRelationships(rels);

      const laid = layoutGraph(
        graph.nodes.map((n) => ({ ...n }) as Node),
        graph.edges.map((e) => ({ ...e }) as Edge),
      );
      setNodes(laid.nodes);
      setEdges(laid.edges);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [id, setNodes, setEdges]);

  useEffect(() => {
    reload();
  }, [reload]);

  // Apply filters by hiding nodes + edges (not removing — preserves positions)
  const filteredNodes = useMemo(() => {
    const search = filters.search.trim().toLowerCase();
    return nodes.map((n) => {
      const d = n.data as Record<string, unknown>;
      const type = d.entityType as EntityType;
      const visibility = d.visibility as Visibility;
      const importance = d.importance as Importance;
      const status = d.status as EntityStatus;
      const conf = d.confidenceScore as number;
      const name = (d.name as string) ?? '';

      const matches =
        filters.types.has(type) &&
        filters.visibilities.has(visibility) &&
        filters.importances.has(importance) &&
        filters.statuses.has(status) &&
        conf >= filters.minConfidence &&
        (search === '' || name.toLowerCase().includes(search));
      return { ...n, hidden: !matches };
    });
  }, [nodes, filters]);

  const visibleIds = useMemo(
    () => new Set(filteredNodes.filter((n) => !n.hidden).map((n) => n.id)),
    [filteredNodes],
  );

  const filteredEdges = useMemo(
    () =>
      edges.map((e) => ({
        ...e,
        hidden: !(visibleIds.has(e.source) && visibleIds.has(e.target)),
      })),
    [edges, visibleIds],
  );

  const onNodeClick: NodeMouseHandler = useCallback(
    (_evt, node) => {
      const ent = entities.find((e) => e.id === node.id) ?? null;
      setSelectedEntity(ent);
      setSelectedRelationship(null);
    },
    [entities],
  );

  const onEdgeClick: EdgeMouseHandler = useCallback(
    (_evt, edge) => {
      const rel = relationships.find((r) => r.id === edge.id) ?? null;
      setSelectedRelationship(rel);
      setSelectedEntity(null);
    },
    [relationships],
  );

  function toggleSet<T>(set: Set<T>, value: T): Set<T> {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    return next;
  }

  function relayout() {
    const laid = layoutGraph(nodes, edges);
    setNodes(laid.nodes);
  }

  return (
    <div className="h-[calc(100vh-3.5rem)] flex">
      <div className="flex-1 relative">
        <div className="absolute top-4 left-4 right-4 z-10 flex items-center gap-2">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-8 bg-card/80 backdrop-blur"
              placeholder="Suche nach Name…"
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            />
          </div>
          <Button variant="outline" onClick={() => setShowFilters((v) => !v)}>
            <SlidersHorizontal className="h-4 w-4" />
            Filter
          </Button>
          <Button variant="ghost" onClick={relayout} title="Layout neu berechnen">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>

        {showFilters && (
          <Card className="absolute top-16 left-4 z-10 w-[360px] bg-card/95 backdrop-blur">
            <CardContent className="p-4 space-y-4">
              <div>
                <Label className="text-xs">Typ</Label>
                <div className="flex flex-wrap gap-1 mt-1">
                  {ENTITY_TYPES.map((t) => {
                    const active = filters.types.has(t);
                    return (
                      <button
                        key={t}
                        onClick={() => setFilters({ ...filters, types: toggleSet(filters.types, t) })}
                      >
                        <Badge variant={active ? 'default' : 'muted'}>{ENTITY_LABEL[t]}</Badge>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <Label className="text-xs">Sichtbarkeit</Label>
                <div className="flex flex-wrap gap-1 mt-1">
                  {(['public', 'gm_only'] as Visibility[]).map((v) => {
                    const active = filters.visibilities.has(v);
                    return (
                      <button
                        key={v}
                        onClick={() =>
                          setFilters({ ...filters, visibilities: toggleSet(filters.visibilities, v) })
                        }
                      >
                        <Badge variant={active ? 'default' : 'muted'}>{v}</Badge>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <Label className="text-xs">Wichtigkeit</Label>
                <div className="flex flex-wrap gap-1 mt-1">
                  {(['low', 'medium', 'high', 'critical'] as Importance[]).map((s) => {
                    const active = filters.importances.has(s);
                    return (
                      <button
                        key={s}
                        onClick={() =>
                          setFilters({ ...filters, importances: toggleSet(filters.importances, s) })
                        }
                      >
                        <Badge variant={active ? 'default' : 'muted'}>{s}</Badge>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <Label className="text-xs">Status</Label>
                <div className="flex flex-wrap gap-1 mt-1">
                  {(['active', 'dead', 'missing', 'destroyed', 'unknown'] as EntityStatus[]).map((s) => {
                    const active = filters.statuses.has(s);
                    return (
                      <button
                        key={s}
                        onClick={() =>
                          setFilters({ ...filters, statuses: toggleSet(filters.statuses, s) })
                        }
                      >
                        <Badge variant={active ? 'default' : 'muted'}>{s}</Badge>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <Label className="text-xs">
                  Mindest-Confidence: {Math.round(filters.minConfidence * 100)}%
                </Label>
                <input
                  className="w-full mt-1"
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round(filters.minConfidence * 100)}
                  onChange={(e) =>
                    setFilters({ ...filters, minConfidence: Number(e.target.value) / 100 })
                  }
                />
              </div>

              <div className="flex justify-between pt-2">
                <Button variant="ghost" size="sm" onClick={() => setFilters(defaultFilters())}>
                  Zurücksetzen
                </Button>
                <Button variant="outline" size="sm" onClick={() => setShowFilters(false)}>
                  Schließen
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {error && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
              {error}
            </div>
          </div>
        )}

        {!loading && entities.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-center">
            <div className="max-w-md">
              <p className="text-lg font-medium mb-2">Noch leer.</p>
              <p className="text-muted-foreground">
                Füge deinen Kampagnentext ein, um deine Beziehungskarte zu erstellen.
              </p>
            </div>
          </div>
        )}

        <ReactFlow
          nodes={filteredNodes}
          edges={filteredEdges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick}
          onEdgeClick={onEdgeClick}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
          proOptions={{ hideAttribution: true }}
        >
          <Background gap={24} color="hsl(var(--border))" />
          <MiniMap pannable zoomable maskColor="rgba(0,0,0,0.5)" />
          <Controls position="bottom-right" />
        </ReactFlow>
      </div>

      {(selectedEntity || selectedRelationship) && (
        <aside className="w-[380px] border-l border-border bg-card">
          {selectedEntity && (
            <EntityPanel
              entity={selectedEntity}
              onClose={() => setSelectedEntity(null)}
              onChanged={(e) => {
                setEntities((prev) => prev.map((x) => (x.id === e.id ? e : x)));
                setNodes((prev) =>
                  prev.map((n) =>
                    n.id === e.id
                      ? {
                          ...n,
                          data: {
                            ...(n.data as Record<string, unknown>),
                            name: e.name,
                            entityType: e.type,
                            description: e.description,
                            visibility: e.visibility,
                            status: e.status,
                            importance: e.importance,
                            confidenceScore: e.confidenceScore,
                          },
                        }
                      : n,
                  ),
                );
                setSelectedEntity(e);
              }}
              onDeleted={(deletedId) => {
                setEntities((prev) => prev.filter((x) => x.id !== deletedId));
                setNodes((prev) => prev.filter((n) => n.id !== deletedId));
                setEdges((prev) => prev.filter((e) => e.source !== deletedId && e.target !== deletedId));
                setSelectedEntity(null);
              }}
            />
          )}
          {selectedRelationship && (
            <RelationshipPanel
              relationship={selectedRelationship}
              entities={entities}
              onClose={() => setSelectedRelationship(null)}
              onChanged={(r) => {
                setRelationships((prev) => prev.map((x) => (x.id === r.id ? r : x)));
                setEdges((prev) =>
                  prev.map((e) =>
                    e.id === r.id
                      ? {
                          ...e,
                          animated: r.status === 'escalating',
                          data: {
                            ...(e.data as Record<string, unknown>),
                            relationshipType: r.type,
                            description: r.description,
                            intensity: r.intensity,
                            visibility: r.visibility,
                            status: r.status,
                            confidenceScore: r.confidenceScore,
                          },
                        }
                      : e,
                  ),
                );
                setSelectedRelationship(r);
              }}
              onDeleted={(deletedId) => {
                setRelationships((prev) => prev.filter((x) => x.id !== deletedId));
                setEdges((prev) => prev.filter((e) => e.id !== deletedId));
                setSelectedRelationship(null);
              }}
            />
          )}
        </aside>
      )}
    </div>
  );
}
