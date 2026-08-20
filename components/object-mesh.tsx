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

function makeStriped(color: string, roughness: number, uPly: { value: number }) {
  const m = new THREE.MeshStandardMaterial({
    color,
    roughness,
    metalness: 0,
    side: THREE.DoubleSide,
  })
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uPly = uPly
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vObj;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvObj = position;")
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vObj;\nuniform float uPly;")
      .replace(
        "#include <color_fragment>",
        [
          "#include <color_fragment>",
          "if (uPly > 0.5) {",
          "  float t = vObj.z / uPly;",
          "  float kant = (0.5 - abs(fract(t) - 0.5)) * uPly;",
          "  float w = max(fwidth(vObj.z) * 1.2, 0.35);",
          "  float fuge = 1.0 - smoothstep(0.0, w + 0.45, kant);",
          "  diffuseColor.rgb *= 1.0 - 0.16 * fuge;",
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
  onFit,
}: {
  data: BuildRes | null
  view: View
  dark: boolean
  /** platetjukn for limfugene i shaderen; 0 slår dei av */
  stripePly: number
  onFit: (r: number, cy: number) => void
}) {
  const invalidate = useThree((s) => s.invalidate)
  const uPly = useRef({ value: 0 })
  const geom = useRef<THREE.BufferGeometry | null>(null)
  const thin = useRef<THREE.BufferGeometry | null>(null)
  const bold = useRef<THREE.BufferGeometry | null>(null)

  const built = useMemo(() => {
    if (!data) return null
    const g = new THREE.BufferGeometry()
    if (data.positions.length) {
      g.setAttribute("position", new THREE.BufferAttribute(data.positions, 3))
      g.setAttribute("normal", new THREE.BufferAttribute(data.normals, 3))
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
  const mat = useMemo(() => makeStriped(col2(dark), rough, uPly.current), [dark, rough])
  useEffect(() => () => mat.dispose(), [mat])
  useEffect(() => {
    uPly.current.value = stripePly
    invalidate()
  }, [stripePly, invalidate])

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
