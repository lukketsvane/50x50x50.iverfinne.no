/**
 * Finmasking for lastkartet.
 *
 * Lag-nettet er bygd for å SJÅAST: store, flate trekantar er rett svar
 * når flata har éin farge. Lastkartet legg éin verdi per hjørne, og då
 * vert kvar stor trekant ein lineær overgang mellom tre punkt — feltet
 * varierer ikkje-lineært (fiberen, momentet), og på ei bladflate med
 * fire hjørne vart det diagonale fargeblomar som ikkje finst i fysikken.
 *
 * Denne deler kvar trekant i eit jamt rutenett til ingen kant er lenger
 * enn maksgrensa, so hjørna SAMPLAR feltet tett nok til at fargane
 * fortel sanninga. Delinga er per trekant: to grannar kan velje ulik
 * tettleik langs delt kant, og då kan fargesaumen skilje seg eit hår —
 * flatene er koplanare, so geometrien sjølv sprekk aldri. Berre
 * last-visinga betaler; dei andre lesemåtane rører aldri denne fila.
 */

type Nett = {
  positions: Float32Array
  normals: Float32Array
  kant: Float32Array
  tris: number
}

export function finmaskNett(m: Nett, maxKant = 24, taksTris = 400_000): Nett {
  const P = m.positions
  const N = m.normals
  const K = m.kant
  const harKant = K.length === m.tris * 3

  // fyrste pass: kor fint kvar trekant treng delast, og kva det kostar
  const niv = new Uint8Array(m.tris)
  let ut = 0
  for (let t = 0; t < m.tris; t++) {
    const i = t * 9
    const e0 = Math.hypot(P[i] - P[i + 3], P[i + 1] - P[i + 4], P[i + 2] - P[i + 5])
    const e1 = Math.hypot(P[i + 3] - P[i + 6], P[i + 4] - P[i + 7], P[i + 5] - P[i + 8])
    const e2 = Math.hypot(P[i + 6] - P[i], P[i + 7] - P[i + 1], P[i + 8] - P[i + 2])
    const n = Math.min(6, Math.max(1, Math.ceil(Math.max(e0, e1, e2) / maxKant)))
    niv[t] = n
    ut += n * n
  }
  // over taket: skaler ned jamt i staden for å droppe nokon — eit kart
  // med hòl i lyg meir enn eit litt grovare kart
  if (ut > taksTris) {
    const s = Math.sqrt(taksTris / ut)
    ut = 0
    for (let t = 0; t < m.tris; t++) {
      niv[t] = Math.max(1, Math.floor(niv[t] * s))
      ut += niv[t] * niv[t]
    }
  }
  if (ut === m.tris) return m

  const oP = new Float32Array(ut * 9)
  const oN = new Float32Array(ut * 9)
  const oK = new Float32Array(harKant ? ut * 3 : 0)
  let o = 0

  const skriv = (
    t: number,
    a: [number, number],
    b: [number, number],
    c: [number, number],
  ) => {
    const i = t * 9
    for (const [u, v] of [a, b, c]) {
      const w = 1 - u - v
      const j = o * 3
      oP[j] = P[i] * w + P[i + 3] * u + P[i + 6] * v
      oP[j + 1] = P[i + 1] * w + P[i + 4] * u + P[i + 7] * v
      oP[j + 2] = P[i + 2] * w + P[i + 5] * u + P[i + 8] * v
      let nx = N[i] * w + N[i + 3] * u + N[i + 6] * v
      let ny = N[i + 1] * w + N[i + 4] * u + N[i + 7] * v
      let nz = N[i + 2] * w + N[i + 5] * u + N[i + 8] * v
      const L = Math.hypot(nx, ny, nz) || 1
      oN[j] = nx / L
      oN[j + 1] = ny / L
      oN[j + 2] = nz / L
      if (harKant) {
        oK[o] = K[t * 3] * w + K[t * 3 + 1] * u + K[t * 3 + 2] * v
      }
      o++
    }
  }

  for (let t = 0; t < m.tris; t++) {
    const n = niv[t]
    if (n === 1) {
      // uendra: A=(0,0), B=(1,0), C=(0,1) i barysentriske (u,v)
      skriv(t, [0, 0], [1, 0], [0, 1])
      continue
    }
    // jamt barysentrisk rutenett: rad for rad, med vindinga i behald
    for (let r = 0; r < n; r++) {
      for (let q = 0; q < n - r; q++) {
        const u0 = q / n
        const v0 = r / n
        const du = 1 / n
        skriv(t, [u0, v0], [u0 + du, v0], [u0, v0 + du])
        if (q < n - r - 1) {
          skriv(t, [u0 + du, v0], [u0 + du, v0 + du], [u0, v0 + du])
        }
      }
    }
  }

  return { positions: oP, normals: oN, kant: harKant ? oK : new Float32Array(0), tris: ut }
}
