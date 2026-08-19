/**
 * RIBBE — setet.
 *
 * Ein superellipse med eit halvmåneinnsnitt og ei skål. Innsnittet er ikkje
 * pynt: det er det som gjer at ein ser kvar framsida er utan å måtta snu
 * objektet, og det er der ein tek tak når krakken skal flyttast.
 *
 * Skåla er målt mot kor breitt SKALET er øvst og ikkje mot setekanten.
 * Overhenget skal lesast som ein flat kant ein kan gripe under; vart skåla
 * strekt heilt ut i kanten, hadde overhenget vorte ei egg.
 */
import type { Pt } from "../core"
import type { Shell } from "./shell"
import type { Station } from "./solid"

export type SeatGeom = {
  st: Station[]
  /** undersida, mm — ho kviler på toppen av alle blada */
  z0: number
  /** setekanten, mm */
  z1: number
  outline: Pt[]
  /** kor mange blad som faktisk ber setet */
  onBlades: number
}

export function seatGeom(sh: Shell, nt: number): SeatGeom {
  const TAU = Math.PI * 2
  const st: Station[] = []
  const outline: Pt[] = []
  for (let i = 0; i < nt; i++) {
    const th = (i / nt) * TAU
    const r = Math.max(20, sh.seatEdge(th))
    st.push({ u: th, a: 0, b: r })
    outline.push([r * Math.cos(th), r * Math.sin(th)])
  }

  // Setet ligg berre på blada, og halvmånen tek nokre av dei bort. Talet
  // vert difor talt og ikkje gått ut frå: eit sete som kviler på under to
  // tredjedelar av blada er ei plate på tvers av eit hol.
  let onBlades = 0
  for (const phi of sh.angles) {
    if (sh.rOuter(phi, sh.zBlade) - 6 < sh.seatEdge(phi)) onBlades++
  }

  return { st, z0: sh.zBlade, z1: sh.zTop, outline, onBlades }
}
