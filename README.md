# LaLiga Sin Partner
https://la-liga-sin-partner.vercel.app/
Un juego de draft de fútbol inspirado en los equipos históricos de La Liga Santander. Construye tu once ideal fichando jugadores de los mejores equipos de La Liga entre 2015 y 2025, simula una temporada completa de 38 jornadas y compite contra rivales históricos reales.

**Inspirado en el 7-0 pero de la mejor liga del mundo (sin perras por culpa de Tebas).**

---

## Cómo se juega

### 1. Configura tu equipo
Elige el nombre de tu equipo, la formación (4-3-3 o 4-4-2) y la dificultad.

### 2. Draft por ruleta
En cada tirada, la ruleta selecciona aleatoriamente un equipo histórico de La Liga. Se te ofrecen sus jugadores disponibles para la posición que necesitas. Elige uno para tu once.

Repite hasta completar los 11 titulares.

### 3. Simula la temporada
Tu equipo se enfrenta a 19 rivales históricos (38 partidos en total, ida y vuelta). Los goles se calculan con una distribución de Poisson ponderada por la fuerza relativa de cada equipo. Los resultados se revelan jornada a jornada en tiempo real.

### 4. Estadísticas finales
Al terminar la temporada, consulta tu posición final en la tabla, los puntos, el máximo goleador, la racha invicta más larga y el partido más épico.

---

## Modos de juego

### Normal
- Jugadores ordenados por media (OVR) de mayor a menor
- Stats completas visibles desde el principio
- Rivales con +15% de fuerza base

### Difícil
- Jugadores en orden aleatorio dentro de cada grupo de posición
- Medias y stats ocultas — una revelación por tirada
- Rivales con +20% de fuerza base

---

## Mecánicas de simulación

- **Distribución de Poisson** para generar goles de forma realista
- **Ventaja local siempre para el rival** — tu equipo juega todos los partidos fuera
- **Factor asimétrico k** — las sorpresas son raras (k=42 si eres más fuerte, k=30 si eres más débil)
- **Época dorada**: Barça y Real Madrid entre 2015-2019 reciben un +10% adicional
- **Racha de derrotas**: 2 o más derrotas consecutivas dan al siguiente rival un +5% extra
- **Validación de posiciones estricta**: LB solo puede jugar de LB, RM puede jugar de RM o RW, etc.

---

## Compartir resultado

Al finalizar la temporada puedes:
- Descargar una imagen en PNG con tu posición, stats y once titular
- Compartir directamente en X (Twitter) con el texto del resultado

---



---

## Datos

Los datos de jugadores y estadísticas de equipos provienen de los juegos FIFA 16–25 y cubren todas las temporadas de La Liga Santander / La Liga EA Sports de 2015-16 a 2024-25.
