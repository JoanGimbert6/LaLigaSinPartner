import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';
import { parseCSV } from '@/lib/csv';

export const dynamic = 'force-static';

export interface DraftTeam {
  clubName: string;
  season: string;
}

export async function GET() {
  const filePath = path.join(process.cwd(), 'public', 'data', 'draft_players.csv');
  const content  = await readFile(filePath, 'utf-8');
  const rows     = parseCSV(content);

  // Columns: player_id, short_name, long_name, fifa_version, club_name(4), ..., season(13)
  const seen  = new Set<string>();
  const teams: DraftTeam[] = [];

  for (const row of rows.slice(1)) {
    if (row.length < 14) continue;
    const clubName = row[4].trim();
    const season   = row[13].trim();
    if (!clubName || !season) continue;
    const key = `${clubName}|||${season}`;
    if (!seen.has(key)) {
      seen.add(key);
      teams.push({ clubName, season });
    }
  }

  teams.sort((a, b) =>
    a.clubName.localeCompare(b.clubName) || a.season.localeCompare(b.season)
  );

  return NextResponse.json(teams);
}
