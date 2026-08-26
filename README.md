# 50x50x50.iverfinne.no — SANDKASSE

Ein parametrisk sandkasse for sitjemøbel, bygd til AHO-oppgåva
**50 × 50 × 50**: eit møbel som skal stå inne i ein kube på 500 millimeter.

Sandkassen har fire typologiar, og dei er ikkje fire former. Dei er fire
svar på det same spørsmålet: **korleis byggjer ein ei krum sitjeflate av
flate plater?**

| typologi | produksjonsveg | leddet |
|---|---|---|
| **VAFFEL** | kryssholdte ribber i to rette retningar | kryssholdt |
| **SKIVE** | parallelle skiver med luft imellom, tredde på stavar | stav og skive |
| **STRAUM** | éin kropp skoren i skrå skiveplan, finnar sette i spor | gjennomspor |
| **RIBBE** | radiale blad og vassrette band | kryssholdt |

Fire er talet av di kvart svar må svare på SPØRSMÅLET. FLETT (vevne band)
og KARVE (limt blokk, frest ned) svara på andre spørsmål — band er ikkje
plate, og subtraksjon byggjer ikkje ei flate, han grev henne fram. KOTE
(vassrette koter på stavar) nådde aldri flata: setet var riller. Alle tre
er tekne heilt ut. BØYG (pressbøygde skal) står på stillaset og er ikkje i
nedtrekket enno; SKAL (dei stabla lamellane) er teken ut av registeret,
men kjelda står att for dokumentpipelinen.

Nedtrekket i panelet byter typologi og ikkje form. Kvar av dei har sitt
eige parameterrom, sine eigne ledd og si eiga grense — og det er grensene
som skil dei. Kvar motor held på sitt eige punkt: byter du fram og attende,
står objektet der du forlét det.

## Inngangane

Eit parameterrom med 21 til 45 band er ikkje eit grensesnitt — det er eit
arkiv. Panelet har difor tre nivå, og skyvarveggen er det siste av dei:

**Posane.** Kvar motor ber ei lita liste namngjevne punkt — handdesigna
utgangspunkt som terningen alltid har jittra kring. No står dei som chips
øvst i panelet, med «standard» fyrst: eit trykk er eit hopp til nøyaktig
det punktet. Posane er ikkje ein presetmeny av ferdige svar; dei er
inngangar i rommet, og alt dei peikar på kan skruast vidare.

**Hovuddraga.** Tre til seks kontrollar per motor som styrer det som
verkeleg formar: høgd, plan, midje, sete, delingsgrad. Eit drag kan flytte
fleire band saman — BOGE i vaffel flytter høgda og begge breiddene på
kvelvinga i eitt tak — men det opnar aldri eit nytt: alt eit drag gjer,
kan gjerast med skyvarane bak, og veggen ser alt draget gjorde.

**Alt.** Måltavla og heile skyvarveggen står bak ein knapp som seier kva
han er. Finstilling, ikkje fyrsteinntrykk.

På lerretet skrur to fingrar dei to banda som formar mest (per motor), og
klypa skrur storleiken: sprikande fingrar gjer møbelet breiare. Klypa
zoomar ikkje — alt bur i same 500-kuben og innramminga er automatisk, so
gesten er ledig for det ho tyder. Ein chip syner kva som vert skrudd og
talet det står i, medan gesten går. Terningen ber begge dei generative
flytane: eitt trykk kastar, dobbelttrykk avlar — og båe respekterer
låste skruar.

## Dei to aksane

Prosjektet spissar seg mot konseptpresentasjonen, og konseptet er ei
avfallsrekning med to aksar som begge står i måltavla:

**Plateutnytting** — avfallet på arket. Kvar motor nestar delane sine på
standardplater og melder tre tal: plater teke i bruk, plate medgått (breidda
gonger den brukte lengda — stripa som faktisk går gjennom maskina) og
plateutnyttinga: netto delareal delt på medgått plateareal. Hòl i ein del er
avfall, ikkje del. Målet er å bruke mest mogleg av flatearealet av platene
som vert fresa og laserkutta, og ei mjuk regel per motor seier frå når eit
val kastar meir av arket enn typologien treng.

**Styrke per materiale** — avfallet i objektet. Utnyttinga under lasta frå
NS-EN 1728 seier kor hardt materialet faktisk arbeider; materiale som ikkje
ber, er avfall som står att i møbelet.

**Avlen** bind dei to saman: eit generativt søk (dobbelttrykk på terningen, eller
`scripts/avl.ts`) som startar i punktet som står, held alle dei harde
reglane, og minimerer eitt tal — *plata gjennom maskina*, delane pluss
avfallet kring dei, i kubikkdesimeter. Talet fell når delane vert færre,
tynnare eller mindre, OG når dei pakkar betre på arket. Tåle mest mogleg,
bruke minst mogleg. Låste skruar står, som med terningen, og søket er frøa:
same frø gjev same svar.

## Kvifor dette finst

Førre versjonen av prosjektet hadde to ting som ikkje var det same: ein
modell i Python som kunne rekne, og ein reiskap i nettlesaren som kunne
skruast på. Reiskapen kjende ikkje ryggrad, kutt eller opningar. Han var
eit steg bak modellen — og det var reiskapen ein sat med.

Sandkassen lukkar det gapet. Feltet, flata, laga, målinga, reglane,
kuttarket og PDF-mappa les alle frå den same koden. Eit tal på arket er
ikkje ei avskrift av eit tal i modellen; det er det talet.

## Dei tre lesemåtane

Same objekt, tre visingar, same likning:

| | |
|---|---|
| **flate** | flata objektet nærmar seg, ferdig |
| **lag** | delane slik dei faktisk er — montert, med ledd og spor synlege |
| **kontur** | dei flate kuttprofilane, sedde ovanfrå |

## Reglane

Det som skil ein reiskap frå ein demonstrasjon, er om han seier nei.
Sandkassen teiknar kva som helst, men han seier frå og han seier kvifor.
Harde reglar tyder at objektet bryt oppgåva eller ikkje kan byggjast;
mjuke er val som skal stå på papiret i staden for i hovudet.

Reglane er eit golv, ikkje ein dom. Å halde alle gjer ikkje eit objekt
godt — det gjer det berre mogleg.

## Kva som ligg kvar

| fil | kva |
|---|---|
| `lib/core.ts` | **start her.** Kontrakten alle motorane deler: parameterband, måltal, reglar, lesemåtar, og geometrien alle treng |
| `lib/engines.ts` | registeret. Ein ny typologi kostar ei mappe og ei line |
| `lib/worker.ts` | motoren i eigen tråd; han veit ikkje kva typologi han byggjer |
| `lib/avl.ts` | avlen: generativt søk mot mindre materiale, bak same kontrakt |
| `lib/vaffel/` | kartesiske ribber i to retningar |
| `lib/skive/` | parallelle skiver på stavar |
| `lib/straum/` | skrå skiveplan og finnar i spor |
| `lib/ribbe/` | radiale blad og band, kryssholdte |
| `lib/boyg/` | pressbøygde skal, under bygging |
| `lib/skal/` | vassrette lamellar; ute av registeret, står for dokumentpipelinen |
| `components/` | scena, gestane, panelet — alle engangsfrie: dei kjenner berre kontrakten |
| `doc/` | PDF-mappa: eigen rasterisator, sats og sider |
| `PLAN.md` | planen for korleis denne webben skal byggjast ut |

## Køyre

```bash
pnpm install
pnpm dev
```

## Mappa

```bash
npx tsx scripts/dump-doc.ts    # data ut av motoren -> doc/data/
python3 doc/render.py          # arka og PDF-en    -> doc/out/sandkasse.pdf
```

Krev `numpy`, `matplotlib` og `pillow`. Rendringa går utan GPU: eigen
rasterisator med z-buffer, skuggekart og omgjevingsokklusjon.

## Kva som er lånt

Scena, gestane og den delbare URL-en kjem frå
[parametric.iverfinne.no](https://parametric.iverfinne.no) — same lysrigg,
same tre-fingers lysstyring, same nedtrekk for motor, og same prinsipp om
at eit design er eit punkt i eit parameterrom og at hashen kodar punktet
nøyaktig. Geometrien deler dei ingenting av.

Skilnaden på dei fem motorane der og dei fire her er at desse skal kunne
byggjast. Keramikk og totem treng ikkje det; eit møbel gjer. Grunnen til at
dette er eit eige domene og ikkje ein sjette motor der, står i `PLAN.md`.
