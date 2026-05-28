import type { EntityType, RelationshipType, Importance } from '@/types/loregraph';

export const ENTITY_LABEL: Record<EntityType, string> = {
  player_character: 'Spielercharakter',
  npc: 'NSC',
  faction: 'Fraktion',
  location: 'Ort',
  item: 'Gegenstand',
  secret: 'Geheimnis',
  event: 'Ereignis',
  unknown: 'Unbekannt',
};

export const RELATIONSHIP_LABEL: Record<RelationshipType, string> = {
  allied_with: 'verbündet mit',
  hates: 'hasst',
  loves: 'liebt',
  owes: 'schuldet',
  manipulates: 'manipuliert',
  protects: 'beschützt',
  hunts: 'jagt',
  works_for: 'arbeitet für',
  betrayed_by: 'verraten von',
  related_to: 'verwandt mit',
  controls: 'kontrolliert',
  knows_secret_of: 'kennt Geheimnis von',
  competes_with: 'konkurriert mit',
  located_in: 'befindet sich in',
  owns: 'besitzt',
  involved_in: 'beteiligt an',
  unknown_connection: 'unklare Verbindung',
};

// Hex colors so React Flow can use them on SVG edges directly.
export const ENTITY_COLOR: Record<EntityType, string> = {
  player_character: '#5fb8ff',
  npc: '#e0b56b',
  faction: '#c66bd9',
  location: '#6bd99b',
  item: '#d9c46b',
  secret: '#d96b6b',
  event: '#9b9bd9',
  unknown: '#888a96',
};

export const RELATIONSHIP_COLOR: Record<RelationshipType, string> = {
  allied_with: '#6bd99b',
  hates: '#d96b6b',
  loves: '#e58fc0',
  owes: '#d9c46b',
  manipulates: '#c66bd9',
  protects: '#5fb8ff',
  hunts: '#e07a3b',
  works_for: '#8d8de0',
  betrayed_by: '#a83232',
  related_to: '#888a96',
  controls: '#b58c00',
  knows_secret_of: '#9b59b6',
  competes_with: '#e58a4d',
  located_in: '#6bd99b',
  owns: '#d9c46b',
  involved_in: '#888a96',
  unknown_connection: '#5a5e6e',
};

export const IMPORTANCE_RING: Record<Importance, string> = {
  low: 'ring-1 ring-border',
  medium: 'ring-1 ring-border',
  high: 'ring-2 ring-primary/60',
  critical: 'ring-2 ring-destructive',
};
