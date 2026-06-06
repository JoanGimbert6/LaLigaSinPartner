import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="min-h-screen bg-white flex flex-col">
      {/* Top stripe */}
      <div className="h-1.5 bg-ll-orange w-full" />

      <div className="flex-1 flex flex-col items-center justify-center p-6">
        <div className="max-w-2xl w-full space-y-10">

          {/* Hero */}
          <div className="text-center space-y-4">
            <p className="text-ll-orange text-xs font-black tracking-[0.25em] uppercase">
              LaLiga Histórica · Temporadas 2015–2026
            </p>
            <h1 className="text-5xl md:text-6xl font-black tracking-tight text-ll-navy leading-none">
              LaLiga<br />
              <span className="text-ll-orange">Sin</span> Partner
            </h1>
            <p className="text-ll-muted text-base md:text-lg max-w-lg mx-auto leading-relaxed">
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
                className="bg-white rounded-2xl p-6 border-2 border-ll-border shadow-sm space-y-3 border-t-4 border-t-ll-orange"
              >
                <div className="flex items-center gap-3">
                  <span className="text-ll-orange font-black text-2xl leading-none">{n}</span>
                  <span className="font-black text-ll-navy text-sm tracking-widest">{title}</span>
                </div>
                <p className="text-ll-muted text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>

          {/* CTA */}
          <div className="text-center space-y-4">
            <Link
              href="/draft"
              className="inline-block bg-ll-orange hover:bg-ll-accent text-white font-black text-xl px-14 py-5 rounded-2xl transition-colors shadow-lg shadow-orange-500/25"
            >
              Crear mi equipo →
            </Link>
            <p className="text-ll-muted text-xs">
              Inspirado en el 7-0 pero de la mejor liga del mundo (sin perras por culpa de Tebas)
            </p>
          </div>
        </div>
      </div>

      {/* Footer stripe */}
      <div className="h-1.5 bg-ll-orange w-full" />
    </main>
  );
}
