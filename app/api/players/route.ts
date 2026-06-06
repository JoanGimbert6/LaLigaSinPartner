import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';
import { parseCSV } from '@/lib/csv';
import type { PositionCategory } from '@/lib/types';

const CATEGORY_POSITIONS: Record<PositionCategory, string[]> = {
  GK:  ['GK'],
  DEF: ['CB', 'LB', 'RB', 'LWB', 'RWB'],
  MID: ['CM', 'CDM', 'CAM', 'RM', 'LM', 'DM', 'AM'],
  FWD: ['ST', 'CF', 'RW', 'LW', 'SS'],
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const clubName = searchParams.get('clubName') ?? '';
  const season   = searchParams.get('season') ?? '';
  const category = searchParams.get('category') ?? '';

  const filePath = path.join(process.cwd(), 'public', 'data', 'draft_players.csv');
  const content  = await readFile(filePath, 'utf-8');
  const rows     = parseCSV(content);

  // category='ANY' or '' → no position filter
  const allowedPos =
    category && category !== 'ANY'
      ? (CATEGORY_POSITIONS[category as PositionCategory] ?? null)
      : null;

  const players = rows
    .slice(1)
    .filter(r => r.length >= 14)
    .map(r => ({
      playerId:        Number(r[0]),
      shortName:       r[1],
      longName:        r[2],
      fifaVersion:     Number(r[3]),
      clubName:        r[4],
      playerPositions: r[5],
      overall:         Number(r[6]),
      pace:            r[7]  ? Number(r[7])  : null,
      shooting:        r[8]  ? Number(r[8])  : null,
      passing:         r[9]  ? Number(r[9])  : null,
      dribbling:       r[10] ? Number(r[10]) : null,
      defending:       r[11] ? Number(r[11]) : null,
      physic:          r[12] ? Number(r[12]) : null,
      season:          r[13],
    }))
    .filter(p => {
      if (clubName && p.clubName !== clubName) return false;
      if (season   && p.season   !== season)   return false;
      if (allowedPos) {
        const positions = p.playerPositions.split(',').map(s => s.trim());
        if (!positions.some(pos => allowedPos.includes(pos))) return false;
      }
      return !isNaN(p.overall) && p.overall > 0;
    })
    .sort((a, b) => b.overall - a.overall);

  return NextResponse.json(players);
}
