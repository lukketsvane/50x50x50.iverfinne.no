/**
 * VAFFEL — kroppen.
 *
 * Objektet er ikkje ei teikning av atten ribber. Det er ein kropp — ein
 * superellipse i planet, dratt oppover med ei midjefunksjon og skoren av
 * ei setegrop — og ribbene er plansnitt gjennom den kroppen. Difor står
 * forma her og ingen annan stad: ribbe, ledd, kuttark og berekning les
 * herifrå, og eit tal på arket er alltid det same talet som teikninga.
 *
 *   x, y  i millimeter frå aksen, verdsfast
 *   z     høgd i millimeter over golvet
 *   u     z normalisert mot setekanten, [0,1]
 *   ρ     kor stort planet er i høgd u, som del av (A, B)
 *
 * Feltet `F` er heile kroppen i éi line: material er der F > 0. Alle fire
 * grensene — planet, setet, bogen og golvet — er skrivne i millimeter, så
 * nullstaden let seg finne med rett interpolasjon uansett kva som bit.
 */
import { CUBE, keep, smooth } from "../core"
import type { Params } from "./params"

/** Marg til kuben. Det som står att er til finérflis og til at ein 500-kube
 *  målt med tommestokk aldri er 500,0. */
const MARGIN = 14

export type Body = {
  p: Params
  /** halve planet etter innpassinga i kuben, mm */
  A: number
  B: number
  /** største ρ over høgda — det er han kuben vert målt mot */
  rhoMax: number
  /** setekanten, mm — toppen av objektet */
  zTop: number
  /** ribbeplana, mm */
  xs: number[]
  ys: number[]
  /** senteravstand mellom ribber, mm */
  pitchX: number
  pitchY: number

  rho(u: number): number
  /** kor stort planet MÅ vera for at (x, y) skal vera inne */
  gOf(x: number, y: number): number
  /** setegropa si overflate over (x, y), mm */
  seatSurf(x: number, y: number): number
  /** undersida: kvelvinga objektet står på bein over, mm */
  arch(x: number, y: number): number
  /** feltet: material der det er positivt, millimeter-skala */
  F(x: number, y: number, z: number): number
  /** dei loddrette stykka med material i søyla (x, y) */
  runsAt(x: number, y: number): [number, number][]
  /** toppen av materialet i søyla, eller −1 om det ikkje er noko der */
  topAt(x: number, y: number): number
}

/** Klokkekurva midja bit med. Ho er aldri null, så kroppen har ikkje eit
 *  knekkpunkt der midja «byrjar» — det finst ikkje eit slikt punkt. */
const bell = (u: number, c: number, w: number) => {
  const t = (u - c) / Math.max(1e-3, w)
  return Math.exp(-t * t)
}

/**
 * Avrunda snitt. Der to grenser møtest med kvar sin radius, er hjørnet ein
 * sirkelboge og ikkje ein spiss — det er setekantradien, og han er ein
 * fysisk kant og ikkje ein pynt: ein skarp finérkant flisar seg.
 */
const roundMin = (a: number, b: number, r: number) => {
  if (r <= 0) return Math.min(a, b)
  if (a >= r || b >= r) return Math.min(a, b)
  const dx = r - a
  const dy = r - b
  return r - Math.hypot(dx, dy)
}

const KROPP_HUGS = keep<Body>(3)
export function makeBody(p: Params): Body {
  return KROPP_HUGS(JSON.stringify(p), () => makeBodyRaw(p))
}

function makeBodyRaw(p: Params): Body {
  const zTop = p.hogd
  const n = p.planN

  const rho = (u: number) => {
    const t = smooth(Math.min(1, Math.max(0, u)))
    const base = p.fot + (p.skulder - p.fot) * t
    return base * (1 - p.midje * bell(u, p.midjeZ, p.midjeW))
  }

  // Kuben er ikkje ein smak. Planet er lineært i A og B, så innpassinga er
  // eitt eksakt steg og ikkje ei leiting: finn det største ρ og skaler.
  let rhoMax = 0
  for (let i = 0; i <= 240; i++) rhoMax = Math.max(rhoMax, rho(i / 240))
  const half = (CUBE - MARGIN) / 2
  const s = Math.min(1, half / (p.planA * rhoMax), half / (p.planB * rhoMax))
  const A = p.planA * s
  const B = p.planB * s

  const gOf = (x: number, y: number) =>
    Math.pow(Math.pow(Math.abs(x) / A, n) + Math.pow(Math.abs(y) / B, n), 1 / n)

  // Setet har sitt eige plan, og gropa vert målt i det. Elles ville ei brei
  // fot flytt botnen i gropa utan at nokon rørte setet.
  const rt = rho(1)
  const As = A * rt
  const Bs = B * rt
  const seatSurf = (x: number, y: number) => {
    const q = Math.min(
      1,
      Math.pow(Math.pow(Math.abs(x) / As, n) + Math.pow(Math.abs(y) / Bs, n), 1 / n),
    )
    const dish = p.sokk * (1 - Math.pow(q, 1.4))
    // Lårlette: framkanten fell, og berre framkanten. Ein sal som fell i
    // begge endar er ein sal ein glir bakover i.
    const fx = Math.max(0, x / As)
    return zTop - dish - p.framkant * fx * fx
  }

  // Skalaen planleddet vert rekna om til millimeter med. ρ er ein del av
  // planet; gradienten hans er kring A i den eine leia og B i den andre,
  // og eit felt som blandar millimeter og delar interpolerer feil.
  const scale = (A + B) / 2

  // Kvelvinga høyrer til KROPPEN og ikkje til den einskilde ribba.
  //
  // Det er ikkje ei forenkling — det er det som gjer at rutenettet let seg
  // byggje. Har kvar ribbe sin eigen boge, byrjar X-ribba og Y-ribba i
  // ulik høgd der dei kryssar, og då må det eine sporet gå heilt frå
  // underkanten på ribba og opp gjennom det meste av henne. Med éi felles
  // kvelving er over- og underkanten den SAME i kvart kryss, og begge
  // spora vert nøyaktig halve overlappet.
  // Kvelvinga er eit KRYSS i planet og ikkje ein kuppel.
  //
  // Ein kuppel let att ein samanhengande ring av gods heile vegen kring
  // foten, og då står objektet som ei tromle: opninga er der, men ho er
  // gøymd bak ribbene i ytterkanten. Eit kryss opnar seg heilt ut til
  // kanten i begge leier, og då står det som det er — fire bein i hjørna,
  // med ein boge på kvar av dei fire sidene.
  const awx = p.bogeB * A * rho(0)
  const awy = p.bogeB * B * rho(0)
  const ah = p.bogeH * zTop
  const m = p.bogeN
  const one = (v: number, w: number) => {
    const q = Math.abs(v) / w
    return q >= 1 ? 0 : Math.pow(1 - Math.pow(q, m), 1 / m)
  }
  const arch = (x: number, y: number) => {
    if (ah <= 0 || awx <= 1e-3 || awy <= 1e-3) return 0
    return ah * Math.max(one(x, awx), one(y, awy))
  }

  const F = (x: number, y: number, z: number) => {
    const fPlan = (rho(z / zTop) - gOf(x, y)) * scale
    const fSeat = seatSurf(x, y) - z
    return Math.min(roundMin(fSeat, fPlan, p.kantR), z - arch(x, y))
  }

  // Midja kan bite djupare enn foten er brei. Då er søyla to stykke med
  // luft imellom, og det er ikkje ein feil — det er midja sett frå sida.
  //
  // Alt i feltet som ikkje avheng av z — planet, setet og bogen — vert
  // rekna ÉIN gong per søyle i staden for éin gong per prøvepunkt. Søyla
  // vert prøvd fleire hundre gonger (192 steg pluss bisekten), og gOf,
  // seatSurf og arch er dei dyre ledda; utan dette er runsAt det som et
  // heile byggjetida til rutenettet.
  const NZ = 192
  const runsAt = (x: number, y: number): [number, number][] => {
    const g0 = gOf(x, y)
    const s0 = seatSurf(x, y)
    const a0 = arch(x, y)
    const fz = (z: number) =>
      Math.min(roundMin(s0 - z, (rho(z / zTop) - g0) * scale, p.kantR), z - a0)
    const out: [number, number][] = []
    let z0 = -1
    let prev = fz(0) > 0
    if (prev) z0 = 0
    for (let i = 1; i <= NZ; i++) {
      const z = (i / NZ) * zTop
      const cur = fz(z) > 0
      if (cur === prev) continue
      // bisekt kantane: eit halvt millimeter feil her er ei ribbe som ikkje
      // møter naboen sin i leddet
      let lo = ((i - 1) / NZ) * zTop
      let hi = z
      for (let k = 0; k < 22; k++) {
        const m = (lo + hi) / 2
        if (fz(m) > 0 === prev) lo = m
        else hi = m
      }
      const zc = (lo + hi) / 2
      if (cur) z0 = zc
      else if (z0 >= 0) out.push([z0, zc])
      prev = cur
    }
    if (prev && z0 >= 0) out.push([z0, zTop])
    return out
  }

  const topAt = (x: number, y: number) => {
    const r = runsAt(x, y)
    return r.length ? r[r.length - 1][1] : -1
  }

  // Ribbene står i cellesenter og ikkje på cellekantar. Ei ribbe på kanten
  // av planet er ei ribbe med null breidd, og ho ville telje som ein del,
  // stå i kuttlista og ikkje bera noko.
  //
  // Rekkja er dessutan trekt inn frå kanten med det eit ledd treng av
  // skulder. Ei ribbe heilt ute ved kanten kryssar naboen sin så nær
  // ytterkanten hans at sporet kappar av ein flis i staden for å gripe i
  // han — og eit kryss utan grep er ikkje eit ledd, det er to plater som
  // ligg inntil kvarandre.
  const inset = p.ribbT / 2 + 20
  const Ax = Math.max(p.ribbT, A * rhoMax - inset)
  const By = Math.max(p.ribbT, B * rhoMax - inset)
  const pitchX = (2 * Ax) / p.ribbX
  const pitchY = (2 * By) / p.ribbY
  const xs: number[] = []
  const ys: number[] = []
  for (let i = 0; i < p.ribbX; i++) xs.push(-Ax + (i + 0.5) * pitchX)
  for (let j = 0; j < p.ribbY; j++) ys.push(-By + (j + 0.5) * pitchY)

  return {
    p, A, B, rhoMax, zTop, xs, ys, pitchX, pitchY,
    rho, gOf, seatSurf, arch, F, runsAt, topAt,
  }
}
