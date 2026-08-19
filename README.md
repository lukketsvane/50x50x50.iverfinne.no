# 50x50x50.iverfinne.no — SANDKASSE

Ein parametrisk sandkasse for eit sitjemøbel i stabla bjørkefinér, bygd
til AHO-oppgåva **50 × 50 × 50**: eit møbel som skal stå inne i ein kube
på 500 millimeter.

Objektet er ei samanhengande flate. Ho startar som bein på golvet, veks
saman i midja, opnar seg til eit sete og reiser seg til ein låg rygg bak.
Det er ingen ledd, ingen skruar, ingen delar som møtest — berre ei flate
som skiftar kva ho gjer. Flata er ei likning: eit snitt som vandrar langs
ein ryggrad, roterer på vegen opp og skiftar akseforhold undervegs. Kvar
det skal vera hòl, og kvar kanten skal liggja, er eit felt over vinkel og
høgd.

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
| **flate** | den ferdige, slipte flata — objektet slik det står |
| **lag** | stabelen slik han kjem ut av fresen, med slipemon på ytterkanten |
| **kontur** | konturkartet — alle laga lagde oppå kvarandre, samstundes plan og kuttdata |

## Reglane

Det som skil ein reiskap frå ein demonstrasjon, er om han seier nei.
Sandkassen teiknar kva som helst, men han seier frå og han seier kvifor:
kuben, setehøgda, veltevinkelen, talet på bein, utnyttinga, eggkanten,
den brukbare skåla, opplegg for rimet, godset i den smalaste delen,
lagtalet, ryggen og klemfaren mellom delane. Harde reglar tyder at
objektet bryt oppgåva eller ikkje kan byggjast; mjuke er val som skal stå
på papiret i staden for i hovudet.

## Kva som ligg kvar

| fil | kva |
|---|---|
| `lib/skal/params.ts` | parameterrommet — band, standardar, klemming av URL-ar, terningen |
| `lib/skal/field.ts` | **start her.** Snitt, ryggrad, vriding, midje, opningsfelt, rim, sete, kubekontroll |
| `lib/skal/surface.ts` | flata som mesh, klipt mot feltet rute for rute |
| `lib/skal/laminae.ts` | dei flate laga: vassrette snitt gjennom godset, med slipemon |
| `lib/skal/stack-mesh.ts` | stabelen som mesh, og konturkartet i tre dimensjonar |
| `lib/skal/metrics.ts` | alt som vert målt: omhylling, fotavtrykk, velting, spenning, masse |
| `lib/skal/rules.ts` | reglane som seier nei |
| `lib/skal/nest.ts` | delane lagde ut på finérplate |
| `lib/skal/export-*.ts` | STL, DXF med lag KUTT og GRAVER, SVG |
| `lib/skal/variants.ts` | tolv snitt gjennom rommet, med grunngjeving og motargument |
| `lib/skal/worker.ts` | motoren i eigen tråd |
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
[parametric.iverfinne.no](https://parametric.iverfinne.no) — same
lysrigg, same tre-fingers lysstyring, same prinsipp om at eit design er
eit punkt i eit parameterrom og at hashen kodar det punktet nøyaktig.
Geometrien deler dei ingenting av. Grunnen til at dette er eit eige
domene og ikkje ein sjette motor der, står i `PLAN.md`.
