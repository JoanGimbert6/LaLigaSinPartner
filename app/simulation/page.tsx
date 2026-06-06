'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import Link from 'next/link';
import type { Formation, PositionSlot, Rival, DraftPick, MatchResult, StandingsRow, Difficulty } from '@/lib/types';
import { FORMATIONS, goalScoringWeight } from '@/lib/formation';
import { calcUserStrength, simulateSeason, selectRivals, buildLeagueTable } from '@/lib/simulation';

type SimPhase = 'setup' | 'simulating' | 'done';

interface SavedDraft {
  formation:   Formation;
  teamName:    string;
  picks:       DraftPick[];
  difficulty?: Difficulty;
}

// ─── Position message ─────────────────────────────────────────────────────────

function getPositionMessage(pos: number): { title: string; sub: string; color: string } {
  if (pos === 1)   return { title: '¡Campeón eterno de La Liga!',   sub: '¡Lo has conseguido! El mejor.',          color: 'text-yellow-600' };
  if (pos <= 4)    return { title: '¡Champions League conseguida!',  sub: 'Entre los 4 mejores. Increíble.',         color: 'text-green-600'  };
  if (pos <= 6)    return { title: 'Europa League',                  sub: 'Europa te espera. Bien hecho.',           color: 'text-blue-600'   };
  if (pos <= 10)   return { title: 'Zona cómoda',                   sub: 'Temporada sólida. Sin sobresaltos.',       color: 'text-ll-navy'    };
  if (pos <= 17)   return { title: 'Salvación agónica',             sub: 'Uno más en Primera. Por los pelos.',      color: 'text-ll-muted'   };
  return             { title: 'Descenso. Inténtalo de nuevo.',       sub: 'La Segunda División te espera.',          color: 'text-red-500'    };
}

// ─── Season stats helpers ─────────────────────────────────────────────────────

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
  position: number,
  message: string,
  teamName: string,
  formation: string,
  points: number,
  gf: number,
  ga: number,
  picks: DraftPick[],
  formationSlots: PositionSlot[],
) {
  const W = 600, H = 860;
  const cv  = document.createElement('canvas');
  cv.width  = W;
  cv.height = H;
  const ctx = cv.getContext('2d')!;

  // Background
  ctx.fillStyle = '#FF4B00';
  ctx.fillRect(0, 0, W, H);

  // Top accent stripe
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.fillRect(0, 0, W, 6);

  // Game title
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.font = 'bold 15px system-ui, Arial';
  ctx.textAlign = 'center';
  ctx.fillText('LALIGA SIN PARTNER', W / 2, 40);

  // Team name
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 26px system-ui, Arial';
  ctx.fillText(teamName.toUpperCase(), W / 2, 78);

  // Position (big)
  ctx.font = `bold 74px system-ui, Arial`;
  ctx.fillText(position === 1 ? 'CAMPEON!' : `${position}º PUESTO`, W / 2, 168);

  // Message
  ctx.font = 'bold 19px system-ui, Arial';
  ctx.fillStyle = 'rgba(255,255,255,0.88)';
  ctx.fillText(message, W / 2, 207);

  // Stats row
  ctx.font = 'bold 20px system-ui, Arial';
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(`${points} pts  ·  ${gf} GF / ${ga} GC`, W / 2, 248);

  // Divider
  ctx.strokeStyle = 'rgba(255,255,255,0.3)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(40, 268); ctx.lineTo(W - 40, 268); ctx.stroke();

  // Formation header
  ctx.font = 'bold 13px system-ui, Arial';
  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  ctx.fillText(`MI XI · ${formation}`, W / 2, 293);

  // Players (two columns)
  const starters = [...picks].filter(p => p.slotIndex < 11).sort((a, b) => a.slotIndex - b.slotIndex);
  const colW = (W - 80) / 2;

  starters.forEach((pick, i) => {
    const col = i < 6 ? 0 : 1;
    const row = i < 6 ? i : i - 6;
    const x   = 40 + col * (colW + 20);
    const y   = 318 + row * 37;

    // Position pill
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.fillRect(x, y - 13, 30, 16);
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.font = 'bold 10px system-ui, Arial';
    ctx.textAlign = 'left';
    ctx.fillText(formationSlots[pick.slotIndex].position, x + 3, y);

    // Name
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '13px system-ui, Arial';
    ctx.fillText(pick.player.shortName.slice(0, 17), x + 34, y);

    // OVR
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    ctx.font = 'bold 12px system-ui, Arial';
    ctx.textAlign = 'right';
    ctx.fillText(String(pick.player.overall), x + colW - 2, y);
    ctx.textAlign = 'left';
  });

  // Bottom accent stripe
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.fillRect(0, H - 6, W, 6);

  // Footer
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.font = '13px system-ui, Arial';
  ctx.fillText('¿Puedes superarme? · #LaLigaSinPartner', W / 2, H - 22);

  // Download
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
          <tr className="text-ll-muted text-xs border-b border-ll-border">
            <th className="text-left py-2 pl-2 w-6 font-bold">#</th>
            <th className="text-left py-2 font-bold">Equipo</th>
            {!compact && <th className="text-center py-2 w-8 font-bold">PJ</th>}
            <th className="text-center py-2 w-8 font-bold">G</th>
            <th className="text-center py-2 w-8 font-bold">E</th>
            <th className="text-center py-2 w-8 font-bold">P</th>
            {!compact && <th className="text-center py-2 w-10 font-bold">GF</th>}
            {!compact && <th className="text-center py-2 w-10 font-bold">GC</th>}
            <th className="text-center py-2 w-10 font-bold">DG</th>
            <th className="text-center py-2 w-10 font-bold text-ll-orange">Pts</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr key={row.name} className={[
              'border-b border-ll-border/50 transition-colors text-xs',
              row.isUser ? 'bg-orange-50 font-bold' : 'hover:bg-ll-light',
            ].join(' ')}>
              <td className="py-1.5 pl-2 text-ll-muted">{idx + 1}</td>
              <td className="py-1.5">
                <span className={row.isUser ? 'text-ll-orange font-black' : 'text-ll-navy'}>
                  {row.isUser ? row.name : row.name.length > 16 ? row.name.slice(0, 14) + '…' : row.name}
                </span>
                {row.isUser && (
                  <span className="ml-1 text-[9px] bg-ll-orange text-white rounded px-1 py-0.5 font-black">TÚ</span>
                )}
              </td>
              {!compact && <td className="text-center py-1.5 text-ll-muted">{row.played}</td>}
              <td className="text-center py-1.5 text-green-600 font-bold">{row.won}</td>
              <td className="text-center py-1.5 text-ll-muted">{row.drawn}</td>
              <td className="text-center py-1.5 text-red-500">{row.lost}</td>
              {!compact && <td className="text-center py-1.5 text-ll-navy">{row.gf}</td>}
              {!compact && <td className="text-center py-1.5 text-ll-muted">{row.ga}</td>}
              <td className="text-center py-1.5 text-ll-navy">{row.gd > 0 ? `+${row.gd}` : row.gd}</td>
              <td className="text-center py-1.5 font-black text-ll-navy">{row.points}</td>
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
    <div className={[
      'flex items-center justify-between rounded-xl px-3 py-2.5 border transition-all duration-300',
      isNew ? 'border-ll-orange bg-orange-50' : 'border-ll-border bg-ll-card',
    ].join(' ')}>
      <div className="flex items-center gap-2.5 min-w-0">
        <span className={[
          'text-xs font-black px-2 py-1 rounded-lg shrink-0',
          won  ? 'bg-green-100 text-green-700' :
          draw ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-600',
        ].join(' ')}>{won ? 'V' : draw ? 'E' : 'D'}</span>
        <span className="text-[10px] text-ll-muted font-bold shrink-0">{match.isHome ? 'Casa' : 'Fuera'}</span>
        <span className="text-ll-navy text-xs font-bold truncate">
          {match.rival.team}<span className="text-ll-muted font-normal ml-1">{match.rival.season}</span>
        </span>
      </div>
      <div className="font-black shrink-0 ml-3 text-ll-navy text-sm">
        {match.userGoals}<span className="text-ll-muted font-normal mx-1">-</span>{match.rivalGoals}
      </div>
    </div>
  );
}

// ─── TeamOverview ─────────────────────────────────────────────────────────────

function TeamOverview({ draft, strength }: { draft: SavedDraft; strength: number }) {
  const slots    = FORMATIONS[draft.formation];
  const starters = draft.picks.filter(p => p.slotIndex < 11).sort((a, b) => a.slotIndex - b.slotIndex);
  return (
    <div className="bg-ll-card rounded-2xl border border-ll-border p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-black text-ll-navy text-lg">{draft.teamName}</h2>
          <p className="text-ll-muted text-xs">{draft.formation}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-ll-muted">Fuerza media</p>
          <p className="text-3xl font-black text-ll-orange leading-none">{strength.toFixed(1)}</p>
        </div>
      </div>
      <div className="space-y-1">
        <p className="text-[10px] font-black text-ll-muted tracking-widest uppercase">Titulares</p>
        {starters.map(pick => (
          <div key={pick.slotIndex} className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="text-ll-muted w-7 font-bold">{slots[pick.slotIndex].position}</span>
              <span className="text-ll-navy">{pick.player.shortName}</span>
            </div>
            <div className="flex items-center gap-2 text-ll-muted">
              <span className="truncate max-w-[80px]">{pick.fromTeam} {pick.fromSeason}</span>
              <span className="font-black text-ll-orange w-6 text-right">{pick.player.overall}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── SimulationPage ───────────────────────────────────────────────────────────

export default function SimulationPage() {
  const [draft,        setDraft]        = useState<SavedDraft | null>(null);
  const [allRivals,    setAllRivals]    = useState<Rival[]>([]);
  const [chosenRivals, setChosenRivals] = useState<Rival[]>([]);
  const [allMatches,   setAllMatches]   = useState<MatchResult[]>([]);
  const [revealedCount, setRevealedCount] = useState(0);
  const [simPhase,     setSimPhase]     = useState<SimPhase>('setup');
  const [activeTab,    setActiveTab]    = useState<'results' | 'standings'>('standings');
  const [error,        setError]        = useState('');
  const [topScorer,    setTopScorer]    = useState<{ pick: DraftPick; goals: number } | null>(null);

  const matchListRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const raw = sessionStorage.getItem('laliga-draft');
    if (raw) {
      try { setDraft(JSON.parse(raw) as SavedDraft); }
      catch { setError('Error leyendo el draft. Vuelve a empezar.'); }
    }
    fetch('/api/rivals')
      .then(r => r.json())
      .then((data: Rival[]) => { setAllRivals(data); setChosenRivals(selectRivals(data, 19)); })
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

  // Compute top scorer once when done
  useEffect(() => {
    if (simPhase !== 'done' || !draft || allMatches.length === 0) return;
    const totalGoals = allMatches.reduce((s, m) => s + m.userGoals, 0);
    setTopScorer(computeTopScorer(draft.picks, totalGoals));
  }, [simPhase, draft, allMatches]);

  const userStrength   = useMemo(() => draft ? calcUserStrength(draft.picks) : 70, [draft]);
  const liveStandings  = useMemo(() => {
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
    return [...draft.picks].filter(p => p.slotIndex < 11).sort((a, b) => b.player.overall - a.player.overall)[0] ?? null;
  }, [draft]);

  const unbeatenStreak = useMemo(() => simPhase === 'done' ? longestUnbeaten(allMatches) : 0, [simPhase, allMatches]);
  const memorableMatch  = useMemo(() => simPhase === 'done' ? mostMemorable(allMatches)   : null, [simPhase, allMatches]);

  const startSimulation = () => {
    if (!draft || chosenRivals.length < 19) return;
    const difficulty = draft.difficulty ?? 'normal';
    const results = simulateSeason(userStrength, chosenRivals, difficulty);
    setAllMatches(results);
    setRevealedCount(0);
    setSimPhase('simulating');
  };

  const resetSimulation = () => {
    setChosenRivals(selectRivals(allRivals, 19));
    setAllMatches([]);
    setRevealedCount(0);
    setTopScorer(null);
    setSimPhase('setup');
  };

  const handleShare = useCallback(() => {
    if (!draft || userPosition === null || userRow === null) return;
    const msg = getPositionMessage(userPosition);
    downloadShareImage(
      userPosition, msg.title, draft.teamName, draft.formation,
      userRow.points, userRow.gf, userRow.ga,
      draft.picks, FORMATIONS[draft.formation],
    );
  }, [draft, userPosition, userRow]);

  const handleShareTwitter = useCallback(() => {
    if (!userPosition || !userRow || !draft) return;
    const text = `He acabado ${userPosition}º en LaLiga Sin Partner con ${userRow.points} puntos jugando como ${draft.teamName}. ¿Puedes superarme? ${window.location.origin}`;
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank');
  }, [userPosition, userRow, draft]);

  // ── Loading / error ──────────────────────────────────────────────────────────

  if (!draft && !error) {
    return <main className="min-h-screen bg-white flex items-center justify-center"><p className="text-ll-muted">Cargando…</p></main>;
  }
  if (error && !draft) {
    return (
      <main className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center space-y-3">
          <p className="text-red-500">{error}</p>
          <Link href="/draft" className="text-ll-orange underline">Volver al draft</Link>
        </div>
      </main>
    );
  }

  // ────────────────────────────────────────────────────────────────────────────
  // ── SETUP ───────────────────────────────────────────────────────────────────
  // ────────────────────────────────────────────────────────────────────────────

  if (simPhase === 'setup' && draft) {
    return (
      <main className="min-h-screen bg-ll-light flex flex-col">
        <div className="h-1.5 bg-ll-orange w-full" />
        <header className="bg-ll-card border-b border-ll-border px-4 py-3">
          <div className="max-w-5xl mx-auto flex items-center justify-between">
            <div>
              <p className="text-[10px] text-ll-orange font-black tracking-widest uppercase">LaLiga Sin Partner</p>
              <h1 className="font-black text-ll-navy text-lg">{draft.teamName}</h1>
            </div>
            <Link href="/draft" className="text-ll-muted hover:text-ll-navy text-sm">← Nuevo Draft</Link>
          </div>
        </header>

        <div className="flex-1 p-4 md:p-6">
          <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6">
            <TeamOverview draft={draft} strength={userStrength} />

            <div className="space-y-4">
              <div className="bg-ll-card rounded-2xl border border-ll-border p-5 shadow-sm">
                <h3 className="font-black text-ll-navy mb-3">Rivales ({chosenRivals.length}/19)</h3>
                {chosenRivals.length === 0 ? (
                  <p className="text-ll-muted text-sm">Cargando rivales…</p>
                ) : (
                  <div className="space-y-1 max-h-72 overflow-y-auto">
                    {[...chosenRivals].sort((a, b) => b.strengthScore - a.strengthScore).map(r => (
                      <div key={`${r.teamKey}-${r.season}`} className="flex items-center justify-between text-xs py-1 border-b border-ll-border/30 last:border-0">
                        <span className="text-ll-navy font-bold">{r.team}<span className="text-ll-muted font-normal ml-1">{r.season}</span></span>
                        <span className="text-ll-orange font-black">{r.strengthScore.toFixed(0)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <button
                onClick={startSimulation}
                disabled={chosenRivals.length < 19}
                className="w-full bg-ll-orange hover:bg-orange-600 disabled:bg-ll-border disabled:text-ll-muted text-white font-black text-lg py-4 rounded-2xl transition-colors shadow-lg shadow-orange-500/20"
              >
                Simular Temporada →
              </button>

              <div className="rounded-xl border-2 border-ll-orange/20 bg-ll-orange/5 p-4 space-y-2">
                <p className="text-xs font-black text-ll-navy tracking-widest uppercase">Objetivo de la temporada</p>
                <div className="space-y-1.5 text-xs">
                  {[
                    { label: '🏆 Ganar la Liga',  note: 'Casi imposible',   color: 'text-yellow-600' },
                    { label: '⭐ TOP 4',           note: 'Muy difícil',      color: 'text-green-600'  },
                    { label: '✅ TOP 8',           note: 'Difícil',          color: 'text-blue-600'   },
                    { label: '⚠️ Descenso',        note: 'Puesto 18–20',     color: 'text-red-500'    },
                  ].map(({ label, note, color }) => (
                    <div key={label} className="flex items-center justify-between">
                      <span className="text-ll-navy font-bold">{label}</span>
                      <span className={`font-black text-[10px] ${color}`}>{note}</span>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-ll-muted leading-snug pt-1 border-t border-ll-border">
                  Los rivales juegan siempre en su estadio. Barça y Madrid en su época dorada son imbatibles.
                  {draft.difficulty === 'hard' && ' · Modo DIFÍCIL: rivales +20%.'}
                </p>
              </div>
            </div>
          </div>
        </div>
        <div className="h-1.5 bg-ll-orange w-full" />
      </main>
    );
  }

  // ────────────────────────────────────────────────────────────────────────────
  // ── SIMULATING + DONE ───────────────────────────────────────────────────────
  // ────────────────────────────────────────────────────────────────────────────

  const visibleMatches = allMatches.slice(0, revealedCount);
  const standings      = simPhase === 'done' ? finalStandings : liveStandings;
  const posMsg         = userPosition !== null ? getPositionMessage(userPosition) : null;

  return (
    <main className="min-h-screen bg-ll-light flex flex-col">
      <div className="h-1.5 bg-ll-orange w-full" />

      <header className="bg-ll-card border-b border-ll-border px-4 py-3 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[10px] text-ll-orange font-black tracking-widest uppercase">LaLiga Sin Partner</p>
            <h1 className="font-black text-ll-navy text-base leading-tight truncate">{draft?.teamName}</h1>
          </div>
          <div className="flex-1 max-w-xs hidden sm:block">
            <div className="flex justify-between text-xs text-ll-muted mb-1">
              <span>Jornada {revealedCount}/{allMatches.length}</span>
              {simPhase === 'done' && <span className="text-green-600 font-bold">Temporada completa</span>}
            </div>
            <div className="h-2 bg-ll-border rounded-full overflow-hidden">
              <div className="h-full bg-ll-orange rounded-full transition-all duration-150"
                style={{ width: allMatches.length > 0 ? `${(revealedCount / allMatches.length) * 100}%` : '0%' }} />
            </div>
          </div>
          <Link href="/draft" className="text-ll-muted hover:text-ll-navy text-sm shrink-0">← Nuevo Draft</Link>
        </div>
      </header>

      <div className="flex-1 p-4 md:p-6">
        <div className="max-w-6xl mx-auto space-y-6">

          {/* ── Results banner (done) ── */}
          {simPhase === 'done' && userPosition !== null && userRow !== null && posMsg && draft && (
            <div className={[
              'rounded-2xl border-2 overflow-hidden',
              userPosition === 1 ? 'border-yellow-400' : userPosition <= 4 ? 'border-green-400' : userPosition > 17 ? 'border-red-300' : 'border-ll-border',
            ].join(' ')}>
              {/* Top: position + message */}
              <div className={[
                'px-6 py-6 text-center',
                userPosition === 1 ? 'bg-yellow-50' : userPosition <= 4 ? 'bg-green-50' : userPosition > 17 ? 'bg-red-50' : 'bg-ll-card',
              ].join(' ')}>
                <p className={`text-5xl font-black leading-none ${posMsg.color}`}>
                  {userPosition}º
                </p>
                <p className={`text-xl font-black mt-2 ${posMsg.color}`}>{posMsg.title}</p>
                <p className="text-ll-muted text-sm mt-1">{posMsg.sub}</p>

                {/* Main stats */}
                <div className="flex flex-wrap justify-center gap-4 mt-4 text-sm">
                  <span className="font-black text-ll-navy text-2xl">{userRow.points} pts</span>
                  <span className="text-ll-muted self-center">·</span>
                  <span className="text-green-600 font-bold">{userRow.won}V</span>
                  <span className="text-ll-muted font-bold">{userRow.drawn}E</span>
                  <span className="text-red-500 font-bold">{userRow.lost}D</span>
                  <span className="text-ll-muted self-center">·</span>
                  <span className="text-ll-navy font-bold">{userRow.gf} GF / {userRow.ga} GC</span>
                </div>
              </div>

              {/* Season stats grid */}
              <div className="bg-white border-t border-ll-border grid grid-cols-2 md:grid-cols-4 divide-x divide-ll-border">
                {bestPlayer && (
                  <div className="p-4 text-center">
                    <p className="text-[10px] font-black text-ll-muted tracking-widest uppercase mb-1">Mejor jugador</p>
                    <p className="font-black text-ll-navy text-sm leading-tight">{bestPlayer.player.shortName}</p>
                    <p className="text-2xl font-black text-ll-orange mt-0.5">{bestPlayer.player.overall}</p>
                  </div>
                )}
                {topScorer && (
                  <div className="p-4 text-center">
                    <p className="text-[10px] font-black text-ll-muted tracking-widest uppercase mb-1">Máximo goleador</p>
                    <p className="font-black text-ll-navy text-sm leading-tight">{topScorer.pick.player.shortName}</p>
                    <p className="text-2xl font-black text-ll-orange mt-0.5">{topScorer.goals} goles</p>
                  </div>
                )}
                <div className="p-4 text-center">
                  <p className="text-[10px] font-black text-ll-muted tracking-widest uppercase mb-1">Racha invicto</p>
                  <p className="text-2xl font-black text-ll-navy mt-1">{unbeatenStreak}</p>
                  <p className="text-xs text-ll-muted">partidos</p>
                </div>
                {memorableMatch && (
                  <div className="p-4 text-center">
                    <p className="text-[10px] font-black text-ll-muted tracking-widest uppercase mb-1">Partido épico</p>
                    <p className="font-black text-ll-navy text-sm leading-tight">{memorableMatch.rival.team}</p>
                    <p className={[
                      'text-xl font-black mt-0.5',
                      memorableMatch.userGoals > memorableMatch.rivalGoals ? 'text-green-600' : 'text-red-500',
                    ].join(' ')}>
                      {memorableMatch.userGoals}–{memorableMatch.rivalGoals}
                    </p>
                  </div>
                )}
              </div>

              {/* Share buttons */}
              <div className="bg-ll-light border-t border-ll-border px-4 py-3 flex flex-wrap gap-2 justify-center">
                <button
                  onClick={handleShare}
                  className="flex items-center gap-2 bg-ll-orange hover:bg-orange-600 text-white font-black text-sm px-5 py-2.5 rounded-xl transition-colors shadow-md shadow-orange-500/20"
                >
                  Descargar imagen
                </button>
                <button
                  onClick={handleShareTwitter}
                  className="flex items-center gap-2 bg-ll-navy hover:bg-black text-white font-black text-sm px-5 py-2.5 rounded-xl transition-colors"
                >
                  Compartir en X
                </button>
              </div>
            </div>
          )}

          {/* ── Main grid ── */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">

            {/* Match list / standings panel */}
            <div className="bg-ll-card rounded-2xl border border-ll-border shadow-sm overflow-hidden">
              {simPhase === 'done' && (
                <div className="flex border-b border-ll-border">
                  {(['results', 'standings'] as const).map(tab => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={[
                        'flex-1 py-3 text-sm font-bold transition-colors',
                        activeTab === tab ? 'border-b-2 border-ll-orange text-ll-orange' : 'text-ll-muted hover:text-ll-navy',
                      ].join(' ')}
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
                      <div className="w-2 h-2 rounded-full bg-ll-orange animate-pulse" />
                      <p className="text-ll-navy font-black text-sm">Simulando en directo…</p>
                    </div>
                  )}
                  <div ref={matchListRef} className="p-4 space-y-2 max-h-[500px] overflow-y-auto">
                    {visibleMatches.length === 0 ? (
                      <p className="text-center text-ll-muted py-10 text-sm">Los resultados aparecerán aquí…</p>
                    ) : (
                      visibleMatches.map((m, i) => (
                        <MatchRow key={m.matchday} match={m} isNew={simPhase === 'simulating' && i === visibleMatches.length - 1} />
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
            <div className="bg-ll-card rounded-2xl border border-ll-border shadow-sm overflow-hidden self-start sticky top-24">
              <div className="px-4 py-3 border-b border-ll-border flex items-center gap-2">
                <div className={['w-2 h-2 rounded-full shrink-0', simPhase === 'simulating' ? 'bg-ll-orange animate-pulse' : 'bg-green-500'].join(' ')} />
                <p className="font-black text-ll-navy text-sm">Clasificación en vivo</p>
              </div>
              <div className="p-2">
                {standings.length > 0 ? (
                  <StandingsTable rows={standings} compact />
                ) : (
                  <p className="text-center text-ll-muted py-6 text-xs">Aparecerá al comenzar</p>
                )}
              </div>
            </div>
          </div>

          {/* Post-simulation buttons */}
          {simPhase === 'done' && (
            <div className="flex gap-3">
              <button
                onClick={resetSimulation}
                className="flex-1 bg-ll-card hover:bg-ll-light border-2 border-ll-border text-ll-navy font-black py-3 rounded-2xl transition-colors"
              >
                Repetir Temporada
              </button>
              <Link
                href="/draft"
                className="flex-1 bg-ll-orange hover:bg-orange-600 text-white font-black py-3 rounded-2xl transition-colors text-center shadow-lg shadow-orange-500/20"
              >
                Nuevo Draft
              </Link>
            </div>
          )}
        </div>
      </div>

      <div className="h-1.5 bg-ll-orange w-full" />
    </main>
  );
}
