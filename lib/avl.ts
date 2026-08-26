/**
 * AVL — generativ søk mot mindre materiale.
 *
 * Oppgåva til avlen er den same som oppgåva til møbelet, berre snudd:
 * objektet skal TÅLE lasta frå NS-EN 1728 — det er dei harde reglane,
 * og dei er ikkje til forhandling — og av materialet som er med skal
 * minst mogleg gå gjennom maskina. Målet som vert minimert er difor
 * ikkje massen til det ferdige objektet, men PLATA INN:
 *
 *   matInn = massCut / (rho · plateutnytting)
 *
 * Det er volumet av den stripa plate som faktisk vert kjøpt og skoren,
 * i kubikk — delane pluss avfallet kring dei. Talet fell når delane vert
 * færre, tynnare eller mindre, OG når dei pakkar betre på arket. Dei to
 * optimeringsaksane i prosjektet er altså same tal: avfallet i objektet
 * og avfallet på arket, summert i kubikkdesimeter.
 *
 * Søket er utglødd fjellklatring med frø: same frø gjev same resultat,
 * alltid. Eit steg flyttar eitt til tre band, av og til kastar terningen
 * heilt om — med motoren sin eigen reparasjon — og kvart kandidatpunkt
 * går gjennom motoren sin eigen clamp, så avlen kan aldri skyve eit tal
 * utanfor bandet sitt. Harde brot kostar så mykje at ingen lovleg løysing
 * taper mot ei ulovleg; mjuke brot kostar litt, av di dei er val som skal
 * forsvarast og ikkje veggar.
 */
import {
  MATERIALS,
  capacities,
  seeded,
  type EngineDef,
  type Material,
  type Metrics,
  type ParamBag,
} from "./core"

export type AvlPunkt = {
  p: ParamBag
  /** plata gjennom maskina, dm³ */
  matInn: number
  /** ferdig masse, kg */
  mass: number
  /** masse som kutta, kg */
  massCut: number
  /** medgått plateareal, m² */
  plateM2: number
  /** netto delareal delt på medgått plateareal */
  sheetUtil: number
  /** strukturell utnytting under 1600 N, 1,0 er kapasiteten */
  util: number
  sheets: number
  harde: number
  mjuke: number
  score: number
}

export type AvlResultat = {
  start: AvlPunkt
  beste: AvlPunkt
  /** kvar gong beste vart bytt: stegnummeret og punktet */
  spor: { steg: number; punkt: AvlPunkt }[]
  prøvde: number
}

const HARD_STRAFF = 1000
const MJUK_STRAFF = 0.6

function vurder(eng: EngineDef, p: ParamBag): AvlPunkt {
  const m: Metrics = eng.measure(p)
  const r = eng.rules(p, m)
  const harde = r.filter((q) => q.hard && !q.ok).length
  const mjuke = r.filter((q) => !q.hard && !q.ok).length
  const mat = (typeof p.material === "string" && p.material in MATERIALS
    ? p.material
    : "bjork") as Material
  const { rho } = capacities(mat)
  const matInn = (m.massCut / rho / Math.max(m.sheetUtil, 0.02)) * 1000
  return {
    p,
    matInn,
    mass: m.mass,
    massCut: m.massCut,
    plateM2: m.sheetArea / 1e6,
    sheetUtil: m.sheetUtil,
    util: m.util,
    sheets: m.sheets,
    harde,
    mjuke,
    score: matInn + harde * HARD_STRAFF + mjuke * MJUK_STRAFF,
  }
}

/** tilnærma normalfordelt i [-1,5, 1,5] — nok klokke for eit steg */
const gauss = (rnd: () => number) => rnd() + rnd() + rnd() - 1.5

export type AvlVal = {
  steg?: number
  frø?: string
  locked?: ReadonlySet<string>
  /** vert kalla kvar gong beste vert bytt */
  påBetre?: (steg: number, punkt: AvlPunkt) => void
}

/**
 * Søket som generator: eitt kall, eitt steg. Arbeidaren treng denne forma —
 * han er éin tråd, og eit søk som køyrer i eitt jafs ville halde skyvarane
 * fastlåste i sekund. Med generatoren kan han ta eit steg, sleppe køen til,
 * og halde fram — eller leggje frå seg heile søket når eit nyare punkt tek
 * over.
 */
export function* avlGen(
  eng: EngineDef,
  start: ParamBag,
  val: AvlVal = {},
): Generator<{ steg: number; beste: AvlPunkt }, AvlResultat> {
  const steg = val.steg ?? 160
  const locked = val.locked ?? new Set<string>()
  const rnd = seeded(val.frø ?? `avl-${eng.id}`)

  const p0 = eng.clamp(start, eng.defaults)
  const s0 = vurder(eng, p0)

  let noverande = s0
  let beste = s0
  const spor: AvlResultat["spor"] = []

  // banda som kan flyttast: numeriske, ulåste
  const frie = eng.keys.filter(
    (k) => !locked.has(k) && typeof p0[k] === "number" && eng.ranges[k],
  )
  const materialFri = !locked.has("material")
  const materialar = Object.keys(MATERIALS)

  // utgløding: store steg fyrst, små til slutt. Temperaturen er i same
  // eining som målet (dm³), så eit oppoversteg på ein tidels liter er
  // sannsynleg tidleg og utenkjeleg seint.
  const T0 = Math.max(0.4, s0.matInn * 0.06)
  const T1 = T0 * 0.02

  for (let i = 0; i < steg; i++) {
    const t = steg > 1 ? i / (steg - 1) : 1
    const T = T0 * Math.pow(T1 / T0, t)
    const skala = 0.22 * (1 - t) + 0.02

    let kandidat: ParamBag
    const kast = rnd()
    if (kast < 0.06) {
      // terningen, med motoren sin eigen reparasjon — hopp ut av dalen
      kandidat = eng.random(rnd, noverande.p, locked)
    } else if (kast < 0.1 && materialFri) {
      const andre = materialar.filter((q) => q !== noverande.p.material)
      kandidat = { ...noverande.p, material: andre[Math.floor(rnd() * andre.length)] }
    } else {
      const n = 1 + Math.floor(rnd() * 3)
      const b: ParamBag = { ...noverande.p }
      for (let j = 0; j < n && frie.length; j++) {
        const k = frie[Math.floor(rnd() * frie.length)]
        const r = eng.ranges[k]
        const v = b[k] as number
        b[k] = v + gauss(rnd) * (r.max - r.min) * skala
      }
      kandidat = b
    }

    const klemd = eng.clamp(kandidat, noverande.p)
    const s = vurder(eng, klemd)

    const d = s.score - noverande.score
    if (d <= 0 || rnd() < Math.exp(-d / T)) noverande = s

    // beste er alltid eit LOVLEG punkt om noko lovleg er funne
    const betre =
      (s.harde === 0 && beste.harde > 0) ||
      ((s.harde === 0) === (beste.harde === 0) && s.score < beste.score)
    if (betre) {
      beste = s
      spor.push({ steg: i, punkt: s })
      val.påBetre?.(i, s)
    }

    yield { steg: i, beste }
  }

  return { start: s0, beste, spor, prøvde: steg }
}

/** heile søket i eitt: same generator, driven til botns */
export function avl(eng: EngineDef, start: ParamBag, val: AvlVal = {}): AvlResultat {
  const g = avlGen(eng, start, val)
  let r = g.next()
  while (!r.done) r = g.next()
  return r.value
}

/** den delbare lenkja til eit punkt — same form som studioen skriv */
export function lenkje(engineId: string, p: ParamBag, view = "kontur"): string {
  return (
    "https://50x50x50.iverfinne.no/#p=" +
    encodeURIComponent(JSON.stringify({ engine: engineId, ...p, view }))
  )
}
