import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';
import { parseCSV } from '@/lib/csv';
import { TEAM_KEY_TO_CLUB } from '@/lib/teamMapping';

export interface DraftTeam {
  clubName: string;
  season: string;
}

// Builds the set of valid (clubName, season) combinations from rivals.csv.
// Only teams that actually played in Primera División that season are valid.
async function buildValidSet(): Promise<Set<string>> {
  const filePath = path.join(process.cwd(), 'public', 'data', 'rivals.csv');
  const content  = await readFile(filePath, 'utf-8');
  const rows     = parseCSV(content);

  const valid = new Set<string>();

  for (const row of rows.slice(1)) {
    if (row.length < 11) continue;
    const season  = row[0].trim();
    const teamKey = row[10].trim();
    if (!teamKey) continue; // teams without a key can't map to draft_players

    const clubName = TEAM_KEY_TO_CLUB[teamKey];
    if (clubName) {
      valid.add(`${clubName}|||${season}`);
    }
  }

  return valid;
}

export async function GET() {
  const [validSet, playersContent] = await Promise.all([
    buildValidSet(),
    readFile(path.join(process.cwd(), 'public', 'data', 'draft_players.csv'), 'utf-8'),
  ]);

  const rows = parseCSV(playersContent);

  // Columns: player_id, short_name, long_name, fifa_version, club_name(4), ..., season(13)
  const seen  = new Set<string>();
  const teams: DraftTeam[] = [];

  for (const row of rows.slice(1)) {
    if (row.length < 14) continue;
    const clubName = row[4].trim();
    const season   = row[13].trim();
    if (!clubName || !season) continue;

    const key = `${clubName}|||${season}`;
    if (!seen.has(key) && validSet.has(key)) {
      seen.add(key);
      teams.push({ clubName, season });
    }
  }

  teams.sort((a, b) =>
    a.clubName.localeCompare(b.clubName) || a.season.localeCompare(b.season)
  );

  return NextResponse.json(teams);
}
