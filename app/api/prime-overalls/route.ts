import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';
import { parseCSV } from '@/lib/csv';

// Returns { [playerId]: maxOverall } across all seasons in draft_players.csv
export async function GET() {
  const filePath = path.join(process.cwd(), 'public', 'data', 'draft_players.csv');
  const content  = await readFile(filePath, 'utf-8');
  const rows     = parseCSV(content);

  const primeMap: Record<number, number> = {};

  for (const row of rows.slice(1)) {
    if (row.length < 14) continue;
    const playerId = Number(row[0]);
    const overall  = Number(row[6]);
    if (isNaN(playerId) || isNaN(overall) || overall <= 0) continue;

    if (!(playerId in primeMap) || overall > primeMap[playerId]) {
      primeMap[playerId] = overall;
    }
  }

  return NextResponse.json(primeMap);
}
