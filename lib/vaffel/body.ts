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
  /** setekanten, mm — der planet sluttar å stige */
  zTop: number
  /** toppen av materialet, mm — setekanten pluss ryggen */
  zHigh: number
  /** ribbeplana, mm */
  xs: number[]
  ys: number[]
  /** senteravstand mellom ribber, mm */
  pitchX: number
  pitchY: number

  rho(u: number): number
  /** kor langt planet har sige framover i høgd u, mm */
  sig(u: number): number
  /** kor stort planet MÅ vera for at (x, y) skal vera inne i høgd u */
  gOf(x: number, y: number, u: number): number
  /** setegropa si overflate over (x, y), mm — ryggen medrekna */
  seatSurf(x: number, y: number): number
  /** sitjeflata åleine: gropa utan ryggen bak, mm */
  sitSurf(x: number, y: number): number
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
  //
  // Sige tel med i den same rekninga. Planet vandrar |lut|·s i X på vegen
  // opp, og vandringa er sentrert kring aksen, so kuben må ta halve planet
  // PLUSS halve vandringa i den eine leia — då er innpassinga framleis eitt
  // steg, av di s står på begge sider av likskapen.
  let rhoMax = 0
  for (let i = 0; i <= 240; i++) rhoMax = Math.max(rhoMax, rho(i / 240))
  const half = (CUBE - MARGIN) / 2
  const s = Math.min(
    1,
    half / (p.planA * rhoMax + Math.abs(p.lut) / 2),
    half / (p.planB * rhoMax),
  )
  const A = p.planA * s
  const B = p.planB * s

  // Sige: heile vandringa er `lean`, og ho er delt likt om aksen. Difor står
  // føtene der dei stod då planet var loddrett — det er berre TOPPEN som
  // heng framom dei, og omhylet er like breitt til begge sider.
  const lean = p.lut * s
  const sig = (u: number) => lean * smooth(u) - lean / 2
  const xFoot = sig(0)
  const xSeat = sig(1)

  const gOf = (x: number, y: number, u: number) =>
    Math.pow(Math.pow(Math.abs(x - sig(u)) / A, n) + Math.pow(Math.abs(y) / B, n), 1 / n)

  // Setet har sitt eige plan, og gropa vert målt i det. Elles ville ei brei
  // fot flytt botnen i gropa utan at nokon rørte setet. Planet er sige fram
  // til xSeat i denne høgda, so gropa vert målt derifrå.
  const rt = rho(1)
  const As = A * rt
  const Bs = B * rt
  const sitSurf = (x: number, y: number) => {
    const xs = x - xSeat
    const q = Math.min(
      1,
      Math.pow(Math.pow(Math.abs(xs) / As, n) + Math.pow(Math.abs(y) / Bs, n), 1 / n),
    )
    const dish = p.sokk * (1 - Math.pow(q, 1.4))
    // Lårlette: framkanten fell, og berre framkanten. Ein sal som fell i
    // begge endar er ein sal ein glir bakover i.
    const fx = Math.max(0, xs / As)
    return zTop - dish - p.framkant * fx * fx
  }
  // Ryggen stig BAK, og han byrjar med null verdi og null stigning ved
  // 0,35 av setedjupna: gropa der ein faktisk kviler skal stå urørd, so
  // stiginga kan ikkje ha eit knekkpunkt inne i henne.
  const backRise = (x: number) => p.rygg * smooth((-(x - xSeat) / As - 0.35) / 0.65)
  const seatSurf = (x: number, y: number) => sitSurf(x, y) + backRise(x)
  const zHigh = zTop + p.rygg

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
  // Breidda er delt i to leier: same tal i begge er den gamle symmetriske
  // kvelvinga, ulike tal er portalen — brei den eine vegen, smal den andre.
  const awx = p.bogeBX * A * rho(0)
  const awy = p.bogeBY * B * rho(0)
  const ah = p.bogeH * zTop
  const m = p.bogeN
  const one = (v: number, w: number) => {
    const q = Math.abs(v) / w
    return q >= 1 ? 0 : Math.pow(1 - Math.pow(q, m), 1 / m)
  }
  // Kvelvinga står på FØTENE og ikkje på aksen: sig planet framover, fylgjer
  // opninga med, elles ville det eine beinet verta kappa og det andre stå
  // att som ein klump.
  const arch = (x: number, y: number) => {
    if (ah <= 0 || awx <= 1e-3 || awy <= 1e-3) return 0
    return ah * Math.max(one(x - xFoot, awx), one(y, awy))
  }

  const F = (x: number, y: number, z: number) => {
    const u = z / zTop
    const fPlan = (rho(u) - gOf(x, y, u)) * scale
    const fSeat = seatSurf(x, y) - z
    return Math.min(roundMin(fSeat, fPlan, p.kantR), z - arch(x, y))
  }

  // Midja kan bite djupare enn foten er brei. Då er søyla to stykke med
  // luft imellom, og det er ikkje ein feil — det er midja sett frå sida.
  //
  // Alt i feltet som ikkje avheng av z — setet, bogen og y-leddet i planet
  // — vert rekna ÉIN gong per søyle i staden for éin gong per prøvepunkt.
  // Søyla vert prøvd fleire hundre gonger (192 steg pluss bisekten), og
  // seatSurf og arch er dei dyre ledda; utan dette er runsAt det som et
  // heile byggjetida til rutenettet.
  //
  // Søyla vert prøvd heilt opp til zHigh og ikkje til setekanten: stig
  // setet bak, ligg toppen av materialet over kanten, og eit spor som
  // stoggar ved kanten bryt ikkje gjennom.
  const NZ = 192
  const runsAt = (x: number, y: number): [number, number][] => {
    // Planleddet på tvers av sige er det einaste som ikkje let seg heise ut
    // av søyla lenger: sige er ein funksjon av høgda. Y-leddet står att.
    const cy = Math.pow(Math.abs(y) / B, n)
    const s0 = seatSurf(x, y)
    const a0 = arch(x, y)
    const fz = (z: number) => {
      const u = z / zTop
      const g0 = Math.pow(Math.pow(Math.abs(x - sig(u)) / A, n) + cy, 1 / n)
      return Math.min(roundMin(s0 - z, (rho(u) - g0) * scale, p.kantR), z - a0)
    }
    const out: [number, number][] = []
    let z0 = -1
    let prev = fz(0) > 0
    if (prev) z0 = 0
    for (let i = 1; i <= NZ; i++) {
      const z = (i / NZ) * zHigh
      const cur = fz(z) > 0
      if (cur === prev) continue
      // bisekt kantane: eit halvt millimeter feil her er ei ribbe som ikkje
      // møter naboen sin i leddet
      let lo = ((i - 1) / NZ) * zHigh
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
    if (prev && z0 >= 0) out.push([z0, zHigh])
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
    p, A, B, rhoMax, zTop, zHigh, xs, ys, pitchX, pitchY,
    rho, sig, gOf, seatSurf, sitSurf, arch, F, runsAt, topAt,
  }
}
