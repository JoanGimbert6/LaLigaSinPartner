'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { Formation, Player, DraftPick, PositionCategory, Difficulty, GameMode } from '@/lib/types';
import { FORMATIONS, FORMATION_PITCH_ROWS, TOTAL_PICKS, mapPositionToSlot, getPlayerSlotPositions } from '@/lib/formation';

// ─── Local types ──────────────────────────────────────────────────────────────

interface DraftTeam { clubName: string; season: string; }
type Phase     = 'setup' | 'rolling' | 'picking' | 'placing';
type SlotState = 'empty' | 'filled' | 'valid' | 'invalid';

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
  field:   '#2D5A27',
};

// ─── Position helpers ─────────────────────────────────────────────────────────

const CAT_ORDER: Record<PositionCategory, number> = { GK: 0, DEF: 1, MID: 2, FWD: 3 };

function primaryCategory(p: Player): PositionCategory {
  return mapPositionToSlot(p.playerPositions)[0] ?? 'FWD';
}
function sortNormal(players: Player[]): Player[] {
  return [...players].sort((a, b) => b.overall - a.overall);
}
function sortHard(players: Player[]): Player[] {
  const arr = [...players];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.sort((a, b) => CAT_ORDER[primaryCategory(a)] - CAT_ORDER[primaryCategory(b)]);
}
function abbrev(name: string): string {
  return (name.split(' ').at(-1) ?? name).slice(0, 8);
}

// ─── Roulette ────────────────────────────────────────────────────────────────

function runRoulette(actual: DraftTeam, pool: DraftTeam[], onTick: (t: string) => void): Promise<void> {
  return new Promise(resolve => {
    let step = 0;
    const TOTAL = 20;
    const tick = () => {
      if (step >= TOTAL) {
        onTick(`${actual.clubName}  ·  ${actual.season}`);
        setTimeout(resolve, 300);
        return;
      }
      const r = pool[Math.floor(Math.random() * pool.length)];
      onTick(`${r.clubName}  ·  ${r.season}`);
      step++;
      setTimeout(tick, 50 + Math.floor((step / TOTAL) ** 2 * 290));
    };
    tick();
  });
}

// ─── PitchSlot ────────────────────────────────────────────────────────────────

function PitchSlot({
  state, pick, positionLabel, difficulty, isPrime, onClick,
}: { state: SlotState; pick?: DraftPick; positionLabel: string; difficulty: Difficulty; isPrime: boolean; onClick?: () => void }) {
  const clickable = state === 'valid';
  const displayOvr = isPrime && pick?.player.primeOverall ? pick.player.primeOverall : pick?.player.overall;
  return (
    <div
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={clickable ? onClick : undefined}
      onKeyDown={clickable ? e => e.key === 'Enter' && onClick?.() : undefined}
      className="flex flex-col items-center justify-center rounded-full border-2 w-14 h-14 text-[10px] font-bold select-none transition-all duration-150 text-center"
      style={{
        cursor: clickable ? 'pointer' : 'default',
        background:
          state === 'filled'  ? '#FFFFFF' :
          state === 'valid'   ? 'rgba(200,16,46,0.25)' :
          state === 'empty'   ? 'rgba(255,255,255,0.1)' :
                                'rgba(0,0,0,0.2)',
        borderColor:
          state === 'filled'  ? '#FFFFFF' :
          state === 'valid'   ? C.red :
          state === 'empty'   ? 'rgba(255,255,255,0.4)' :
                                'rgba(255,255,255,0.15)',
        color:
          state === 'filled'  ? '#0A0A0A' :
          state === 'valid'   ? C.red :
          state === 'empty'   ? 'rgba(255,255,255,0.6)' :
                                'rgba(255,255,255,0.2)',
        animation: state === 'valid' ? 'pulse 2s infinite' : undefined,
      }}
    >
      {pick ? (
        <>
          <span className="text-[9px] font-black leading-tight px-0.5 truncate max-w-[52px]" style={{ color: '#0A0A0A' }}>
            {abbrev(pick.player.shortName)}
          </span>
          <span className="text-[10px] font-black" style={{ color: difficulty === 'normal' ? '#C8102E' : '#0A0A0A' }}>
            {difficulty === 'normal' ? displayOvr : '?'}
          </span>
          {isPrime && pick.player.primeOverall && (
            <span className="text-[7px] font-black" style={{ color: '#C8102E' }}>P</span>
          )}
        </>
      ) : (
        <span>{positionLabel}</span>
      )}
    </div>
  );
}

// ─── FormationPitch ───────────────────────────────────────────────────────────

function FormationPitch({
  formation, picks, placing, validSlots, difficulty, isPrime, onSlotClick,
}: {
  formation: Formation; picks: DraftPick[];
  placing: boolean; validSlots?: Set<string>;
  difficulty: Difficulty; isPrime: boolean;
  onSlotClick?: (idx: number) => void;
}) {
  const slots   = FORMATIONS[formation];
  const rows    = FORMATION_PITCH_ROWS[formation];
  const pickMap = Object.fromEntries(picks.map(p => [p.slotIndex, p]));
  return (
    <div
      className="relative rounded-2xl overflow-hidden shadow-md p-4 py-6"
      style={{ background: `linear-gradient(180deg, #245020 0%, ${C.field} 50%, #245020 100%)` }}
    >
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute left-0 right-0 top-1/2 h-px" style={{ background: 'rgba(255,255,255,0.12)' }} />
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 rounded-full border" style={{ borderColor: 'rgba(255,255,255,0.12)' }} />
        <div className="absolute bottom-0 left-1/4 right-1/4 h-10 border border-b-0" style={{ borderColor: 'rgba(255,255,255,0.12)' }} />
        <div className="absolute top-0 left-1/4 right-1/4 h-10 border border-t-0" style={{ borderColor: 'rgba(255,255,255,0.12)' }} />
      </div>
      <div className="relative flex flex-col gap-5">
        {rows.map((row, ri) => (
          <div key={ri} className="flex justify-around items-center">
            {row.map(si => (
              <PitchSlot
                key={si}
                state={(() => {
                  if (pickMap[si]) return 'filled';
                  if (!placing || !validSlots) return 'empty';
                  return validSlots.has(slots[si].position) ? 'valid' : 'invalid';
                })()}
                pick={pickMap[si]}
                positionLabel={slots[si].position}
                difficulty={difficulty}
                isPrime={isPrime}
                onClick={() => onSlotClick?.(si)}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── RouletteBox ──────────────────────────────────────────────────────────────

function RouletteBox({ text, spinning }: { text: string; spinning: boolean }) {
  return (
    <div
      className="relative rounded-2xl min-h-28 flex flex-col items-center justify-center text-center px-6 py-6 overflow-hidden transition-all duration-300"
      style={{
        border: `2px solid ${spinning ? C.red : text ? '#2E2E2E' : '#2E2E2E'}`,
        background: spinning ? '#1A0509' : C.card,
      }}
    >
      <p
        className="font-black text-xl md:text-2xl leading-tight transition-colors duration-75"
        style={{ color: spinning ? C.red : text ? C.text : '#444444' }}
      >
        {text || '—  ·  —'}
      </p>
      <p className="text-xs mt-1 font-medium" style={{ color: spinning ? '#E8192C88' : text ? C.muted : C.subtle }}>
        {spinning ? 'Sorteando equipo…' : text ? '¡Equipo sorteado!' : 'Pulsa el botón para sortear'}
      </p>
    </div>
  );
}

// ─── PlayerCard ───────────────────────────────────────────────────────────────

function PlayerCard({
  player, difficulty, revealedId, isPrime, onPick, onReveal,
}: {
  player: Player;
  difficulty: Difficulty;
  revealedId: number | null;
  isPrime: boolean;
  onPick: () => void;
  onReveal: () => void;
}) {
  const isHard     = difficulty === 'hard';
  const isRevealed = !isHard || revealedId === player.playerId;
  const canReveal  = isHard && revealedId === null;
  const displayOvr = isPrime && player.primeOverall ? player.primeOverall : player.overall;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onPick}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(); } }}
      className="w-full text-left rounded-xl p-4 transition-all group cursor-pointer"
      style={{
        background: C.card,
        border: `2px solid #2E2E2E`,
      }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = C.red)}
      onMouseLeave={e => (e.currentTarget.style.borderColor = '#2E2E2E')}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-black text-sm" style={{ color: C.text }}>{player.shortName}</span>
            {isPrime && (
              <span
                className="text-[9px] font-black px-1.5 py-0.5 rounded"
                style={{ background: C.gold, color: '#000000' }}
              >
                PRIME
              </span>
            )}
          </div>
          <div className="text-xs mt-0.5" style={{ color: C.subtle }}>{player.playerPositions}</div>
        </div>

        {isRevealed ? (
          <div className="shrink-0 text-right">
            <div className="text-2xl font-black leading-none" style={{ color: isPrime ? C.gold : C.red }}>
              {displayOvr}
            </div>
            {isPrime && player.primeOverall && player.primeOverall !== player.overall && (
              <div className="text-[9px]" style={{ color: C.subtle }}>base {player.overall}</div>
            )}
            <div className="text-[10px]" style={{ color: C.subtle }}>OVR</div>
          </div>
        ) : canReveal ? (
          <button
            onClick={e => { e.stopPropagation(); onReveal(); }}
            className="shrink-0 text-[10px] font-black rounded-lg px-2 py-1 transition-colors"
            style={{ color: C.red, border: `1px solid rgba(200,16,46,0.4)` }}
          >
            Revelar
          </button>
        ) : (
          <div className="shrink-0 text-right">
            <div className="font-black text-sm" style={{ color: '#444444' }}>???</div>
            <div className="text-[10px]" style={{ color: C.subtle }}>OVR</div>
          </div>
        )}
      </div>

      {isRevealed && (
        <div className="mt-3 grid grid-cols-3 gap-x-4 gap-y-1 pt-3" style={{ borderTop: `1px solid #2E2E2E` }}>
          {(
            [
              ['PAC', player.pace], ['TIR', player.shooting], ['PAS', player.passing],
              ['REG', player.dribbling], ['DEF', player.defending], ['FIS', player.physic],
            ] as [string, number | null][]
          )
            .filter(([, v]) => v !== null)
            .map(([label, value]) => (
              <div key={label} className="flex justify-between text-xs">
                <span style={{ color: C.subtle }}>{label}</span>
                <span className="font-bold" style={{ color: C.text }}>{value}</span>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

// ─── DraftPage ────────────────────────────────────────────────────────────────

export default function DraftPage() {
  const router = useRouter();

  const [formation,  setFormation]  = useState<Formation | null>(null);
  const [teamName,   setTeamName]   = useState('Mi Equipo');
  const [difficulty, setDifficulty] = useState<Difficulty>('normal');
  const [gameMode,   setGameMode]   = useState<GameMode>('normal');
  const [primeMap,   setPrimeMap]   = useState<Record<number, number>>({});

  const [phase,      setPhase]      = useState<Phase>('setup');
  const [picks,      setPicks]      = useState<DraftPick[]>([]);
  const [pickedIds,  setPickedIds]  = useState<Set<number>>(new Set());
  const [usedKeys,   setUsedKeys]   = useState<Set<string>>(new Set());

  const [isSpinning,     setIsSpinning]     = useState(false);
  const [rouletteText,   setRouletteText]   = useState('');
  const [currentTeam,    setCurrentTeam]    = useState<DraftTeam | null>(null);
  const [offeredPlayers, setOfferedPlayers] = useState<Player[]>([]);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [revealedId,     setRevealedId]     = useState<number | null>(null);

  const [allDraftTeams, setAllDraftTeams] = useState<DraftTeam[]>([]);
  const [error,         setError]         = useState('');

  const isPrime = gameMode === 'prime';

  // Read game mode from sessionStorage
  useEffect(() => {
    const stored = sessionStorage.getItem('laliga-game-mode') as GameMode | null;
    if (stored === 'prime' || stored === 'normal') setGameMode(stored);
  }, []);

  // Fetch prime overalls when prime mode is active
  useEffect(() => {
    if (!isPrime) return;
    fetch('/api/prime-overalls')
      .then(r => r.json())
      .then((data: Record<string, number>) => {
        // keys come as strings from JSON
        const map: Record<number, number> = {};
        for (const [k, v] of Object.entries(data)) map[Number(k)] = v;
        setPrimeMap(map);
      })
      .catch(() => {});
  }, [isPrime]);

  useEffect(() => {
    fetch('/api/draft-teams')
      .then(r => r.json())
      .then(setAllDraftTeams)
      .catch(() => setError('Error cargando equipos. Recarga la página.'));
  }, []);

  function enrichWithPrime(players: Player[]): Player[] {
    if (!isPrime) return players;
    return players.map(p => ({
      ...p,
      primeOverall: primeMap[p.playerId] ?? p.overall,
    }));
  }

  function openSlotPositions(): Set<string> {
    if (!formation) return new Set();
    const filled = new Set(picks.map(p => p.slotIndex));
    const open   = new Set<string>();
    FORMATIONS[formation].forEach((slot, i) => { if (!filled.has(i)) open.add(slot.position); });
    return open;
  }

  // ── Roll ──────────────────────────────────────────────────────────────────

  const handleRoll = async () => {
    if (!formation || isSpinning) return;
    setError('');
    setCurrentTeam(null);
    setOfferedPlayers([]);
    setSelectedPlayer(null);
    setRevealedId(null);

    const available = allDraftTeams.filter(t => !usedKeys.has(`${t.clubName}|||${t.season}`));
    if (!available.length) { setError('No quedan equipos disponibles.'); return; }

    const actual = available[Math.floor(Math.random() * available.length)];
    setIsSpinning(true);
    setRouletteText('');

    const open = openSlotPositions();

    const [rawPlayers] = await Promise.all([
      (async (): Promise<Player[]> => {
        const res  = await fetch(
          `/api/players?clubName=${encodeURIComponent(actual.clubName)}&season=${encodeURIComponent(actual.season)}`
        );
        const data: Player[] = await res.json();
        return enrichWithPrime(data)
          .filter(p => !pickedIds.has(p.playerId))
          .filter(p => getPlayerSlotPositions(p.playerPositions).some(pos => open.has(pos)));
      })(),
      runRoulette(actual, allDraftTeams, setRouletteText),
    ]);

    const sorted = difficulty === 'hard' ? sortHard(rawPlayers) : sortNormal(rawPlayers);

    setCurrentTeam(actual);
    setOfferedPlayers(sorted);
    setUsedKeys(prev => new Set(prev).add(`${actual.clubName}|||${actual.season}`));
    setIsSpinning(false);
    setPhase('picking');
  };

  const handlePickPlayer = (player: Player) => {
    setSelectedPlayer(player);
    setPhase('placing');
  };

  const handleSelectSlot = (slotIndex: number) => {
    if (!selectedPlayer || !currentTeam || !formation) return;
    const pick: DraftPick = {
      slotIndex,
      player:     selectedPlayer,
      fromTeam:   currentTeam.clubName,
      fromSeason: currentTeam.season,
    };
    const newPicks = [...picks, pick];
    setPicks(newPicks);
    setPickedIds(prev => new Set(prev).add(selectedPlayer.playerId));
    setSelectedPlayer(null);

    if (newPicks.length >= TOTAL_PICKS) {
      sessionStorage.setItem('laliga-draft', JSON.stringify({ formation, teamName, picks: newPicks, difficulty, gameMode }));
      router.push('/simulation');
    } else {
      setPhase('rolling');
    }
  };

  const startDraft = () => {
    if (!formation) return;
    setPicks([]);
    setPickedIds(new Set());
    setUsedKeys(new Set());
    setRouletteText('');
    setCurrentTeam(null);
    setPhase('rolling');
  };

  const validSlots: Set<string> | undefined = selectedPlayer
    ? new Set(getPlayerSlotPositions(selectedPlayer.playerPositions))
    : undefined;

  const progress = Math.round((picks.length / TOTAL_PICKS) * 100);

  // ── SETUP ─────────────────────────────────────────────────────────────────

  if (phase === 'setup') {
    return (
      <main className="min-h-screen flex flex-col" style={{ background: C.bg }}>
        <div className="h-1.5 w-full" style={{ background: `linear-gradient(90deg, ${C.red}, ${C.redBr})` }} />

        <div className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-lg w-full space-y-5">
            <div className="text-center space-y-1">
              <p className="text-xs font-black tracking-widest uppercase" style={{ color: C.red }}>LaLiga Sin Partner</p>
              <h1 className="text-3xl font-black" style={{ color: C.text }}>Configura tu equipo</h1>
              {isPrime && (
                <span
                  className="inline-block text-xs font-black px-3 py-1 rounded-full"
                  style={{ background: C.gold, color: '#000000' }}
                >
                  MODO PRIME ACTIVO
                </span>
              )}
            </div>

            {/* Team name */}
            <div className="rounded-2xl p-5 space-y-2" style={{ background: C.card, border: `1px solid ${C.border}` }}>
              <label className="block text-xs font-black tracking-widest uppercase" style={{ color: C.text }}>
                Nombre del equipo
              </label>
              <input
                type="text"
                value={teamName}
                onChange={e => setTeamName(e.target.value || 'Mi Equipo')}
                maxLength={30}
                className="w-full rounded-xl px-4 py-3 font-bold focus:outline-none transition-colors"
                style={{ background: C.card2, border: `2px solid ${C.border}`, color: C.text }}
                onFocus={e => (e.target.style.borderColor = C.red)}
                onBlur={e => (e.target.style.borderColor = C.border)}
              />
            </div>

            {/* Formation */}
            <div className="rounded-2xl p-5 space-y-3" style={{ background: C.card, border: `1px solid ${C.border}` }}>
              <p className="text-xs font-black tracking-widest uppercase" style={{ color: C.text }}>Formación</p>
              <div className="grid grid-cols-2 gap-3">
                {(['4-3-3', '4-4-2'] as Formation[]).map(f => (
                  <button
                    key={f}
                    onClick={() => setFormation(f)}
                    className="rounded-xl p-4 text-center transition-all"
                    style={{
                      background: formation === f ? C.red : C.card2,
                      border: `2px solid ${formation === f ? C.red : C.border}`,
                      color: C.text,
                    }}
                  >
                    <div className="text-xl font-black">{f}</div>
                    <div className="text-xs mt-0.5 opacity-70">
                      {f === '4-3-3' ? '1 POR · 4 DEF · 3 MED · 3 DEL' : '1 POR · 4 DEF · 4 MED · 2 DEL'}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Difficulty */}
            <div className="rounded-2xl p-5 space-y-3" style={{ background: C.card, border: `1px solid ${C.border}` }}>
              <p className="text-xs font-black tracking-widest uppercase" style={{ color: C.text }}>Dificultad</p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setDifficulty('normal')}
                  className="rounded-xl p-4 text-left space-y-1 transition-all"
                  style={{
                    background: difficulty === 'normal' ? C.red : C.card2,
                    border: `2px solid ${difficulty === 'normal' ? C.red : C.border}`,
                    color: C.text,
                  }}
                >
                  <div className="font-black text-base">Normal</div>
                  <div className="text-xs opacity-75 leading-snug">Stats visibles · Dificultad estándar</div>
                </button>
                <button
                  onClick={() => setDifficulty('hard')}
                  className="rounded-xl p-4 text-left space-y-1 transition-all"
                  style={{
                    background: difficulty === 'hard' ? '#1A1A1A' : C.card2,
                    border: `2px solid ${difficulty === 'hard' ? C.muted : C.border}`,
                    color: C.text,
                  }}
                >
                  <div className="font-black text-base">Difícil</div>
                  <div className="text-xs opacity-75 leading-snug">Medias ocultas · Sin saber quién fichas</div>
                </button>
              </div>
            </div>

            {error && (
              <p className="text-sm text-center rounded-xl p-3" style={{ color: '#ef4444', background: '#1A0505', border: '1px solid #7f1d1d' }}>
                {error}
              </p>
            )}

            <button
              onClick={startDraft}
              disabled={!formation || allDraftTeams.length === 0}
              className="w-full font-black text-lg py-4 rounded-2xl transition-colors"
              style={{
                background: (!formation || allDraftTeams.length === 0) ? C.border : `linear-gradient(135deg, ${C.red}, ${C.redBr})`,
                color: (!formation || allDraftTeams.length === 0) ? C.subtle : C.text,
                boxShadow: (!formation || allDraftTeams.length === 0) ? 'none' : `0 8px 24px rgba(200,16,46,0.3)`,
              }}
            >
              {allDraftTeams.length === 0 ? 'Cargando…' : 'Iniciar Draft →'}
            </button>

            <div className="text-center">
              <Link href="/" className="text-sm" style={{ color: C.subtle }}>← Volver al inicio</Link>
            </div>
          </div>
        </div>

        <div className="h-1.5 w-full" style={{ background: `linear-gradient(90deg, ${C.red}, ${C.redBr})` }} />
      </main>
    );
  }

  // ── DRAFT BOARD ───────────────────────────────────────────────────────────

  return (
    <main className="min-h-screen flex flex-col" style={{ background: C.bg2 }}>
      <div className="h-1.5 w-full" style={{ background: `linear-gradient(90deg, ${C.red}, ${C.redBr})` }} />

      <header className="px-4 py-3" style={{ background: C.card, borderBottom: `1px solid ${C.border}` }}>
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[10px] font-black tracking-widest uppercase" style={{ color: C.red }}>LaLiga Sin Partner</p>
            <h1 className="font-black text-base leading-tight truncate" style={{ color: C.text }}>
              {teamName}
              {formation && <span className="font-normal ml-1.5 text-sm" style={{ color: C.subtle }}>· {formation}</span>}
              <span
                className="ml-2 text-[10px] font-black px-1.5 py-0.5 rounded uppercase"
                style={{
                  background: difficulty === 'hard' ? '#FFFFFF22' : `${C.red}22`,
                  color: difficulty === 'hard' ? C.muted : C.red,
                }}
              >
                {difficulty === 'hard' ? 'DIFÍCIL' : 'NORMAL'}
              </span>
              {isPrime && (
                <span
                  className="ml-1 text-[10px] font-black px-1.5 py-0.5 rounded uppercase"
                  style={{ background: C.gold, color: '#000000' }}
                >
                  PRIME
                </span>
              )}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:block text-right">
              <p className="text-xs" style={{ color: C.subtle }}>Jugadores</p>
              <p className="font-black" style={{ color: C.text }}>{picks.length}/{TOTAL_PICKS}</p>
            </div>
            <div className="w-24 h-2.5 rounded-full overflow-hidden" style={{ background: C.border }}>
              <div className="h-full rounded-full transition-all duration-500" style={{ width: `${progress}%`, background: C.red }} />
            </div>
          </div>
        </div>
      </header>

      <div className="flex-1 p-4 md:p-6">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-[3fr_2fr] gap-6">

          {formation && (
            <FormationPitch
              formation={formation}
              picks={picks}
              placing={phase === 'placing'}
              validSlots={validSlots}
              difficulty={difficulty}
              isPrime={isPrime}
              onSlotClick={phase === 'placing' ? handleSelectSlot : undefined}
            />
          )}

          <div className="space-y-4">
            <RouletteBox text={rouletteText} spinning={isSpinning} />

            {phase === 'rolling' && (
              <button
                onClick={handleRoll}
                disabled={isSpinning}
                className="w-full font-black text-xl py-4 rounded-2xl transition-all active:scale-95"
                style={{
                  background: isSpinning ? C.border : `linear-gradient(135deg, ${C.red}, ${C.redBr})`,
                  color: C.text,
                  opacity: isSpinning ? 0.5 : 1,
                  boxShadow: isSpinning ? 'none' : '0 8px 24px rgba(200,16,46,0.3)',
                }}
              >
                {isSpinning ? 'Sorteando…' : 'Tirar Ruleta'}
              </button>
            )}

            {phase === 'placing' && selectedPlayer && (
              <div className="rounded-2xl p-4 space-y-3" style={{ background: C.card, border: `2px solid ${C.red}` }}>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: C.subtle }}>Colocando a</p>
                    <p className="font-black text-xl mt-0.5" style={{ color: C.text }}>{selectedPlayer.shortName}</p>
                    <p className="text-xs" style={{ color: C.subtle }}>{selectedPlayer.playerPositions}</p>
                  </div>
                  {difficulty === 'normal' && (
                    <div className="text-right">
                      <p className="text-3xl font-black leading-none" style={{ color: isPrime ? C.gold : C.red }}>
                        {isPrime && selectedPlayer.primeOverall ? selectedPlayer.primeOverall : selectedPlayer.overall}
                      </p>
                      <p className="text-[10px]" style={{ color: C.subtle }}>OVR{isPrime ? ' PRIME' : ''}</p>
                    </div>
                  )}
                </div>
                <div className="rounded-xl px-3 py-2 text-xs leading-relaxed" style={{ background: `${C.red}15`, border: `1px solid ${C.red}33` }}>
                  Slots <span className="font-black" style={{ color: C.red }}>rojos pulsantes</span> = compatibles.
                </div>
                {validSlots && (
                  <div className="flex gap-1.5 flex-wrap">
                    {[...validSlots].map(pos => (
                      <span key={pos} className="text-[10px] font-black px-2 py-0.5 rounded-full" style={{ background: C.red, color: C.text }}>
                        {pos}
                      </span>
                    ))}
                  </div>
                )}
                <button
                  onClick={() => { setSelectedPlayer(null); setPhase('picking'); }}
                  className="text-xs underline w-full text-center"
                  style={{ color: C.subtle }}
                >
                  ← Elegir otro jugador
                </button>
              </div>
            )}

            {phase === 'picking' && (
              <>
                {currentTeam && (
                  <div className="rounded-xl p-3" style={{ background: C.card, border: `1px solid ${C.border}` }}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: C.subtle }}>Equipo sorteado</p>
                        <p className="font-black mt-0.5" style={{ color: C.text }}>
                          {currentTeam.clubName}
                          <span className="font-normal ml-1.5" style={{ color: C.red }}>{currentTeam.season}</span>
                        </p>
                      </div>
                      {difficulty === 'hard' && (
                        <span className="text-[10px] rounded-lg px-2 py-1 font-bold" style={{ background: C.card2, color: C.subtle }}>
                          {revealedId !== null ? '✓ Revelación usada' : '1 revelación disponible'}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                <p className="text-sm font-bold" style={{ color: C.text }}>Elige un jugador:</p>

                {offeredPlayers.length === 0 ? (
                  <div className="rounded-xl p-6 text-center" style={{ background: C.card, border: `1px solid ${C.border}` }}>
                    <p className="text-sm" style={{ color: C.subtle }}>No hay jugadores disponibles para las posiciones abiertas.</p>
                    <button onClick={() => setPhase('rolling')} className="mt-3 text-sm font-bold underline" style={{ color: C.red }}>
                      Volver a tirar
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-0.5">
                    {offeredPlayers.map(p => (
                      <PlayerCard
                        key={p.playerId}
                        player={p}
                        difficulty={difficulty}
                        revealedId={revealedId}
                        isPrime={isPrime}
                        onPick={() => handlePickPlayer(p)}
                        onReveal={() => setRevealedId(p.playerId)}
                      />
                    ))}
                  </div>
                )}
              </>
            )}

            {error && (
              <p className="text-sm text-center rounded-xl p-3" style={{ color: '#ef4444', background: '#1A0505', border: '1px solid #7f1d1d' }}>
                {error}
              </p>
            )}
          </div>
        </div>

        {picks.length > 0 && formation && (
          <div className="max-w-5xl mx-auto mt-4 rounded-2xl p-4" style={{ background: C.card, border: `1px solid ${C.border}` }}>
            <p className="text-[10px] font-black tracking-widest uppercase mb-3" style={{ color: C.text }}>
              Tu XI ({picks.length}/{TOTAL_PICKS})
            </p>
            <div className="flex flex-wrap gap-2">
              {[...picks].sort((a, b) => a.slotIndex - b.slotIndex).map(pick => {
                const displayOvr = isPrime && pick.player.primeOverall ? pick.player.primeOverall : pick.player.overall;
                return (
                  <div key={pick.slotIndex} className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs" style={{ background: C.card2, border: `1px solid ${C.border}` }}>
                    <span className="font-bold w-7" style={{ color: C.subtle }}>{FORMATIONS[formation][pick.slotIndex].position}</span>
                    <span className="font-bold" style={{ color: C.text }}>{pick.player.shortName}</span>
                    <span className="font-black" style={{ color: isPrime ? C.gold : C.red }}>{displayOvr}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="h-1.5 w-full" style={{ background: `linear-gradient(90deg, ${C.red}, ${C.redBr})` }} />
    </main>
  );
}
