import type { Rival, MatchResult, StandingsRow, DraftPick, Difficulty, GameMode } from './types';
import { mapPositionToSlot } from './formation';

// ─── Poisson ──────────────────────────────────────────────────────────────────

function poissonRandom(lambda: number): number {
  if (lambda <= 0) return 0;
  const L = Math.exp(-Math.min(lambda, 15));
  let k = 0;
  let p = 1;
  do { k++; p *= Math.random(); } while (p > L);
  return k - 1;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

// ─── User strength (0–100 scale) ─────────────────────────────────────────────
// Dataset range: overall ~60–95 → normalized to 0–100
// Bonuses: positional coherence (+3) + elite players (+1 each, max +5)

export function calcUserStrength(picks: DraftPick[], gameMode: GameMode = 'normal'): number {
  const starters = picks.filter(p => p.slotIndex < 11);
  if (starters.length === 0) return 50;

  const ovrs = starters.map(p =>
    gameMode === 'prime' && p.player.primeOverall ? p.player.primeOverall : p.player.overall
  );
  const avg = ovrs.reduce((a, b) => a + b, 0) / ovrs.length;

  // Normalize to 0–100 (floor 60, ceiling 95 in dataset)
  const normalized = clamp((avg - 60) / (95 - 60) * 100, 0, 100);

  // Positional coherence bonus
  const cats = starters.map(p => mapPositionToSlot(p.player.playerPositions)[0] ?? 'FWD');
  const defCount = cats.filter(c => c === 'DEF').length;
  const midCount = cats.filter(c => c === 'MID').length;
  const fwdCount = cats.filter(c => c === 'FWD').length;
  const coherenceBonus = defCount >= 4 && midCount >= 3 && fwdCount >= 3 ? 3 : 0;

  // Elite player bonus
  const eliteCount = ovrs.filter(o => o > 85).length;
  const eliteBonus = Math.min(5, eliteCount);

  return clamp(normalized + coherenceBonus + eliteBonus, 0, 108);
}

// ─── Probability table by strength diff ──────────────────────────────────────

function baseProbabilities(diff: number): [number, number, number] {
  // Returns [pWin, pDraw, pLoss]
  if (diff > 20)  return [0.65, 0.20, 0.15];
  if (diff > 10)  return [0.55, 0.25, 0.20];
  if (diff > 0)   return [0.45, 0.28, 0.27];
  if (diff > -10) return [0.35, 0.28, 0.37];
  if (diff > -20) return [0.25, 0.25, 0.50];
  return              [0.15, 0.20, 0.65];
}

function applyHomeAdvantage(pWin: number, pDraw: number, pLoss: number): [number, number, number] {
  const HOME = 0.08;
  const w = clamp(pWin + HOME, 0.05, 0.95);
  const l = clamp(pLoss - HOME, 0.05, 0.95);
  const d = clamp(1 - w - l, 0.05, 0.90);
  const total = w + d + l;
  return [w / total, d / total, l / total];
}

// ─── Match simulation ─────────────────────────────────────────────────────────

export function simulateMatch(
  userStrength: number,
  rival: Rival,
  isHome: boolean,
  matchday: number,
): MatchResult {
  const rivalStr = rival.strengthScore;
  const diff = userStrength - rivalStr;

  let [pWin, pDraw, pLoss] = baseProbabilities(diff);
  if (isHome) [pWin, pDraw, pLoss] = applyHomeAdvantage(pWin, pDraw, pLoss);

  // Determine outcome
  const r = Math.random();
  const isWin  = r < pWin;
  const isDraw = r >= pWin && r < pWin + pDraw;

  // Poisson lambdas based on strength ratio
  const safeUser  = Math.max(5, userStrength);
  const safeRival = Math.max(5, rivalStr);
  const ratio = safeUser / safeRival;
  const homeBoost = isHome ? 1.10 : 1.0;

  const lambdaUser  = clamp(1.3 * ratio * homeBoost, 0.5, 2.8);
  const lambdaRival = clamp(1.3 / ratio / homeBoost, 0.5, 2.8);

  let userGoals  = poissonRandom(lambdaUser);
  let rivalGoals = poissonRandom(lambdaRival);

  // Reconcile goals with outcome
  if (isWin && userGoals <= rivalGoals) {
    userGoals = rivalGoals + 1;
  } else if (!isWin && !isDraw && rivalGoals <= userGoals) {
    rivalGoals = userGoals + 1;
  } else if (isDraw) {
    const avg = Math.round((userGoals + rivalGoals) / 2);
    userGoals  = avg;
    rivalGoals = avg;
  }

  return { matchday, rival, isHome, userGoals, rivalGoals };
}

// ─── Season simulation ────────────────────────────────────────────────────────

export function simulateSeason(
  userStrength: number,
  rivals: Rival[],
  _difficulty: Difficulty = 'normal',
): MatchResult[] {
  const schedule: { rival: Rival; isHome: boolean }[] = [];
  for (const rival of rivals) {
    schedule.push({ rival, isHome: true  });
    schedule.push({ rival, isHome: false });
  }
  // Fisher-Yates shuffle
  for (let i = schedule.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [schedule[i], schedule[j]] = [schedule[j], schedule[i]];
  }

  return schedule.map(({ rival, isHome }, i) =>
    simulateMatch(userStrength, rival, isHome, i + 1)
  );
}

// ─── Select 19 unique rival teams ─────────────────────────────────────────────
// Each real team appears at most once, picked from any season.

export function selectRivals(pool: Rival[], count = 19): Rival[] {
  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  const usedTeams = new Set<string>();
  const result: Rival[] = [];

  for (const rival of shuffled) {
    // Use team name as the unique identifier (consistent across seasons)
    const teamId = rival.team;
    if (!usedTeams.has(teamId)) {
      usedTeams.add(teamId);
      result.push(rival);
      if (result.length >= count) break;
    }
  }

  return result;
}

// ─── W/D/L estimator ─────────────────────────────────────────────────────────

export function estimateWDL(points: number, games: number) {
  const won   = Math.min(Math.floor(points / 3), games);
  const drawn = Math.min(points - won * 3, games - won);
  const lost  = Math.max(games - won - drawn, 0);
  return { won, drawn, lost };
}

// ─── League table ──────────────────────────────────────────────────────────────

export function buildLeagueTable(
  matches: MatchResult[],
  rivals: Rival[],
  teamName: string,
): StandingsRow[] {
  let won = 0, drawn = 0, lost = 0, gf = 0, ga = 0;
  for (const m of matches) {
    gf += m.userGoals;
    ga += m.rivalGoals;
    if (m.userGoals > m.rivalGoals)        won++;
    else if (m.userGoals === m.rivalGoals) drawn++;
    else                                   lost++;
  }
  const userRow: StandingsRow = {
    name: teamName, isUser: true,
    played: matches.length,
    won, drawn, lost, gf, ga,
    gd:     gf - ga,
    points: won * 3 + drawn,
  };

  const rivalRows: StandingsRow[] = rivals.map(r => {
    const wdl = estimateWDL(r.points, r.games);
    return {
      name:   `${r.team} ${r.season}`,
      isUser: false,
      played: r.games,
      won:    wdl.won,
      drawn:  wdl.drawn,
      lost:   wdl.lost,
      gf:     r.gf,
      ga:     r.ga,
      gd:     r.gd,
      points: r.points,
    };
  });

  return [userRow, ...rivalRows].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.gd     !== a.gd)     return b.gd     - a.gd;
    return b.gf - a.gf;
  });
}
