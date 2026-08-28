/**
 * VIKING — skroget.
 *
 * Dei fire fyrste typologiane svarar på det same spørsmålet: korleis
 * byggjer ein ei KRUM sitjeflate av FLATE plater? Alle fire svarar det
 * same på ein måte ingen av dei seier høgt — dei snittar. VAFFEL snittar
 * i to retningar, SKIVE i éi, STRAUM på skrå, RIBBE radialt. Og fylgja er
 * den same i alle fire: **du sit på plata sin KANT**. Sju til tjueein
 * rå, tverrskorne finérkantar under låret, og flata finst berre som
 * striper med luft imellom.
 *
 * LAFT nekta spørsmålet: ei plate er ei plate, komforten kjem av vinklar.
 * Der sit du på plateFLATA — men flata er flat.
 *
 * Det står att eitt hjørne, og det er dette:
 *
 *                     du sit på KANTEN      du sit på FLATA
 *   krum flate        vaffel skive              VIKING
 *                     straum ribbe
 *   flat flate            —                      laft
 *
 * KLINKBYGGING er svaret. Eit klinkbygd skrog er krumt utan at eit
 * einaste bord er krumt: kvart bord er ei flat stripe, og krumminga bur i
 * VINKELEN MELLOM DEI. Borda overlappar kvarandre i lappen — dei ligg
 * ikkje kant i kant i eit spor — og skalet vert ei LUKKA flate ein kan
 * leggje handa på. Det er det eine SKIVE-lesaren sa manglar i heile
 * sandkassen.
 *
 *   x  fram(+)/bak(−)     y  sideveg      z  opp
 *
 * Skroget er ei PROFILKURVE i x–z, delt i n fasettar. Kvar fasett er eitt
 * bord, og bordet ligg i planet som fasetten og y-retninga spenner ut.
 * Planart per konstruksjon — det er ikkje ei tilnærming, det er ein
 * definisjon, og det er difor borda kan kuttast flate.
 *
 * To SPANT held vinklane. Utan dei er kvar lapp eit hengsle: to naglar i
 * same lappelina ligg på line og hindrar ikkje at bordet svingar. Spanta
 * er òg beina — dei held fram under skroget og ned i golvet — og det er
 * ærleg båtbygging: skalet ber, spanta gjev det form.
 */
import type { Pt, Vec3 } from "../core"
import type { Params } from "./params"

const RAD = Math.PI / 180

export type Plass = { o: Vec3; u: Vec3; v: Vec3; n: Vec3 }

/** eit punkt på profilkurva, med retninga si */
export type Knute = { x: number; z: number }

export type Skrog = {
  p: Params
  /** knutane på profilkurva, n + 1 av dei, frå framfoten og bakover */
  knute: Knute[]
  /** halve breidda på skroget ved bogelengd s ∈ [0,1] */
  halvB(s: number): number
  /** setet si høgd der ein faktisk sit */
  sitZ: number
  /** setekanten framme */
  seteZ: number
  /** spanta sin y: halve avstanden mellom dei to */
  spantY: number
  /** lengd på profilen i alt, mm */
  bogeLengd: number
  /** vinkelen mellom to nabobord, grader — lappen sin opning */
  lappVinkel: number[]
}

/**
 * PROFILKURVA.
 *
 * To utgåver er kasta før denne, og båe av same grunn. Den fyrste sette x
 * og z kvar for seg i tre soner: rette mål, men sonene møttest med kvar
 * sin tangent, og eit knekk på hundre grader hamna midt i eit bord. Den
 * andre bygde kurva av tangentvinkelen og skalerte henne etterpå: glatt
 * kurve, men skaleringa kopla alt til alt — ei skål på 44 mm gav ei leppe
 * på 270, og reparasjonen jaga eit mål som flytta seg medan ho sikta.
 *
 * Denne set FEM PUNKT i millimeter og dreg ei glatt kurve gjennom dei.
 * Punkta er dei fem tinga ein faktisk har ei meining om:
 *
 *   FOTEN         der stamnen møter golvet
 *   SETEKANTEN    framme, der låret sluttar
 *   SITJEPUNKTET  botnen i skåla — det er DETTE `hogd` tyder
 *   BAKKANTEN     der setet møter ryggen
 *   RYGGTOPPEN    så høgt og så lena som ryggen er
 *
 * Kurva er ein sentripetal Catmull-Rom gjennom dei fem. Sentripetal og
 * ikkje uniform, av di den uniforme lagar ei lykkje når to punkt ligg tett
 * — og setekanten og sitjepunktet ligg tett når skåla er grunn.
 */

/** sentripetal Catmull-Rom gjennom punkta, som ei tett polyline */
function spline(pkt: [number, number][], perSeg = 40): { x: number; z: number }[] {
  const P = [pkt[0], ...pkt, pkt[pkt.length - 1]]
  const ut: { x: number; z: number }[] = []
  for (let i = 1; i + 2 < P.length; i++) {
    const [p0, p1, p2, p3] = [P[i - 1], P[i], P[i + 1], P[i + 2]]
    const d = (a: [number, number], b: [number, number]) =>
      Math.max(1e-4, Math.hypot(b[0] - a[0], b[1] - a[1]) ** 0.5)
    const t0 = 0
    const t1 = t0 + d(p0, p1)
    const t2 = t1 + d(p1, p2)
    const t3 = t2 + d(p2, p3)
    for (let k = 0; k < perSeg; k++) {
      const t = t1 + ((t2 - t1) * k) / perSeg
      const bl = (a: [number, number], b: [number, number], ta: number, tb: number): [number, number] => {
        const w = (t - ta) / Math.max(1e-9, tb - ta)
        return [a[0] + (b[0] - a[0]) * w, a[1] + (b[1] - a[1]) * w]
      }
      const A1 = bl(p0, p1, t0, t1)
      const A2 = bl(p1, p2, t1, t2)
      const A3 = bl(p2, p3, t2, t3)
      const B1 = bl(A1, A2, t0, t2)
      const B2 = bl(A2, A3, t1, t3)
      const C = bl(B1, B2, t1, t2)
      ut.push({ x: C[0], z: C[1] })
    }
  }
  ut.push({ x: pkt[pkt.length - 1][0], z: pkt[pkt.length - 1][1] })
  return ut
}

/**
 * Dei fem punkta, i millimeter — alt anna fylgjer av dei.
 *
 * SKROGET NÅR IKKJE GOLVET. Fyrste utgåva let stamnen gå heilt ned og
 * stå på bakken, og det gav to feil på ein gong: spanta og skroget slost
 * om å vera bein, so spantomrisset skar seg sjølv, og svingen frå
 * loddrett stamn til vassrett sete var nitti grader som måtte fordelast
 * på tre bord — seksti grader i lappen, altso eit hjørne.
 *
 * Ein båt står ikkje på stamnen. Han ligg i ein krybbe, og krybba er
 * spanta. Skroget her er difor berre SKALET — frå baugen sin krull,
 * gjennom skåla, opp ryggen — og spanta ber det ned i golvet. Då er
 * svingen kring hundre og tjue grader over alle borda, og lappen vert ein
 * lapp.
 */
export function kontrollpunkt(p: Params): [number, number][] {
  const A = p.djup / 2
  const rv = p.ryggV * RAD
  // bakkanten ligg litt lågare enn framkanten: setet heller attover, som
  // det skal, og skåla er difor djupast litt framfor midten
  const bakLoft = p.skaal * 0.62
  const ut: [number, number][] = []
  // BAUGEN: framkanten krullar seg fram og ned. `stamn` er kor langt.
  if (p.stamn > 8) ut.push([A + p.stamn * 0.72, p.hogd + p.skaal - p.stamn * 0.58])
  ut.push([A, p.hogd + p.skaal])
  ut.push([0, p.hogd])
  ut.push([-A, p.hogd + bakLoft])
  if (p.ryggH > 6) {
    ut.push([-A - p.ryggH * Math.sin(rv), p.hogd + bakLoft + p.ryggH * Math.cos(rv)])
  }
  return ut
}

export function profilKurve(p: Params, perSeg = 40): { x: number; z: number }[] {
  return spline(kontrollpunkt(p), perSeg)
}

/**
 * Ytre mål på skroget åleine, utan spant. Reparasjonen i params.ts les
 * DETTE og ikkje ei formel: høgda kjem av ei kurve som vert skalert etter
 * kvar ein sit, og eit anslag på henne bommar med tretti millimeter.
 */
export function skrogMaal(p: Params): { L: number; H: number; sit: number } {
  const k = profilKurve(p, 16)
  let x0 = Infinity, x1 = -Infinity, z1 = -Infinity
  for (const q of k) {
    if (q.x < x0) x0 = q.x
    if (q.x > x1) x1 = q.x
    if (q.z > z1) z1 = q.z
  }
  // sitjepunktet er eit kontrollpunkt og treng ikkje leitast fram; men
  // splinen kan skyte litt forbi det, so det vert lese av kurva
  let sit = Infinity
  for (const q of k) if (Math.abs(q.x) < p.djup * 0.3 && q.z < sit) sit = q.z
  return { L: x1 - x0, H: z1, sit: Number.isFinite(sit) ? sit : p.hogd }
}

/**
 * BREIDDA LANGS SKROGET.
 *
 * Ein skute er smal i stamnen og brei midtskips, og det er ikkje pynt:
 * det er der kroppen er brei. Breidda er difor ein funksjon av
 * bogelengda, ikkje eit tal. `sving` er kor mykje ho svingar inn mot
 * endane — null er ein kasse, stort er ei båtform.
 */
function halvBreiddAv(s: number, p: Params): number {
  const B = p.breidd / 2
  // full breidd midt på setet, smalare i begge endar
  const inn = 1 - p.sving * (1 - Math.sin(Math.PI * Math.min(1, Math.max(0, s))) ** 0.55)
  return Math.max(60, B * inn)
}

export function byggSkrog(p: Params): Skrog {
  const n = Math.max(4, Math.round(p.bord))
  const kurve = profilKurve(p)
  // kumulativ bogelengd, so knutane kan setjast med LIK BORDLENGD og
  // ikkje med lik parameter — elles vert borda i stamnen dobbelt så
  // lange som dei i setet, og det er ikkje eit klinkbygd skrog
  const kum: number[] = [0]
  for (let i = 1; i < kurve.length; i++) {
    kum.push(kum[i - 1] + Math.hypot(kurve[i].x - kurve[i - 1].x, kurve[i].z - kurve[i - 1].z))
  }
  const bogeLengd = kum[kum.length - 1]

  /**
   * KVAR KNUTANE SKAL LIGGJE.
   *
   * Lik bordlengd er feil svar. Setet er nesten rett og svingar ikkje;
   * skuldra mellom stamn og sete svingar nitti grader. Deler ein bogen i
   * like lengder, får den rette strekninga like mange bord som svingen, og
   * lappen i svingen vert seksti grader — eit hjørne, ikkje ein klink.
   *
   * Ein båtbyggjar gjer det motsette: SMALARE bord der krumminga er stor.
   * Difor vert knutane sette med lik verdi av eit fairingmål — bogelengd
   * pluss ein radius gonger den absolutte svingen — so ein sving på nitti
   * grader tel like mykje som hundre og nitti millimeter rett strekning,
   * og borda samlar seg der forma treng dei.
   */
  const KRUM = 120
  const fair: number[] = [0]
  for (let i = 1; i < kurve.length; i++) {
    const dL = kum[i] - kum[i - 1]
    const a0 = i > 1 ? Math.atan2(kurve[i - 1].z - kurve[i - 2].z, kurve[i - 1].x - kurve[i - 2].x) : 0
    const a1 = Math.atan2(kurve[i].z - kurve[i - 1].z, kurve[i].x - kurve[i - 1].x)
    let d = a1 - a0
    while (d > Math.PI) d -= 2 * Math.PI
    while (d < -Math.PI) d += 2 * Math.PI
    fair.push(fair[i - 1] + dL + (i > 1 ? KRUM * Math.abs(d) : 0))
  }
  const fairTot = fair[fair.length - 1]
  const paaFair = (m: number): Knute => {
    if (m <= 0) return kurve[0]
    if (m >= fairTot) return kurve[kurve.length - 1]
    let lo = 0
    let hi = fair.length - 1
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1
      if (fair[mid] <= m) lo = mid
      else hi = mid
    }
    const t = (m - fair[lo]) / Math.max(1e-9, fair[hi] - fair[lo])
    return {
      x: kurve[lo].x + t * (kurve[hi].x - kurve[lo].x),
      z: kurve[lo].z + t * (kurve[hi].z - kurve[lo].z),
    }
  }
  const knute: Knute[] = []
  for (let i = 0; i <= n; i++) knute.push(paaFair((fairTot * i) / n))

  // vinkelen mellom to nabobord — lappen si opning, og heile grunnen til
  // at talet på bord er ein KOMFORTparameter og ikkje ein pynteparameter
  const lappVinkel: number[] = []
  for (let i = 0; i + 1 < n; i++) {
    const a = Math.atan2(knute[i + 1].z - knute[i].z, knute[i + 1].x - knute[i].x)
    const b = Math.atan2(knute[i + 2].z - knute[i + 1].z, knute[i + 2].x - knute[i + 1].x)
    let d = (b - a) / RAD
    while (d > 180) d -= 360
    while (d < -180) d += 360
    lappVinkel.push(d)
  }

  // der ein sit: det lågaste punktet på setesona
  let sitZ = Infinity
  const A = p.djup / 2
  for (const k of knute) if (k.x < A * 0.9 && k.x > -A * 0.9 && k.z < sitZ) sitZ = k.z
  if (!Number.isFinite(sitZ)) sitZ = p.hogd - p.skaal

  return {
    p,
    knute,
    halvB: (s) => halvBreiddAv(s, p),
    sitZ,
    seteZ: p.hogd,
    spantY: (p.breidd / 2) * p.spantY,
    bogeLengd,
    lappVinkel,
  }
}

/**
 * Planet eit bord ligg i. u går langs fasetten, v langs y, og normalen
 * peikar UT av skroget. Origo ligg i fasetten sitt startpunkt, so u = 0
 * er lappekanten mot bordet under.
 */
export function bordPlass(sk: Skrog, i: number): Plass {
  const a = sk.knute[i]
  const b = sk.knute[i + 1]
  const L = Math.hypot(b.x - a.x, b.z - a.z) || 1
  const u: Vec3 = [(b.x - a.x) / L, 0, (b.z - a.z) / L]
  const v: Vec3 = [0, 1, 0]
  // n = u × v, normalisert. Med u i x–z og v = y peikar n ut frå skroget.
  const n: Vec3 = [u[2] * v[1] - u[1] * v[2], u[0] * v[2] - u[2] * v[0], u[1] * v[0] - u[0] * v[1]]
  return { o: [a.x, 0, a.z], u, v, n }
}
