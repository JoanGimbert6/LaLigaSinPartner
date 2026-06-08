export type Formation  = '4-3-3' | '4-4-2';
export type Difficulty = 'normal' | 'hard';
export type GameMode   = 'normal' | 'prime';
export type PositionCategory = 'GK' | 'DEF' | 'MID' | 'FWD';

export interface PositionSlot {
  position: string;
  label: string;
  category: PositionCategory;
}

export interface Player {
  playerId: number;
  shortName: string;
  longName: string;
  fifaVersion: number;
  clubName: string;
  playerPositions: string;
  overall: number;
  primeOverall?: number;
  pace: number | null;
  shooting: number | null;
  passing: number | null;
  dribbling: number | null;
  defending: number | null;
  physic: number | null;
  season: string;
}

export interface Rival {
  season: string;
  team: string;
  points: number;
  gf: number;
  ga: number;
  gd: number;
  sotPg: number;
  games: number;
  strength: number;
  strengthScore: number;
  teamKey: string;
  clubName: string;
  overall: number;
  attack: number;
  midfield: number;
  defence: number;
}

export interface DraftPick {
  slotIndex: number;
  player: Player;
  fromTeam: string;
  fromSeason: string;
}

export interface MatchResult {
  matchday: number;
  rival: Rival;
  isHome: boolean;
  userGoals: number;
  rivalGoals: number;
}

export interface StandingsRow {
  name: string;
  isUser: boolean;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gf: number;
  ga: number;
  gd: number;
  points: number;
}

export interface GameState {
  formation:  Formation;
  teamName:   string;
  picks:      DraftPick[];
  difficulty: Difficulty;
  gameMode:   GameMode;
}

export interface LeaderboardEntry {
  id: string;
  playerName: string;
  points: number;
  position: number;
  gf: number;
  ga: number;
  players: { name: string; overall: number; position: string }[];
  date: string;
  primeMode: boolean;
}
