/**
 * SANDKASSE — reglane.
 *
 * Ein sandkasse som berre teiknar er ein demonstrasjon. Det som gjer han til
 * ein reiskap er at han seier nei: at eit tal på skjermen kan slå fast at
 * objektet ikkje let seg byggja, ikkje let seg sitja på, eller ikkje lenger
 * er svar på oppgåva.
 *
 * Ein hard regel er brot: objektet er ikkje byggjeleg eller går utanfor
 * kuben. Ein mjuk regel er eit val — han kan stå, men den som let han stå
 * skal ha sett kva han kostar. Difor har kvar regel ei grunngjeving og
 * ikkje berre eit tal.
 *
 * Reglane les måla frå `metrics` der dei finst. Det som ikkje finst der —
 * godset i eit lag, opninga mellom to delar i same lag, foten mot golvet —
 * vert målt her, av di dei tala berre gjev meining som ein terskel og ikkje
 * som ei rad i ein tabell.
 */
import { makeShell, planArcs, type Shell } from "./field"
import type { Metrics } from "./metrics"
import { CUBE, type Params } from "./params"

const TAU = Math.PI * 2

export type Rule = {
  id: string
  label: string
  ok: boolean
  hard: boolean
  value: string
  why: string
}

/** fingerfella: ei opning i dette bandet tek ein finger og held han */
const TRAP_LO = 5
const TRAP_HI = 25

const mm = (v: number) => (Number.isFinite(v) ? v.toFixed(0) : "–")
const mm1 = (v: number) => (Number.isFinite(v) ? v.toFixed(1) : "–")

/**
 * Midtplanet i kvart lag, med same lagdeling som `buildStack`: er resten
 * øvst tynnare enn ei halv plate, vert ho slegen saman med laget under i
 * staden for å stå som ei flis for seg. Reglane må sjå dei same laga som
 * kuttlista, elles vaktar dei eit objekt som ingen kjem til å byggja.
 */
function layerMids(sh: Shell, p: Params): number[] {
  let n = Math.max(2, Math.ceil(sh.zTop / p.plyT))
  if (n > 2 && sh.zTop - (n - 1) * p.plyT < p.plyT * 0.5) n -= 1
  const out: number[] = []
  for (let i = 0; i < n; i++) {
    const z0 = i * p.plyT
    const z1 = i === n - 1 ? sh.zTop : Math.min(sh.zTop, z0 + p.plyT)
    out.push(Math.min(sh.zTop - 0.01, (z0 + z1) / 2))
  }
  return out
}

/**
 * Kor smalt godset vert i eit lagplan, målt utanom eggkanten.
 *
 * Talet er den vassrette breidda av veggen i snittplanet, altså tjukna
 * gonga med den vassrette delen av normalen. Det er ikkje det same som
 * breidda på delen `buildStack` kuttar — den kutta delen dekkjer heile
 * høgda til laget og vert difor breiare der veggen legg seg ned — men det
 * er det som står att som gods etter slipinga, og det er òg akkurat den
 * overlappen to lag har mot kvarandre i limfuga.
 *
 * Punkt inne i eggkantbandet vert hoppa over: der er tjukna meint å gå ned
 * mot `edgeT`, og det er regel 6 som vaktar det talet.
 */
function godsMin(sh: Shell, p: Params): number {
  const NT = 240
  let best = Infinity
  for (const z of layerMids(sh, p)) {
    for (let k = 0; k < NT; k++) {
      const th = (k / NT) * TAU
      if (z > sh.rimZ(th) || sh.matAt(th, sh.hOf(z)) < 1) continue
      const t = sh.wall(th, z)
      if (t < p.shellT - 0.01) continue
      const n = sh.normal(th, z)
      const w = t * Math.hypot(n[0], n[1])
      if (w < best) best = w
    }
  }
  return Number.isFinite(best) ? best : 0
}

/**
 * Står objektet på golvet, og på kor mange skilde flater?
 *
 * Ein samanhengande ring heile vegen rundt er éi flate, men det er den
 * beste foten som finst — difor må ringen skiljast frå den eine lause
 * biten før talet kan brukast til noko.
 */
function floorPatches(sh: Shell): { patches: number; ring: boolean } {
  const N = 720
  const on: boolean[] = []
  for (let i = 0; i < N; i++) on.push(sh.matAt((i / N) * TAU, 0) >= 1)
  if (on.every(Boolean)) return { patches: 1, ring: true }
  let n = 0
  for (let i = 0; i < N; i++) if (!on[i] && on[(i + 1) % N]) n++
  return { patches: n, ring: false }
}

/**
 * Opningane mellom delar i same lag.
 *
 * To delar i eit lag er skilde av ei opning, og opninga er trongast mellom
 * endeflatene. Både ytre og indre hjørne vert prøvde: det er tilfeldig kva
 * for eit av dei som står nærast når veggen heller.
 *
 * Ein returnerer alle opningane og ikkje berre den minste — fingerfella er
 * eit band, ikkje ei nedre grense, så ei opning midt inne i bandet er verre
 * enn ei som er mindre enn heile bandet.
 */
function gaps(sh: Shell, p: Params): number[] {
  const out: number[] = []
  for (const z of layerMids(sh, p)) {
    const runs = planArcs(sh, z, 360)
    if (runs.length < 2) continue
    const [cx, cy] = sh.spine(sh.hOf(z))
    const corner = (a: { th: number; ro: number; ri: number }, r: number): [number, number] => [
      cx + r * Math.cos(a.th),
      cy + r * Math.sin(a.th),
    ]
    for (let a = 0; a < runs.length; a++) {
      const A = runs[a][runs[a].length - 1]
      const B = runs[(a + 1) % runs.length][0]
      let d = Infinity
      for (const ra of [A.ro, A.ri]) {
        for (const rb of [B.ro, B.ri]) {
          const pa = corner(A, ra)
          const pb = corner(B, rb)
          d = Math.min(d, Math.hypot(pa[0] - pb[0], pa[1] - pb[1]))
        }
      }
      if (Number.isFinite(d)) out.push(d)
    }
  }
  return out
}

export function checkRules(p: Params, m: Metrics): Rule[] {
  // Reglane 9 og 12 les geometrien direkte, så skalet må byggjast her. Det
  // er billeg mot resten av målinga, og eit felles skal held dei to måla i
  // takt med kvarandre.
  const sh = makeShell(p)
  const rules: Rule[] = []
  const add = (r: Rule) => rules.push(r)

  // --- 1 kuben -------------------------------------------------------------
  const envMax = Math.max(m.envX, m.envY, m.envZ)
  add({
    id: "kube",
    label: "kuben",
    hard: true,
    ok: envMax <= CUBE + 1e-6,
    value: `${mm1(m.envX)} × ${mm1(m.envY)} × ${mm1(m.envZ)} mm`,
    why: "Oppgåva er kuben, og eit objekt som ikkje går inn i han svarar ikkje lenger på henne — kor godt det elles måtte sitja.",
  })

  // --- 2 setehøgd ----------------------------------------------------------
  add({
    id: "setehogd",
    label: "setehøgd",
    hard: false,
    ok: m.seatZ >= 380 && m.seatZ <= 480,
    value: `${mm(m.seatZ)} mm`,
    why: "Under 380 mm pressar setet knea opp mot brystet, over 480 mm heng føtene i lause lufta; NS-EN 1729 og Pheasant si Bodyspace kjem til det same bandet frå kvar si side.",
  })

  // --- 3 veltevinkel -------------------------------------------------------
  add({
    id: "velte",
    label: "veltevinkel",
    hard: true,
    ok: m.tipAngle >= 15,
    value: `${mm1(m.tipAngle)}° · arm ${mm(m.tipArm)} mm`,
    why: "Ein krakk som går rundt når nokon lener seg utover er farleg lenge før han er stygg; Stool 60 har 23 grader å gå på.",
  })

  // --- 4 bein --------------------------------------------------------------
  const fl = floorPatches(sh)
  add({
    id: "bein",
    label: "bein på golvet",
    hard: true,
    ok: fl.ring || m.contacts >= 3,
    value: fl.ring ? "samanhengande ring" : `${mm(m.contacts)} flater`,
    why: "Tre punkt legg eit plan og vaggar ikkje; med to står objektet og vippar same kor jamt golvet er.",
  })

  // --- 5 utnytting ---------------------------------------------------------
  add({
    id: "utnytting",
    label: "utnytting",
    hard: true,
    ok: m.util <= 1,
    value: `${(m.util * 100).toFixed(0)} % · σc ${m.sigmaC.toFixed(2)} + σm ${m.sigmaM.toFixed(2)} MPa`,
    why: "Over 1,0 er lasta større enn materialet toler etter NS-EN 1995-1-1, og då er resten av teikninga likegyldig.",
  })

  // --- 6 eggkant -----------------------------------------------------------
  add({
    id: "eggkant",
    label: "eggkant",
    hard: false,
    ok: p.edgeT < p.shellT && p.edgeT >= 2.5,
    value: `${mm1(p.edgeT)} mm mot ${mm1(p.shellT)} mm`,
    why: "Eggkanten skal lesast som ein kant og ikkje som ein avkutta vegg, men under 2,5 mm flisar finérlaga seg opp i staden for å slipast reine.",
  })

  // --- 7 skål --------------------------------------------------------------
  add({
    id: "skal",
    label: "brukbar skål",
    hard: false,
    ok: m.dishW >= 240 && m.dishD >= 280,
    value: `${mm(m.dishW)} × ${mm(m.dishD)} mm`,
    why: "Ei sitjeflate smalare enn eit sete er ikkje eit sete; kring 240 × 280 mm er der ein vaksen framleis får plass til begge sitjebeina utan å balansera.",
  })

  // --- 8 rimet -------------------------------------------------------------
  add({
    id: "rim",
    label: "rimet",
    hard: false,
    ok: m.rimSpan >= 0.6 * 360,
    value: `${mm(m.rimSpan)}° av 360°`,
    why: "Rimet er opplandet setekanten heng i; er meir enn to femtedelar av det ete opp av opningar, har setet ikkje noko å festa seg i.",
  })

  // --- 9 gods --------------------------------------------------------------
  const gods = godsMin(sh, p)
  add({
    id: "gods",
    label: "smalaste gods",
    hard: false,
    ok: gods >= 8,
    value: `${mm1(gods)} mm`,
    why: "Det som står att mellom ytter- og innerflata er både det som ber lasta og heile limflata mot laget under; under åtte millimeter er det for lite til begge delar.",
  })

  // --- 10 lagtal -----------------------------------------------------------
  add({
    id: "lagtal",
    label: "tal lag",
    hard: false,
    ok: m.layers <= 44,
    value: `${mm(m.layers)} lag · ${mm(m.parts)} delar`,
    why: "Kvart lag er ei oppspenning, ei liming og ei tørketid; over 44 lag er limjobben ei sak for ein verkstad og ikkje for ein person.",
  })

  // --- 11 rygg -------------------------------------------------------------
  add({
    id: "rygg",
    label: "ryggen",
    hard: false,
    ok: p.finRise <= 0 || m.finRise >= 60,
    value: p.finRise <= 0 ? "ingen rygg" : `${mm(m.finRise)} mm`,
    why: "Ein rygg som reiser seg under seksti millimeter når ikkje opp til ryggen på nokon; han vert ein kant å setja seg fast i i staden for noko å lena seg mot.",
  })

  // --- 12 klemfare ---------------------------------------------------------
  const g = gaps(sh, p)
  const trapped = g.filter((v) => v >= TRAP_LO && v < TRAP_HI)
  const worst = trapped.length ? Math.min(...trapped) : g.length ? Math.min(...g) : NaN
  add({
    id: "klemfare",
    label: "klemfare",
    hard: false,
    ok: trapped.length === 0,
    value: g.length === 0 ? "ingen opning" : `minste opning ${mm1(worst)} mm`,
    why: "Ei opning mellom fem og tjuefem millimeter tek ein finger og slepper han ikkje att; ho skal anten vera for trong til å koma inn i eller vid nok til å koma ut av.",
  })

  // --- 13 topplaget --------------------------------------------------------
  // Det øvste laget er det minste, og det er òg det som ber ryggen.
  // Same samanslåing av flisa som `buildStack` gjer, slik at regelen ser
  // det same laget som fresen ville skore.
  let nL = Math.max(2, Math.ceil(sh.zTop / p.plyT))
  if (nL > 2 && sh.zTop - (nL - 1) * p.plyT < p.plyT * 0.5) nL -= 1
  const zTopLayer = (nL - 1) * p.plyT
  let topArea = 0
  for (const arc of planArcs(sh, Math.min(sh.zTop - 0.4, zTopLayer + 0.4), 720)) {
    for (let i = 0; i + 1 < arc.length; i++) {
      let d = arc[i + 1].th - arc[i].th
      if (d > Math.PI) d -= 2 * Math.PI
      if (d < -Math.PI) d += 2 * Math.PI
      const ro = (arc[i].ro + arc[i + 1].ro) / 2
      const ri = (arc[i].ri + arc[i + 1].ri) / 2
      topArea += 0.5 * (ro * ro - ri * ri) * Math.abs(d)
    }
  }
  add({
    id: "topplag",
    label: "øvste laget",
    hard: false,
    ok: topArea >= 300,
    value: `${mm1(topArea / 100)} cm²`,
    why: "Ein del på nokre få kvadratcentimeter let seg korkje spenna opp under fresen eller pressast i limjiggen, og han er det som ber ryggen.",
  })

  // --- 14 skåldjupn --------------------------------------------------------
  add({
    id: "skaldjupn",
    label: "skåldjupn",
    hard: false,
    ok: m.dishDepth >= 25 && m.dishDepth <= 60,
    value: `${mm1(m.dishDepth)} mm`,
    why: "For grunn skål gjev inga plassering å sitja i, for djup gjer at ein må klatra opp av krakken for å reisa seg.",
  })

  return rules
}
