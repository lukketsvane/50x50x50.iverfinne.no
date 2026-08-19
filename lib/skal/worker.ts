/// <reference lib="webworker" />
/**
 * SANDKASSE — motoren i eigen tråd.
 *
 * Å byggje objektet tek nokre hundre millisekund. Gjer ein det på
 * hovudtråden, frys lerretet kvar gong ein skyvar rører seg, og då er
 * det ikkje lenger ein sandkasse — då er det eit skjema med ein
 * førehandsvisning. Alt som kostar tid ligg difor her, og hovudtråden
 * gjer ikkje anna enn å teikne.
 */
import { makeShell } from "./field"
import { buildMesh, DETAIL, type MeshData } from "./surface"
import { buildStack, type Stack } from "./laminae"
import { contourLines, stackMesh } from "./stack-mesh"
import { measure, type Metrics } from "./metrics"
import { checkRules, type Rule } from "./rules"
import { nest } from "./nest"
import { meshToStl } from "./export-stl"
import { stackToDxf } from "./export-dxf"
import { contourMapSvg, sheetSvg } from "./export-svg"
import type { Params } from "./params"

export type View = "flate" | "lag" | "kontur"
export type DetailKey = keyof typeof DETAIL

export type BuildReq = {
  kind: "build"
  id: number
  params: Params
  detail: DetailKey
  view: View
}
export type ExportReq = {
  kind: "export"
  id: number
  params: Params
  what: "stl" | "dxf" | "svg" | "ark"
}
export type Req = BuildReq | ExportReq

export type BuildRes = {
  kind: "build"
  id: number
  view: View
  positions: Float32Array<ArrayBufferLike>
  normals: Float32Array<ArrayBufferLike>
  tris: number
  min: [number, number, number]
  max: [number, number, number]
  lines: Float32Array<ArrayBufferLike>
  heavy: Float32Array<ArrayBufferLike>
  metrics: Metrics
  rules: Rule[]
  stat: { layers: number; parts: number; area: number; mass: number }
}
export type ExportRes = {
  kind: "export"
  id: number
  name: string
  mime: string
  text?: string
  data?: ArrayBuffer
}
export type Res = BuildRes | ExportRes

const EMPTY = new Float32Array(0)

function build(req: BuildReq): { res: BuildRes; transfer: Transferable[] } {
  const sh = makeShell(req.params)
  const stack: Stack = buildStack(req.params, sh)

  // Skalet vert bygd uansett kva lesemåte som står på, av di målinga
  // treng det: eit tal som berre finst i «flate» ville forsvinne når ein
  // byter til «lag», og då er tabellen ikkje lenger den same tabellen.
  const skin = buildMesh(req.params, DETAIL[req.detail], sh)
  const metrics = measure(req.params, { shell: sh, mesh: skin, stack })
  const rules = checkRules(req.params, metrics)

  let mesh: MeshData = skin
  let lines: Float32Array<ArrayBufferLike> = EMPTY
  let heavy: Float32Array<ArrayBufferLike> = EMPTY
  if (req.view === "lag") {
    mesh = stackMesh(stack)
  } else if (req.view === "kontur") {
    const c = contourLines(stack)
    lines = c.positions
    heavy = c.heavy
    mesh = {
      positions: EMPTY,
      normals: EMPTY,
      tris: 0,
      min: [sh.R * -1, sh.R * -1, 0],
      max: [sh.R, sh.R, sh.zTop],
    }
  }

  const res: BuildRes = {
    kind: "build",
    id: req.id,
    view: req.view,
    positions: mesh.positions,
    normals: mesh.normals,
    tris: mesh.tris,
    min: mesh.min,
    max: mesh.max,
    lines,
    heavy,
    metrics,
    rules,
    stat: {
      layers: stack.count,
      parts: stack.parts,
      area: stack.area,
      mass: stack.mass,
    },
  }
  const transfer: Transferable[] = [
    mesh.positions.buffer,
    mesh.normals.buffer,
  ]
  if (lines.length) transfer.push(lines.buffer, heavy.buffer)
  return { res, transfer }
}

function doExport(req: ExportReq): { res: ExportRes; transfer: Transferable[] } {
  const sh = makeShell(req.params)
  const base = "skal"
  if (req.what === "stl") {
    const mesh = buildMesh(req.params, DETAIL.hog, sh)
    const bytes = meshToStl(mesh, base)
    const buf = bytes.buffer.slice(0) as ArrayBuffer
    return {
      res: { kind: "export", id: req.id, name: `${base}.stl`, mime: "model/stl", data: buf },
      transfer: [buf],
    }
  }
  const stack = buildStack(req.params, sh)
  if (req.what === "dxf") {
    const n = nest(stack)
    return {
      res: {
        kind: "export",
        id: req.id,
        name: `${base}.dxf`,
        mime: "application/dxf",
        text: stackToDxf(stack, n),
      },
      transfer: [],
    }
  }
  if (req.what === "ark") {
    const n = nest(stack)
    return {
      res: {
        kind: "export",
        id: req.id,
        name: `${base}-ark1.svg`,
        mime: "image/svg+xml",
        text: sheetSvg(n, 0),
      },
      transfer: [],
    }
  }
  return {
    res: {
      kind: "export",
      id: req.id,
      name: `${base}-kontur.svg`,
      mime: "image/svg+xml",
      text: contourMapSvg(stack),
    },
    transfer: [],
  }
}

self.onmessage = (e: MessageEvent<Req>) => {
  const req = e.data
  try {
    const out = req.kind === "build" ? build(req) : doExport(req)
    ;(self as unknown as Worker).postMessage(out.res, out.transfer)
  } catch (err) {
    // Ein parameterkombinasjon som får motoren til å gje opp er ein feil
    // i motoren, ikkje i brukaren. Meld frå i konsollen og la den førre
    // bygginga bli ståande, i staden for å svartlegge lerretet.
    console.error("sandkasse: bygginga slo feil", err)
  }
}
