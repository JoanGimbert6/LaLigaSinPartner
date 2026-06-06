import type { Formation, PositionSlot, PositionCategory } from './types';

// Exact mapping: each FIFA position string → slot category
export const POSITION_MAP: Record<string, PositionCategory> = {
  GK:  'GK',
  CB:  'DEF', LB:  'DEF', RB:  'DEF', LWB: 'DEF', RWB: 'DEF',
  CDM: 'MID', CM:  'MID', CAM: 'MID', LM:  'MID', RM:  'MID',
  ST:  'FWD', CF:  'FWD', LW:  'FWD', RW:  'FWD',
};

/** Returns all slot categories a player can legally fill (no duplicates). */
export function mapPositionToSlot(playerPositions: string): PositionCategory[] {
  const cats = new Set<PositionCategory>();
  for (const pos of playerPositions.split(',').map(s => s.trim())) {
    const cat = POSITION_MAP[pos];
    if (cat) cats.add(cat);
  }
  return [...cats];
}

// Specific slot positions each player position can fill in the formation
const PLAYER_TO_SLOTS: Record<string, string[]> = {
  GK:  ['GK'],
  CB:  ['CB'],
  LB:  ['LB'],
  RB:  ['RB'],
  LWB: ['LB'],
  RWB: ['RB'],
  CDM: ['CM'],
  CM:  ['CM'],
  CAM: ['CM', 'LM', 'RM'],
  LM:  ['LM', 'LW'],
  RM:  ['RM', 'RW'],
  LW:  ['LW', 'LM'],
  RW:  ['RW', 'RM'],
  ST:  ['ST'],
  CF:  ['ST'],
};

/** Returns the specific formation slot positions a player can legally fill. */
export function getPlayerSlotPositions(playerPositions: string): string[] {
  const slots = new Set<string>();
  for (const pos of playerPositions.split(',').map(s => s.trim())) {
    for (const slot of PLAYER_TO_SLOTS[pos] ?? []) slots.add(slot);
  }
  return [...slots];
}

/** Weight used for goal-scoring probability (higher = more likely to score). */
export function goalScoringWeight(playerPositions: string, overall: number): number {
  const cats = mapPositionToSlot(playerPositions);
  if (cats.includes('FWD')) return overall * 3.0;
  if (cats.includes('MID')) return overall * 1.0;
  if (cats.includes('DEF')) return overall * 0.2;
  return 0; // GK
}

export const FORMATIONS: Record<Formation, PositionSlot[]> = {
  '4-3-3': [
    { position: 'GK', label: 'Portero',          category: 'GK'  }, // 0
    { position: 'LB', label: 'Lateral Izq.',      category: 'DEF' }, // 1
    { position: 'CB', label: 'Central Izq.',       category: 'DEF' }, // 2
    { position: 'CB', label: 'Central Der.',       category: 'DEF' }, // 3
    { position: 'RB', label: 'Lateral Der.',       category: 'DEF' }, // 4
    { position: 'CM', label: 'Mediocentro Izq.',   category: 'MID' }, // 5
    { position: 'CM', label: 'Mediocentro',        category: 'MID' }, // 6
    { position: 'CM', label: 'Mediocentro Der.',   category: 'MID' }, // 7
    { position: 'LW', label: 'Extremo Izq.',       category: 'FWD' }, // 8
    { position: 'ST', label: 'Delantero Centro',   category: 'FWD' }, // 9
    { position: 'RW', label: 'Extremo Der.',       category: 'FWD' }, // 10
  ],
  '4-4-2': [
    { position: 'GK', label: 'Portero',            category: 'GK'  }, // 0
    { position: 'LB', label: 'Lateral Izq.',        category: 'DEF' }, // 1
    { position: 'CB', label: 'Central Izq.',         category: 'DEF' }, // 2
    { position: 'CB', label: 'Central Der.',         category: 'DEF' }, // 3
    { position: 'RB', label: 'Lateral Der.',         category: 'DEF' }, // 4
    { position: 'LM', label: 'Mediapunta Izq.',      category: 'MID' }, // 5
    { position: 'CM', label: 'Mediocentro Izq.',     category: 'MID' }, // 6
    { position: 'CM', label: 'Mediocentro Der.',     category: 'MID' }, // 7
    { position: 'RM', label: 'Mediapunta Der.',      category: 'MID' }, // 8
    { position: 'ST', label: 'Delantero Izq.',       category: 'FWD' }, // 9
    { position: 'ST', label: 'Delantero Der.',       category: 'FWD' }, // 10
  ],
};

// Field rows for pitch rendering — FWD (top) → GK (bottom)
export const FORMATION_PITCH_ROWS: Record<Formation, number[][]> = {
  '4-3-3': [
    [8, 9, 10],    // FWD
    [5, 6, 7],     // MID
    [1, 2, 3, 4],  // DEF
    [0],           // GK
  ],
  '4-4-2': [
    [9, 10],       // FWD
    [5, 6, 7, 8],  // MID
    [1, 2, 3, 4],  // DEF
    [0],           // GK
  ],
};

export const CATEGORY_POSITIONS: Record<PositionCategory, string[]> = {
  GK:  ['GK'],
  DEF: ['CB', 'LB', 'RB', 'LWB', 'RWB'],
  MID: ['CM', 'CDM', 'CAM', 'RM', 'LM', 'DM', 'AM'],
  FWD: ['ST', 'CF', 'RW', 'LW', 'SS'],
};

export const TOTAL_PICKS = 11;
