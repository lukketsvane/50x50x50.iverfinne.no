/**
 * FLETT — reglane.
 *
 * Tre av dei harde finst ikkje i nokon annan motor i sandkassen, og dei
 * er heile grunnen til at typologien er ein eigen motor:
 *
 *   BØYERADIUS  bandet vert TVUNGE kring bandet det kryssar. Radien er
 *               ikkje eit val — han fylgjer av delinga, flottlengda og
 *               tjukna på det andre bandet.
 *   SIG         flata er ein kabel, ikkje ei plate. Ho MÅ søkke for å
 *               bere, og ho får ikkje søkke so djupt at ein botnar.
 *   SPRIK       ramma må halde bandstrekket utan å gje etter. Ein lukka
 *               ring gjer det i trykk; ein kutta ring må gjera det i
 *               bøying, og det er ei heilt anna rekning.
 */
import { CUBE, MATERIALS, nn, type Metrics, type Rule } from "../core"
import { nest } from "../vaffel/nest"
import { krefter } from "./metrics"
import { buildParts } from "./parts"
import { makeWeave } from "./weave"
import type { Params } from "./params"

const mm1 = (v: number) => nn(v, 1) + " mm"

const SIT_LO = 380
const SIT_HI = 480
const TRAP_LO = 5
const TRAP_HI = 25
/** kor djupt veven får søkke før den som sit kviler på ramma i staden */
export const SIG_MAX = 34
/** under dette er veven ei plate med luft i, og då er han feil verktøy */
export const SIG_MIN = 3.5
/** kor mykje ramma får gje etter før veven vert slakk */
export const SPRIK_MAX = 3

export function checkRules(p: Params, m: Metrics): Rule[] {
  const w = makeWeave(p)
  const kr = krefter(p, w)
  const pl = buildParts(w)
  const ark = nest(pl.ramme.parts).sheets.length + nest(pl.band.parts).sheets.length
  const out: Rule[] = []
  const add = (r: Rule) => out.push(r)

  // --- 1 kuben (hard) --------------------------------------------------------
  const big = Math.max(m.envX, m.envY, m.envZ)
  add({
    id: "kube",
    label: "står i kuben",
    hard: true,
    ok: big <= CUBE,
    value: `${mm1(big)} av ${CUBE}`,
    why: "Oppgåva er ein kube på 500 mm. Her er det ramma som et han: veven sjølv har inga tjukn å tale om, men ringen legg rammebreidda utanpå opninga heile vegen rundt, og beina spriker vidare enn ringen.",
  })

  // --- 2 sitjehøgda (hard) ---------------------------------------------------
  add({
    id: "sitjehogd",
    label: "sitjehøgd under last",
    hard: true,
    ok: m.sitZ >= SIT_LO && m.sitZ <= SIT_HI,
    value: mm1(m.sitZ),
    why: `NS-EN 1729 set setehøgda for vaksne til ${SIT_LO}–${SIT_HI} mm. I ein vev er den høgda ikkje der flata ligg tom: ho er der flata ligg når nokon sit i henne, og sigen på ${mm1(kr.sig)} er trekt frå. Ein vev som vert målt tom, vert målt feil.`,
  })

  // --- 3 velting (hard) ------------------------------------------------------
  add({
    id: "velting",
    label: "veltevinkel",
    hard: true,
    ok: m.tipAngle >= 12,
    value: `${nn(m.tipAngle, 1)}°`,
    why: "NS-EN 1022. Vinkelen går frå der ein sit ut til kanten av støtteflata. Beinspreiinga er den billegaste spaken her — ho flyttar foten utan å røre korkje setehøgda eller veven.",
  })

  // --- 4 styrke (hard) -------------------------------------------------------
  add({
    id: "styrke",
    label: "utnytting",
    hard: true,
    ok: m.util <= 1,
    value: `${nn(m.util * 100, 0)} %`,
    why: "1600 N etter NS-EN 1728, mot kapasitetane i NS-EN 1995-1-1. Bandet, ramma og beinet vert rekna kvar for seg og den verste tel: dei deler aldri snitt, so å leggje spenningane deira saman ville vera å straffe eit band for eit bein.",
  })

  // --- 5 BØYERADIUS (hard) ---------------------------------------------------
  // Den karakteristiske regelen. Sjå why-teksten for utleiinga.
  add({
    id: "boygeradius",
    label: "bøyeradius i veven",
    hard: true,
    ok: kr.rmin >= kr.rKrav,
    value: `${nn(kr.rmin, 0)} av ${nn(kr.rKrav, 0)} mm`,
    why: `Finér bøyer seg kaldt til om lag ${p.boygtal} gonger si eiga tjukn — under det knekk krossbanda. I ein vev er radien ikkje eit val: bandet vert tvunge kring bandet det kryssar, og lina hans er ei bylgje med amplitude t_kryss/2 og bylgjelengd 2·flott·deling. Det gjev R = 2·flott²·deling²/(π²·t_kryss). Difor kan tjukke band berre vevast GROVT, og difor kan eit kypert pakke banda dobbelt så tett som eit toskaft: flottlengda står i kvadratet.`,
  })

  // --- 6 festebøyen (hard) ---------------------------------------------------
  add({
    id: "festeboy",
    label: "bøyen i festet",
    hard: true,
    ok: kr.rFeste >= kr.rFesteKrav,
    value:
      kr.rFesteKrav > 0
        ? `${nn(kr.rFeste, 1)} av ${nn(kr.rFesteKrav, 1)} mm`
        : "ingen varig bøy",
    why: "To bøyar i objektet er VARIGE og ikkje elastiske: omslaget kring ramma sin ytterkant, og knekken der veven svingar frå sete til rygg over bakkanten. Båe vert bløytte, lagde og straks bundne, og då er forma sett — finér toler slikt ned mot seks gonger tjukna, mot hundre til hundre og femti for ei kald, fri bøying. Omslaget har halve rammetjukna som radius, knekken har halve rammebreidda. Difor kan eit tjukt band ikkje omslåast, og difor krev ein rygg ei brei ramme å svinge kring.",
  })

  // --- 7 sigen botnar ikkje (hard) -------------------------------------------
  add({
    id: "sig",
    label: "sigen botnar ikkje",
    hard: true,
    ok: kr.sig <= SIG_MAX,
    value: mm1(kr.sig),
    why: `Veven ber som ein kabel: P = 4·T0·δ/L + 32·E·A·δ³/(3L³). Utan førespenn lever han berre på det kubiske leddet og søkk djupt. Over ${SIG_MAX} mm kviler den som sit på rammekanten i staden for i veven, og då er lårundersida i klem mellom to kantar. Tjukkare band, kortare spenn eller meir førespenn er dei tre utvegane.`,
  })

  // --- 8 ramma spriker ikkje (hard) ------------------------------------------
  add({
    id: "sprik",
    label: "ramma spriker ikkje",
    hard: true,
    ok: kr.sprik <= SPRIK_MAX,
    value: mm1(kr.sprik),
    why: `Banda dreg ${nn(Math.max(kr.Fren, kr.Finn) / 1000, 1)} kN innover på ramma. Ein LUKKA ring tek det som rein ringtrykk og gjev knapt etter; ein kutta ring må ta det same i bøying mellom beina, og bøyestivleiken går med rammebreidda i tredje potens. Gjev ramma etter meir enn ${SPRIK_MAX} mm, vert veven slakk, sigen aukar, og strekket aukar med han — det er ein sirkel som ikkje stengjer seg sjølv.`,
  })

  // --- 9 flettverket heng saman (hard) ---------------------------------------
  const nRen = w.warp.length
  const nInn = w.weft.length
  add({
    id: "flettverk",
    label: "flettverket heng saman",
    hard: true,
    ok: nRen >= 3 && nInn >= 3,
    value: `${nRen} × ${nInn}`,
    why: "Eit band med færre enn to kryss er ikkje fletta — det er ein laus strimmel som fell ut når nokon set seg. Slike band vert ikkje bygde, og med under tre band kvar veg finst det ikkje ein vev lenger, berre nokre spiler.",
  })

  // --- 10 ryggen krev rett bakkant (hard) ------------------------------------
  add({
    id: "ryggfeste",
    label: "bogen har rett bakkant",
    hard: true,
    ok: w.hVev < 25 || p.bakflat >= 0.55,
    value: w.hVev < 25 ? "ingen klatring" : nn(p.bakflat, 2),
    why: "Klatrar veven opp i ryggbogen, må innslaga der vera RETTE band på tvers — og eit rakt band kan ikkje leggjast langs ei kurve i sitt eige plan. Difor må bakkanten av planet rettast ut før bogen kan ta imot noko. Ein runda bakkant og ein rygg er to ting som ikkje kan stå i same møbel.",
  })

  // --- 11 festet har gods (hard) ---------------------------------------------
  const godsOk = p.feste === 1 || p.kant <= p.rammeH - 12
  add({
    id: "festegods",
    label: "gods bak festet",
    hard: true,
    ok: godsOk,
    value: `${nn(p.kant, 0)} i ${nn(p.rammeH, 0)} mm`,
    why: "Slissa er eit sagsnitt inn frå ramma si innerside og leppa ein fals i overkanten. Begge et av det same godset, og under tolv millimeter att bak festet flisar ramma seg opp langs snittet fyrste gongen nokon set seg. Omslaget et ingen ting — det legg seg utanpå.",
  })

  // --- 12 klemfare (mjuk) ----------------------------------------------------
  const luft = Math.min(w.gapRen, w.gapInn)
  add({
    id: "klemfare",
    label: "opningane i veven",
    hard: false,
    ok: !(luft >= TRAP_LO && luft < TRAP_HI),
    value: mm1(luft),
    why: `Ei opning mellom ${TRAP_LO} og ${TRAP_HI} mm tek ein finger og slepper han ikkje att. Ein vev har ikkje éi slik opning, han har ${m.list.find((q) => q.id === "opningar")?.value ?? 0} av dei, alle like store og alle med kant på fire sider. Anten skal flettet vera tett — under fem millimeter — eller ope nok til at ei hand kjem ut att.`,
  })

  // --- 13 sigen er der (mjuk) ------------------------------------------------
  add({
    id: "mjukleik",
    label: "veven er mjuk",
    hard: false,
    ok: kr.sig >= SIG_MIN,
    value: mm1(kr.sig),
    why: `Under ${SIG_MIN} mm sig kjennest veven som ei plate, og då er det ei plate ein skulle ha bruka: heile grunnen til å flette er at flata gjev etter. For stramt førespenn og for tjukke band tek den mjukleiken bort utan å gjera møbelet sterkare.`,
  })

  // --- 14 sitjeflate (mjuk) --------------------------------------------------
  const seatMin = Math.min(m.seatW, m.seatD)
  add({
    id: "sete",
    label: "sitjeflate",
    hard: false,
    ok: seatMin >= 320,
    value: mm1(seatMin),
    why: "Under 320 mm på den korte leia sit ein på ramma i staden for på veven. Talet er målt frå ytterkanten av ytterbandet kvar veg — lufta mellom banda tel med, slik ho gjer på ein benk av spiler.",
  })

  // --- 15 støtteflate (mjuk) -------------------------------------------------
  add({
    id: "stotte",
    label: "støtteflate",
    hard: false,
    ok: m.footArea >= 90000,
    value: `${nn(m.footArea / 100, 0)} cm²`,
    why: "Under 900 cm² står møbelet på for lite til at det kjennest trygt, same kva veltevinkelen seier — vinkelen måler den verste retninga, flata måler alle.",
  })

  // --- 16 masse (mjuk) -------------------------------------------------------
  add({
    id: "masse",
    label: "masse",
    hard: false,
    ok: m.mass <= 12,
    value: `${nn(m.mass, 2)} kg`,
    why: "Veven er den lettaste sitjeflata i sandkassen: eit sete på tre hundre og femti kvadratcentimeter veg under eit halvt kilo. Er møbelet tungt, er det ramma som er tung, og ei ramme over tolv kilo har slutta å vera eit feste og vorte eit fundament.",
  })

  // --- 17 plater (mjuk) ------------------------------------------------------
  add({
    id: "plater",
    label: "plater",
    hard: false,
    ok: ark <= 3,
    value: `${ark} × 2500 × 1250`,
    why: "To kuttlister: rammesegmenta i finér og banda i eit heilt anna godstal. Banda nestar godt av di dei er lange smale rektangel, men rammesegmenta er bogar, og ein boge legg beslag på eit heilt rektangel.",
  })

  // --- 18 materialet (mjuk) --------------------------------------------------
  add({
    id: "material",
    label: "materiale",
    hard: false,
    ok: p.material !== "poppel",
    value: MATERIALS[p.material as keyof typeof MATERIALS].label,
    why: "Poppelkjerne har halve E-modulen til bjørka. I ein vev slår det dobbelt: bandet søkk djupare OG ramma spriker meir, og båe verkar same veg. Bjørk og bøk er dei to som toler å verta strekte.",
  })

  return out
}
