/// <reference lib="webworker" />
/**
 * SANDKASSE — motoren i eigen tråd.
 *
 * Hovudtråden teiknar, og gjer ikkje anna. Alt som rører geometri ligg her,
 * og arbeidaren veit ikkje kva typologi han byggjer: han slår opp motoren i
 * registeret og kallar kontrakten. Difor kostar ein ny typologi ei mappe og
 * ei line i `lib/engines.ts`, og ingen ting i grensesnittet.
 */
import { getEngine, isEngineId } from "./engines"
import { avlGen, type AvlPunkt } from "./avl"
export type { DetailKey } from "./core"
import type {
  DetailKey,
  EngineId,
  ExportKind,
  Maskin,
  Metrics,
  ParamBag,
  Rule,
  Vec3,
  View,
} from "./core"

export type BuildReq = {
  kind: "build"
  id: number
  engine: EngineId
  params: ParamBag
  detail: DetailKey
  view: View
}
export type ExportReq = {
  kind: "export"
  id: number
  engine: EngineId
  params: ParamBag
  what: ExportKind
  /** maskina som skal kutte — laseren gjev modellskala og eiga seng */
  maskin?: Maskin
}
/** form av lasta: motoren løyser eitt formval or lastmodellen sin */
export type FormReq = {
  kind: "form"
  id: number
  engine: EngineId
  params: ParamBag
}
/** avlen: same objekt, mindre plate — søket startar i punktet som står */
export type AvlReq = {
  kind: "avl"
  id: number
  engine: EngineId
  params: ParamBag
  steg: number
  frø: string
  locked: string[]
}
export type Req = BuildReq | ExportReq | AvlReq | FormReq

export type BuildRes = {
  kind: "build"
  id: number
  engine: EngineId
  view: View
  positions: Float32Array<ArrayBufferLike>
  normals: Float32Array<ArrayBufferLike>
  tris: number
  min: Vec3
  max: Vec3
  kant: Float32Array<ArrayBufferLike>
  /** lastkartet, berre i lesemåten «last»: utnytting per hjørne, 1,0 = kapasitet */
  felt?: Float32Array<ArrayBufferLike>
  feltTak?: number
  lines: Float32Array<ArrayBufferLike>
  heavy: Float32Array<ArrayBufferLike>
}
/** Måltala kjem i eiga melding, ETTER nettet — sjå kommentaren i handteraren. */
export type MaalRes = {
  kind: "maal"
  id: number
  engine: EngineId
  metrics: Metrics
  rules: Rule[]
}
export type ExportRes = {
  kind: "export"
  id: number
  name: string
  mime: string
  text?: string
  data?: ArrayBuffer
}
/** Eit bygg som kasta. Svaret finst av éin grunn: porten i studioen slepp
 *  ikkje neste førespurnad før han har fått svar på den førre, og eit
 *  unntak utan svar ville låse heile appen for alltid. */
export type FeilRes = { kind: "feil"; id: number }
/** Profilteikninga som bilete, generert automatisk etter kvar måling:
 *  alle flatene, rett i menyen — ingen skal måtte laste ned ein SVG for
 *  å sjå kva delane er. */
export type SynRes = { kind: "syn"; id: number; engine: EngineId; svg: string }
/** avlen undervegs og ferdig. `avbroten` tyder at eit nyare punkt tok over
 *  medan søket gjekk — då skal resultatet IKKJE brukast: brukaren har alt
 *  flytta seg, og eit svar som overskriv handa hans er verre enn ingen. */
export type AvlRes = {
  kind: "avl"
  id: number
  engine: EngineId
  ferdig: boolean
  avbroten: boolean
  steg: number
  total: number
  best: ParamBag
  matInn: number
  matInn0: number
  sheetUtil: number
  util: number
  mass: number
  harde: number
}
/** svaret på form av lasta: det løyste punktet, klart til å setjast inn */
export type FormRes = {
  kind: "form"
  id: number
  engine: EngineId
  params: ParamBag
}
export type Res = BuildRes | MaalRes | ExportRes | FeilRes | SynRes | AvlRes | FormRes

function build(req: BuildReq): { res: BuildRes; transfer: Transferable[] } {
  const out = getEngine(req.engine).build(req.params, req.detail, req.view)
  const res: BuildRes = {
    kind: "build",
    id: req.id,
    engine: req.engine,
    view: req.view,
    ...out,
  }
  // Berre bufferar med innhald vert overførte, og kvar buffer berre éin gong:
  // same buffer to gonger i lista er ein DataCloneError, og han tek heile
  // meldinga med seg.
  const transfer: Transferable[] = []
  for (const a of [out.positions, out.normals, out.kant, out.felt, out.lines, out.heavy]) {
    if (a && a.byteLength && !transfer.includes(a.buffer)) transfer.push(a.buffer)
  }
  return { res, transfer }
}

function doExport(req: ExportReq): { res: ExportRes; transfer: Transferable[] } {
  const out = getEngine(req.engine).exportFile(req.params, req.what, req.maskin)
  return {
    res: { kind: "export", id: req.id, ...out },
    transfer: out.data ? [out.data] : [],
  }
}

/**
 * Avlen, i bitar. Arbeidaren er éin tråd, og eitt søkjesteg kostar det eit
 * heilt bygg kostar — so søket tek eitt steg per makrooppgåve og slepper
 * køen til imellom. Kjem det eit nyare punkt medan søket går (brukaren
 * drog ein skyvar), vert søket lagt frå seg der det står og svaret merkt
 * avbrote: handa til brukaren vinn alltid over algoritmen.
 */
function doAvl(req: AvlReq) {
  const eng = getEngine(req.engine)
  const g = avlGen(eng, req.params, {
    steg: req.steg,
    frø: req.frø,
    locked: new Set(req.locked),
  })
  const svar = (
    ferdig: boolean,
    avbroten: boolean,
    steg: number,
    s: AvlPunkt,
    matInn0: number,
  ) => {
    const res: AvlRes = {
      kind: "avl",
      id: req.id,
      engine: req.engine,
      ferdig,
      avbroten,
      steg,
      total: req.steg,
      best: s.p,
      matInn: s.matInn,
      matInn0,
      sheetUtil: s.sheetUtil,
      util: s.util,
      mass: s.mass,
      harde: s.harde,
    }
    ;(self as unknown as Worker).postMessage(res)
  }
  let matInn0 = 0
  let sistMeldt = 0
  const eittSteg = () => {
    try {
      const r = g.next()
      if (r.done) {
        svar(true, false, req.steg, r.value.beste, matInn0 || r.value.start.matInn)
        return
      }
      if (!matInn0) matInn0 = r.value.beste.matInn
      if (newest !== req.id) {
        svar(true, true, r.value.steg, r.value.beste, matInn0)
        return
      }
      // framdrift utan spam: høgst fire meldingar i sekundet
      if (Date.now() - sistMeldt > 250) {
        sistMeldt = Date.now()
        svar(false, false, r.value.steg, r.value.beste, matInn0)
      }
      setTimeout(eittSteg, 0)
    } catch (err) {
      console.error("sandkasse: avlen slo feil", err)
      const res: FeilRes = { kind: "feil", id: req.id }
      ;(self as unknown as Worker).postMessage(res)
    }
  }
  eittSteg()
}

/**
 * Nettet fyrst, måltala etterpå — og måltala berre for det SISTE punktet.
 *
 * Ein skyvar som vert dregen sender ein straum av punkt, og å måle kvart av
 * dei er å måle objekt ingen kjem til å sjå. Difor vert målinga utsett med
 * setTimeout: arbeidaren er éin tråd, so meldingar som alt står i kø får
 * køyre fyrst, og når målinga endeleg slepp til, veit ho om eit nyare punkt
 * har teke over. Har det det, teier ho. Fristen er ikkje null: klienten
 * sender neste punkt fyrst når svaret på det førre er framme, so neste
 * melding er undervegs over ein rundtur når denne handteraren sluttar — ei
 * måling som fyrer med det same ville alltid vinne det kappløpet og målt
 * kvart einaste mellombilete. Hundre millisekund er meir enn rundturen og
 * mindre enn nokon rekk å sjå. Slik kostar draget berre nettbygging, og
 * rekninga skjer éin gong — når fingeren stoggar.
 */
let newest = 0

self.onmessage = (e: MessageEvent<Req>) => {
  const req = e.data
  if (!isEngineId(req.engine)) return
  try {
    if (req.kind === "export") {
      const out = doExport(req)
      ;(self as unknown as Worker).postMessage(out.res, out.transfer)
      return
    }
    if (req.kind === "form") {
      // eitt spørsmål, eitt svar — utanom porten, som eksporten. Motoren
      // utan lastForm svarar med punktet urørt; knappen skal ikkje synast
      // der, men eit svar MÅ alltid ut, elles heng busy-lyset for alltid.
      const eng = getEngine(req.engine)
      const ut = eng.lastForm ? eng.lastForm(req.params) : req.params
      const res: FormRes = { kind: "form", id: req.id, engine: req.engine, params: ut }
      ;(self as unknown as Worker).postMessage(res)
      return
    }
    if (req.kind === "avl") {
      // avlen eig `newest` medan han går: eit nyare bygg bryt han av
      newest = req.id
      doAvl(req)
      return
    }
    newest = req.id
    const out = build(req)
    ;(self as unknown as Worker).postMessage(out.res, out.transfer)
    setTimeout(() => {
      if (newest !== req.id) return
      try {
        const eng = getEngine(req.engine)
        // Målinga går uansett kva lesemåte som står på: eit tal som berre
        // finst i «flate» ville forsvinne når ein byter til «lag».
        const metrics = eng.measure(req.params)
        if (newest !== req.id) return
        const rules = eng.rules(req.params, metrics)
        const res: MaalRes = { kind: "maal", id: req.id, engine: req.engine, metrics, rules }
        ;(self as unknown as Worker).postMessage(res)
        // Flatene som bilete, i same utsette steget: mellombygga er alt
        // hugsa frå målinga, so teikninga kostar berre sjølve SVG-en — og
        // ho teier på same viset når eit nyare punkt har teke over.
        if (newest !== req.id) return
        const svg = eng.exportFile(req.params, "arksyn")
        if (newest !== req.id || !svg.text) return
        const syn: SynRes = { kind: "syn", id: req.id, engine: req.engine, svg: svg.text }
        ;(self as unknown as Worker).postMessage(syn)
      } catch (err) {
        console.error("sandkasse: målinga slo feil", err)
      }
    }, 100)
  } catch (err) {
    // Ein parameterkombinasjon som får motoren til å gje opp er ein feil i
    // motoren, ikkje i brukaren. Meld frå i konsollen, lat den førre
    // bygginga bli ståande — og SVAR, alltid: porten på hovudtråden ventar
    // på dette svaret, og utan det står appen fastlåst til sida vert lasta
    // på nytt.
    console.error("sandkasse: bygginga slo feil", err)
    const res: FeilRes = { kind: "feil", id: req.id }
    ;(self as unknown as Worker).postMessage(res)
  }
}
