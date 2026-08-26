# 50x50x50.iverfinne.no — SANDKASSE

Ein parametrisk sandkasse for sitjemøbel, bygd til AHO-oppgåva
**50 × 50 × 50**: eit møbel som skal stå inne i ein kube på 500 millimeter.

Sandkassen har seks typologiar, og dei er ikkje seks former. Dei er seks
svar på det same spørsmålet: **korleis byggjer ein ei krum sitjeflate av
flate plater?**

| typologi | produksjonsveg | leddet |
|---|---|---|
| **VAFFEL** | kryssholdte ribber i to rette retningar | kryssholdt |
| **SKIVE** | parallelle skiver med luft imellom, tredde på stavar | stav og skive |
| **STRAUM** | éin kropp skoren i skrå skiveplan, finnar sette i spor | gjennomspor |
| **RIBBE** | radiale blad og vassrette band | kryssholdt |
| **KOTE** | vassrette kotesnitt tredde på stavar med hylser | stav, hylse og kile |
| **KARVE** | limt blokk, frest og sliten glatt | limfuga sjølv |

BØYG (pressbøygde skal) står på stillaset og er ikkje i nedtrekket enno;
SKAL (dei stabla lamellane) er teken ut av registeret, men kjelda står att
for dokumentpipelinen.

Nedtrekket i panelet byter typologi og ikkje form. Kvar av dei har sitt
eige parameterrom, sine eigne ledd og si eiga grense — og det er grensene
som skil dei. Kvar motor held på sitt eige punkt: byter du fram og attende,
står objektet der du forlét det.

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

**Avlen** bind dei to saman: eit generativt søk (spira i panelet, eller
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
| `lib/kote/` | vassrette kotesnitt på stavar |
| `lib/karve/` | limt blokk, frest — kotelinjene er signaturen |
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

Skilnaden på dei fem motorane der og dei seks her er at desse skal kunne
byggjast. Keramikk og totem treng ikkje det; eit møbel gjer. Grunnen til at
dette er eit eige domene og ikkje ein sjette motor der, står i `PLAN.md`.
