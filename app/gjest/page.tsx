"use client"
/**
 * GJEST — sida der ein tek med sitt eige møbel.
 *
 * Sandkassen byggjer geometrien sin sjølv, og alt anna på denne webben er
 * eit punkt i eit parameterrom. Denne sida er unntaket: ho tek ei GLB
 * nokon andre har teikna og snittar henne i dei same ribbene, med det same
 * kryssholdte leddet, den same pakkaren og det same luftkravet.
 *
 * DERFOR STÅR HO PÅ SI EIGA SIDE, og ikkje i nedtrekket. Ein motor i
 * sandkassen svarar på ei måltavle — masse, veltevinkel, utnytting under
 * NS-EN 1728 — og dei tala er REKNA, ikkje gjetne. For ein vilkårleg
 * importert mesh finst ikkje lastmodellen som gjev dei. Å setje GJEST i
 * nedtrekket ville tydd å dikte opp tal for å fylle tavla, og det er den
 * eine tingen heile prosjektet er bygd for ikkje å gjera.
 *
 * Difor lovar sida berre det ho kan halde: DELANE og PLATA. Kva ho ikkje
 * seier noko om, står skrive på henne.
 */
import { useCallback, useMemo, useRef, useState } from "react"
import {
  FORMAT,
  iKuben,
  opneKantar,
  parseMesh,
  rettVend,
  type Soup,
} from "../../lib/gjest/glb"
import { makeSolid } from "../../lib/gjest/solid"
import { byggVev, DETALJ, STANDARD, type GjestVal } from "../../lib/gjest/ribber"
import { kutt, kuttDxf, kuttSvg, kryssarSegSjolv } from "../../lib/gjest/kutt"

/** dei tala ein kan dra i — `kastLause` er ein brytar og ikkje eit band */
type TalNokkel = {
  [K in keyof GjestVal]: GjestVal[K] extends number ? K : never
}[keyof GjestVal]

const BAND: {
  k: TalNokkel
  namn: string
  min: number
  max: number
  steg: number
  eining?: string
}[] = [
  { k: "nX", namn: "ribber langs X", min: 3, max: 21, steg: 1 },
  { k: "nY", namn: "ribber langs Y", min: 3, max: 21, steg: 1 },
  { k: "t", namn: "platetjukn", min: 4, max: 24, steg: 0.5, eining: "mm" },
  { k: "maal", namn: "største mål", min: 200, max: 900, steg: 10, eining: "mm" },
  // Toleransen, og ikkje ei «glatting». Bandet stoggar på 1 mm av di talet
  // no TYDER noko: `simplify` held det han lovar, so 1 mm er ein millimeter
  // avvik frå forma i den fila maskina får. Den gamle sida gjekk til 4.
  { k: "glatt", namn: "toleranse", min: 0.05, max: 1, steg: 0.05, eining: "mm" },
  { k: "detalj", namn: "oppløysing", min: DETALJ.lav, max: DETALJ.hog, steg: 10, eining: "ruter" },
]

type Svar = {
  namn: string
  trekantar: number
  boks: [number, number, number]
  ribber: number
  stykke: number
  delte: number
  hol: number
  ledd: number
  kasta: number
  smalast: number
  sjolvkryss: number
  ark: number
  util: number
  netto: number
  svg: string
  dxf: string
  ms: number
}

export default function GjestSide() {
  const [tri, setTri] = useState<{
    raa: Soup
    namn: string
    opne: number
    snudd: boolean
  } | null>(null)
  const [val, setVal] = useState<GjestVal>(STANDARD)
  const [feil, setFeil] = useState<string | null>(null)
  const filRef = useRef<HTMLInputElement>(null)

  const les = useCallback(async (f: File) => {
    setFeil(null)
    try {
      const inn = parseMesh(f.name, await f.arrayBuffer())
      if (!inn.tris) throw new Error("Fann ingen trekantar i fila.")
      // Begge desse er eigenskapar ved FILA og ikkje ved snittet, so dei
      // vert avgjorde éin gong her og ikkje på nytt for kvar ribbe.
      const opne = opneKantar(inn)
      const { soup: raa, snudd } = rettVend(inn)
      setTri({ raa, namn: f.name, opne, snudd })
    } catch (e) {
      setTri(null)
      setFeil(e instanceof Error ? e.message : "Fila lét seg ikkje lesa.")
    }
  }, [])

  // Heile kjeda er rein av (mesh, val), so ho høyrer i ein useMemo og ikkje
  // i ein effekt. Feltet tek 200–300 ms på ei skål med 3 200 trekantar ved
  // standard oppløysing; det er strålane som kostar, og talet på dei veks
  // med `detalj` og med talet på ribber.
  const svar = useMemo<Svar | null>(() => {
    if (!tri) return null
    const t0 = performance.now()
    try {
      const sol = makeSolid(iKuben(tri.raa, val.maal))
      const vev = byggVev(sol, val)
      const k = kutt(vev)
      const stykke = vev.ribber.flatMap((r) => r.stykke)
      const medSpor = vev.ribber.filter((r) => r.spor.length)
      return {
        namn: tri.namn,
        trekantar: tri.raa.tris,
        boks: vev.boks,
        ribber: vev.ribber.length,
        stykke: stykke.length,
        delte: vev.ribber.filter((r) => r.stykke.length > 1).length,
        hol: stykke.reduce((a, s) => a + s.holes.length, 0),
        ledd: vev.ledd,
        kasta: vev.kasta,
        smalast: medSpor.length
          ? Math.min(...medSpor.map((r) => r.smalast))
          : 0,
        sjolvkryss: stykke.filter((s) => kryssarSegSjolv(s.outline)).length,
        ark: k.ark,
        util: k.util,
        netto: k.netto,
        svg: kuttSvg(k),
        dxf: kuttDxf(k, val.t),
        ms: performance.now() - t0,
      }
    } catch (e) {
      setFeil(e instanceof Error ? e.message : "Feltet gjekk ikkje.")
      return null
    }
  }, [tri, val])

  const lastNed = (innhald: string, namn: string, mime: string) => {
    const url = URL.createObjectURL(new Blob([innhald], { type: mime }))
    const a = document.createElement("a")
    a.href = url
    a.download = namn
    a.click()
    URL.revokeObjectURL(url)
  }

  const grunn = svar ? svar.namn.replace(/\.[a-z0-9]+$/i, "") : "gjest"

  return (
    <main
      className="min-h-dvh px-5 py-6"
      style={{ color: "var(--ink)" }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault()
        const f = e.dataTransfer.files[0]
        if (f) void les(f)
      }}
    >
      <header className="mb-6 flex items-baseline justify-between">
        <h1 className="text-[11px] tracking-[0.22em]">GJEST</h1>
        <a
          href="/"
          className="text-[11px] tracking-wide opacity-60 hover:opacity-100"
        >
          sandkassen
        </a>
      </header>

      {!tri && (
        <button
          onClick={() => filRef.current?.click()}
          className="flex h-56 w-full flex-col items-center justify-center gap-2 rounded-3xl border border-dashed text-[12px] tracking-[0.14em] opacity-70"
        >
          <span>slepp ei fil her, eller trykk</span>
          <span className="opacity-60">{FORMAT.join("  ")}</span>
        </button>
      )}

      <input
        ref={filRef}
        type="file"
        accept={FORMAT.join(",")}
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) void les(f)
        }}
      />

      {feil && (
        <p className="rounded-2xl border px-4 py-3 text-[12px]" style={{ borderColor: "#c00" }}>
          {feil}
        </p>
      )}

      {svar && tri && (
        <>
          <div className="mb-5 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-[12px]">
            <span className="tracking-[0.14em]">{svar.namn}</span>
            <span className="opacity-60">
              {svar.boks.map((v) => Math.round(v)).join(" × ")} mm ·{" "}
              {svar.ribber} ribber · {svar.stykke} stykke · {svar.ledd} ledd ·{" "}
              {svar.ark} plate{svar.ark === 1 ? "" : "r"} ·{" "}
              {Math.round(svar.util * 100)} % ark
            </span>
            {tri.opne > 0 && (
              <span className="opacity-60">· {tri.opne} opne kantar i fila</span>
            )}
            <button
              onClick={() => filRef.current?.click()}
              className="ml-auto rounded-full border px-3 py-1 text-[11px] tracking-[0.14em]"
            >
              byt fil
            </button>
          </div>

          {/* Åtvaringane står OVER teikninga og ikkje under henne. Ei ribbe
              som ikkje heng saman med noko, eller ein kontur som kryssar seg
              sjølv, er ting ein må vite FØR ein kuttar — ikkje noko ein
              oppdagar når plata ligg i maskina. */}
          {(svar.sjolvkryss > 0 ||
            svar.kasta > 0 ||
            svar.ledd === 0 ||
            (svar.smalast > 0 && svar.smalast < val.t * 2) ||
            svar.delte > 0 ||
            tri.snudd ||
            tri.opne > 0) && (
            <ul className="mb-5 space-y-1 text-[12px]">
              {svar.sjolvkryss > 0 && (
                <li style={{ color: "#c00" }}>
                  {svar.sjolvkryss} stykke har ein kontur som kryssar seg sjølv — kuttbana
                  skjer gjennom sitt eige gods
                </li>
              )}
              {svar.ledd === 0 && (
                <li style={{ color: "#c00" }}>
                  ingen ledd i det heile — ribbene møter aldri kvarandre i gods, og
                  delane held ikkje saman
                </li>
              )}
              {svar.smalast > 0 && svar.smalast < val.t * 2 && (
                <li style={{ color: "#c00" }}>
                  smalaste godset gjennom eit spor er {svar.smalast.toFixed(1)} mm —
                  ribba kan knekke der
                </li>
              )}
              {svar.kasta > 0 && (
                <li className="opacity-70">
                  {svar.kasta} stykke kasta — dei hang ikkje i eit einaste ledd
                </li>
              )}
              {svar.delte > 0 && (
                <li className="opacity-70">
                  {svar.delte} ribber er delte i fleire stykke — dei er lause bitar som
                  må skjerast kvar for seg
                </li>
              )}
              {tri.snudd && (
                <li className="opacity-70">
                  nettet var ut-inn og vart snudd — utan det hadde alt vore luft
                </li>
              )}
              {tri.opne > 0 && (
                <li className="opacity-70">
                  {tri.opne} opne kantar — flata er ikkje lukka, og då er «inne» eit
                  gjett. Snittet står, men det er ikkje rekna på noko heilt.
                </li>
              )}
            </ul>
          )}

          <div className="mb-6 space-y-3">
            {BAND.map(({ k, namn, min, max, steg, eining }) => (
              <label key={k} className="flex items-center gap-3 text-[11px]">
                <span className="w-32 shrink-0 uppercase tracking-[0.14em] opacity-70">
                  {namn}
                </span>
                <input
                  type="range"
                  min={min}
                  max={max}
                  step={steg}
                  value={val[k]}
                  onChange={(e) => setVal({ ...val, [k]: +e.target.value })}
                  className="h-9 min-w-0 flex-1"
                  style={{ accentColor: "var(--ink)" }}
                />
                <span className="w-16 shrink-0 text-right tabular-nums">
                  {val[k]}
                  {eining && <span className="opacity-40"> {eining}</span>}
                </span>
              </label>
            ))}
          </div>

          <div className="mb-6 flex gap-2">
            <button
              onClick={() => lastNed(svar.svg, `${grunn}-ark.svg`, "image/svg+xml")}
              className="rounded-full border px-4 py-2 text-[11px] uppercase tracking-[0.18em]"
            >
              svg
            </button>
            <button
              onClick={() => lastNed(svar.dxf, `${grunn}.dxf`, "application/dxf")}
              className="rounded-full border px-4 py-2 text-[11px] uppercase tracking-[0.18em]"
            >
              dxf
            </button>
          </div>

          {/* Kuttarket kjem i MILLIMETER — `width="2440mm"` — av di ei fil
              som skal skrivast ut i 1:1 må vera det. På skjermen er det ei
              teikning og ikkje ei plate, so ho vert skalert inn her og
              berre her: fila brukaren lastar ned står urørd. */}
          <div
            className="rounded-2xl border p-2 [&>svg]:h-auto [&>svg]:w-full"
            dangerouslySetInnerHTML={{ __html: svar.svg }}
          />

          <p className="mt-5 text-[11px] leading-5 opacity-50">
            Delane og plata er rekna. Masse, veltevinkel og utnytting under last er
            det IKKJE — den modellen finst berre for typologiane i sandkassen, og
            eit tal utan ei rekning bak er verre enn ingen tal.
          </p>
        </>
      )}
    </main>
  )
}
