'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { GameMode } from '@/lib/types';

export default function HomePage() {
  const router = useRouter();
  const [mode, setMode] = useState<GameMode>('normal');

  // Persist mode so draft page can read it
  useEffect(() => {
    sessionStorage.setItem('laliga-game-mode', mode);
  }, [mode]);

  const handleStart = () => {
    sessionStorage.setItem('laliga-game-mode', mode);
    router.push('/draft');
  };

  return (
    <main className="min-h-screen flex flex-col" style={{ background: '#0A0A0A' }}>
      {/* Top stripe */}
      <div className="h-1.5 w-full" style={{ background: 'linear-gradient(90deg, #C8102E, #E8192C)' }} />

      <div className="flex-1 flex flex-col items-center justify-center p-6">
        <div className="max-w-2xl w-full space-y-10">

          {/* Hero */}
          <div className="text-center space-y-4">
            <p className="text-xs font-black tracking-[0.25em] uppercase" style={{ color: '#C8102E' }}>
              LaLiga Histórica · Temporadas 2015–2026
            </p>
            <h1 className="text-5xl md:text-6xl font-black tracking-tight leading-none" style={{ color: '#FFFFFF' }}>
              LaLiga<br />
              <span style={{ color: '#C8102E' }}>Sin</span> Partner
            </h1>
            <p className="text-base md:text-lg max-w-lg mx-auto leading-relaxed" style={{ color: '#CCCCCC' }}>
              Sortea jugadores de equipos históricos de La Liga, construye tu XI ideal
              y compite una temporada completa de 38 partidos.
            </p>
          </div>

          {/* Steps */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              {
                n: '01',
                title: 'DRAFT',
                desc: 'Tira la ruleta 11 veces. Cada tirada sortea un equipo histórico. Elige un jugador y colócalo en tu alineación.',
              },
              {
                n: '02',
                title: 'TEMPORADA',
                desc: '19 rivales históricos únicos, cada uno jugado dos veces (casa + fuera) = 38 partidos simulados con estadísticas reales.',
              },
              {
                n: '03',
                title: 'CLASIFICACIÓN',
                desc: 'Sigue los partidos en directo y descubre tu posición final. ¿Serás campeón de La Liga?',
              },
            ].map(({ n, title, desc }) => (
              <div
                key={n}
                className="rounded-2xl p-6 space-y-3"
                style={{
                  background: '#1E1E1E',
                  borderTop: '4px solid #C8102E',
                  border: '1px solid #2E2E2E',
                  borderTopWidth: '4px',
                  borderTopColor: '#C8102E',
                }}
              >
                <div className="flex items-center gap-3">
                  <span className="font-black text-2xl leading-none" style={{ color: '#C8102E' }}>{n}</span>
                  <span className="font-black text-sm tracking-widest" style={{ color: '#FFFFFF' }}>{title}</span>
                </div>
                <p className="text-sm leading-relaxed" style={{ color: '#CCCCCC' }}>{desc}</p>
              </div>
            ))}
          </div>

          {/* Mode selector */}
          <div className="rounded-2xl p-5 space-y-3" style={{ background: '#1E1E1E', border: '1px solid #2E2E2E' }}>
            <p className="text-xs font-black tracking-widest uppercase" style={{ color: '#CCCCCC' }}>Modo de juego</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setMode('normal')}
                className="rounded-xl p-4 text-left space-y-1 transition-all"
                style={{
                  background: mode === 'normal' ? '#C8102E' : '#252525',
                  border: `2px solid ${mode === 'normal' ? '#C8102E' : '#2E2E2E'}`,
                  color: '#FFFFFF',
                }}
              >
                <div className="font-black text-base">Normal</div>
                <div className="text-xs opacity-75 leading-snug">
                  Overall real de cada temporada · Draft estándar
                </div>
              </button>
              <button
                onClick={() => setMode('prime')}
                className="rounded-xl p-4 text-left space-y-1 transition-all"
                style={{
                  background: mode === 'prime' ? '#1A1A1A' : '#252525',
                  border: `2px solid ${mode === 'prime' ? '#F5A623' : '#2E2E2E'}`,
                  color: '#FFFFFF',
                }}
              >
                <div className="flex items-center gap-2">
                  <span className="font-black text-base">Prime</span>
                  <span
                    className="text-[10px] font-black px-1.5 py-0.5 rounded"
                    style={{ background: '#F5A623', color: '#000000' }}
                  >
                    PRIME
                  </span>
                </div>
                <div className="text-xs opacity-75 leading-snug">
                  Mejor overall de toda la carrera · Versión legendaria
                </div>
              </button>
            </div>
            {mode === 'prime' && (
              <p
                className="text-[10px] rounded-lg px-3 py-2 leading-relaxed"
                style={{ background: '#252525', color: '#F5A623' }}
              >
                Cada jugador aparece con la mejor media que tuvo en toda su carrera en el dataset.
                El <span className="font-black">player_id</span> identifica al mismo jugador entre temporadas.
              </p>
            )}
          </div>

          {/* CTA */}
          <div className="text-center space-y-4">
            <button
              onClick={handleStart}
              className="inline-block font-black text-xl px-14 py-5 rounded-2xl transition-all shadow-lg"
              style={{
                background: 'linear-gradient(135deg, #C8102E, #E8192C)',
                color: '#FFFFFF',
                boxShadow: '0 8px 32px rgba(200,16,46,0.35)',
              }}
            >
              Crear mi equipo →
            </button>
            <div>
              <Link
                href="/leaderboard"
                className="text-sm font-bold transition-colors"
                style={{ color: '#F5A623' }}
              >
                🏆 Ver Leaderboard Global
              </Link>
            </div>
            <p className="text-xs" style={{ color: '#888888' }}>
              Inspirado en el 7-0 pero de la mejor liga del mundo (sin perras por culpa de Tebas)
            </p>
          </div>
        </div>
      </div>

      {/* Footer stripe */}
      <div className="h-1.5 w-full" style={{ background: 'linear-gradient(90deg, #C8102E, #E8192C)' }} />
    </main>
  );
}
