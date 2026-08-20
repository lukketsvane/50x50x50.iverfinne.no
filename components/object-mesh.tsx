"use client"

import { useEffect, useMemo, useRef } from "react"
import { useThree } from "@react-three/fiber"
import * as THREE from "three"
import type { BuildRes } from "@/lib/worker"
import type { View } from "@/lib/core"

/** millimeter til sceneeiningar: kuben på 500 mm vert 2 einingar brei */
export const MM = 1 / 250

/**
 * Objektet i scena, kva typologi det så er. Modellen reknar i millimeter med
 * Z opp, som er koordinatsystemet til verkstaden; scena har Y opp.
 * Omrekninga skjer her og ingen annan stad, slik at ingen tal i nokon motor
 * nokon gong er i «sceneeiningar».
 */
/**
 * Lamineringa som materiale, ikkje som tekstur.
 *
 * Finéren er identiteten til objektet: kvar femtande millimeter ligg det ei
 * limfuge, og det er ho som fortel at flata er ein stabel og ikkje eit
 * støyp. Fugene vert rekna i shaderen av geometrien sin eigen z — same z
 * som laga faktisk ligg i — so dei fylgjer objektet gjennom kvar einaste
 * parameterendring utan at nokon har teikna dei. Breidda vert halden i
 * skjermpikslar med fwidth, so fuga korkje forsvinn på avstand eller vert
 * eit belte på nært hald.
 *
 * Uniformen vert delt med materialet gjennom eit objekt som lever utanfor
 * shaderen: ny platetjukn er eit taloppslag, aldri ein rekompilering.
 */
/** Bjørk under kvitpigmentert olje: nesten kvit, eit snev varm. I mørk
 *  modus vert han dempa, elles brenn objektet hòl i skjermen. */
const col2 = (dark: boolean) => (dark ? "#cfc7bb" : "#e8e1d4")

/**
 * Beisane. Fargen sit på FLATENE av kvar plate; kantane står som rå finér —
 * det er slik ein faktisk beisar, før liming, og det er kontrasten
 * referansebileta lever av: farga lag med lyse fugekantar imellom.
 * «natur» er inga beis. Beisen endrar ingenting i geometrien eller
 * berekninga — han er ferdig handsaming, som lakk.
 */
export const BEIS: readonly { id: string; label: string; hex: string }[] = [
  { id: "natur", label: "natur", hex: "" },
  { id: "kvit", label: "kvitpigmentert", hex: "#e9e2d2" },
  { id: "petrol", label: "petrolblå", hex: "#3f7d8c" },
  { id: "marine", label: "marineblå", hex: "#2b4a68" },
  { id: "gron", label: "skogsgrøn", hex: "#4e6b52" },
  { id: "rust", label: "rustraud", hex: "#a04f38" },
  { id: "svart", label: "svartbeisa", hex: "#2e2b28" },
]

function makeStriped(
  color: string,
  roughness: number,
  uPly: { value: number },
  uBeis: { value: THREE.Color },
  uBeisOn: { value: number },
) {
  const m = new THREE.MeshStandardMaterial({
    color,
    roughness,
    metalness: 0,
    side: THREE.DoubleSide,
  })
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uPly = uPly
    sh.uniforms.uBeis = uBeis
    sh.uniforms.uBeisOn = uBeisOn
    sh.vertexShader = sh.vertexShader
      .replace(
        "#include <common>",
        "#include <common>\nattribute float aKant;\nvarying vec3 vObj;\nvarying float vKant;",
      )
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvObj = position;\nvKant = aKant;")
    sh.fragmentShader = sh.fragmentShader
      .replace(
        "#include <common>",
        "#include <common>\nvarying vec3 vObj;\nvarying float vKant;\nuniform float uPly;\nuniform vec3 uBeis;\nuniform float uBeisOn;",
      )
      .replace(
        "#include <color_fragment>",
        [
          "#include <color_fragment>",
          "{",
          // Kvart hjørne veit om det er plateFLATE (0) eller KUTT (1).
          // Motoren har merkt det der han bygde trekanten; der han teier,
          // har framsyninga gissa frå normalen før ho la attributtet.
          "  if (uBeisOn > 0.5) {",
          "    diffuseColor.rgb = mix(diffuseColor.rgb, uBeis, (1.0 - vKant) * 0.92);",
          "  }",
          "  if (uPly > 0.5) {",
          "    float t = vObj.z / uPly;",
          "    float kant = (0.5 - abs(fract(t) - 0.5)) * uPly;",
          "    float w = max(fwidth(vObj.z) * 1.2, 0.35);",
          "    float fuge = 1.0 - smoothstep(0.0, w + 0.45, kant);",
          // Fuga finst berre i kuttet. Flatene ligg NØYAKTIG på
          // laggrensene, so utan denne porten vart heile lokket på kvart
          // lag mørkna som éi stor fuge — det var den mørke ringen kring
          // setet.
          "    diffuseColor.rgb *= 1.0 - 0.16 * fuge * vKant;",
          "  }",
          "}",
        ].join("\n"),
      )
  }
  return m
}

export function ObjectMesh({
  data,
  view,
  dark,
  stripePly,
  beis,
  onFit,
}: {
  data: BuildRes | null
  view: View
  dark: boolean
  /** platetjukn for limfugene i shaderen; 0 slår dei av */
  stripePly: number
  /** beis-hex for plateFLATENE; tom streng er natur */
  beis: string
  onFit: (r: number, cy: number) => void
}) {
  const invalidate = useThree((s) => s.invalidate)
  const uPly = useRef({ value: 0 })
  const uBeis = useRef({ value: new THREE.Color("#888888") })
  const uBeisOn = useRef({ value: 0 })
  const geom = useRef<THREE.BufferGeometry | null>(null)
  const thin = useRef<THREE.BufferGeometry | null>(null)
  const bold = useRef<THREE.BufferGeometry | null>(null)

  const built = useMemo(() => {
    if (!data) return null
    const g = new THREE.BufferGeometry()
    if (data.positions.length) {
      g.setAttribute("position", new THREE.BufferAttribute(data.positions, 3))
      g.setAttribute("normal", new THREE.BufferAttribute(data.normals, 3))
      // Flate/kant per hjørne. Motorar som merkjer sjølve sender lista;
      // for dei andre vert ho gissa av normalen: langs stabelaksen er
      // plateflate, på tvers er kutt. Gissinga skjer HER, éin gong per
      // bygg, so shaderen alltid les same attributt.
      const nv = data.positions.length / 3
      let kant = data.kant
      if (kant.length !== nv) {
        kant = new Float32Array(nv)
        for (let i = 0; i < nv; i++) {
          const nz = Math.abs(data.normals[i * 3 + 2])
          const t = Math.min(1, Math.max(0, (nz - 0.6) / 0.25))
          kant[i] = 1 - t * t * (3 - 2 * t)
        }
      }
      g.setAttribute("aKant", new THREE.BufferAttribute(kant, 1))
      g.computeBoundingSphere()
    }
    const mk = (a: Float32Array) => {
      const b = new THREE.BufferGeometry()
      if (a.length) b.setAttribute("position", new THREE.BufferAttribute(a, 3))
      return b
    }
    return { g, thin: mk(data.lines), bold: mk(data.heavy) }
  }, [data])

  useEffect(() => {
    const prev = { g: geom.current, t: thin.current, b: bold.current }
    geom.current = built?.g ?? null
    thin.current = built?.thin ?? null
    bold.current = built?.bold ?? null
    prev.g?.dispose()
    prev.t?.dispose()
    prev.b?.dispose()
    invalidate()
  }, [built, invalidate])

  // Auto-innramminga treng radius og senterhøgd i sceneeiningar. Storleiken
  // vert lesen av det som faktisk er bygd, ikkje av kuben — eit lite objekt
  // skal ikkje stå like langt unna som eit stort.
  const box = useMemo(() => {
    if (!data) return null
    const min = data.min
    const max = data.max
    const cx = (min[0] + max[0]) / 2
    const cy = (min[1] + max[1]) / 2
    const h = Math.max(1, max[2] - Math.min(0, min[2]))
    const w = Math.max(max[0] - min[0], max[1] - min[1])
    return { cx, cy, r: (Math.hypot(w, h) / 2) * MM, mid: (h / 2) * MM }
  }, [data])

  useEffect(() => {
    if (box) onFit(box.r, box.mid)
  }, [box, onFit])

  // materialet lever like lenge som fargen og ruheita; fugetjukna er ein
  // uniform og kostar aldri ein rekompilering
  const rough = view === "lag" ? 0.92 : 0.78
  const mat = useMemo(
    () => makeStriped(col2(dark), rough, uPly.current, uBeis.current, uBeisOn.current),
    [dark, rough],
  )
  useEffect(() => () => mat.dispose(), [mat])
  useEffect(() => {
    uPly.current.value = stripePly
    uBeisOn.current.value = beis ? 1 : 0
    if (beis) uBeis.current.value.set(beis)
    invalidate()
  }, [stripePly, beis, invalidate])

  if (!built || !box) return null

  return (
    <group
      rotation={[-Math.PI / 2, 0, 0]}
      scale={MM}
      position={[-box.cx * MM, 0, box.cy * MM]}
    >
      {view === "kontur" ? (
        <>
          <lineSegments geometry={built.thin}>
            <lineBasicMaterial color={dark ? "#8a8a8a" : "#9a9a9a"} transparent opacity={0.55} />
          </lineSegments>
          <lineSegments geometry={built.bold}>
            <lineBasicMaterial color={dark ? "#ffffff" : "#000000"} />
          </lineSegments>
        </>
      ) : (
        <mesh geometry={built.g} castShadow receiveShadow material={mat} />
      )}
    </group>
  )
}
