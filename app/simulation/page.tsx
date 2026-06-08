'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import Link from 'next/link';
import type { Formation, PositionSlot, Rival, DraftPick, MatchResult, StandingsRow, Difficulty, GameMode, LeaderboardEntry } from '@/lib/types';
import { FORMATIONS, goalScoringWeight } from '@/lib/formation';
import { calcUserStrength, simulateSeason, selectRivals, buildLeagueTable } from '@/lib/simulation';

// ─── Colors ───────────────────────────────────────────────────────────────────

const C = {
  bg:      '#0A0A0A',
  bg2:     '#1A1A1A',
  card:    '#1E1E1E',
  card2:   '#252525',
  border:  '#2E2E2E',
  red:     '#C8102E',
  redBr:   '#E8192C',
  gold:    '#F5A623',
  text:    '#FFFFFF',
  muted:   '#CCCCCC',
  subtle:  '#888888',
};

type SimPhase = 'setup' | 'simulating' | 'done';

interface SavedDraft {
  formation:   Formation;
  teamName:    string;
  picks:       DraftPick[];
  difficulty?: Difficulty;
  gameMode?:   GameMode;
}

// ─── Position message ─────────────────────────────────────────────────────────

function getPositionMessage(pos: number): { title: string; sub: string; color: string; bg: string } {
  if (pos === 1)  return { title: '¡Campeón eterno de La Liga!',  sub: '¡Lo has conseguido! El mejor.',         color: '#ca8a04', bg: '#1a1000' };
  if (pos <= 4)   return { title: '¡Champions League conseguida!', sub: 'Entre los 4 mejores. Increíble.',        color: '#16a34a', bg: '#0a1a0a' };
  if (pos <= 6)   return { title: 'Europa League',                 sub: 'Europa te espera. Bien hecho.',          color: '#2563eb', bg: '#0a0a1a' };
  if (pos <= 10)  return { title: 'Zona cómoda',                  sub: 'Temporada sólida. Sin sobresaltos.',      color: C.muted,   bg: '#1A1A1A' };
  if (pos <= 17)  return { title: 'Salvación agónica',            sub: 'Uno más en Primera. Por los pelos.',     color: C.subtle,  bg: '#1A1A1A' };
  return            { title: 'Descenso. Inténtalo de nuevo.',      sub: 'La Segunda División te espera.',         color: '#ef4444', bg: '#1a0505' };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function longestUnbeaten(matches: MatchResult[]): number {
  let max = 0, cur = 0;
  for (const m of matches) {
    if (m.userGoals >= m.rivalGoals) { cur++; max = Math.max(max, cur); }
    else cur = 0;
  }
  return max;
}

function mostMemorable(matches: MatchResult[]): MatchResult | null {
  if (!matches.length) return null;
  return matches.reduce((best, m) =>
    Math.abs(m.userGoals - m.rivalGoals) > Math.abs(best.userGoals - best.rivalGoals) ? m : best
  );
}

function computeTopScorer(picks: DraftPick[], totalGoals: number): { pick: DraftPick; goals: number } | null {
  if (totalGoals === 0) return null;
  const starters = picks.filter(p => p.slotIndex < 11);
  const weights  = starters.map(p => ({ p, w: goalScoringWeight(p.player.playerPositions, p.player.overall) }));
  const totalW   = weights.reduce((s, x) => s + x.w, 0);
  if (totalW === 0) return null;

  const goalCount = new Map<number, number>(starters.map(p => [p.slotIndex, 0]));
  for (let g = 0; g < totalGoals; g++) {
    let r = Math.random() * totalW;
    for (const { p, w } of weights) {
      r -= w;
      if (r <= 0) { goalCount.set(p.slotIndex, (goalCount.get(p.slotIndex) ?? 0) + 1); break; }
    }
  }

  let maxGoals = 0, topPick: DraftPick | null = null;
  for (const { p } of weights) {
    const g = goalCount.get(p.slotIndex) ?? 0;
    if (g > maxGoals) { maxGoals = g; topPick = p; }
  }
  return topPick ? { pick: topPick, goals: maxGoals } : null;
}

// ─── Share image (Canvas) ─────────────────────────────────────────────────────

function downloadShareImage(
  position: number, message: string, teamName: string, formation: string,
  points: number, gf: number, ga: number, picks: DraftPick[],
  formationSlots: PositionSlot[], primeMode: boolean,
) {
  const W = 600, H = 880;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d')!;

  ctx.fillStyle = '#0A0A0A';
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = '#C8102E';
  ctx.fillRect(0, 0, W, 6);

  ctx.fillStyle = 'rgba(200,16,46,0.08)';
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.font = 'bold 14px system-ui, Arial';
  ctx.textAlign = 'center';
  ctx.fillText('LALIGA SIN PARTNER' + (primeMode ? ' · MODO PRIME' : ''), W / 2, 38);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 26px system-ui, Arial';
  ctx.fillText(teamName.toUpperCase(), W / 2, 76);

  ctx.fillStyle = '#C8102E';
  ctx.font = `bold 72px system-ui, Arial`;
  ctx.fillText(position === 1 ? '¡CAMPEON!' : `${position}º PUESTO`, W / 2, 168);

  ctx.font = 'bold 19px system-ui, Arial';
  ctx.fillStyle = 'rgba(255,255,255,0.80)';
  ctx.fillText(message, W / 2, 205);

  ctx.font = 'bold 20px system-ui, Arial';
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(`${points} pts  ·  ${gf} GF / ${ga} GC`, W / 2, 244);

  ctx.strokeStyle = 'rgba(200,16,46,0.4)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(40, 264); ctx.lineTo(W - 40, 264); ctx.stroke();

  ctx.font = 'bold 13px system-ui, Arial';
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.fillText(`MI XI · ${formation}`, W / 2, 290);

  const starters = [...picks].filter(p => p.slotIndex < 11).sort((a, b) => a.slotIndex - b.slotIndex);
  const colW = (W - 80) / 2;

  starters.forEach((pick, i) => {
    const col = i < 6 ? 0 : 1;
    const row = i < 6 ? i : i - 6;
    const x   = 40 + col * (colW + 20);
    const y   = 318 + row * 38;

    ctx.fillStyle = 'rgba(200,16,46,0.15)';
    ctx.fillRect(x, y - 13, 30, 16);
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = 'bold 10px system-ui, Arial';
    ctx.textAlign = 'left';
    ctx.fillText(formationSlots[pick.slotIndex].position, x + 3, y);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '13px system-ui, Arial';
    ctx.fillText(pick.player.shortName.slice(0, 17), x + 34, y);

    const ovr = primeMode && pick.player.primeOverall ? pick.player.primeOverall : pick.player.overall;
    ctx.fillStyle = primeMode ? '#F5A623' : '#C8102E';
    ctx.font = 'bold 12px system-ui, Arial';
    ctx.textAlign = 'right';
    ctx.fillText(String(ovr), x + colW - 2, y);
    ctx.textAlign = 'left';
  });

  ctx.fillStyle = 'rgba(200,16,46,0.8)';
  ctx.fillRect(0, H - 6, W, 6);

  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255,255,255,0.40)';
  ctx.font = '13px system-ui, Arial';
  ctx.fillText('¿Puedes superarme? · #LaLigaSinPartner', W / 2, H - 22);

  const a = document.createElement('a');
  a.download = `laliga-${position}puesto.png`;
  a.href = cv.toDataURL('image/png');
  a.click();
}

// ─── StandingsTable ───────────────────────────────────────────────────────────

function StandingsTable({ rows, compact }: { rows: StandingsRow[]; compact?: boolean }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs" style={{ borderBottom: `1px solid ${C.border}`, color: C.subtle }}>
            <th className="text-left py-2 pl-2 w-6 font-bold">#</th>
            <th className="text-left py-2 font-bold">Equipo</th>
            {!compact && <th className="text-center py-2 w-8 font-bold">PJ</th>}
            <th className="text-center py-2 w-8 font-bold">G</th>
            <th className="text-center py-2 w-8 font-bold">E</th>
            <th className="text-center py-2 w-8 font-bold">P</th>
            {!compact && <th className="text-center py-2 w-10 font-bold">GF</th>}
            {!compact && <th className="text-center py-2 w-10 font-bold">GC</th>}
            <th className="text-center py-2 w-10 font-bold">DG</th>
            <th className="text-center py-2 w-10 font-bold" style={{ color: C.red }}>Pts</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr
              key={row.name}
              className="text-xs transition-colors"
              style={{
                borderBottom: `1px solid ${C.border}33`,
                background: row.isUser ? `${C.red}18` : 'transparent',
                fontWeight: row.isUser ? 700 : 400,
              }}
            >
              <td className="py-1.5 pl-2" style={{ color: C.subtle }}>{idx + 1}</td>
              <td className="py-1.5">
                <span style={{ color: row.isUser ? C.red : C.text }}>
                  {row.isUser ? row.name : row.name.length > 16 ? row.name.slice(0, 14) + '…' : row.name}
                </span>
                {row.isUser && (
                  <span className="ml-1 text-[9px] rounded px-1 py-0.5 font-black" style={{ background: C.red, color: '#FFFFFF' }}>TÚ</span>
                )}
              </td>
              {!compact && <td className="text-center py-1.5" style={{ color: C.subtle }}>{row.played}</td>}
              <td className="text-center py-1.5 font-bold" style={{ color: '#16a34a' }}>{row.won}</td>
              <td className="text-center py-1.5" style={{ color: C.subtle }}>{row.drawn}</td>
              <td className="text-center py-1.5" style={{ color: '#ef4444' }}>{row.lost}</td>
              {!compact && <td className="text-center py-1.5" style={{ color: C.text }}>{row.gf}</td>}
              {!compact && <td className="text-center py-1.5" style={{ color: C.subtle }}>{row.ga}</td>}
              <td className="text-center py-1.5" style={{ color: C.text }}>{row.gd > 0 ? `+${row.gd}` : row.gd}</td>
              <td className="text-center py-1.5 font-black" style={{ color: C.text }}>{row.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── MatchRow ─────────────────────────────────────────────────────────────────

function MatchRow({ match, isNew }: { match: MatchResult; isNew?: boolean }) {
  const won  = match.userGoals > match.rivalGoals;
  const draw = match.userGoals === match.rivalGoals;
  return (
    <div
      className="flex items-center justify-between rounded-xl px-3 py-2.5 border transition-all duration-300"
      style={{
        borderColor: isNew ? C.red : C.border,
        background:  isNew ? `${C.red}0F` : C.card2,
      }}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <span
          className="text-xs font-black px-2 py-1 rounded-lg shrink-0"
          style={{
            background: won ? '#0a3a1a' : draw ? '#1a1500' : '#1a0505',
            color:      won ? '#16a34a' : draw ? '#ca8a04' : '#ef4444',
          }}
        >
          {won ? 'V' : draw ? 'E' : 'D'}
        </span>
        <span className="text-[10px] font-bold shrink-0" style={{ color: C.subtle }}>{match.isHome ? 'Casa' : 'Fuera'}</span>
        <span className="text-xs font-bold truncate" style={{ color: C.text }}>
          {match.rival.team}<span className="font-normal ml-1" style={{ color: C.subtle }}>{match.rival.season}</span>
        </span>
      </div>
      <div className="font-black shrink-0 ml-3 text-sm" style={{ color: C.text }}>
        {match.userGoals}<span className="font-normal mx-1" style={{ color: C.subtle }}>-</span>{match.rivalGoals}
      </div>
    </div>
  );
}

// ─── TeamOverview ─────────────────────────────────────────────────────────────

function TeamOverview({ draft, strength }: { draft: SavedDraft; strength: number }) {
  const slots    = FORMATIONS[draft.formation];
  const starters = draft.picks.filter(p => p.slotIndex < 11).sort((a, b) => a.slotIndex - b.slotIndex);
  const isPrime  = draft.gameMode === 'prime';
  return (
    <div className="rounded-2xl p-5 space-y-4" style={{ background: C.card, border: `1px solid ${C.border}` }}>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-black text-lg" style={{ color: C.text }}>{draft.teamName}</h2>
          <p className="text-xs" style={{ color: C.subtle }}>{draft.formation}{isPrime ? ' · MODO PRIME' : ''}</p>
        </div>
        <div className="text-right">
          <p className="text-xs" style={{ color: C.subtle }}>Fuerza media</p>
          <p className="text-3xl font-black leading-none" style={{ color: isPrime ? C.gold : C.red }}>{strength.toFixed(1)}</p>
        </div>
      </div>
      <div className="space-y-1">
        <p className="text-[10px] font-black tracking-widest uppercase" style={{ color: C.subtle }}>Titulares</p>
        {starters.map(pick => {
          const displayOvr = isPrime && pick.player.primeOverall ? pick.player.primeOverall : pick.player.overall;
          return (
            <div key={pick.slotIndex} className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="w-7 font-bold" style={{ color: C.subtle }}>{slots[pick.slotIndex].position}</span>
                <span style={{ color: C.text }}>{pick.player.shortName}</span>
              </div>
              <div className="flex items-center gap-2" style={{ color: C.subtle }}>
                <span className="truncate max-w-[80px]">{pick.fromTeam} {pick.fromSeason}</span>
                <span className="font-black w-6 text-right" style={{ color: isPrime ? C.gold : C.red }}>{displayOvr}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── LeaderboardSubmit ────────────────────────────────────────────────────────

function LeaderboardSubmit({
  draft, userRow, userPosition, onSubmitted,
}: {
  draft: SavedDraft;
  userRow: StandingsRow;
  userPosition: number;
  onSubmitted: (id: string) => void;
}) {
  const [name,      setName]      = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done,       setDone]       = useState(false);
  const [err,        setErr]        = useState('');

  const handleSubmit = async () => {
    if (!name.trim()) { setErr('Escribe tu nombre'); return; }
    setSubmitting(true);
    setErr('');
    try {
      const players = draft.picks
        .filter(p => p.slotIndex < 11)
        .sort((a, b) => a.slotIndex - b.slotIndex)
        .map(p => ({
          name:     p.player.shortName,
          overall:  (draft.gameMode === 'prime' && p.player.primeOverall) ? p.player.primeOverall : p.player.overall,
          position: FORMATIONS[draft.formation][p.slotIndex].position,
        }));

      const res = await fetch('/api/leaderboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerName: name.trim(),
          points:     userRow.points,
          position:   userPosition,
          gf:         userRow.gf,
          ga:         userRow.ga,
          players,
          primeMode:  draft.gameMode === 'prime',
        }),
      });
      if (!res.ok) throw new Error('Error al guardar');
      const entry: LeaderboardEntry = await res.json();
      // Also save to localStorage
      try {
        const local = JSON.parse(localStorage.getItem('laliga-my-results') ?? '[]') as LeaderboardEntry[];
        local.unshift(entry);
        localStorage.setItem('laliga-my-results', JSON.stringify(local.slice(0, 20)));
      } catch {}
      setDone(true);
      onSubmitted(entry.id);
    } catch {
      setErr('Error al guardar. Inténtalo de nuevo.');
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="rounded-xl p-4 text-center" style={{ background: '#0a1a0a', border: `1px solid #16a34a` }}>
        <p className="font-black" style={{ color: '#16a34a' }}>¡Resultado guardado en el Leaderboard!</p>
        <Link href="/leaderboard" className="text-sm mt-1 block" style={{ color: C.gold }}>Ver Leaderboard Global →</Link>
      </div>
    );
  }

  return (
    <div className="rounded-xl p-4 space-y-3" style={{ background: C.card, border: `1px solid ${C.border}` }}>
      <p className="text-xs font-black tracking-widest uppercase" style={{ color: C.subtle }}>Guardar en Leaderboard</p>
      <div className="flex gap-2">
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Tu nombre / apodo"
          maxLength={30}
          className="flex-1 rounded-lg px-3 py-2 text-sm focus:outline-none"
          style={{ background: C.card2, border: `1px solid ${C.border}`, color: C.text }}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
        />
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="px-4 py-2 rounded-lg font-black text-sm transition-colors"
          style={{ background: submitting ? C.border : C.gold, color: '#000000' }}
        >
          {submitting ? '…' : 'Guardar'}
        </button>
      </div>
      {err && <p className="text-xs" style={{ color: '#ef4444' }}>{err}</p>}
    </div>
  );
}

// ─── SimulationPage ───────────────────────────────────────────────────────────

export default function SimulationPage() {
  const [draft,          setDraft]          = useState<SavedDraft | null>(null);
  const [allRivals,      setAllRivals]      = useState<Rival[]>([]);
  const [chosenRivals,   setChosenRivals]   = useState<Rival[]>([]);
  const [allMatches,     setAllMatches]     = useState<MatchResult[]>([]);
  const [revealedCount,  setRevealedCount]  = useState(0);
  const [simPhase,       setSimPhase]       = useState<SimPhase>('setup');
  const [activeTab,      setActiveTab]      = useState<'results' | 'standings'>('standings');
  const [error,          setError]          = useState('');
  const [topScorer,      setTopScorer]      = useState<{ pick: DraftPick; goals: number } | null>(null);
  const [submittedId,    setSubmittedId]    = useState<string | null>(null);

  const matchListRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const raw = sessionStorage.getItem('laliga-draft');
    if (raw) {
      try { setDraft(JSON.parse(raw) as SavedDraft); }
      catch { setError('Error leyendo el draft. Vuelve a empezar.'); }
    }
    fetch('/api/rivals')
      .then(r => r.json())
      .then((data: Rival[]) => {
        setAllRivals(data);
        setChosenRivals(selectRivals(data, 19));
      })
      .catch(() => setError('Error cargando rivales.'));
  }, []);

  // Reveal one match every 120ms
  useEffect(() => {
    if (simPhase !== 'simulating') return;
    if (revealedCount >= allMatches.length) { setSimPhase('done'); return; }
    const id = setTimeout(() => setRevealedCount(c => c + 1), 120);
    return () => clearTimeout(id);
  }, [simPhase, revealedCount, allMatches.length]);

  // Auto-scroll
  useEffect(() => {
    if (matchListRef.current && simPhase === 'simulating') {
      matchListRef.current.scrollTop = matchListRef.current.scrollHeight;
    }
  }, [revealedCount, simPhase]);

  // Top scorer once done
  useEffect(() => {
    if (simPhase !== 'done' || !draft || allMatches.length === 0) return;
    const totalGoals = allMatches.reduce((s, m) => s + m.userGoals, 0);
    setTopScorer(computeTopScorer(draft.picks, totalGoals));
  }, [simPhase, draft, allMatches]);

  const userStrength = useMemo(
    () => draft ? calcUserStrength(draft.picks, draft.gameMode ?? 'normal') : 50,
    [draft]
  );

  const liveStandings = useMemo(() => {
    if (revealedCount === 0 || allMatches.length === 0) return [];
    return buildLeagueTable(allMatches.slice(0, revealedCount), chosenRivals, draft?.teamName ?? 'Mi Equipo');
  }, [revealedCount, allMatches, chosenRivals, draft]);

  const finalStandings = useMemo(() => {
    if (simPhase !== 'done' || allMatches.length === 0) return [];
    return buildLeagueTable(allMatches, chosenRivals, draft?.teamName ?? 'Mi Equipo');
  }, [simPhase, allMatches, chosenRivals, draft]);

  const userPosition = simPhase === 'done' ? finalStandings.findIndex(r => r.isUser) + 1 : null;
  const userRow      = simPhase === 'done' ? finalStandings.find(r => r.isUser) ?? null   : null;

  const bestPlayer = useMemo(() => {
    if (!draft) return null;
    return [...draft.picks].filter(p => p.slotIndex < 11)
      .sort((a, b) => {
        const ao = (draft.gameMode === 'prime' && a.player.primeOverall) ? a.player.primeOverall : a.player.overall;
        const bo = (draft.gameMode === 'prime' && b.player.primeOverall) ? b.player.primeOverall : b.player.overall;
        return bo - ao;
      })[0] ?? null;
  }, [draft]);

  const unbeatenStreak = useMemo(() => simPhase === 'done' ? longestUnbeaten(allMatches) : 0, [simPhase, allMatches]);
  const memorableMatch  = useMemo(() => simPhase === 'done' ? mostMemorable(allMatches)   : null, [simPhase, allMatches]);

  const startSimulation = () => {
    if (!draft || chosenRivals.length < 19) return;
    const results = simulateSeason(userStrength, chosenRivals, draft.difficulty ?? 'normal');
    setAllMatches(results);
    setRevealedCount(0);
    setSubmittedId(null);
    setTopScorer(null);
    setSimPhase('simulating');
  };

  const handleShare = useCallback(() => {
    if (!draft || userPosition === null || userRow === null) return;
    const msg = getPositionMessage(userPosition);
    downloadShareImage(
      userPosition, msg.title, draft.teamName, draft.formation,
      userRow.points, userRow.gf, userRow.ga,
      draft.picks, FORMATIONS[draft.formation], draft.gameMode === 'prime',
    );
  }, [draft, userPosition, userRow]);

  const handleShareTwitter = useCallback(() => {
    if (!userPosition || !userRow || !draft) return;
    const prime = draft.gameMode === 'prime' ? ' [Modo Prime]' : '';
    const text  = `He acabado ${userPosition}º en LaLiga Sin Partner con ${userRow.points} puntos jugando como ${draft.teamName}${prime}. ¿Puedes superarme? ${window.location.origin}`;
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank');
  }, [userPosition, userRow, draft]);

  // ── Loading / error ────────────────────────────────────────────────────────

  if (!draft && !error) {
    return (
      <main className="min-h-screen flex items-center justify-center" style={{ background: C.bg }}>
        <p style={{ color: C.subtle }}>Cargando…</p>
      </main>
    );
  }
  if (error && !draft) {
    return (
      <main className="min-h-screen flex items-center justify-center" style={{ background: C.bg }}>
        <div className="text-center space-y-3">
          <p style={{ color: '#ef4444' }}>{error}</p>
          <Link href="/draft" className="underline" style={{ color: C.red }}>Volver al draft</Link>
        </div>
      </main>
    );
  }

  const isPrime = draft?.gameMode === 'prime';

  // ── SETUP ──────────────────────────────────────────────────────────────────

  if (simPhase === 'setup' && draft) {
    return (
      <main className="min-h-screen flex flex-col" style={{ background: C.bg2 }}>
        <div className="h-1.5 w-full" style={{ background: `linear-gradient(90deg, ${C.red}, ${C.redBr})` }} />
        <header className="px-4 py-3" style={{ background: C.card, borderBottom: `1px solid ${C.border}` }}>
          <div className="max-w-5xl mx-auto flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black tracking-widest uppercase" style={{ color: C.red }}>LaLiga Sin Partner</p>
              <h1 className="font-black text-lg" style={{ color: C.text }}>
                {draft.teamName}
                {isPrime && (
                  <span className="ml-2 text-xs font-black px-2 py-0.5 rounded" style={{ background: C.gold, color: '#000000' }}>PRIME</span>
                )}
              </h1>
            </div>
            <Link href="/draft" className="text-sm" style={{ color: C.subtle }}>← Nuevo Draft</Link>
          </div>
        </header>

        <div className="flex-1 p-4 md:p-6">
          <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6">
            <TeamOverview draft={draft} strength={userStrength} />

            <div className="space-y-4">
              <div className="rounded-2xl p-5 space-y-2" style={{ background: C.card, border: `1px solid ${C.border}` }}>
                <h3 className="font-black" style={{ color: C.text }}>Rivales ({chosenRivals.length}/19)</h3>
                <p className="text-[10px]" style={{ color: C.subtle }}>Cada equipo aparece una sola vez (sin repetir club entre temporadas)</p>
                {chosenRivals.length === 0 ? (
                  <p className="text-sm" style={{ color: C.subtle }}>Cargando rivales…</p>
                ) : (
                  <div className="space-y-1 max-h-72 overflow-y-auto">
                    {[...chosenRivals].sort((a, b) => b.strengthScore - a.strengthScore).map(r => (
                      <div
                        key={`${r.teamKey}-${r.season}`}
                        className="flex items-center justify-between text-xs py-1"
                        style={{ borderBottom: `1px solid ${C.border}33` }}
                      >
                        <span className="font-bold" style={{ color: C.text }}>
                          {r.team}<span className="font-normal ml-1" style={{ color: C.subtle }}>{r.season}</span>
                        </span>
                        <span className="font-black" style={{ color: C.red }}>{r.strengthScore.toFixed(0)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <button
                onClick={startSimulation}
                disabled={chosenRivals.length < 19}
                className="w-full font-black text-lg py-4 rounded-2xl transition-colors"
                style={{
                  background: chosenRivals.length < 19 ? C.border : `linear-gradient(135deg, ${C.red}, ${C.redBr})`,
                  color: C.text,
                  boxShadow: chosenRivals.length < 19 ? 'none' : '0 8px 24px rgba(200,16,46,0.3)',
                }}
              >
                Simular Temporada →
              </button>

              <div className="rounded-xl p-4 space-y-2" style={{ background: C.card, border: `2px solid ${C.red}22` }}>
                <p className="text-xs font-black tracking-widest uppercase" style={{ color: C.text }}>Objetivo de la temporada</p>
                <div className="space-y-1.5 text-xs">
                  {[
                    { label: '🏆 Ganar la Liga',  note: 'Casi imposible',   color: '#ca8a04' },
                    { label: '⭐ TOP 4',           note: 'Muy difícil',      color: '#16a34a' },
                    { label: '✅ TOP 8',           note: 'Difícil',          color: '#2563eb' },
                    { label: '⚠️ Descenso',        note: 'Puesto 18–20',     color: '#ef4444' },
                  ].map(({ label, note, color }) => (
                    <div key={label} className="flex items-center justify-between">
                      <span className="font-bold" style={{ color: C.text }}>{label}</span>
                      <span className="font-black text-[10px]" style={{ color }}>{note}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="h-1.5 w-full" style={{ background: `linear-gradient(90deg, ${C.red}, ${C.redBr})` }} />
      </main>
    );
  }

  // ── SIMULATING + DONE ──────────────────────────────────────────────────────

  const visibleMatches = allMatches.slice(0, revealedCount);
  const standings      = simPhase === 'done' ? finalStandings : liveStandings;
  const posMsg         = userPosition !== null ? getPositionMessage(userPosition) : null;

  return (
    <main className="min-h-screen flex flex-col" style={{ background: C.bg2 }}>
      <div className="h-1.5 w-full" style={{ background: `linear-gradient(90deg, ${C.red}, ${C.redBr})` }} />

      <header className="px-4 py-3 sticky top-0 z-10" style={{ background: C.card, borderBottom: `1px solid ${C.border}` }}>
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[10px] font-black tracking-widest uppercase" style={{ color: C.red }}>LaLiga Sin Partner</p>
            <h1 className="font-black text-base leading-tight truncate" style={{ color: C.text }}>{draft?.teamName}</h1>
          </div>
          <div className="flex-1 max-w-xs hidden sm:block">
            <div className="flex justify-between text-xs mb-1" style={{ color: C.subtle }}>
              <span>Jornada {revealedCount}/{allMatches.length}</span>
              {simPhase === 'done' && <span style={{ color: '#16a34a', fontWeight: 700 }}>Temporada completa</span>}
            </div>
            <div className="h-2 rounded-full overflow-hidden" style={{ background: C.border }}>
              <div
                className="h-full rounded-full transition-all duration-150"
                style={{
                  width: allMatches.length > 0 ? `${(revealedCount / allMatches.length) * 100}%` : '0%',
                  background: C.red,
                }}
              />
            </div>
          </div>
          <Link href="/draft" className="text-sm shrink-0" style={{ color: C.subtle }}>← Nuevo Draft</Link>
        </div>
      </header>

      <div className="flex-1 p-4 md:p-6">
        <div className="max-w-6xl mx-auto space-y-6">

          {/* Results banner */}
          {simPhase === 'done' && userPosition !== null && userRow !== null && posMsg && draft && (
            <div className="rounded-2xl overflow-hidden" style={{ border: `2px solid ${posMsg.color}44` }}>
              <div className="px-6 py-6 text-center" style={{ background: posMsg.bg }}>
                <p className="text-5xl font-black leading-none" style={{ color: posMsg.color }}>
                  {userPosition}º
                </p>
                <p className="text-xl font-black mt-2" style={{ color: posMsg.color }}>{posMsg.title}</p>
                <p className="text-sm mt-1" style={{ color: C.muted }}>{posMsg.sub}</p>
                {isPrime && (
                  <span className="inline-block mt-2 text-xs font-black px-3 py-1 rounded-full" style={{ background: C.gold, color: '#000' }}>
                    MODO PRIME
                  </span>
                )}

                <div className="flex flex-wrap justify-center gap-4 mt-4 text-sm">
                  <span className="font-black text-2xl" style={{ color: C.text }}>{userRow.points} pts</span>
                  <span className="self-center" style={{ color: C.subtle }}>·</span>
                  <span className="font-bold" style={{ color: '#16a34a' }}>{userRow.won}V</span>
                  <span className="font-bold" style={{ color: C.subtle }}>{userRow.drawn}E</span>
                  <span className="font-bold" style={{ color: '#ef4444' }}>{userRow.lost}D</span>
                  <span className="self-center" style={{ color: C.subtle }}>·</span>
                  <span className="font-bold" style={{ color: C.text }}>{userRow.gf} GF / {userRow.ga} GC</span>
                </div>
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-2 md:grid-cols-4" style={{ background: C.card, borderTop: `1px solid ${C.border}` }}>
                {bestPlayer && (
                  <div className="p-4 text-center" style={{ borderRight: `1px solid ${C.border}` }}>
                    <p className="text-[10px] font-black tracking-widest uppercase mb-1" style={{ color: C.subtle }}>Mejor jugador</p>
                    <p className="font-black text-sm leading-tight" style={{ color: C.text }}>{bestPlayer.player.shortName}</p>
                    <p className="text-2xl font-black mt-0.5" style={{ color: isPrime ? C.gold : C.red }}>
                      {isPrime && bestPlayer.player.primeOverall ? bestPlayer.player.primeOverall : bestPlayer.player.overall}
                    </p>
                  </div>
                )}
                {topScorer && (
                  <div className="p-4 text-center" style={{ borderRight: `1px solid ${C.border}` }}>
                    <p className="text-[10px] font-black tracking-widest uppercase mb-1" style={{ color: C.subtle }}>Máximo goleador</p>
                    <p className="font-black text-sm leading-tight" style={{ color: C.text }}>{topScorer.pick.player.shortName}</p>
                    <p className="text-2xl font-black mt-0.5" style={{ color: C.red }}>{topScorer.goals} goles</p>
                  </div>
                )}
                <div className="p-4 text-center" style={{ borderRight: `1px solid ${C.border}` }}>
                  <p className="text-[10px] font-black tracking-widest uppercase mb-1" style={{ color: C.subtle }}>Racha invicto</p>
                  <p className="text-2xl font-black mt-1" style={{ color: C.text }}>{unbeatenStreak}</p>
                  <p className="text-xs" style={{ color: C.subtle }}>partidos</p>
                </div>
                {memorableMatch && (
                  <div className="p-4 text-center">
                    <p className="text-[10px] font-black tracking-widest uppercase mb-1" style={{ color: C.subtle }}>Partido épico</p>
                    <p className="font-black text-sm leading-tight" style={{ color: C.text }}>{memorableMatch.rival.team}</p>
                    <p className="text-xl font-black mt-0.5" style={{ color: memorableMatch.userGoals > memorableMatch.rivalGoals ? '#16a34a' : '#ef4444' }}>
                      {memorableMatch.userGoals}–{memorableMatch.rivalGoals}
                    </p>
                  </div>
                )}
              </div>

              {/* Share buttons */}
              <div className="px-4 py-3 flex flex-wrap gap-2 justify-center" style={{ background: C.bg2, borderTop: `1px solid ${C.border}` }}>
                <button
                  onClick={handleShare}
                  className="flex items-center gap-2 font-black text-sm px-5 py-2.5 rounded-xl transition-colors"
                  style={{ background: C.red, color: C.text }}
                >
                  Descargar imagen
                </button>
                <button
                  onClick={handleShareTwitter}
                  className="flex items-center gap-2 font-black text-sm px-5 py-2.5 rounded-xl transition-colors"
                  style={{ background: '#1a1a1a', border: `1px solid ${C.border}`, color: C.text }}
                >
                  Compartir en X
                </button>
              </div>
            </div>
          )}

          {/* Leaderboard submit */}
          {simPhase === 'done' && draft && userRow && userPosition !== null && !submittedId && (
            <LeaderboardSubmit
              draft={draft}
              userRow={userRow}
              userPosition={userPosition}
              onSubmitted={setSubmittedId}
            />
          )}
          {simPhase === 'done' && submittedId && (
            <div className="rounded-xl p-4 text-center" style={{ background: '#0a1a0a', border: `1px solid #16a34a` }}>
              <p className="font-black" style={{ color: '#16a34a' }}>¡Guardado en el Leaderboard!</p>
              <Link href="/leaderboard" className="text-sm mt-1 block" style={{ color: C.gold }}>Ver Leaderboard Global →</Link>
            </div>
          )}

          {/* Main grid */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">

            <div className="rounded-2xl overflow-hidden" style={{ background: C.card, border: `1px solid ${C.border}` }}>
              {simPhase === 'done' && (
                <div className="flex" style={{ borderBottom: `1px solid ${C.border}` }}>
                  {(['results', 'standings'] as const).map(tab => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className="flex-1 py-3 text-sm font-bold transition-colors"
                      style={{
                        borderBottom: activeTab === tab ? `2px solid ${C.red}` : 'none',
                        color: activeTab === tab ? C.red : C.subtle,
                      }}
                    >
                      {tab === 'results' ? 'Resultados' : 'Clasificación completa'}
                    </button>
                  ))}
                </div>
              )}

              {(simPhase === 'simulating' || (simPhase === 'done' && activeTab === 'results')) && (
                <>
                  {simPhase === 'simulating' && (
                    <div className="px-4 pt-4 pb-1 flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: C.red }} />
                      <p className="font-black text-sm" style={{ color: C.text }}>Simulando en directo…</p>
                    </div>
                  )}
                  <div ref={matchListRef} className="p-4 space-y-2 max-h-[500px] overflow-y-auto">
                    {visibleMatches.length === 0 ? (
                      <p className="text-center py-10 text-sm" style={{ color: C.subtle }}>Los resultados aparecerán aquí…</p>
                    ) : (
                      visibleMatches.map((m, i) => (
                        <MatchRow
                          key={m.matchday}
                          match={m}
                          isNew={simPhase === 'simulating' && i === visibleMatches.length - 1}
                        />
                      ))
                    )}
                  </div>
                </>
              )}

              {simPhase === 'done' && activeTab === 'standings' && (
                <div className="p-4"><StandingsTable rows={finalStandings} /></div>
              )}
            </div>

            {/* Live standings sidebar */}
            <div className="rounded-2xl overflow-hidden self-start sticky top-24" style={{ background: C.card, border: `1px solid ${C.border}` }}>
              <div className="px-4 py-3 flex items-center gap-2" style={{ borderBottom: `1px solid ${C.border}` }}>
                <div
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ background: simPhase === 'simulating' ? C.red : '#16a34a', animation: simPhase === 'simulating' ? 'pulse 2s infinite' : undefined }}
                />
                <p className="font-black text-sm" style={{ color: C.text }}>Clasificación en vivo</p>
              </div>
              <div className="p-2">
                {standings.length > 0 ? (
                  <StandingsTable rows={standings} compact />
                ) : (
                  <p className="text-center py-6 text-xs" style={{ color: C.subtle }}>Aparecerá al comenzar</p>
                )}
              </div>
            </div>
          </div>

          {/* Post-simulation: only "Jugar de nuevo" */}
          {simPhase === 'done' && (
            <div className="flex justify-center">
              <Link
                href="/"
                className="px-12 py-3 rounded-2xl font-black transition-colors text-center"
                style={{
                  background: `linear-gradient(135deg, ${C.red}, ${C.redBr})`,
                  color: C.text,
                  boxShadow: '0 8px 24px rgba(200,16,46,0.3)',
                }}
              >
                Jugar de nuevo
              </Link>
            </div>
          )}
        </div>
      </div>

      <div className="h-1.5 w-full" style={{ background: `linear-gradient(90deg, ${C.red}, ${C.redBr})` }} />
    </main>
  );
}
