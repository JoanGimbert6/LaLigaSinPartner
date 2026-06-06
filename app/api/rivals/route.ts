import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';
import { parseCSV } from '@/lib/csv';
import { TEAM_KEY_TO_CLUB } from '@/lib/teamMapping';

export const dynamic = 'force-static';

export async function GET() {
  const filePath = path.join(process.cwd(), 'public', 'data', 'rivals.csv');
  const content = await readFile(filePath, 'utf-8');
  const rows = parseCSV(content);

  // Header: season,team,points,gf,ga,gd,sot_pg,games,strength,strength_score,team_key,overall,attack,midfield,defence
  const rivals = rows
    .slice(1)
    .filter(r => r.length >= 15 && r[10] && r[10].trim())
    .map(r => ({
      season:        r[0].trim(),
      team:          r[1].trim(),
      points:        Number(r[2]),
      gf:            Number(r[3]),
      ga:            Number(r[4]),
      gd:            Number(r[5]),
      sotPg:         Number(r[6]),
      games:         Number(r[7]),
      strength:      Number(r[8]),
      strengthScore: Number(r[9]),
      teamKey:       r[10].trim(),
      clubName:      TEAM_KEY_TO_CLUB[r[10].trim()] ?? r[10].trim(),
      overall:       Number(r[11]),
      attack:        Number(r[12]),
      midfield:      Number(r[13]),
      defence:       Number(r[14]),
    }));

  return NextResponse.json(rivals);
}
