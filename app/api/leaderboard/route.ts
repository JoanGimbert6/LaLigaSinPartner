import { NextResponse } from 'next/server';
import { readFile, writeFile, mkdir } from 'fs/promises';
import path from 'path';
import type { LeaderboardEntry } from '@/lib/types';

const DB_PATH = path.join(process.cwd(), 'data', 'leaderboard.json');

async function readEntries(): Promise<LeaderboardEntry[]> {
  try {
    const content = await readFile(DB_PATH, 'utf-8');
    return JSON.parse(content) as LeaderboardEntry[];
  } catch {
    return [];
  }
}

export async function GET() {
  const entries = await readEntries();
  const top20 = [...entries]
    .sort((a, b) => b.points - a.points || a.position - b.position)
    .slice(0, 20);
  return NextResponse.json(top20);
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const points   = Number(body.points);
  const position = Number(body.position);
  const gf       = Number(body.gf);
  const ga       = Number(body.ga);

  if (isNaN(points)   || points < 0   || points > 114)  return NextResponse.json({ error: 'Invalid points' },   { status: 400 });
  if (isNaN(position) || position < 1 || position > 20)  return NextResponse.json({ error: 'Invalid position' }, { status: 400 });

  const entry: LeaderboardEntry = {
    id:         Date.now().toString(),
    playerName: String(body.playerName ?? 'Anónimo').slice(0, 30),
    points,
    position,
    gf:         isNaN(gf) ? 0 : gf,
    ga:         isNaN(ga) ? 0 : ga,
    players:    Array.isArray(body.players)
      ? (body.players as { name: string; overall: number; position: string }[]).slice(0, 11)
      : [],
    date:       new Date().toISOString(),
    primeMode:  Boolean(body.primeMode),
  };

  const entries = await readEntries();
  entries.push(entry);
  entries.sort((a, b) => b.points - a.points);
  const trimmed = entries.slice(0, 500);

  await mkdir(path.dirname(DB_PATH), { recursive: true });
  await writeFile(DB_PATH, JSON.stringify(trimmed, null, 2), 'utf-8');

  return NextResponse.json(entry, { status: 201 });
}
