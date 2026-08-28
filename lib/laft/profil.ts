/**
 * LAFT — platene og ledda.
 *
 * Her bur heile geometrien, og han bur berre her: kuttarket, nettet,
 * måltavla og lastmodellen les alle DENNE fila. Kvar del er ein lukka
 * kontur i sitt eige plan pluss ei plassering i rommet, og det er alt eit
 * flatpakka møbel ER.
 *
 * DEI FIRE PLATENE OG KILEN:
 *
 *   sete   ligg vassrett, vippa bakover kring framkanten. To gjennomgåande
 *          spor tek tappane på bladene; eitt spor på tvers tek tunga til
 *          ryggen.
 *   bein   to blad som står i sideplana, med tappar opp gjennom setet og
 *          eit skrått spor i toppkanten der ryggen lafter seg ned i dei.
 *   rygg   ei plate som lener seg bakover og går NED gjennom setet. Under
 *          setet har tunga to hakk som femner om bladene, og eit spor for
 *          kilen. Bereholet er det einaste hòlet som ikkje er eit ledd.
 *   kile   står i sideplanet som bladene, vert slegen ned gjennom sporet i
 *          tunga, og bér opp mot undersida av setet. Skuldra på ryggen
 *          ligg over setet, kilen under: plata er klemd mellom dei to, og
 *          då sit heile møbelet. Han er den einaste delen som er RETT å
 *          kutte i eit anna treslag — han skal vera synleg.
 *
 * INGEN LIM, INGEN SKRUAR. Rekkjefylgja er: reis bladene, slepp setet ned
 * på tappane, slepp ryggen ned gjennom setet, slå kilen.
 */
import { bbox, shoelace, type Pt, type Vec3 } from "../core"
import { materialet, type Params } from "./params"

const RAD = Math.PI / 180

/** Plasseringa av ei plate: origo og to aksar i planet. Tjukna går langs
 *  normalen, og konturen er FRAMSIDA — baksida ligg ei tjukn bak. */
export type Plass = { o: Vec3; u: Vec3; v: Vec3; n: Vec3 }

export type DelKind = "sete" | "bein" | "rygg" | "kile"

export type Del = {
  id: string
  kind: DelKind
  /** lukka kontur i planet, mot klokka */
  outline: Pt[]
  /** hòl og gjennomgåande spor, med klokka */
  holes: Pt[][]
  plass: Plass
  t: number
}

// =============================================================================
// SMÅVERKTØY
// =============================================================================
const kryss = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
]

/** ei lukka rekkje mot klokka, uansett kva vegen ho kom inn */
const motKlokka = (ring: Pt[]): Pt[] => (shoelace(ring) < 0 ? ring.slice().reverse() : ring)
/** eit hòl går motsett veg av konturen */
const medKlokka = (ring: Pt[]): Pt[] => (shoelace(ring) > 0 ? ring.slice().reverse() : ring)

/** rektangel som ring */
function rekt(cx: number, cy: number, w: number, h: number): Pt[] {
  const a = w / 2
  const b = h / 2
  return [
    [cx - a, cy - b],
    [cx + a, cy - b],
    [cx + a, cy + b],
    [cx - a, cy + b],
  ]
}

/** kapselen: eit langhòl med halvrunde endar — bereholet og spora */
function kapsel(cx: number, cy: number, len: number, r: number, n = 10): Pt[] {
  const L = Math.max(0, len / 2 - r)
  const ut: Pt[] = []
  for (let i = 0; i <= n; i++) {
    const a = -Math.PI / 2 + (i / n) * Math.PI
    ut.push([cx + L + r * Math.cos(a), cy + r * Math.sin(a)])
  }
  for (let i = 0; i <= n; i++) {
    const a = Math.PI / 2 + (i / n) * Math.PI
    ut.push([cx - L + r * Math.cos(a), cy + r * Math.sin(a)])
  }
  return ut
}

/**
 * Runda hjørne. Kvart hjørne vert bytt med ein bogé av radien, klemd av
 * dei to kantane som møtest — eit hjørne mellom to stutte kantar kan ikkje
 * runde meir enn kantane held. Det er den einaste staden i motoren
 * geometrien mjuknar; alt anna er rette snitt og spor.
 */
function rundHjorne(ring: Pt[], r: number, n = 5): Pt[] {
  const m = ring.length
  if (r < 0.5 || m < 3) return ring
  const ut: Pt[] = []
  for (let i = 0; i < m; i++) {
    const p0 = ring[(i + m - 1) % m]
    const p1 = ring[i]
    const p2 = ring[(i + 1) % m]
    let ax = p0[0] - p1[0]
    let ay = p0[1] - p1[1]
    let bx = p2[0] - p1[0]
    let by = p2[1] - p1[1]
    const la = Math.hypot(ax, ay)
    const lb = Math.hypot(bx, by)
    if (la < 1e-6 || lb < 1e-6) {
      ut.push(p1)
      continue
    }
    ax /= la
    ay /= la
    bx /= lb
    by /= lb
    const cosv = Math.max(-1, Math.min(1, ax * bx + ay * by))
    const v = Math.acos(cosv)
    // nesten rett line: ingenting å runde
    if (v > Math.PI - 0.12 || v < 0.12) {
      ut.push(p1)
      continue
    }
    const t = Math.min(r / Math.tan(v / 2), la * 0.48, lb * 0.48)
    const A: Pt = [p1[0] + ax * t, p1[1] + ay * t]
    const B: Pt = [p1[0] + bx * t, p1[1] + by * t]
    // sirkelsenteret ligg langs halveringslina
    let mx = ax + bx
    let my = ay + by
    const lm = Math.hypot(mx, my) || 1
    mx /= lm
    my /= lm
    const d = t / Math.cos(v / 2)
    const c: Pt = [p1[0] + mx * d, p1[1] + my * d]
    const rr = Math.abs(t * Math.tan(v / 2))
    let a0 = Math.atan2(A[1] - c[1], A[0] - c[0])
    let a1 = Math.atan2(B[1] - c[1], B[0] - c[0])
    let dA = a1 - a0
    while (dA > Math.PI) dA -= 2 * Math.PI
    while (dA < -Math.PI) dA += 2 * Math.PI
    for (let k = 0; k <= n; k++) {
      const a = a0 + (dA * k) / n
      ut.push([c[0] + rr * Math.cos(a), c[1] + rr * Math.sin(a)])
    }
  }
  return ut
}

/** avlastinga i eit indre hjørne: fresen kan ikkje skjera skarpt, so
 *  hjørnet får eit hòl av fresediameteren. Utan det passar ikkje sporet. */
function avlasting(x: number, y: number, d: number): Pt[] {
  const r = d / 2
  const ut: Pt[] = []
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2
    ut.push([x + r * Math.cos(a), y + r * Math.sin(a)])
  }
  return ut
}

// =============================================================================
// BYGGET
// =============================================================================
export type Bygg = {
  p: Params
  delar: Del[]
  /** setevippen i radianar */
  a: number
  /** ryggleninga i radianar */
  rv: number
  /** setet si overside i høgd z ved vassrett x */
  seteTopp(x: number): number
  /** setet si underside i høgd z ved vassrett x */
  seteUnder(x: number): number
  /** vassrett utstrekning av setet, fram og bak */
  xF: number
  xB: number
  /** føtene sine x, og bladet si halve tjukn i y */
  fotF: number
  fotB: number
  /** fri spennvidd setet har mellom bladene, mm */
  spennFri: number
  /** overhenget setet har utanfor bladet på kvar side, mm */
  overheng: number
}

export function bygg(p: Params): Bygg {
  const a = p.setevipp * RAD
  const rv = p.ryggV * RAD
  const t = p.plyT
  const fit = p.pressfit
  const ca = Math.cos(a)

  // setet er ei PLATE: `djup` er det ein kuttar, og den vassrette
  // utstrekninga er difor litt mindre når plata vippar
  const xF = (p.djup / 2) * ca
  const xB = -xF
  const seteTopp = (x: number) => p.hogd - (xF - x) * Math.tan(a)
  const seteUnder = (x: number) => seteTopp(x) - t / ca

  const fotF = xF + p.framspark
  const fotB = xB - p.bakspark

  // --- kvar ryggen står ---------------------------------------------------
  // Ryggplata lener seg bakover og går ned gjennom setet. Ho kryssar
  // setet ved xR; over setet stig ho bakover, under setet går tunga ned.
  const xR = xB + p.djup * 0.10 * ca + t
  const zR = seteTopp(xR)
  /** eit punkt i ryggplanet: w langs plata frå setekryssinga, u på tvers */
  const ryggPunkt = (w: number): [number, number] => [xR - w * Math.sin(rv), zR + w * Math.cos(rv)]

  // --- SETET --------------------------------------------------------------
  // Konturen i planet: u langs djupna, v på tvers. Fram- og bakkanten
  // bognar med `svai`, og bakkanten bognar INN so han ikkje kolliderer
  // med ryggen som lener seg over han.
  const NU = 16
  const halvD = p.djup / 2
  const halvB = p.breidd / 2
  // sidekantane smalnar litt bakover — det er det som gjer at auget les
  // ein SETEFLATE og ikkje eit brett
  const breiddVed = (u: number) => halvB * (1 - 0.06 * (0.5 - u / p.djup))
  const seteRing: Pt[] = []
  for (let i = 0; i <= NU; i++) {
    const s = i / NU
    const v = -1 + 2 * s
    seteRing.push([halvD + p.svai * p.djup * (1 - v * v) * 0.5, v * breiddVed(halvD)])
  }
  for (let i = 0; i <= NU; i++) {
    const s = i / NU
    const v = 1 - 2 * s
    seteRing.push([-halvD + p.svai * p.djup * (1 - v * v) * 0.5, v * breiddVed(-halvD)])
  }
  const seteOut = motKlokka(rundHjorne(seteRing, p.nase, 6))

  // tappane frå bladene, som gjennomgåande spor. Sporet er så breitt som
  // plata pluss klaringa, og så langt som halsen.
  const seteHol: Pt[][] = []
  const uTapp = 0
  for (const sgn of [-1, 1]) {
    seteHol.push(medKlokka(rekt(uTapp, (sgn * p.spenn) / 2, p.hals, t + fit)))
  }
  // tunga til ryggen: eit spor på tvers. Ei skrå plate skjer BREIARE
  // gjennom ei vassrett plate enn ho er tjukk — difor cosinusen.
  const uR = (xR - 0) / ca
  const sporB = (t + fit) / Math.cos(rv)
  seteHol.push(medKlokka(rekt(uR, 0, sporB, p.ryggF)))
  for (const sv of [-1, 1]) {
    for (const su of [-1, 1]) {
      seteHol.push(
        medKlokka(avlasting(uR + (su * sporB) / 2, (sv * p.ryggF) / 2, p.fresD)),
      )
    }
  }

  const setePlass: Plass = {
    // Konturen ligg i UNDERSIDA og materialet veks opp: `seteTopp` er den
    // flata ein sit PÅ, og då må plata slutte der og ikkje byrje der.
    o: [0, 0, seteTopp(0) - t / ca],
    u: [ca, 0, Math.sin(a)],
    v: [0, 1, 0],
    n: [-Math.sin(a), 0, ca],
  }

  // --- BLADENE ------------------------------------------------------------
  // Profilen i (u, w) = (x, z). Toppkanten fylgjer undersida av setet;
  // framme og bak sparkar bladet ut i føter, og imellom står ein boge.
  const wF = seteUnder(xF)
  const wB = seteUnder(xB)
  const fotL = 46 + 40 * (1 - p.beinsvai)
  const beinRing: Pt[] = []
  beinRing.push([fotF, 0])
  beinRing.push([fotF - fotL, 0])
  // bogen mellom føtene: `beinsvai` gjer han spissare, so beina vert
  // smalare og bladet lettare
  const NB = 30
  const n2 = 2 - 1.35 * p.beinsvai
  const bA = fotF - fotL
  const bB = fotB + fotL
  // Bogen er ein DEL av bladhøgda: han skal la beina bli SLANKE, og eit
  // fast millimetertal gjer berre eit hakk i underkanten på eit høgt blad.
  const bogeH = p.fotboge * Math.min(wF, wB)
  for (let i = 1; i < NB; i++) {
    const s = i / NB
    const x = bA + (bB - bA) * s
    const w = bogeH * Math.pow(Math.max(0, 1 - Math.pow(Math.abs(2 * s - 1), n2)), 1 / n2)
    beinRing.push([x, w])
  }
  beinRing.push([fotB + fotL, 0])
  beinRing.push([fotB, 0])
  beinRing.push([xB, wB])
  // TAPPEN: toppkanten stig gjennom setet og endar i flukt med oversida.
  // Han er ikkje eit påheng — han er sjølve konturen, og det er han som
  // held bladet fast i setet. Halve halsen vert målt i PLANET til setet,
  // so tapp og spor har same lengd når plata vippar.
  const halvTapp = (p.hals / 2) * ca
  beinRing.push([-halvTapp, seteUnder(-halvTapp)])
  beinRing.push([-halvTapp, seteTopp(-halvTapp)])
  beinRing.push([halvTapp, seteTopp(halvTapp)])
  beinRing.push([halvTapp, seteUnder(halvTapp)])
  beinRing.push([xF, wF])
  // liten radius: tappen skal passe eit spor, og eit rundt hjørne som et
  // av skuldra er verre enn eit skarpt som fresen uansett rundar
  const beinOut = motKlokka(rundHjorne(beinRing, Math.min(7, p.nase), 4))

  // sporet der ryggen lafter seg ned i bladet: ei skrå renne frå
  // toppkanten og ned, halve kryssinga djup
  const laftDjup = 34
  const beinHol: Pt[][] = []
  // Kvar ryggplanet FAKTISK kryssar toppkanten: plata lener seg, so
  // krysspunktet ligg eit stykke bak der ho skjer setet si overside.
  // Rekna, ikkje gissa — eit spor på feil stad er eit møbel som ikkje
  // let seg setje saman.
  const sKryss = -(t / ca) / (Math.cos(rv) + Math.sin(rv) * Math.tan(a))
  const beinSporSenter = xR - sKryss * Math.sin(rv)
  {
    const halvS = (t + fit) / 2
    const dx = -Math.sin(rv)
    const dz = Math.cos(rv)
    // toppen av sporet ligg i toppkanten av bladet, botnen `laftDjup` ned
    const topp: Pt = [beinSporSenter, seteUnder(beinSporSenter)]
    const botn: Pt = [topp[0] + dx * -laftDjup, topp[1] + dz * -laftDjup]
    const px = dz
    const pz = -dx
    beinHol.push(
      medKlokka([
        [topp[0] + px * halvS, topp[1] + pz * halvS],
        [botn[0] + px * halvS, botn[1] + pz * halvS],
        [botn[0] - px * halvS, botn[1] - pz * halvS],
        [topp[0] - px * halvS, topp[1] - pz * halvS],
      ]),
    )
    beinHol.push(medKlokka(avlasting(botn[0], botn[1], p.fresD)))
  }

  const beinPlass = (sgn: number): Plass => ({
    o: [0, (sgn * p.spenn) / 2 - t / 2, 0],
    u: [1, 0, 0],
    v: [0, 0, 1],
    n: [0, 1, 0],
  })

  // --- RYGGEN -------------------------------------------------------------
  // Planet: u på tvers (y), w langs plata frå setekryssinga og opp.
  // Under setet går tunga ned; over setet stig ryggen med skuldrer.
  const tunge = 96 + p.plyT * 2
  const wTopp = p.ryggH / Math.cos(rv)
  const NR = 14
  const ryggRing: Pt[] = []
  // tunga, nedanfrå og opp på framsida
  ryggRing.push([-p.ryggF / 2, -tunge])
  ryggRing.push([p.ryggF / 2, -tunge])
  // skuldra rett over setet: her ligg plata OPPÅ setet, og det er skuldra
  // som tek lasta når kilen dreg
  ryggRing.push([p.ryggF / 2, 26])
  for (let i = 1; i <= NR; i++) {
    const s = i / NR
    const w = 26 + (wTopp - 26) * s
    const b = p.ryggF / 2 + (p.ryggT / 2 - p.ryggF / 2) * s
    ryggRing.push([b + p.ryggsvai * p.ryggT * Math.sin(Math.PI * s) * 0.5, w])
  }
  for (let i = NR; i >= 1; i--) {
    const s = i / NR
    const w = 26 + (wTopp - 26) * s
    const b = p.ryggF / 2 + (p.ryggT / 2 - p.ryggF / 2) * s
    ryggRing.push([-(b + p.ryggsvai * p.ryggT * Math.sin(Math.PI * s) * 0.5), w])
  }
  ryggRing.push([-p.ryggF / 2, 26])
  const ryggOut = motKlokka(rundHjorne(ryggRing, p.nase * 0.8, 5))

  const ryggHol: Pt[][] = []
  // bereholet — det einaste hòlet som ikkje er eit ledd
  if (p.grep >= 60) {
    ryggHol.push(medKlokka(kapsel(0, wTopp - p.grepZ, p.grep, 17, 12)))
  }
  // hakka som femner om bladene: opne spor frå botnkanten av tunga og opp
  for (const sgn of [-1, 1]) {
    const cy = (sgn * p.spenn) / 2
    const halv = (t + fit) / 2
    const opp = -tunge + laftDjup + 12
    ryggHol.push(
      medKlokka([
        [cy - halv, -tunge - 1],
        [cy + halv, -tunge - 1],
        [cy + halv, opp],
        [cy - halv, opp],
      ]),
    )
    ryggHol.push(medKlokka(avlasting(cy, opp, p.fresD)))
  }
  // Sporet til kilen. Eit hòl i tunga går langs NORMALEN hennar — altså
  // fram og bak — so kilen står i sideplanet som bladene og vert driven
  // FRAM. Hòlet er difor tynt som ei plate på tvers og høgt som kilen er
  // der han står. (Fyrste utkastet hadde hòlet lagt andre vegen, og då
  // kunne kilen ikkje koma gjennom det i det heile.)
  const kileH = 26
  const kileW = -(t / ca) / Math.cos(rv) - 3 - kileH / 2
  ryggHol.push(medKlokka(rekt(0, kileW, t + fit, kileH + fit)))
  for (const su of [-1, 1]) {
    for (const sw of [-1, 1]) {
      ryggHol.push(
        medKlokka(avlasting((su * (t + fit)) / 2, kileW + (sw * (kileH + fit)) / 2, p.fresD)),
      )
    }
  }

  const ryggPlass: Plass = (() => {
    const bp = ryggPunkt(0)
    const nn = kryss([0, 1, 0], [-Math.sin(rv), 0, Math.cos(rv)])
    return {
      // Sentrert i sporet sitt: konturen er MIDT i plata. Ei plate som
      // ligg inntil den eine sida av sporet, står skeivt i møbelet.
      o: [bp[0] - (nn[0] * t) / 2, -(nn[1] * t) / 2, bp[1] - (nn[2] * t) / 2],
      u: [0, 1, 0],
      v: [-Math.sin(rv), 0, Math.cos(rv)],
      n: nn,
    }
  })()

  // --- KILEN --------------------------------------------------------------
  // Han vert slegen FRAM gjennom tunga, og skråkanten er heile mekanikken:
  // di lenger inn han går, di høgare vert snittet i hòlet, og til slutt
  // pressar overkanten opp mot undersida av setet. Skuldra til ryggen ligg
  // OVER setet og kilen UNDER — plata er klemd mellom dei to, og då sit
  // møbelet. Hovudet stoggar han: det står høgare enn hòlet.
  const kL = p.kileB
  const kileOut = motKlokka(
    rundHjorne(
      [
        [-kL / 2, 0],
        [kL / 2, 0],
        [kL / 2, kileH + 15],
        [kL / 2 - 16, kileH + 15],
        [kL / 2 - 16, kileH],
        [-kL / 2, kileH * 0.6],
      ],
      3,
      3,
    ),
  )
  const kilePkt = ryggPunkt(kileW)
  const kilePlass: Plass = {
    // står i sideplanet som bladene, midt mellom dei, med botnen i botnen
    // av hòlet — driven frå baksida og fram
    o: [kilePkt[0] - kL * 0.34, -t / 2, kilePkt[1] - (kileH + fit) / 2],
    u: [1, 0, 0],
    v: [0, 0, 1],
    n: [0, 1, 0],
  }

  const delar: Del[] = [
    { id: "S1", kind: "sete", outline: seteOut, holes: seteHol, plass: setePlass, t },
    { id: "B1", kind: "bein", outline: beinOut, holes: beinHol, plass: beinPlass(-1), t },
    { id: "B2", kind: "bein", outline: beinOut, holes: beinHol, plass: beinPlass(1), t },
    { id: "R1", kind: "rygg", outline: ryggOut, holes: ryggHol, plass: ryggPlass, t },
    { id: "K1", kind: "kile", outline: kileOut, holes: [], plass: kilePlass, t },
  ]

  return {
    p,
    delar,
    a,
    rv,
    seteTopp,
    seteUnder,
    xF,
    xB,
    fotF,
    fotB,
    spennFri: p.spenn - t,
    overheng: Math.max(0, p.breidd / 2 - p.spenn / 2),
  }
}

/** eit punkt i planet ut i verda */
export function tilVerda(pl: Plass, q: Pt, w = 0): Vec3 {
  return [
    pl.o[0] + pl.u[0] * q[0] + pl.v[0] * q[1] + pl.n[0] * w,
    pl.o[1] + pl.u[1] * q[0] + pl.v[1] * q[1] + pl.n[1] * w,
    pl.o[2] + pl.u[2] * q[0] + pl.v[2] * q[1] + pl.n[2] * w,
  ]
}

/** netto areal av ein del: konturen minus hòla */
export function delAreal(d: Del): number {
  return (
    Math.abs(shoelace(d.outline)) - d.holes.reduce((s, h) => s + Math.abs(shoelace(h)), 0)
  )
}

/** boksen delen tek på plata */
export function delBoks(d: Del) {
  return bbox(d.outline)
}

export { materialet }
