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
export type { DetailKey } from "./core"
import type {
  DetailKey,
  EngineId,
  ExportKind,
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
}
export type Req = BuildReq | ExportReq

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
export type Res = BuildRes | MaalRes | ExportRes | FeilRes

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
  for (const a of [out.positions, out.normals, out.lines, out.heavy]) {
    if (a.byteLength && !transfer.includes(a.buffer)) transfer.push(a.buffer)
  }
  return { res, transfer }
}

function doExport(req: ExportReq): { res: ExportRes; transfer: Transferable[] } {
  const out = getEngine(req.engine).exportFile(req.params, req.what)
  return {
    res: { kind: "export", id: req.id, ...out },
    transfer: out.data ? [out.data] : [],
  }
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
