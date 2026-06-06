import type { Rival, MatchResult, StandingsRow, DraftPick, Difficulty } from './types';

function poissonRandom(lambda: number): number {
  if (lambda <= 0) return 0;
  const L = Math.exp(-Math.min(lambda, 15));
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= Math.random();
  } while (p > L);
  return k - 1;
}

export function calcUserStrength(picks: DraftPick[]): number {
  const starters = picks.filter(p => p.slotIndex < 11);
  if (starters.length === 0) return 70;
  return starters.reduce((acc, p) => acc + p.player.overall, 0) / starters.length;
}

// Season format in rivals.csv: "15-16", "16-17", etc.
const GOLDEN_ERA_SEASONS = new Set(['15-16', '16-17', '17-18', '18-19']);

function isGoldenEra(rival: Rival): boolean {
  const label = `${rival.team} ${rival.teamKey}`.toLowerCase();
  const isElite = label.includes('barcelona') || label.includes('real madrid');
  return isElite && GOLDEN_ERA_SEASONS.has(rival.season.trim());
}

const BASE_BOOST: Record<Difficulty, number> = { normal: 1.15, hard: 1.20 };

function getRivalEffectiveStrength(rival: Rival, streakBonus: number, difficulty: Difficulty): number {
  let s = rival.strengthScore * BASE_BOOST[difficulty];
  if (isGoldenEra(rival)) s *= 1.10;
  s += streakBonus;
  return s;
}

export function simulateMatch(
  userStrength: number,
  rival: Rival,
  isHome: boolean,
  matchday: number,
  streakBonus  = 0,
  difficulty: Difficulty = 'normal',
): MatchResult {
  const HOME_ADV = 10;
  const rivalStr = getRivalEffectiveStrength(rival, streakBonus, difficulty);
  const adjUser  = userStrength;        // user never gets home advantage
  const adjRival = rivalStr + HOME_ADV; // rival always gets it

  const diff = adjUser - adjRival;
  const k    = diff >= 0 ? 42 : 30;    // asymmetric: upsets are rare
  const factor = Math.exp(diff / k);

  const userGoals  = poissonRandom(1.05 * factor);
  const rivalGoals = poissonRandom(1.05 / factor);
  return { matchday, rival, isHome, userGoals, rivalGoals };
}

export function simulateSeason(
  userStrength: number,
  rivals: Rival[],
  difficulty: Difficulty = 'normal',
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

  const results: MatchResult[] = [];
  let consecutiveLosses = 0;

  for (let i = 0; i < schedule.length; i++) {
    const { rival, isHome } = schedule[i];
    const streakBonus = consecutiveLosses >= 2 ? rival.strengthScore * 0.05 : 0;
    const result = simulateMatch(userStrength, rival, isHome, i + 1, streakBonus, difficulty);
    results.push(result);
    consecutiveLosses = result.userGoals < result.rivalGoals ? consecutiveLosses + 1 : 0;
  }

  return results;
}

export function selectRivals(pool: Rival[], count = 19): Rival[] {
  const arr = [...pool];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, count);
}

// ─── W/D/L estimator ─────────────────────────────────────────────────────────

/**
 * Estimates W/D/L from a team's real season points + games played.
 * Formula: maximise wins, then use remaining points as draws.
 * Verified: points = W×3 + D, W+D+L = games.
 */
export function estimateWDL(points: number, games: number) {
  const won   = Math.min(Math.floor(points / 3), games);
  const drawn = Math.min(points - won * 3, games - won);
  const lost  = Math.max(games - won - drawn, 0);
  return { won, drawn, lost };
}

// ─── League table ─────────────────────────────────────────────────────────────

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
