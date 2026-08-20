"use client"

import { useCallback, useMemo, useState, type CSSProperties, type JSX, type ReactNode } from "react"
import {
  CUBE,
  MATERIALS,
  type EngineId,
  type Material,
  type Metrics,
  type ParamBag,
  type Range,
  type Rule,
  type View,
} from "@/lib/core"
import { ENGINES, getEngine } from "@/lib/engines"
import { BEIS } from "./object-mesh"

/**
 * SANDKASSE — kontrollflata.
 *
 * Same kontrollspråk som parametric.iverfinne.no, med vilje: eit flytande
 * ark nedst med tre tilstandar. Lukka er det éi line — motoren, tre tal og
 * to knappar — og objektet eig heile skjermen. Halvope kjem lesemåtane,
 * materialet, måltavla og eksporten. Heilt ope kjem skyveveggen.
 *
 * Det sandkassen legg til språket er tala: dei tre som avgjer om objektet
 * i det heile er eit sitjemøbel står i sjølve lina, alltid, og skiftar
 * farge når ein regel ryk. Ein leikegrind gøymer rekninga; ein reiskap
 * har henne i panna.
 *
 * Ingen tal vert rekna ut her. Alt kjem frå `metrics` og `rules`, som har
 * målt det objektet som faktisk står på skjermen.
 */

const VIEWS: readonly { id: View; label: string; hint: string }[] = [
  { id: "flate", label: "flate", hint: "flata objektet nærmar seg, ferdig" },
  { id: "lag", label: "lag", hint: "delane slik dei faktisk er, montert" },
  { id: "kontur", label: "kontur", hint: "dei flate kuttprofilane" },
]

const EXPORTS: readonly { id: "stl" | "dxf" | "svg" | "ark"; label: string; hint: string }[] = [
  { id: "stl", label: "stl", hint: "flata som trekantnett, til rendering og 3D-print" },
  { id: "dxf", label: "dxf", hint: "alle delar som kurver, til fresen" },
  { id: "svg", label: "svg", hint: "konturkart av delane" },
  { id: "ark", label: "kuttark", hint: "delane nesta på plate" },
]

/** Finértonar til materialprikkane. Fargen er ikkje pynt: han er den eine
 *  skilnaden mellom dei tre ein faktisk kan sjå på eit ferdig møbel. */
const WOOD: Record<Material, string> = {
  bjork: "#e9dcc0",
  bok: "#d9b48d",
  poppel: "#f2ead2",
}

const DASH = "–"
const nn = (v: number, d: number) =>
  Number.isFinite(v) ? v.toFixed(d).replace(".", ",") : DASH
const n0 = (v: number) => nn(v, 0)
const n1 = (v: number) => nn(v, 1)
const n2 = (v: number) => nn(v, 2)

const decimals = (step: number) => (step >= 1 ? 0 : step >= 0.1 ? 1 : step >= 0.01 ? 2 : 3)
const snap = (v: number, r: Range) =>
  !Number.isFinite(v) ? r.min : r.int ? Math.round(v) : +v.toFixed(4)
const num = (p: ParamBag, k: string, fallback: number) =>
  typeof p[k] === "number" ? (p[k] as number) : fallback

// same kontrollspråk som parametric: hårliner, piller og to runde knappar
const HAIR: CSSProperties = { borderColor: "var(--rule)" }
const ICON_BTN =
  "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition active:scale-95"
const ICON_BTN_SOLID =
  "flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition active:scale-95"

function chipStyle(active: boolean): CSSProperties {
  return active
    ? { background: "var(--ink)", color: "var(--paper)", borderColor: "transparent" }
    : { color: "var(--ink)", borderColor: "var(--rule)" }
}
const CHIP =
  "min-h-[30px] rounded-full border px-3 text-[11px] leading-none tracking-[0.04em] transition active:scale-95 disabled:opacity-30"

/** Ikona er strekar, teikna her i staden for henta frå eit bibliotek:
 *  fire ikon er ikkje verdt ein avhengnad. */
const STROKE = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
}
const IcoShuffle = (
  <svg viewBox="0 0 24 24" className="h-4 w-4" {...STROKE}>
    <path d="M2 18h2.9a4 4 0 0 0 3.4-1.9l5.4-8.2A4 4 0 0 1 17.1 6H22" />
    <path d="m18 2 4 4-4 4" />
    <path d="M2 6h2.9a4 4 0 0 1 3.4 1.9l.5.8" />
    <path d="m14.6 14.5.5.8a4 4 0 0 0 3.4 1.9H22" />
    <path d="m18 14 4 4-4 4" />
  </svg>
)
const IcoSliders = (
  <svg viewBox="0 0 24 24" className="h-4 w-4" {...STROKE}>
    <path d="M21 4h-7M10 4H3M21 12h-9M8 12H3M21 20h-5M12 20H3M14 2v4M8 10v4M16 18v4" />
  </svg>
)
const IcoDown = (
  <svg viewBox="0 0 24 24" className="h-4 w-4" {...STROKE}>
    <path d="m6 9 6 6 6-6" />
  </svg>
)
const IcoUp = (
  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" {...STROKE}>
    <path d="m18 15-6-6-6 6" />
  </svg>
)

type TableRow = {
  label: string
  value: string
  unit: string
  /** kva reglar som eig talet — id-ane skil seg frå motor til motor */
  rules?: readonly string[]
}

/** Reglane som eig kvart tal, på tvers av dei fire motorane. Same tanke
 *  har ulik id frå motor til motor, og ei rad som berre kjende SKAL sine
 *  ville stå svart medan STRAUM braut seg. */
const R_KUBE = ["kube"]
const R_SIT = ["setehogd", "sitjehogd"]
const R_SETE = ["skal", "setebreidd", "setebaering", "sete"]
const R_FOT = ["bein", "golv", "stotte", "fotboge"]
const R_VELTE = ["velte", "velting"]
const R_MASSE = ["masse"]
const R_DELAR = ["lagtal", "finnetal", "plater", "plate", "platetal", "unike"]
const R_UTN = ["utnytting", "styrke"]

function tableRows(m: Metrics | null): TableRow[] {
  if (!m) {
    const tom = (label: string, unit: string): TableRow => ({ label, value: DASH, unit })
    return [
      tom("ytre mål", "mm"),
      tom("klaring", "mm"),
      tom("setekant", "mm"),
      tom("sitjehøgd", "mm"),
      tom("sitjeflate", "mm"),
      tom("fotavtrykk", "mm"),
      tom("støtteflate", "cm²"),
      tom("veltevinkel", "°"),
      tom("masse", "kg"),
      tom("delar", "stk"),
      tom("utnytting", "%"),
    ]
  }
  return [
    { label: "ytre mål", value: `${n1(m.envX)} × ${n1(m.envY)} × ${n1(m.envZ)}`, unit: "mm", rules: R_KUBE },
    { label: "klaring", value: `${n1(m.clearX)} · ${n1(m.clearY)} · ${n1(m.clearZ)}`, unit: "mm", rules: R_KUBE },
    { label: "setekant", value: n0(m.seatZ), unit: "mm" },
    // Setekanten er ikkje der ein sit. På ei skål ligg dei tretti
    // millimeter frå kvarandre, og det er sitjehøgda regelen les.
    { label: "sitjehøgd", value: n0(m.sitZ), unit: "mm", rules: R_SIT },
    { label: "sitjeflate", value: `${n0(m.seatW)} × ${n0(m.seatD)}`, unit: "mm", rules: R_SETE },
    { label: "fotavtrykk", value: `${n0(m.footX)} × ${n0(m.footY)}`, unit: "mm", rules: R_FOT },
    { label: "støtteflate", value: n0(m.footArea / 100), unit: "cm²", rules: R_FOT },
    { label: "veltevinkel", value: n1(m.tipAngle), unit: "°", rules: R_VELTE },
    // ferdig masse, ikkje som kutta: slipemonet ligg att som støv på golvet
    { label: "masse", value: n2(m.mass), unit: "kg", rules: R_MASSE },
    { label: `${m.unitLabel} · delar`, value: `${n0(m.units)} · ${n0(m.parts)}`, unit: "stk", rules: R_DELAR },
    { label: "utnytting", value: n0(m.util * 100), unit: "%", rules: R_UTN },
  ]
}

/** Éin skyvar: etiketten er låsen, prikken seier om han er teken. */
function SliderRow({
  k,
  r,
  value,
  locked,
  onChange,
  onToggleLock,
}: {
  k: string
  r: Range
  value: number
  locked: boolean
  onChange: (k: string, raw: string) => void
  onToggleLock: (k: string) => void
}) {
  return (
    <div
      className="flex items-center gap-3 py-1.5 transition-opacity"
      style={{ opacity: locked ? 0.35 : 1 }}
    >
      <button
        type="button"
        aria-pressed={locked}
        title={locked ? "låst mot terningen — trykk for å låse opp" : "trykk for å låse mot terningen"}
        onClick={() => onToggleLock(k)}
        className="flex w-24 shrink-0 items-center gap-1.5 text-left text-[10px] uppercase leading-[1.2] tracking-[0.14em]"
        style={{ color: "var(--ink)" }}
      >
        <span
          aria-hidden="true"
          className="block h-[5px] w-[5px] shrink-0 rounded-full"
          style={{
            background: locked ? "var(--ink)" : "transparent",
            border: locked ? "none" : "1px solid color-mix(in srgb, var(--ink) 30%, transparent)",
          }}
        />
        <span className="min-w-0 flex-1">{r.label}</span>
      </button>
      <input
        type="range"
        className="pslider flex-1"
        min={r.min}
        max={r.max}
        step={r.step}
        value={value}
        aria-label={locked ? `${r.label}, låst` : r.label}
        onChange={(e) => onChange(k, e.target.value)}
      />
      <span className="tab w-14 shrink-0 text-right text-[11px]" style={{ color: "var(--ink)" }}>
        {value.toFixed(decimals(r.step)).replace(".", ",")}
        {r.unit && <span className="pl-0.5 opacity-45">{r.unit}</span>}
      </span>
    </div>
  )
}

/** Ei rekkje i halvarket: etikett til venstre, innhaldet til høgre. */
function PanelRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-3 py-1.5">
      <span
        className="w-20 shrink-0 text-[10px] uppercase tracking-[0.18em]"
        style={{ color: "var(--ink)" }}
      >
        {label}
      </span>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">{children}</div>
    </div>
  )
}

export function ControlsPanel(props: {
  engine: EngineId
  params: ParamBag
  metrics: Metrics | null
  rules: Rule[]
  view: View
  seed: string
  beis: string
  locked: ReadonlySet<string>
  hiDetail: boolean
  isDesktop: boolean
  busy: boolean
  onEngine: (e: EngineId) => void
  onChange: (p: ParamBag) => void
  onView: (v: View) => void
  onSeed: (s: string) => void
  onBeis: (b: string) => void
  onShuffle: () => void
  onReset: () => void
  onToggleLock: (k: string) => void
  onToggleDetail: () => void
  onExport: (kind: "stl" | "dxf" | "svg" | "ark") => void
  onShare: () => void
}): JSX.Element {
  const {
    engine,
    params,
    metrics,
    rules,
    view,
    seed,
    beis,
    locked,
    hiDetail,
    isDesktop,
    busy,
    onEngine,
    onChange,
    onView,
    onSeed,
    onBeis,
    onShuffle,
    onReset,
    onToggleLock,
    onToggleDetail,
    onExport,
    onShare,
  } = props

  // lukka → halv (lesemåtar, materiale, tavla, eksport) → full (skyveveggen)
  const [mode, setMode] = useState<"lukka" | "halv" | "full">("lukka")
  const open = mode !== "lukka"

  const eng = getEngine(engine)

  const broken = useMemo(() => {
    const hard = new Set<string>()
    const soft = new Set<string>()
    for (const r of rules) if (!r.ok) (r.hard ? hard : soft).add(r.id)
    return { hard, soft }
  }, [rules])
  const failed = useMemo(() => rules.filter((r) => !r.ok), [rules])
  const isHard = (ids: readonly string[]) => ids.some((id) => broken.hard.has(id))
  const isSoft = (ids: readonly string[]) => ids.some((id) => broken.soft.has(id))

  const rows = useMemo(() => tableRows(metrics), [metrics])

  const setParam = useCallback(
    (k: string, raw: string) =>
      onChange({ ...params, [k]: snap(Number(raw), eng.ranges[k]) }),
    [params, onChange, eng],
  )

  /** Dei tre tala som avgjer om det er eit sitjemøbel, i sjølve lina.
   *  Panelet kan lukkast; rekninga kan ikkje. */
  const headline: { text: string; ids: readonly string[] }[] = metrics
    ? [
        { text: `${n1(metrics.mass)} kg`, ids: R_MASSE },
        { text: `${n1(metrics.tipAngle)}°`, ids: R_VELTE },
        { text: `${n0(metrics.util * 100)} %`, ids: R_UTN },
      ]
    : []

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-10 flex justify-center px-3 pb-[calc(env(safe-area-inset-bottom)+12px)]">
      <section
        aria-label="kontrollar for sandkassen"
        aria-busy={busy}
        className="pointer-events-auto w-full max-w-md rounded-3xl border"
        style={{ ...HAIR, background: "var(--paper)", color: "var(--ink)" }}
      >
        {/* hovudlina — motoren, rekninga, terningen og opnaren */}
        <div className="flex items-center gap-1.5 p-2.5">
          <select
            value={engine}
            onChange={(e) => onEngine(e.target.value as EngineId)}
            aria-label="typologi"
            className="h-9 shrink-0 cursor-pointer appearance-none rounded-full border bg-transparent pl-3 pr-2.5 text-[11px] uppercase tracking-[0.18em] outline-none"
            style={{ ...HAIR, color: "var(--ink)" }}
          >
            {ENGINES.map((e) => (
              <option key={e.id} value={e.id} style={{ color: "#111", background: "#fff" }}>
                {e.label}
              </option>
            ))}
          </select>

          <span className="tab min-w-0 flex-1 truncate pl-1.5 text-[11px] tracking-[0.06em]">
            {headline.length === 0 ? (
              <span className="opacity-40">reknar …</span>
            ) : (
              headline.map((h, i) => (
                <span key={h.ids[0]}>
                  {i > 0 && <span className="px-1 opacity-30">·</span>}
                  <span
                    style={{
                      color: isHard(h.ids) ? "var(--warn)" : undefined,
                      opacity: isHard(h.ids) ? 1 : 0.62,
                      textDecoration: isSoft(h.ids) ? "underline dotted" : undefined,
                      textUnderlineOffset: 3,
                    }}
                  >
                    {h.text}
                  </span>
                </span>
              ))
            )}
          </span>

          {/* prikken har fast plass, så lina står i ro medan motoren reknar */}
          <span
            aria-hidden="true"
            className="block h-[5px] w-[5px] shrink-0 rounded-full"
            style={{
              background: "var(--ink)",
              opacity: busy ? 0.8 : 0.12,
              transition: "opacity 200ms ease",
            }}
          />

          <button
            type="button"
            onClick={onShuffle}
            aria-label="terning — nye tal innanfor grensene, låste skruar står"
            title="terning"
            className={ICON_BTN_SOLID}
            style={{ background: "var(--ink)", color: "var(--paper)" }}
          >
            {IcoShuffle}
          </button>
          <button
            type="button"
            onClick={() => setMode(open ? "lukka" : "halv")}
            aria-label={open ? "gøym kontrollane" : "vis kontrollane"}
            aria-expanded={open}
            className={ICON_BTN}
            style={{ ...HAIR, color: "var(--ink)" }}
          >
            {open ? IcoDown : IcoSliders}
          </button>
        </div>

        {/* det utvidbare arket */}
        {open && (
          <div className="max-h-[56vh] overflow-y-auto overscroll-contain px-4 pb-4">
            <PanelRow label="visning">
              {VIEWS.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  title={v.hint}
                  aria-pressed={view === v.id}
                  onClick={() => onView(v.id)}
                  className={CHIP}
                  style={chipStyle(view === v.id)}
                >
                  {v.label}
                </button>
              ))}
            </PanelRow>

            <PanelRow label="materiale">
              {(Object.keys(MATERIALS) as Material[]).map((mk) => (
                <button
                  key={mk}
                  type="button"
                  aria-pressed={params.material === mk}
                  aria-label={`materiale: ${MATERIALS[mk].label}`}
                  title={MATERIALS[mk].label}
                  onClick={() => onChange({ ...params, material: mk })}
                  className="h-6 w-6 rounded-full border transition active:scale-90"
                  style={{
                    backgroundColor: WOOD[mk],
                    borderColor: params.material === mk ? "var(--ink)" : "var(--rule)",
                    boxShadow: params.material === mk ? "0 0 0 1px var(--ink)" : undefined,
                  }}
                />
              ))}
            </PanelRow>

            {/* beisen sit på plateflatene; kutta står som rå finér. Kvar
                motor merkjer sjølv kva som er kva, so fargen gjeld alle. */}
            <PanelRow label="beis">
              {BEIS.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  aria-pressed={beis === b.id}
                  aria-label={`beis: ${b.label}`}
                  title={b.label}
                  onClick={() => onBeis(b.id)}
                  className="h-6 w-6 rounded-full border transition active:scale-90"
                  style={{
                    backgroundColor: b.hex || "#cfc7bb",
                    borderColor: beis === b.id ? "var(--ink)" : "var(--rule)",
                    boxShadow: beis === b.id ? "0 0 0 1px var(--ink)" : undefined,
                  }}
                />
              ))}
            </PanelRow>

            {/* reglane som ryk: éi line kvar, grunngjevinga i title. Panelet
                seier KVA som er gale; KVIFOR ligg eit fingertrykk unna. */}
            {failed.length > 0 && (
              <ul className="space-y-1 py-1">
                {failed.map((r) => (
                  <li
                    key={r.id}
                    title={r.why}
                    className="flex items-baseline justify-between gap-3 text-[11px] leading-4"
                    style={{
                      color: r.hard ? "var(--warn)" : undefined,
                      opacity: r.hard ? 1 : 0.65,
                    }}
                  >
                    <span className="tracking-[0.06em]">
                      {r.hard ? "bryt" : "merk"} · {r.label}
                    </span>
                    <span className="tab shrink-0">{r.value}</span>
                  </li>
                ))}
              </ul>
            )}

            {/* frøet: same tekst gjev alltid same objekt — «Iver» er eitt
                bestemt punkt i rommet og kan skrivast ned */}
            <div className="flex items-center gap-2 py-1.5">
              <input
                type="text"
                value={seed}
                placeholder="frø"
                spellCheck={false}
                autoComplete="off"
                aria-label="frø"
                onChange={(e) => onSeed(e.target.value)}
                className="tab w-full min-w-0 flex-1 border-b bg-transparent pb-[2px] text-[11px] leading-4 tracking-[0.08em] outline-none placeholder:uppercase placeholder:tracking-[0.18em] placeholder:opacity-45"
                style={{ ...HAIR, color: "var(--ink)" }}
              />
              <button
                type="button"
                onClick={onReset}
                className={CHIP}
                style={chipStyle(false)}
                title="tilbake til standardobjektet"
              >
                nullstill
              </button>
              <button
                type="button"
                onClick={onShare}
                className={CHIP}
                style={chipStyle(false)}
                title="lenkja ber heile objektet i hashen"
              >
                del
              </button>
            </div>

            {/* eksporten får heile breidda: fire piller på éi line er meir
                lesbart enn tre og ein dinglande fjerdemann */}
            <div className="flex flex-wrap items-center gap-1.5 py-1.5">
              {EXPORTS.map((x) => (
                <button
                  key={x.id}
                  type="button"
                  title={x.hint}
                  disabled={busy}
                  onClick={() => onExport(x.id)}
                  className={CHIP + " uppercase tracking-[0.1em]"}
                  style={chipStyle(false)}
                >
                  {x.label}
                </button>
              ))}
            </div>

            {isDesktop && (
              <button
                type="button"
                role="switch"
                aria-checked={hiDetail}
                onClick={onToggleDetail}
                title="fleire trekantar i flata; tyngre å rekne"
                className="my-2 flex w-full items-center justify-between rounded-2xl border px-3 py-2 transition active:scale-[0.99]"
                style={HAIR}
              >
                <span className="text-[10px] uppercase tracking-[0.18em]">fint nett</span>
                <span
                  className="relative h-5 w-9 rounded-full border transition"
                  style={{ ...HAIR, background: hiDetail ? "var(--ink)" : "transparent" }}
                >
                  <span
                    className="absolute top-0.5 h-3.5 w-3.5 rounded-full transition-all"
                    style={{
                      left: hiDetail ? 18 : 2,
                      background: hiDetail ? "var(--paper)" : "var(--ink)",
                    }}
                  />
                </span>
              </button>
            )}

            {/* utvidaren mellom halvt og heilt ope — skyveveggen bak han */}
            <button
              type="button"
              aria-expanded={mode === "full"}
              onClick={() => setMode(mode === "full" ? "halv" : "full")}
              className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-2xl border py-2 text-[10px] font-semibold uppercase tracking-[0.18em] opacity-70 transition active:scale-[0.99]"
              style={HAIR}
            >
              {mode === "full" ? <>færre kontrollar {IcoUp}</> : <>alle parametrar {IcoDown}</>}
            </button>

            {mode === "full" && (
              <>
                <h2 className="pt-4 text-[10px] uppercase leading-none tracking-[0.24em] opacity-40">
                  mål · {CUBE}-kuben
                </h2>
            <dl
              className="mt-1.5"
              style={{ opacity: busy ? 0.5 : 1, transition: "opacity 200ms ease" }}
            >
              {rows.map((row) => {
                const hard = row.rules !== undefined && isHard(row.rules)
                const soft = row.rules !== undefined && isSoft(row.rules)
                return (
                  <div
                    key={row.label}
                    className="flex items-baseline justify-between gap-3 py-[2px] text-[11px] leading-4"
                  >
                    <dt className="shrink-0 opacity-50">{row.label}</dt>
                    <dd
                      className="tab truncate text-right"
                      style={{
                        color: hard ? "var(--warn)" : undefined,
                        // eit mjukt brot er eit val og ikkje ein feil: det
                        // skal merkast, men ikkje rope
                        textDecoration: soft ? "underline dotted" : undefined,
                        textDecorationColor: soft
                          ? "color-mix(in srgb, var(--ink) 45%, transparent)"
                          : undefined,
                        textUnderlineOffset: 3,
                      }}
                    >
                      {row.value}
                      <span className="pl-1 opacity-45">{row.unit}</span>
                    </dd>
                  </div>
                )
              })}
            </dl>
              </>
            )}

            {mode === "full" &&
              eng.groups.map((g) => (
                <div key={g.id} className="pt-3">
                  <h3 className="pb-0.5 text-[10px] uppercase leading-none tracking-[0.24em] opacity-35">
                    {g.label}
                  </h3>
                  {g.keys.map((k) => (
                    <SliderRow
                      key={k}
                      k={k}
                      r={eng.ranges[k]}
                      value={num(params, k, eng.ranges[k].min)}
                      locked={locked.has(k)}
                      onChange={setParam}
                      onToggleLock={onToggleLock}
                    />
                  ))}
                </div>
              ))}
          </div>
        )}
      </section>
    </div>
  )
}
