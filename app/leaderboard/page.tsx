'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import type { LeaderboardEntry } from '@/lib/types';

const C = {
  bg:     '#0A0A0A',
  bg2:    '#1A1A1A',
  card:   '#1E1E1E',
  card2:  '#252525',
  border: '#2E2E2E',
  red:    '#C8102E',
  redBr:  '#E8192C',
  gold:   '#F5A623',
  text:   '#FFFFFF',
  muted:  '#CCCCCC',
  subtle: '#888888',
};

function formatDate(iso: string) {
  const d = new Date(iso);
  return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
}

function PositionBadge({ pos }: { pos: number }) {
  const color = pos === 1 ? '#ca8a04' : pos <= 4 ? '#16a34a' : pos <= 6 ? '#2563eb' : pos > 17 ? '#ef4444' : C.subtle;
  return (
    <span className="font-black text-xs px-2 py-0.5 rounded" style={{ background: `${color}22`, color }}>
      {pos}º
    </span>
  );
}

function XiModal({ entry, onClose }: { entry: LeaderboardEntry; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.85)' }}
      onClick={onClose}
    >
      <div
        className="rounded-2xl p-6 max-w-sm w-full space-y-4"
        style={{ background: C.card, border: `1px solid ${C.border}` }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-black" style={{ color: C.text }}>{entry.playerName}</h3>
            <p className="text-xs" style={{ color: C.subtle }}>
              {entry.position}º · {entry.points} pts · {entry.gf} GF / {entry.ga} GC
              {entry.primeMode && (
                <span className="ml-1 font-black px-1.5 py-0.5 rounded text-[9px]" style={{ background: C.gold, color: '#000' }}>PRIME</span>
              )}
            </p>
          </div>
          <button onClick={onClose} className="text-sm font-bold" style={{ color: C.subtle }}>✕</button>
        </div>
        <div className="space-y-1">
          {entry.players.map((p, i) => (
            <div key={i} className="flex items-center justify-between text-xs py-1" style={{ borderBottom: `1px solid ${C.border}33` }}>
              <div className="flex items-center gap-2">
                <span className="w-7 font-bold" style={{ color: C.subtle }}>{p.position}</span>
                <span style={{ color: C.text }}>{p.name}</span>
              </div>
              <span className="font-black" style={{ color: entry.primeMode ? C.gold : C.red }}>{p.overall}</span>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-center" style={{ color: C.subtle }}>{formatDate(entry.date)}</p>
      </div>
    </div>
  );
}

export default function LeaderboardPage() {
  const [entries,    setEntries]    = useState<LeaderboardEntry[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [selected,   setSelected]   = useState<LeaderboardEntry | null>(null);
  const [myIds,      setMyIds]      = useState<Set<string>>(new Set());

  useEffect(() => {
    // Load leaderboard
    fetch('/api/leaderboard')
      .then(r => r.json())
      .then((data: LeaderboardEntry[]) => {
        setEntries(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));

    // Load my results from localStorage
    try {
      const local = JSON.parse(localStorage.getItem('laliga-my-results') ?? '[]') as LeaderboardEntry[];
      setMyIds(new Set(local.map(e => e.id)));
    } catch {}
  }, []);

  return (
    <main className="min-h-screen flex flex-col" style={{ background: C.bg }}>
      <div className="h-1.5 w-full" style={{ background: `linear-gradient(90deg, ${C.red}, ${C.redBr})` }} />

      <header className="px-4 py-3" style={{ background: C.card, borderBottom: `1px solid ${C.border}` }}>
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black tracking-widest uppercase" style={{ color: C.red }}>LaLiga Sin Partner</p>
            <h1 className="font-black text-lg" style={{ color: C.text }}>🏆 Leaderboard Global</h1>
          </div>
          <Link href="/" className="text-sm" style={{ color: C.subtle }}>← Inicio</Link>
        </div>
      </header>

      <div className="flex-1 p-4 md:p-6">
        <div className="max-w-3xl mx-auto space-y-4">

          {loading && (
            <div className="text-center py-16">
              <p style={{ color: C.subtle }}>Cargando…</p>
            </div>
          )}

          {!loading && entries.length === 0 && (
            <div className="text-center py-16 space-y-4">
              <p className="text-2xl font-black" style={{ color: C.subtle }}>Sin resultados aún</p>
              <p className="text-sm" style={{ color: C.subtle }}>¡Sé el primero en guardar tu resultado!</p>
              <Link
                href="/"
                className="inline-block px-8 py-3 rounded-2xl font-black"
                style={{ background: `linear-gradient(135deg, ${C.red}, ${C.redBr})`, color: C.text }}
              >
                Jugar ahora
              </Link>
            </div>
          )}

          {!loading && entries.length > 0 && (
            <div className="rounded-2xl overflow-hidden" style={{ background: C.card, border: `1px solid ${C.border}` }}>
              {/* Header row */}
              <div
                className="grid text-[10px] font-black tracking-widest uppercase px-4 py-3"
                style={{ gridTemplateColumns: '2rem 1fr auto auto auto auto', background: C.card2, color: C.subtle, borderBottom: `1px solid ${C.border}` }}
              >
                <span>#</span>
                <span>Jugador</span>
                <span className="text-center w-12">Pos</span>
                <span className="text-center w-12">Pts</span>
                <span className="text-center w-16">GF/GC</span>
                <span className="w-8"></span>
              </div>

              {entries.map((entry, idx) => {
                const isMe = myIds.has(entry.id);
                return (
                  <div
                    key={entry.id}
                    className="grid items-center px-4 py-3 text-sm transition-colors"
                    style={{
                      gridTemplateColumns: '2rem 1fr auto auto auto auto',
                      borderBottom: `1px solid ${C.border}33`,
                      background: isMe ? `${C.red}15` : 'transparent',
                    }}
                  >
                    {/* Rank */}
                    <span
                      className="font-black text-xs"
                      style={{ color: idx === 0 ? C.gold : idx === 1 ? '#9ca3af' : idx === 2 ? '#92400e' : C.subtle }}
                    >
                      {idx + 1}
                    </span>

                    {/* Name */}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-black truncate" style={{ color: isMe ? C.red : C.text }}>
                          {entry.playerName}
                        </span>
                        {isMe && (
                          <span className="text-[9px] font-black px-1.5 py-0.5 rounded shrink-0" style={{ background: C.red, color: '#FFFFFF' }}>
                            TÚ
                          </span>
                        )}
                        {entry.primeMode && (
                          <span className="text-[9px] font-black px-1.5 py-0.5 rounded shrink-0" style={{ background: C.gold, color: '#000000' }}>
                            PRIME
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] mt-0.5" style={{ color: C.subtle }}>{formatDate(entry.date)}</div>
                    </div>

                    {/* Position */}
                    <div className="w-12 flex justify-center">
                      <PositionBadge pos={entry.position} />
                    </div>

                    {/* Points */}
                    <div className="w-12 text-center font-black" style={{ color: C.text }}>{entry.points}</div>

                    {/* GF/GC */}
                    <div className="w-16 text-center text-xs" style={{ color: C.subtle }}>{entry.gf}/{entry.ga}</div>

                    {/* View XI */}
                    <div className="w-8 flex justify-end">
                      {entry.players.length > 0 && (
                        <button
                          onClick={() => setSelected(entry)}
                          className="text-[10px] font-black px-1.5 py-1 rounded transition-colors"
                          style={{ color: C.subtle, border: `1px solid ${C.border}` }}
                          onMouseEnter={e => (e.currentTarget.style.color = C.red)}
                          onMouseLeave={e => (e.currentTarget.style.color = C.subtle)}
                          title="Ver XI"
                        >
                          XI
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="text-center pt-4">
            <Link
              href="/"
              className="inline-block px-10 py-3 rounded-2xl font-black"
              style={{ background: `linear-gradient(135deg, ${C.red}, ${C.redBr})`, color: C.text, boxShadow: '0 8px 24px rgba(200,16,46,0.3)' }}
            >
              Jugar ahora →
            </Link>
          </div>
        </div>
      </div>

      <div className="h-1.5 w-full" style={{ background: `linear-gradient(90deg, ${C.red}, ${C.redBr})` }} />

      {selected && <XiModal entry={selected} onClose={() => setSelected(null)} />}
    </main>
  );
}
