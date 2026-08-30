# 50x50x50.iverfinne.no — SANDKASSE

Ein parametrisk sandkasse for sitjemøbel, bygd til AHO-oppgåva
**50 × 50 × 50**: eit møbel som skal stå inne i ein kube på 500 millimeter.

Sandkassen har fire typologiar, og dei er ikkje fire former. Dei er fire
svar på det same spørsmålet: **korleis byggjer ein ei krum sitjeflate av
flate plater?** Alle fire svarar på ein måte ingen av dei seier høgt: dei
SNITTAR. Og fylgja er den same i alle fire, og ho er fysisk — **du sit på
plata sin KANT**.

| typologi | produksjonsveg | leddet |
|---|---|---|
| **VAFFEL** | kryssholdte ribber i to rette retningar | kryssholdt |
| **SKIVE** | parallelle skiver med luft imellom, tredde på stavar | stav og skive |
| **STRAUM** | éin kropp skoren i skrå skiveplan, finnar sette i spor | gjennomspor |
| **RIBBE** | radiale blad og vassrette band | kryssholdt |

**VAFFEL er sluttproduktet.** STRAUM og RIBBE står som argumentet kring
valet, og RIBBE er den næraste naboen: same leddet, radialt i staden for
kartesisk. Det er dei to som ber formspennet: VAFFEL kan no reise ein
rygg som fell bakover og ein skålkant som stig kring heile setet, RIBBE
kan la bladtuppen stikke fram forbi skalet og gjera bandet så breitt at
det vert ei hylle. Åtte av ni referansekrakkar let seg nå ved å skru.
Den niande er ei vogge, og ho står att av di ho ikkje manglar ein akse —
ho stiller eit anna spørsmål. Alt saman står i `PLAN.md`, etappe 28,
saman med det runda faktisk lærte: **det er kuben som seier nei til
ryggen, ikkje motoren.**

SKIVE var ute ei runde og er ATTE. Argumentet mot han var at han berre
snittar éin veg; det var feil. Ei skive treng ikkje møte nokon på tvers,
og då er heile konturen hennar fri — det er ein annan ting enn to
retningar, ikkje ein fattigare versjon av dei.

Tekne heilt ut, og kvar sin grunn: FLETT (vevne band — band er ikkje
plate), KARVE (limt blokk, frest ned — subtraksjon byggjer ikkje ei
flate, han grev henne fram), KOTE (vassrette koter på stavar, som aldri
nådde flata: setet var riller) og LAFT (to kryssande blad og eit flatt
sete — han NEKTA spørsmålet). BØYG (pressbøygde skal) og
VIKING (overlappande bord klinka til to spant) står på stillaset og er
ikkje i nedtrekket; SKAL (dei stabla lamellane) er teken ut av
registeret, men kjelda står att for dokumentpipelinen.

Reiskapen er bygd for å lage ÉIN krakk som passar brukaren sin: still
høgd, plan og sete etter kroppen (posane, hovuddraga, gestane), sjå kva
lasta gjer med objektet — lesemåten **last** målar utnyttinga under
NS-EN 1728-lasta på sjølve flata, med same modell og same skala som
tavla — og få ut ei kuttliste som kastar minst mogleg av plata.

Nedtrekket i panelet byter typologi og ikkje form. Kvar av dei har sitt
eige parameterrom, sine eigne ledd og si eiga grense — og det er grensene
som skil dei. Kvar motor held på sitt eige punkt: byter du fram og attende,
står objektet der du forlét det.

## Inngangane

Eit parameterrom med 26 til 38 band er ikkje eit grensesnitt — det er eit
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
| `lib/vaffel/` | kartesiske ribber i to retningar — sluttproduktet |
| `lib/skive/` | parallelle skiver på stavar |
| `lib/gjest/` | ei GLB utanfrå, snitta til dei same ribbene: GLB-lesar, plansnitt, vev |
| `lib/straum/` | skrå skiveplan og finnar i spor |
| `lib/ribbe/` | radiale blad og band, kryssholdte |
| `lib/boyg/` | pressbøygde skal, under bygging |
| `lib/viking/` | overlappande bord på to spant, under bygging |
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
