'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { Formation, Player, DraftPick, PositionCategory, Difficulty } from '@/lib/types';
import { FORMATIONS, FORMATION_PITCH_ROWS, TOTAL_PICKS, mapPositionToSlot, getPlayerSlotPositions } from '@/lib/formation';

// ─── Local types ──────────────────────────────────────────────────────────────

interface DraftTeam { clubName: string; season: string; }

type Phase     = 'setup' | 'rolling' | 'picking' | 'placing';
type SlotState = 'empty' | 'filled' | 'valid' | 'invalid';

// ─── Position / slot helpers ──────────────────────────────────────────────────

const CAT_ORDER: Record<PositionCategory, number> = { GK: 0, DEF: 1, MID: 2, FWD: 3 };

function primaryCategory(p: Player): PositionCategory {
  return mapPositionToSlot(p.playerPositions)[0] ?? 'FWD';
}

function sortPlayersNormal(players: Player[]): Player[] {
  return [...players].sort((a, b) => b.overall - a.overall);
}

function sortPlayersHard(players: Player[]): Player[] {
  // Shuffle first so within-category order is random
  const arr = [...players];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  // Then stable-sort by category
  return arr.sort((a, b) => CAT_ORDER[primaryCategory(a)] - CAT_ORDER[primaryCategory(b)]);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function abbrev(name: string): string {
  return (name.split(' ').at(-1) ?? name).slice(0, 8);
}

function computeSlotState(
  slotPosition: string,
  filled: boolean,
  placing: boolean,
  validSlots?: Set<string>,
): SlotState {
  if (filled) return 'filled';
  if (!placing || !validSlots) return 'empty';
  return validSlots.has(slotPosition) ? 'valid' : 'invalid';
}

// ─── Roulette animation ───────────────────────────────────────────────────────

function runRoulette(
  actual: DraftTeam,
  pool: DraftTeam[],
  onTick: (text: string) => void,
): Promise<void> {
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
  state, pick, positionLabel, difficulty, onClick,
}: { state: SlotState; pick?: DraftPick; positionLabel: string; difficulty: Difficulty; onClick?: () => void }) {
  const clickable = state === 'valid';
  return (
    <div
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={clickable ? onClick : undefined}
      onKeyDown={clickable ? e => e.key === 'Enter' && onClick?.() : undefined}
      className={[
        'flex flex-col items-center justify-center rounded-full border-2 w-14 h-14 text-[10px] font-bold select-none transition-all duration-150 text-center',
        clickable ? 'cursor-pointer' : 'cursor-default',
        state === 'filled'  ? 'bg-white border-white shadow-md'
        : state === 'valid' ? 'bg-ll-orange/20 border-ll-orange text-ll-orange hover:bg-ll-orange/40 ring-2 ring-ll-orange/40 animate-pulse'
        : state === 'empty' ? 'bg-white/15 border-white/50 text-white/70'
                            : 'bg-black/10 border-white/20 text-white/25 opacity-40',
      ].join(' ')}
    >
      {pick ? (
        <>
          <span className="text-[9px] font-black text-ll-navy leading-tight px-0.5 truncate max-w-[52px]">
            {abbrev(pick.player.shortName)}
          </span>
          <span className="text-[10px] font-black text-ll-orange">
            {difficulty === 'normal' ? pick.player.overall : '?'}
          </span>
        </>
      ) : (
        <span>{positionLabel}</span>
      )}
    </div>
  );
}

// ─── FormationPitch ───────────────────────────────────────────────────────────

function FormationPitch({
  formation, picks, placing, validSlots, difficulty, onSlotClick,
}: {
  formation: Formation; picks: DraftPick[];
  placing: boolean; validSlots?: Set<string>;
  difficulty: Difficulty;
  onSlotClick?: (idx: number) => void;
}) {
  const slots   = FORMATIONS[formation];
  const rows    = FORMATION_PITCH_ROWS[formation];
  const pickMap = Object.fromEntries(picks.map(p => [p.slotIndex, p]));

  return (
    <div
      className="relative rounded-2xl overflow-hidden shadow-md p-4 py-6"
      style={{ background: 'linear-gradient(180deg, #3d6b49 0%, #4A7C59 50%, #3d6b49 100%)' }}
    >
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute left-0 right-0 top-1/2 h-px bg-white/10" />
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 rounded-full border border-white/10" />
        <div className="absolute bottom-0 left-1/4 right-1/4 h-10 border border-white/10 border-b-0" />
        <div className="absolute top-0 left-1/4 right-1/4 h-10 border border-white/10 border-t-0" />
      </div>
      <div className="relative flex flex-col gap-5">
        {rows.map((row, ri) => (
          <div key={ri} className="flex justify-around items-center">
            {row.map(si => (
              <PitchSlot
                key={si}
                state={computeSlotState(slots[si].position, Boolean(pickMap[si]), placing, validSlots)}
                pick={pickMap[si]}
                positionLabel={slots[si].position}
                difficulty={difficulty}
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
    <div className={[
      'relative rounded-2xl border-2 min-h-28 flex flex-col items-center justify-center text-center px-6 py-6 overflow-hidden transition-all duration-300',
      spinning ? 'border-ll-orange bg-ll-navy shadow-lg shadow-orange-500/20'
      : text   ? 'border-ll-accent bg-ll-card'
               : 'border-ll-border bg-ll-card',
    ].join(' ')}>
      <div className="absolute top-3 left-6 right-6 h-px bg-current opacity-[0.06] pointer-events-none" />
      <div className="absolute bottom-3 left-6 right-6 h-px bg-current opacity-[0.06] pointer-events-none" />
      <p className={[
        'font-black text-xl md:text-2xl leading-tight transition-colors duration-75',
        spinning ? 'text-ll-orange' : text ? 'text-ll-navy' : 'text-ll-border',
      ].join(' ')}>{text || '—  ·  —'}</p>
      <p className={[
        'text-xs mt-1 font-medium',
        spinning ? 'text-ll-orange/60' : text ? 'text-ll-accent' : 'text-ll-muted',
      ].join(' ')}>
        {spinning ? 'Sorteando equipo…' : text ? '¡Equipo sorteado!' : 'Pulsa el botón para sortear'}
      </p>
    </div>
  );
}

// ─── PlayerCard ───────────────────────────────────────────────────────────────

function PlayerCard({
  player, difficulty, revealedId, onPick, onReveal,
}: {
  player: Player;
  difficulty: Difficulty;
  revealedId: number | null;
  onPick: () => void;
  onReveal: () => void;
}) {
  const isHard     = difficulty === 'hard';
  const isRevealed = !isHard || revealedId === player.playerId;
  const canReveal  = isHard && revealedId === null;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onPick}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(); } }}
      className="w-full text-left bg-white border-2 border-ll-orange/30 hover:border-ll-orange rounded-xl p-4 transition-all group shadow-sm hover:shadow-md cursor-pointer"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-black text-ll-navy text-sm group-hover:text-ll-orange transition-colors">
            {player.shortName}
          </div>
          <div className="text-ll-muted text-xs mt-0.5">{player.playerPositions}</div>
        </div>

        {isRevealed ? (
          <div className="shrink-0 text-right">
            <div className="text-2xl font-black text-ll-orange leading-none">{player.overall}</div>
            <div className="text-[10px] text-ll-muted">OVR</div>
          </div>
        ) : canReveal ? (
          <button
            onClick={e => { e.stopPropagation(); onReveal(); }}
            className="shrink-0 text-[10px] font-black text-ll-orange border border-ll-orange/40 rounded-lg px-2 py-1 hover:bg-ll-orange/10 transition-colors"
          >
            Revelar
          </button>
        ) : (
          <div className="shrink-0 text-right">
            <div className="text-ll-border font-black text-sm">???</div>
            <div className="text-[10px] text-ll-muted">OVR</div>
          </div>
        )}
      </div>

      {isRevealed && (
        <div className="mt-3 grid grid-cols-3 gap-x-4 gap-y-1 border-t border-ll-border pt-3">
          {(
            [
              ['PAC', player.pace], ['TIR', player.shooting], ['PAS', player.passing],
              ['REG', player.dribbling], ['DEF', player.defending], ['FIS', player.physic],
            ] as [string, number | null][]
          )
            .filter(([, v]) => v !== null)
            .map(([label, value]) => (
              <div key={label} className="flex justify-between text-xs">
                <span className="text-ll-muted">{label}</span>
                <span className="font-bold text-ll-navy">{value}</span>
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

  // Config
  const [formation,  setFormation]  = useState<Formation | null>(null);
  const [teamName,   setTeamName]   = useState('Mi Equipo');
  const [difficulty, setDifficulty] = useState<Difficulty>('normal');

  // Phase + picks
  const [phase,      setPhase]      = useState<Phase>('setup');
  const [picks,      setPicks]      = useState<DraftPick[]>([]);
  const [pickedIds,  setPickedIds]  = useState<Set<number>>(new Set());
  const [usedKeys,   setUsedKeys]   = useState<Set<string>>(new Set());

  // Roll state
  const [isSpinning,      setIsSpinning]      = useState(false);
  const [rouletteText,    setRouletteText]    = useState('');
  const [currentTeam,     setCurrentTeam]     = useState<DraftTeam | null>(null);
  const [offeredPlayers,  setOfferedPlayers]  = useState<Player[]>([]);
  const [selectedPlayer,  setSelectedPlayer]  = useState<Player | null>(null);
  const [revealedId,      setRevealedId]      = useState<number | null>(null);

  // Data pool
  const [allDraftTeams, setAllDraftTeams] = useState<DraftTeam[]>([]);
  const [error,         setError]         = useState('');

  useEffect(() => {
    fetch('/api/draft-teams')
      .then(r => r.json())
      .then(setAllDraftTeams)
      .catch(() => setError('Error cargando equipos. Recarga la página.'));
  }, []);

  function openSlotPositions(): Set<string> {
    if (!formation) return new Set();
    const filled = new Set(picks.map(p => p.slotIndex));
    const open   = new Set<string>();
    FORMATIONS[formation].forEach((slot, i) => { if (!filled.has(i)) open.add(slot.position); });
    return open;
  }

  // ── Roll ────────────────────────────────────────────────────────────────────

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
        return data
          .filter(p => !pickedIds.has(p.playerId))
          .filter(p => getPlayerSlotPositions(p.playerPositions).some(pos => open.has(pos)));
      })(),
      runRoulette(actual, allDraftTeams, setRouletteText),
    ]);

    // Sort depends on difficulty
    const sorted = difficulty === 'hard'
      ? sortPlayersHard(rawPlayers)
      : sortPlayersNormal(rawPlayers);

    setCurrentTeam(actual);
    setOfferedPlayers(sorted);
    setUsedKeys(prev => new Set(prev).add(`${actual.clubName}|||${actual.season}`));
    setIsSpinning(false);
    setPhase('picking');
  };

  // ── Pick player → placing ──────────────────────────────────────────────────

  const handlePickPlayer = (player: Player) => {
    setSelectedPlayer(player);
    setPhase('placing');
  };

  // ── Choose slot ─────────────────────────────────────────────────────────────

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
      sessionStorage.setItem('laliga-draft', JSON.stringify({ formation, teamName, picks: newPicks, difficulty }));
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

  // ────────────────────────────────────────────────────────────────────────────
  // ── SETUP ───────────────────────────────────────────────────────────────────
  // ────────────────────────────────────────────────────────────────────────────

  if (phase === 'setup') {
    return (
      <main className="min-h-screen bg-white flex flex-col">
        <div className="h-1.5 bg-ll-orange w-full" />

        <div className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-lg w-full space-y-5">
            <div className="text-center space-y-1">
              <p className="text-ll-orange text-xs font-black tracking-widest uppercase">LaLiga Sin Partner</p>
              <h1 className="text-3xl font-black text-ll-navy">Configura tu equipo</h1>
            </div>

            {/* Team name */}
            <div className="bg-white rounded-2xl p-5 border-2 border-ll-border shadow-sm space-y-2">
              <label className="block text-xs font-black text-ll-navy tracking-widest uppercase">
                Nombre del equipo
              </label>
              <input
                type="text"
                value={teamName}
                onChange={e => setTeamName(e.target.value || 'Mi Equipo')}
                maxLength={30}
                className="w-full border-2 border-ll-border focus:border-ll-orange rounded-xl px-4 py-3 text-ll-navy font-bold bg-ll-light focus:outline-none transition-colors"
              />
            </div>

            {/* Formation */}
            <div className="bg-white rounded-2xl p-5 border-2 border-ll-border shadow-sm space-y-3">
              <p className="text-xs font-black text-ll-navy tracking-widest uppercase">Formación</p>
              <div className="grid grid-cols-2 gap-3">
                {(['4-3-3', '4-4-2'] as Formation[]).map(f => (
                  <button
                    key={f}
                    onClick={() => setFormation(f)}
                    className={[
                      'rounded-xl border-2 p-4 text-center transition-all',
                      formation === f
                        ? 'border-ll-orange bg-ll-orange text-white'
                        : 'border-ll-border bg-ll-light text-ll-navy hover:border-ll-orange',
                    ].join(' ')}
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
            <div className="bg-white rounded-2xl p-5 border-2 border-ll-border shadow-sm space-y-3">
              <p className="text-xs font-black text-ll-navy tracking-widest uppercase">Dificultad</p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setDifficulty('normal')}
                  className={[
                    'rounded-xl border-2 p-4 text-left transition-all space-y-1',
                    difficulty === 'normal'
                      ? 'border-ll-orange bg-ll-orange text-white'
                      : 'border-ll-border bg-ll-light text-ll-navy hover:border-ll-orange',
                  ].join(' ')}
                >
                  <div className="font-black text-base">Normal</div>
                  <div className="text-xs opacity-75 leading-snug">
                    Jugadores por media · Stats visibles · Dificultad estándar
                  </div>
                </button>
                <button
                  onClick={() => setDifficulty('hard')}
                  className={[
                    'rounded-xl border-2 p-4 text-left transition-all space-y-1',
                    difficulty === 'hard'
                      ? 'border-ll-navy bg-ll-navy text-white'
                      : 'border-ll-border bg-ll-light text-ll-navy hover:border-ll-navy',
                  ].join(' ')}
                >
                  <div className="font-black text-base">Difícil</div>
                  <div className="text-xs opacity-75 leading-snug">
                    Jugadores aleatorios · Medias ocultas · Rivales +20%
                  </div>
                </button>
              </div>
              {difficulty === 'hard' && (
                <p className="text-[10px] text-ll-muted bg-ll-light rounded-lg px-3 py-2 leading-relaxed">
                  Los jugadores aparecen en orden aleatorio sin medias. Una vez por tirada puedes
                  revelar la media de un solo jugador antes de elegir.
                </p>
              )}
            </div>

            {error && <p className="text-red-500 text-sm text-center">{error}</p>}

            <button
              onClick={startDraft}
              disabled={!formation || allDraftTeams.length === 0}
              className="w-full bg-ll-orange hover:bg-ll-accent disabled:bg-ll-border disabled:text-ll-muted text-white font-black text-lg py-4 rounded-2xl transition-colors shadow-lg shadow-orange-500/20"
            >
              {allDraftTeams.length === 0 ? 'Cargando…' : 'Iniciar Draft →'}
            </button>

            <div className="text-center">
              <Link href="/" className="text-ll-muted hover:text-ll-navy text-sm">← Volver al inicio</Link>
            </div>
          </div>
        </div>

        <div className="h-1.5 bg-ll-orange w-full" />
      </main>
    );
  }

  // ────────────────────────────────────────────────────────────────────────────
  // ── DRAFT BOARD ─────────────────────────────────────────────────────────────
  // ────────────────────────────────────────────────────────────────────────────

  return (
    <main className="min-h-screen bg-ll-light flex flex-col">
      <div className="h-1.5 bg-ll-orange w-full" />

      <header className="bg-white border-b-2 border-ll-border px-4 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[10px] text-ll-orange font-black tracking-widest uppercase">LaLiga Sin Partner</p>
            <h1 className="font-black text-ll-navy text-base leading-tight truncate">
              {teamName}
              {formation && <span className="text-ll-muted font-normal ml-1.5 text-sm">· {formation}</span>}
              <span className={[
                'ml-2 text-[10px] font-black px-1.5 py-0.5 rounded uppercase',
                difficulty === 'hard'
                  ? 'bg-ll-navy text-white'
                  : 'bg-ll-orange/10 text-ll-orange',
              ].join(' ')}>
                {difficulty === 'hard' ? 'DIFÍCIL' : 'NORMAL'}
              </span>
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:block text-right">
              <p className="text-xs text-ll-muted">Jugadores</p>
              <p className="font-black text-ll-navy">{picks.length}/{TOTAL_PICKS}</p>
            </div>
            <div className="w-24 h-2.5 bg-ll-border rounded-full overflow-hidden">
              <div className="h-full bg-ll-orange rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
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
              onSlotClick={phase === 'placing' ? handleSelectSlot : undefined}
            />
          )}

          <div className="space-y-4">
            <RouletteBox text={rouletteText} spinning={isSpinning} />

            {phase === 'rolling' && (
              <button
                onClick={handleRoll}
                disabled={isSpinning}
                className="w-full bg-ll-orange hover:bg-ll-accent disabled:opacity-50 disabled:cursor-not-allowed text-white font-black text-xl py-4 rounded-2xl transition-all active:scale-95 shadow-lg shadow-orange-500/20"
              >
                {isSpinning ? 'Sorteando…' : 'Tirar Ruleta'}
              </button>
            )}

            {phase === 'placing' && selectedPlayer && (
              <div className="bg-white border-2 border-ll-orange rounded-2xl p-4 shadow-sm space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-[10px] text-ll-muted font-black uppercase tracking-widest">Colocando a</p>
                    <p className="font-black text-ll-navy text-xl mt-0.5">{selectedPlayer.shortName}</p>
                    <p className="text-ll-muted text-xs">{selectedPlayer.playerPositions}</p>
                  </div>
                  {difficulty === 'normal' && (
                    <div className="text-right">
                      <p className="text-3xl font-black text-ll-orange leading-none">{selectedPlayer.overall}</p>
                      <p className="text-[10px] text-ll-muted">OVR</p>
                    </div>
                  )}
                </div>
                <div className="bg-ll-orange/8 border border-ll-orange/20 rounded-xl px-3 py-2 text-xs text-ll-navy leading-relaxed">
                  Slots <span className="font-black text-ll-orange">naranjas pulsantes</span> = compatibles.
                  Slots opacos = posición incorrecta.
                </div>
                {validSlots && (
                  <div className="flex gap-1.5 flex-wrap">
                    {[...validSlots].map(pos => (
                      <span key={pos} className="text-[10px] font-black bg-ll-orange text-white px-2 py-0.5 rounded-full">{pos}</span>
                    ))}
                  </div>
                )}
                <button
                  onClick={() => { setSelectedPlayer(null); setPhase('picking'); }}
                  className="text-ll-muted hover:text-ll-orange text-xs underline w-full text-center"
                >
                  ← Elegir otro jugador
                </button>
              </div>
            )}

            {phase === 'picking' && (
              <>
                {currentTeam && (
                  <div className="bg-white rounded-xl border-2 border-ll-border p-3 shadow-sm">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[10px] text-ll-muted font-black uppercase tracking-widest">Equipo sorteado</p>
                        <p className="font-black text-ll-navy mt-0.5">
                          {currentTeam.clubName}
                          <span className="text-ll-orange font-normal ml-1.5">{currentTeam.season}</span>
                        </p>
                      </div>
                      {difficulty === 'hard' && (
                        <span className="text-[10px] text-ll-muted bg-ll-light rounded-lg px-2 py-1 font-bold">
                          {revealedId !== null ? '✓ Revelación usada' : '1 revelación disponible'}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                <p className="text-sm font-bold text-ll-navy">Elige un jugador:</p>

                {offeredPlayers.length === 0 ? (
                  <div className="bg-white rounded-xl border-2 border-ll-border p-6 text-center shadow-sm">
                    <p className="text-ll-muted text-sm">No hay jugadores disponibles para las posiciones abiertas.</p>
                    <button onClick={() => setPhase('rolling')} className="mt-3 text-ll-orange text-sm font-bold underline">
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
                        onPick={() => handlePickPlayer(p)}
                        onReveal={() => setRevealedId(p.playerId)}
                      />
                    ))}
                  </div>
                )}
              </>
            )}

            {error && (
              <p className="text-red-500 text-sm text-center bg-red-50 rounded-xl p-3 border border-red-200">{error}</p>
            )}
          </div>
        </div>

        {picks.length > 0 && formation && (
          <div className="max-w-5xl mx-auto mt-4 bg-white rounded-2xl border-2 border-ll-border p-4 shadow-sm">
            <p className="text-[10px] font-black text-ll-navy tracking-widest uppercase mb-3">
              Tu XI ({picks.length}/{TOTAL_PICKS})
            </p>
            <div className="flex flex-wrap gap-2">
              {[...picks].sort((a, b) => a.slotIndex - b.slotIndex).map(pick => (
                <div key={pick.slotIndex} className="flex items-center gap-1.5 bg-ll-light rounded-lg px-2.5 py-1.5 text-xs border border-ll-orange/30">
                  <span className="text-ll-muted font-bold w-7">{FORMATIONS[formation][pick.slotIndex].position}</span>
                  <span className="text-ll-navy font-bold">{pick.player.shortName}</span>
                  <span className="text-ll-orange font-black">{pick.player.overall}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="h-1.5 bg-ll-orange w-full" />
    </main>
  );
}
