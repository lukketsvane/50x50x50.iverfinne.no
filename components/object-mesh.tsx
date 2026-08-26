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
/**
 * Materialtonane i 3D — same valet som materialprikkane i panelet.
 * Naturtonen er grunnfargen shaderen legg ved, seinved og finérlag over;
 * i mørk modus vert han dempa, elles brenn objektet hòl i skjermen.
 * `slag` vel shadergrein og overflateparametrar: ved har åringar og
 * lagdelt kant, MDF er homogen med tett mørkare kant, akryl er blank
 * støypt plast utan ved i det heile.
 */
const TONAR: Record<string, { lys: string; slag: "ved" | "mdf" | "akryl" }> = {
  bjork: { lys: "#e8dabb", slag: "ved" },
  bok: { lys: "#d2a97c", slag: "ved" },
  poppel: { lys: "#f0e6cc", slag: "ved" },
  mdf: { lys: "#c8aa80", slag: "mdf" },
  akryl: { lys: "#cfe0e0", slag: "akryl" },
}

/**
 * Beisane. Fargen sit på FLATENE av kvar plate; kantane står som rå finér —
 * det er slik ein faktisk beisar, før liming, og det er kontrasten
 * referansebileta lever av: farga lag med lyse fugekantar imellom.
 * «natur» er inga beis. Beisen endrar ingenting i geometrien eller
 * berekninga — han er ferdig handsaming, som lakk.
 */
export const BEIS: readonly { id: string; label: string; hex: string }[] = [
  { id: "natur", label: "natur", hex: "" },
  // AHO sin oransje primærfarge — standardbeisen på sida
  { id: "aho", label: "aho-oransje", hex: "#ed520f" },
  { id: "kvit", label: "kvitpigmentert", hex: "#e9e2d2" },
  { id: "petrol", label: "petrolblå", hex: "#3f7d8c" },
  { id: "marine", label: "marineblå", hex: "#2b4a68" },
  { id: "gron", label: "skogsgrøn", hex: "#4e6b52" },
  { id: "rust", label: "rustraud", hex: "#a04f38" },
  { id: "svart", label: "svartbeisa", hex: "#2e2b28" },
]

/**
 * Skalaen til lastkartet, av husets eigne fargar: marine → petrol → sand
 * → aho-oransje → mørkraud. 0 er urørt, 1,0 er objektet sitt VERSTE punkt
 * — kva det punktet er i prosent av kapasiteten, står ved skalaen i
 * panelet. Fargane vert rekna per hjørne éin gong per bygg; shaderen les
 * dei som vanlege vertex-fargar.
 */
const LAST_STOPP: readonly [number, number, number, number][] = [
  [0.0, 0x2b / 255, 0x4a / 255, 0x68 / 255],
  [0.3, 0x3f / 255, 0x7d / 255, 0x8c / 255],
  [0.55, 0xe9 / 255, 0xe2 / 255, 0xd2 / 255],
  [0.8, 0xed / 255, 0x52 / 255, 0x0f / 255],
  [1.0, 0x7f / 255, 0x1d / 255, 0x1d / 255],
]

function feltFargar(felt: Float32Array, tak?: number): Float32Array {
  // Strekt til objektet sitt eige verste punkt. På absoluttskalaen ligg
  // eit lovleg møbel under 40 % utnytting og det meste av godset under
  // 10 — då var HEILE kartet blått, same kva ein skrudde på, og eit kart
  // som alltid seier det same seier ingenting. Relativt syner kartet det
  // han finst for: KVAR lasta bur i objektet. Ankeret er motoren sitt
  // analytiske maksimum (feltTak) — same talet som «utnytting» i tavla
  // og ved skalaen i panelet — med hjørnemaksimum som golv, so ingen
  // verdi går over 1 om ankeret av ein grunn manglar.
  let maks = 0
  for (let i = 0; i < felt.length; i++) if (felt[i] > maks) maks = felt[i]
  if (tak && tak > maks) maks = tak
  const inv = maks > 1e-6 ? 1 / maks : 0
  const out = new Float32Array(felt.length * 3)
  for (let i = 0; i < felt.length; i++) {
    // Kvadratrota spreier den låge enden; skalaen i panelet er teikna
    // med same rot, so ein farge peikar på same relative nivå begge stader.
    const u = Math.sqrt(Math.min(1, Math.max(0, felt[i] * inv)))
    let k = 1
    while (k < LAST_STOPP.length - 1 && LAST_STOPP[k][0] < u) k++
    const a = LAST_STOPP[k - 1]
    const b = LAST_STOPP[k]
    const t = (u - a[0]) / (b[0] - a[0] || 1)
    out[i * 3] = a[1] + (b[1] - a[1]) * t
    out[i * 3 + 1] = a[2] + (b[2] - a[2]) * t
    out[i * 3 + 2] = a[3] + (b[3] - a[3]) * t
  }
  return out
}

function makeStriped(
  color: string,
  slag: "ved" | "mdf" | "akryl",
  uPly: { value: number },
  uBeis: { value: THREE.Color },
  uBeisOn: { value: number },
) {
  const m = new THREE.MeshPhysicalMaterial({
    color,
    metalness: 0,
    side: THREE.DoubleSide,
    // overflata er slaget: olja finér har eit tynt, levande strøk;
    // MDF er daudmatt; støypt akryl er blankpolert
    ...(slag === "ved"
      ? { roughness: 0.58, clearcoat: 0.28, clearcoatRoughness: 0.42, envMapIntensity: 0.55 }
      : slag === "mdf"
        ? { roughness: 0.86, clearcoat: 0, envMapIntensity: 0.22 }
        : { roughness: 0.1, clearcoat: 1.0, clearcoatRoughness: 0.06, envMapIntensity: 1.2 }),
  })
  const uSlag = slag === "ved" ? 0 : slag === "mdf" ? 1 : 2
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uPly = uPly
    sh.uniforms.uBeis = uBeis
    sh.uniforms.uBeisOn = uBeisOn
    sh.uniforms.uSlag = { value: uSlag }
    sh.vertexShader = sh.vertexShader
      .replace(
        "#include <common>",
        "#include <common>\nattribute float aKant;\nvarying vec3 vObj;\nvarying vec3 vNrmO;\nvarying float vKant;",
      )
      .replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\nvObj = position;\nvNrmO = normal;\nvKant = aKant;",
      )
    sh.fragmentShader = sh.fragmentShader
      .replace(
        "#include <common>",
        "#include <common>\nvarying vec3 vObj;\nvarying vec3 vNrmO;\nvarying float vKant;\nuniform float uPly;\nuniform vec3 uBeis;\nuniform float uBeisOn;\nuniform float uSlag;\nfloat gKorn;",
      )
      .replace(
        "#include <color_fragment>",
        [
          "#include <color_fragment>",
          "{",
          "  gKorn = 0.0;",
          // Kvart hjørne veit om det er plateFLATE (0) eller KUTT (1).
          // Motoren har merkt det der han bygde trekanten; der han teier,
          // har framsyninga gissa frå normalen før ho la attributtet.
          // Beisen fyrst, veden over: farga tre viser framleis åringane —
          // det er beis, ikkje målingsdekke.
          "  if (uBeisOn > 0.5) {",
          "    diffuseColor.rgb = mix(diffuseColor.rgb, uBeis, (1.0 - vKant) * 0.92);",
          "  }",
          // VEDEN. Alt er rekna av geometrien sin eigen posisjon i
          // millimeter — ingen tekstur, inga sauming, og mønsteret fylgjer
          // kvar einaste parameterendring. Kvar frekvens vert dempa av sin
          // eigen skjermromsderiverte, so mønsteret løyser seg opp i ro og
          // ikkje i moaré når det vert mindre enn ein piksel.
          "  if (uSlag < 0.5) {",
          // Planvalet er KONTINUERLEG: koordinaten er ei triplanar
          // blanding vekta av normalen i fjerde potens. På ei plan plate
          // dominerer eitt plan totalt og teikninga er som før; på ein
          // frest, fasettert kropp glid planet mjukt frå fasett til
          // fasett i staden for å flippe — det var flippinga som la
          // mursteinsmønster over sokkelen.
          "    vec3 aw = vNrmO * vNrmO;",
          "    aw *= aw;",
          "    aw /= max(aw.x + aw.y + aw.z, 1e-5);",
          "    vec2 q = vObj.yz * aw.x + vObj.xz * aw.y + vObj.xy * aw.z;",
          "    float px = fwidth(q.x);",
          // Planvalet over gjeld berre der flata FAKTISK er eit plan: på
          // ei tvikrumma frest flate flippar aksen frå fragment til
          // fragment, og full ved vart kordfløyel. Krumme flater får
          // difor roleg, dempa ved — plane plateflater full teikning.
          "    float flatW = 1.0;",
          // ... og berre der normalen står i ro: på ei krum flate svingar
          // han frå piksel til piksel, og der skal veden tie
          "    flatW *= clamp(1.0 - length(fwidth(vNrmO)) * 9.0, 0.0, 1.0);",
          // Og fyrst og sist: ringveden hoeyrer plateFLATENE til. Eit kutt
          // viser endeved og lag — aldri ringband — so heile
          // flate-teikninga doeyr paa kanten.
          "    flatW *= 1.0 - vKant;",
          // Rotérskoren finér: nesten parallelle årringar som vandrar.
          // Seinveden er det smale, skarpe, mørkare bandet i kvar ring —
          // det er han, meir enn fargen, som gjer at auget les tre.
          "    float bolge = 30.0 * sin(q.y * 0.011 + 1.7) + 55.0 * sin(q.y * 0.0031) + 9.0 * sin(q.x * 0.007);",
          "    float rf = fract((q.x + bolge) / 26.0);",
          "    float attR = clamp(1.0 - px * 0.09, 0.0, 1.0);",
          "    float late = (smoothstep(0.55, 0.74, rf) - smoothstep(0.80, 0.95, rf)) * attR;",
          "    float attF = clamp(1.0 - px * 2.6, 0.0, 1.0);",
          "    float fib = (sin(q.x * 2.3 + 3.0 * sin(q.y * 0.33)) * 0.5 + 0.5) * attF;",
          // margstrålespetter: sjeldne, strekte, eit hakk mørkare
          "    vec2 cq = floor(q * vec2(0.3, 0.05));",
          "    float fleck = step(0.955, fract(sin(dot(cq, vec2(127.1, 311.7))) * 43758.5453)) * attF;",
          // brei fargedrift over plata — inga plate er jamn
          "    float drift = sin(q.x * 0.006 + q.y * 0.0043);",
          "    vec3 lateTone = uBeisOn > 0.5 ? diffuseColor.rgb * 0.86 : diffuseColor.rgb * vec3(0.80, 0.68, 0.55);",
          "    diffuseColor.rgb = mix(diffuseColor.rgb, lateTone, late * mix(0.22, 0.75, flatW));",
          "    diffuseColor.rgb *= 1.0 + drift * 0.07 * (1.0 - 0.6 * vKant) - fib * 0.035 * flatW - fleck * 0.12 * flatW;",
          "    gKorn = late;",
          "    if (vKant > 0.5) {",
          // KUTTET. Der laga ligg VASSRETT (uPly ber platetjukna) vert
          // kvart finérlag på ~1,45 mm teikna, annakvar mørkare av di
          // fibrane står på tvers, med limline mellom. For motorane der
          // platene står kvar sin veg finst ingen global lag-akse — då
          // står kuttet som rå, ujamn endeved: litt mørkare og varmare
          // enn flata, med spetter.
          "      if (uPly > 0.5) {",
          "        float nV = max(3.0, floor(uPly / 1.45 + 0.5));",
          "        float tz = fract(vObj.z / uPly);",
          "        float vt = tz * nV;",
          "        float ft = fract(vt);",
          "        float vPx = fwidth(vObj.z) * nV / uPly;",
          "        float attV = clamp(1.0 - vPx * 0.9, 0.0, 1.0);",
          "        float par = mod(floor(vt), 2.0);",
          "        diffuseColor.rgb *= mix(1.0, mix(1.07, 0.85, par), attV);",
          "        float gl = 1.0 - smoothstep(0.0, 0.16 + vPx * 0.4, min(ft, 1.0 - ft));",
          "        diffuseColor.rgb *= 1.0 - 0.3 * gl * attV;",
          "        float kantP = (0.5 - abs(tz - 0.5)) * uPly;",
          "        float wp = max(fwidth(vObj.z) * 1.2, 0.3);",
          "        diffuseColor.rgb *= 1.0 - 0.2 * (1.0 - smoothstep(0.0, wp + 0.4, kantP));",
          "      } else {",
          "        diffuseColor.rgb *= vec3(0.94, 0.92, 0.88);",
          "      }",
          "      vec3 celle = floor(vObj * 1.6);",
          "      float spek = fract(sin(dot(celle, vec3(12.9898, 78.233, 37.719))) * 43758.5453) - 0.5;",
          "      diffuseColor.rgb *= 1.0 + spek * 0.07 * attF;",
          "    }",
          "  } else if (uSlag < 1.5) {",
          // MDF: homogen fiberplate — berre eit fint, tett spett, og ein
          // kant som er tettare og mørkare enn flata
          "    vec3 c2 = floor(vObj * 3.1);",
          "    float s2 = fract(sin(dot(c2, vec3(12.9898, 78.233, 37.719))) * 43758.5453) - 0.5;",
          "    diffuseColor.rgb *= 1.0 + s2 * 0.025;",
          "    if (vKant > 0.5) diffuseColor.rgb *= 0.9;",
          "  }",
          // akryl: rein, jamn farge — glansen gjer resten
          "}",
        ].join("\n"),
      )
      .replace(
        "#include <roughnessmap_fragment>",
        [
          "#include <roughnessmap_fragment>",
          // Endeveden et lys — kuttet er ruare enn flata — og seinveden
          // er BLANKARE enn vårveden: det er vekslinga i glans, meir enn
          // i farge, som sel materialet under hardt lys.
          "if (uSlag < 0.5) roughnessFactor = clamp(roughnessFactor + vKant * 0.14 - gKorn * 0.1, 0.05, 1.0);",
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
  material,
  onFit,
}: {
  data: BuildRes | null
  view: View
  dark: boolean
  /** platetjukn for limfugene i shaderen; 0 slår dei av */
  stripePly: number
  /** beis-hex for plateFLATENE; tom streng er natur */
  beis: string
  /** materialvalet frå panelet — bjork/bok/poppel/mdf/akryl */
  material: string
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
      // lastkartet: utnyttinga per hjørne, ferdig farga etter skalaen
      if (data.view === "last" && data.felt && data.felt.length === nv) {
        g.setAttribute("color", new THREE.BufferAttribute(feltFargar(data.felt, data.feltTak), 3))
      }
      // Kula kjem frå min/maks motoren alt har rekna — å skanne kvart
      // hjørne ein gong til her ville kosta ein full gjennomgang av
      // nettet per bygg, på hovudtråden, for eit tal vi alt har.
      const c = new THREE.Vector3(
        (data.min[0] + data.max[0]) / 2,
        (data.min[1] + data.max[1]) / 2,
        (data.min[2] + data.max[2]) / 2,
      )
      const r =
        Math.hypot(
          data.max[0] - data.min[0],
          data.max[1] - data.min[1],
          data.max[2] - data.min[2],
        ) / 2
      g.boundingSphere = new THREE.Sphere(c, r)
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

  // materialet lever like lenge som tonen og slaget; fugetjukna er ein
  // uniform og kostar aldri ein rekompilering
  const tone = TONAR[material] ?? TONAR.bjork
  const farge = useMemo(() => {
    const c = new THREE.Color(tone.lys)
    if (dark) c.multiplyScalar(0.82)
    return c
  }, [tone, dark])
  const mat = useMemo(
    () =>
      makeStriped("#" + farge.getHexString(), tone.slag, uPly.current, uBeis.current, uBeisOn.current),
    [farge, tone],
  )
  useEffect(() => () => mat.dispose(), [mat])
  // Lastkartet sitt eige materiale: berre fargane, ingen ved og inga beis
  // — kartet er ei måling, ikkje eit materiale.
  const matLast = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.85,
        metalness: 0,
        side: THREE.DoubleSide,
      }),
    [],
  )
  useEffect(() => () => matLast.dispose(), [matLast])
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
        <mesh
          geometry={built.g}
          castShadow
          receiveShadow
          material={data?.view === "last" && data.felt?.length ? matLast : mat}
        />
      )}
    </group>
  )
}
