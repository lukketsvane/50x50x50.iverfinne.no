# PLAN

Arbeidsdokument for utbygginga av sandkassen. Skrive for éin person med
ein innleveringsdato. Alle tal i dokumentet er målte på denne maskina med
skripta i `scripts/`, og kvar tabell seier kva skript talet kjem frå.

---

## 1 Tesen

I SKAL-mappa står det, som punkt seks på lista over kva som står att:

> `ribbe.html` kjenner ikkje ryggrad, kutt eller opningar. Han er eit steg
> bak modellen.

Det er heile grunnen til at sandkassen finst. Reiskapen og modellen skal
ikkje vera to program som liknar på kvarandre — dei skal vera same kode.
Eit tal på arket skal ikkje vera ei avskrift av eit tal i modellen; det
skal vera det talet.

Den delen er gjord. `lib/skal/` er éin motor, og både nettsida og
PDF-mappa les frå han: `worker.ts` og `scripts/dump-doc.ts` kallar dei
same funksjonane med dei same parametrane. Gapet mellom reiskap og modell
er lukka.

Men gapet har flytta seg, og målinga seier kvar. Ei full runde i
arbeidaren tek **2 315 ms** på mellomste detaljnivå. Det er ikkje ein
sandkasse. Ein sandkasse er noko ein grev i; to og eit halvt sekund per
skyvarrørsle er eit skjema med ei førehandsvising, og då er ein tilbake
til å tenkje ferdig før ein skrur — som er nett den vanen generatoren
skulle avskaffe.

Så: **tesen er framleis at reiskapen og modellen er same kode. Planen
handlar om å gjera den koden rask nok til at han kan brukast som ein
reiskap, og ærleg nok til at det han seier kan stolast på.**

---

## 2 Kva som står i dag

Sandkassen er ikkje éin generator lenger. Han er eit register med fire, og
skalet veit ingenting om kva som ligg under nedtrekket.

| lag | fil | status |
|---|---|---|
| kontrakt | `lib/core.ts` | `EngineDef`: parameterrom, tre lesemåtar, måltavle, reglar, fire eksportformat. Pluss geometrien alle fire treng: hylster, superellipse, meshvolum, kapasitetar |
| register | `lib/engines.ts` | fire motorar, nedtrekk, per-motor tilstand |
| tråd | `lib/worker.ts` | motoruavhengig; rutar på `req.engine` |
| grensesnitt | `studio.tsx`, `viewer.tsx`, `controls-panel.tsx` | skriven éin gong, tener alle fire |
| prøve | `scripts/typologies.ts` | kontraktprøva: nøklar, terning, lukka nett, NaN, kuben, reglar, tid |
| mappe | `doc/render.py` | 16 sider, eigen rasterisator utan GPU |

Og dei fire motorane, med tala frå `scripts/typologies.ts`:

| motor | produksjonsveg | skyvarar | reglar (harde) | masse | utnytting | bygg + mål |
|---|---|---|---|---|---|---|
| `skal` | vassrette lamellar, stabla og slipte ned til éi flate | 45 | 14 (4) | 3,82 kg | 5 % | 1526 ms |
| `straum` | éin kropp skoren i skrå skiveplan, finnar sette i spor | 30 | 17 (5) | 5,05 kg | 8 % | 350 ms |
| `ribbe` | radiale blad og vassrette band, kryssholdte i kvarandre | 33 | 16 (9) | 10,24 kg | 15 % | 100 ms |
| `vaffel` | kryssholdte ribber i to retningar, utan lim og utan skruar | 21 | 16 (8) | 5,56 kg | 18 % | 585 ms |

Alle fire held alle reglane sine på standardobjektet. Ingen av dei held
alle reglane på eit tilfeldig trekk — sjå etappe 7.

**Det som er verdt å lese ut av tabellen:** SKAL er femten gonger tregare
enn RIBBE. Det er ikkje ei slurv i SKAL — det er at eit felt som må
marsjerast kostar meir enn ei flate som let seg skrive ned. Etappe 2 og 3
handlar om den skilnaden.

## 3 Arkitektur

### 3.1 Kva som er ein rein funksjon av `Params`

Heile motoren er eit lag på lag av reine funksjonar, og rekkjefylgja er
ikkje tilfeldig:

| nivå | verdi | av kva | kostnad |
|---|---|---|---|
| 0 | `Params` | — den einaste tilstanden | 45 tal |
| 1 | `Shell` | `makeShell(p)` | 16 ms |
| 2 | `MeshData`, `Stack` | `(p, Shell)` | 244–1 087 ms / 583 ms |
| 3 | `Metrics`, `Rule[]` | geometrien, ikkje parametrane | 142 ms eige arbeid |
| 4 | `Nesting`, STL, DXF, SVG | `Stack` eller `MeshData` | 9–389 ms |

Regelen er at eit nivå aldri reknar noko om att frå nivået under. Han er
broten akkurat éin stad i dag, og det er den dyraste feilen i heile
prosjektet: `measure(p)` byggjer sjølv både skal, lav-mesh og stabel om
att. Av dei 1 024 millisekunda målinga tek, er **882 arbeid arbeidaren
alt har gjort** — 86 prosent. Sjå etappe 1.

Nivå 3 er den viktigaste grensa. Eit måltal skal aldri reknast av
parametrane, av di parameteren seier kva ein bad om og målet seier kva ein
fekk: `p.seatZ` og setehøgda på det objektet som faktisk står der treng
ikkje vera same tal, sidan skalet vert skalert inn i kuben etter at ein
har skrudd. Den regelen står i `metrics.ts` og skal stå.

**Sømen.** Berre `field.ts` veit kva objektet *er*. Alt nedanfor les
`Shell`-grensesnittet — 18 medlemer — og bryr seg ikkje om kvar tala kjem
frå. Det er den einaste eigenskapen i heile arkitekturen som gjer eit brot
billeg, og han skal haldast med vilje. Meir om kva han ikkje dekkjer i
bolk 4.

**Kva som ikkje er ein funksjon av `Params`:** kamera, lys, lesemåte,
detaljnivå, frøtekst, låser, om arket er ope. Det er øktstilstand. Det er
ikkje objektet.

### 3.2 Kva som høyrer heime i ein worker

Regelen er hard: **hovudtråden teiknar, og gjer ikkje anna.** Alt som rører
`Shell` ligg i `worker.ts`.

Han gjer i dag éi ting for mykje og éi ting for lite.

For mykje: han svarar med alt på ein gong. Tabellen ventar på eit mesh han
ikkje les. Målinga sitt eige arbeid er 142 ms; eit lav-mesh er 244 ms og
eit hog-mesh 1 087 ms. Svaret skal delast i to meldingar — `tal` fyrst,
`mesh` etter — slik at tala står på skjermen medan flata framleis vert
bygd.

For lite: ei bygging som er i gang kan ikkje avbrytast. Drar ein ein
skyvar i to sekund, står det ei ferdig, forelda bygging i kø for kvar 90
ms. Hovudtråden kastar dei rett nok — `shown.current` passar på at eit
gammalt svar aldri overskriv eit nyare — men arbeidaren har alt brukt
tida. Han treng ein generasjonsteljar han sjekkar mellom fasane, slik at
ei bygging som er forelda døyr der ho står.

**Éin arbeidar, ikkje fleire.** Ein arbeidar til ville måtte byggje skalet
sitt eige, og då reknar to trådar det same. Vinsten ligg i å dele svaret,
ikkje i å dele tråden.

**Eksporten skal bli i same arbeidar.** Det ein lastar ned må vera nøyaktig
det objektet som står på skjermen. Ein eigen eksporttråd som byggjer om att
frå `Params` ville gje same svar i dag og eit anna svar den dagen nokon
endrar ein konstant i berre den eine.

### 3.3 Kva som er delbar tilstand i URL-en

Hashen kodar objektet, og berre objektet: 45 tal, materialet og
lesemåten. Ikkje kamera, ikkje lys, ikkje frø, ikkje låser. Ei delt lenkje
skal seia kva objekt, ikkje kva humør sjåaren var i — og to som har dratt
kameraet kvar sin veg skal ikkje tru dei ser på to ulike krakkar.

Hashen er ikkje til å stole på. `clampParams` les kvart felt for seg,
klemmer det inn i sitt eige band og fell tilbake på det som stod frå før
når noko ikkje er eit tal. Den vegen skal all avkoding gå — òg den nye,
korte. Ein avkodar som skriv rett inn i `Params` ville vera den eine staden
ei laga lenkje kunne skyve eit tal utanfor bandet sitt.

I dag er hashen JSON: **1 034 teikn** for standardobjektet, **1 186 på det
verste** over 200 tilfeldige punkt. Det er for langt til ein QR-kode og
blir linedelt i e-post.

Informasjonen i eit punkt er **314,5 bit**, rekna som summen av `log2` av
talet på trinn i kvart band. Kvantisert til sitt eige steg og pakka i fast
rekkjefylgje blir det **40 byte = 56 teikn base64url**, altså 17,5 gonger
kortare. Under den grensa kjem ein ikkje utan å kaste bort trinn.

Den gamle `#p=`-forma skal aksepterast for alltid. Ho står i lenkjer som er
sende ut, og ei lenkje som sluttar å verke er ei lenkje som aldri burde
vore delt.

### 3.4 Eksport og doc-pipelina

Kjeda er:

```
Params → worker.ts   → STL / DXF / SVG        (i nettlesaren, éin knapp)
Params → dump-doc.ts → doc/data/*.f32 + doc.json  (20 s, 67 MB)
         render.py   → doc/out/sandkasse.pdf      (385 s, 15 sider, 1,45 MB)
```

Begge greinene kallar `buildMesh`, `buildStack`, `measure`, `checkRules`
og `nest`. Det er koplinga, og ho held.

Tre ting manglar.

**Alle platene.** Nettsida eksporterer `sheetSvg(n, 0)` — plate éin.
Standardobjektet går på éi plate, så feilen syner ikkje; eit objekt som
treng to, vert eksportert halvt.

**Éin kommando.** Mappa er to steg i dag, og ingen ting hindrar at det vert
bygd ein PDF av eit objekt som bryt ein hard regel. Det skal vera
`npm run mappe`, og han skal nekte på hardt brot. Ein PDF av eit ulovleg
objekt er verre enn ingen PDF: han ser like ferdig ut.

**Stempelet.** Mappa skal bera lenkja som reproduserer objektet ho
skildrar. Det er den korte hashen sin fyrste verkelege jobb.

PDF-en er eit byggjeprodukt, ikkje ei fil ein redigerer. `doc/data/` og
`doc/out/` står i `.gitignore` og skal bli der.

### 3.5 Grensa mot parametric.iverfinne.no

**Kva vi lånar** — ved å kopiere, ikkje ved å avhenge:

| kva | kvifor det er verdt å låne |
|---|---|
| lysriggen i `viewer.tsx` | éin styrbar hovudlampe og to faste, svake; ingen omgjevingslys, ingen omgjevingskart. Éin hard skugge er det som let ein lesa ei krum flate |
| `frameloop="demand"` | scena teiknar når noko endrar seg, ikkje 60 gonger i sekundet |
| fast orbitmål | golvet flyttar seg aldri; auto-innramminga går berre lenger bak |
| gestane i `gesture-params.tsx` | to fingrar skrur ein parameter, tre styrer lyset og legg kameraet tilbake |
| arket og utvidaren i panelet | draget og klikket deler same knapp |
| prinsippet om hashen | eit design er eit punkt, hashen kodar punktet nøyaktig, og hashen er ikkje til å stole på |

**Kva vi ikkje lånar:** geometri — ikkje ei line. Koden i registeret deira.
Engelsken.

**Kva vi lånte likevel, og som endra planen:** *ideen* om eit register.
Fyrste utkastet av dette dokumentet argumenterte for at sandkassen skulle
ha éin generator og ingen motormeny. Det var feil, og det var feil av ein
grunn som er verdt å skrive ned: eg tenkte at motoren var forma. Han er
ikkje det — han er produksjonsvegen. Fire vegar til den same krumme flata
er fire motorar, og då er nedtrekket ikkje pynt lånt frå naboen, det er
tesen sjølv sett på skjermen.

**Kvifor dette er eit eige domene og ikkje ein sjette motor:**

1. **Kontrakten.** Dei fem motorane der oppfyller éin kontrakt:
   `Params → mesh`. Vår er `Params → mesh + stabel + kring 34 måltal + 14
   til 17 reglar + nesting + fire eksportformat + ei PDF-mappe`. Ein sjette
   motor der borte måtte anten sprengje registeret deira eller tvinge dei
   fem andre til å bera felt dei ikkje har bruk for. Difor har vi vårt
   eige register med vår eigen, tyngre kontrakt — og fire motorar i han.
2. **Einingar og ei oppgåve.** Dei fem er dimensjonslaus skulptur; det
   einaste verkelege målet der borte er eit lyshaldarhòl. Her er kvart tal
   i millimeter og svarar til ein kube på 500 mm, til NS-EN 1728, 1022 og
   1995-1-1, og til ein innleveringsdato.
3. **Terningen.** Der er kvart punkt i rommet eit gyldig objekt, og
   terningen kan trygt streife heile rommet. Her held **30 %** av uniforme
   trekk dei harde reglane og **0 %** held alle fjorten. Ein motor der
   terningen stort sett gjev noko ulovleg høyrer ikkje heime i eit galleri
   som byggjer på at terningen er trygg.
4. **Vekta.** Dei fem deler éin bunt, og three.js er alt 921 kB der. Ein
   motor som drar med seg laminering, måling, reglar, nesting og tre
   eksportørar ville la eit galleri betale for ein krakk.
5. **Levetida.** parametric er eit galleri som held fram med å vekse.
   Sandkassen har ein innleveringsdato, og etter han er han eit vitnemål om
   kva som vart gjort. Eit vitnemål skal ikkje kunne endre seg av di nokon
   skreiv om eit felles skal.
6. **Språket.** Reiskapen er på nynorsk av di mappa er det, og av di orda
   er ein del av argumentet.

**Kostnaden, ærleg sagt:** to kopiar av scene, gestar og panel. Ei
retting det eine staden når ikkje den andre. Det er valt, og då må det
òg stå kva ein gjer med det: scena vert kopiert over med vilje éin gong
til før innlevering, og aldri etterpå.

---

## 4 Kva metoden ikkje løyser

Forfattaren skreiv det sjølv, i to mapper på rad:

> Ein generator gjer det billeg å lage variasjon og dyrt å lage brot. SKAL
> kom ikkje av å skru ein skyvar lenger enn FLUX — det kom av å byte
> produksjonsveg, og det kosta tre nye modular. Kvar gong objektet tok eit
> verkeleg steg, var det fordi noko utanfor likninga endra seg.

Det er ikkje eit problem sandkassen kan skru seg ut av, og planen skal
ikkje late som han kan. Fleire skyvarar er ikkje svaret. Fleire skyvarar er
det motsette av svaret.

**Kva ein gjer i staden.**

*Gjer brotet billegare, ikkje variasjonen breiare.* Det einaste tiltaket
som verkeleg svarar på kritikken er sømen i 3.1: berre `field.ts` veit kva
objektet er, og 18 medlemer i `Shell` er alt resten treng. Ein ny
produksjonsveg tyder å skrive éin ny modul som fyller det grensesnittet —
ikkje å skrive prosjektet om att. Det er kostnaden ved eit brot, målt i
filer, og han skal ned og ikkje opp.

Og med det same: **sømen held ikkje overalt.** `laminae.ts` går ut frå at
objektet kan skjerast i vassrette lag av éi platetjukn, og `metrics.ts` går
ut frå at det minste tverrsnittet er ein ring. Ein ribbegenerator ville
trenge si eiga lagdeling og si eiga tverrsnittsmåling. `Shell` er ein søm
for alt som er eit skal; han er ingen søm for det som ikkje er det. Det er
verdt å vite før ein trur brotet er gratis.

*Frys parametertalet.* 45 er alt fleire enn éin person held i hovudet, og
kvar ny skyvar gjer rommet større og den brukbare delen mindre — 30 % i
dag. Regelen frå no: **ein ny parameter må anten erstatte ein annan, eller
opne ein klasse objekt rommet ikkje kan nå i det heile.** Å utvide eit band
er ikkje ein ny klasse.

*Hald variantane utanfor grensesnittet.* Dei tolv i `variants.ts` er ikkje
ein meny. Kvar av dei har ei grunngjeving og eit motargument, og dei høyrer
heime i mappa som argument. Ein presetmeny ville gjera argumentet om til
eit val, og då slepp ingen å forsvare noko.

*Sei kva reiskapen ikkje kan sjå.* Slipinga er 14 av 25 timar og ingen
parameter rører henne. Sandkassen kan seia at objektet er lovleg. Han kan
ikkje seia at det er verdt 25 timar, og han kan ikkje seia at det er bra.
Reglane er eit golv, ikkje ein dom: å halde alle fjorten gjer ikkje eit
objekt godt, det gjer det berre mogleg.

---

## 5 Etappar

Rekkjefylgja er den ein ville teke dei i. Dei fyrste fire er fart, av di alt
anna er ubehageleg å arbeide med når kvar endring kostar 2,3 sekund.

### A · Fire typologiar bak éin kontrakt — GJORD

**Kvifor.** Sandkassen viste éi form, og det gjorde tesen usynleg. Poenget
er ikkje at DENNE krakken er parametrisk — det er at spørsmålet «korleis
byggjer ein ei krum sitjeflate av flate plater?» har fleire svar, og at
kvart svar er eit eige rom med si eiga grense. Éin motor er ein
demonstrasjon. Fire er eit argument.

**Kva som vart gjort.** `lib/core.ts` fekk kontrakten — `EngineDef` — og
`lib/engines.ts` registeret. Skalet vart skrive om til å ta motoren som
tilstand: eige parameterrom, eigne låsar og eige punkt per motor, slik at
ein byter typologi utan å miste objektet ein forlét. Terningen kryssar
aldri motorgrensa, av di eit tal i eitt parameterrom ikkje tyder noko i
eit anna.

Tre nye motorar vart skrivne mot den kontrakten. Det er `scripts/typologies.ts`
som avgjer om dei held han: nøklane, terningen, det lukka nettet, NaN,
kuben, sitjehøgda, reglane, tida og alle fire eksportformata.

**Tre feil prøva fann, og som ingen ville sett på skjermen:**

1. **Halve VAFFEL hadde negativt volum.** Y-familien legg profilen i
   (x, z) og X-familien i (y, z). Dei to plana er spegelvende — `y × z`
   peikar langs `+x`, men `x × z` peikar langs `−y` — så same vindinga gjev
   utoverpeikande trekantar i det eine og innoverpeikande i det andre.
   Kvar ribbe var lukka og rett for seg; summen var 0,86 dm³ i staden for
   28,08. Massen i tabellen var skilnaden mellom dei to helvtene.

2. **Spora i VAFFEL var hòl og ikkje spor.** Munnen på eit spor vart dregen
   fem millimeter forbi kanten. Men kanten er krum, så i kvar side av
   sporet stod det gods att og lukka han. Ei ribbe med ni slike er ikkje
   noko ein kan setje saman — ho er ei plate med ni avlange hòl.

3. **STRAUM hadde tjuetre klemfeller.** Opninga mellom finnane var 8,8 mm,
   midt i bandet frå 5 til 25 der ein finger kjem inn og ikkje ut, og med
   tjuetre finnar er ho der tjueto gonger. Standarden er no tolv finnar og
   ein vegg på 34 mm.

**Og éin ting som ikkje var ein feil, men eit feil val:** VAFFEL hadde
fyrst ei kvelving per ribbe. Då byrjar X- og Y-ribba i ulik høgd der dei
kryssar, og det eine sporet må gå heilt ut til underkanten på ribba — 335
mm i ei ribbe på 430. Kvelvinga høyrer til KROPPEN. Med éi felles kvelving
er over- og underkanten den same i kvart kryss, og begge spora vert
nøyaktig halve overlappet. Talet på ledd gjekk frå 24 til 77 utan at ei
einaste ribbe vart delt.

| | før | no |
|---|---|---|
| motorar | 1 | 4 |
| typologiar som held alle reglane sine | 1 | 4 |
| kode skalet må vite om ein motor | alt | `EngineDef` |
| VAFFEL, gyldige objekt frå terningen | — | 20 % harde |
| STRAUM, gyldige objekt frå terningen | 35 % | 98 % |

### 0 · Rydd opp i kva objekt sandkassen faktisk viser — GJORD

**Kvifor.** SKAL-mappa skildrar 33 lag, 50 delar, 3,9 kg og
460 × 472 × 488 mm. Fyrste versjonen av denne motoren gav 32 lag, 61 delar,
3,38 kg og 488,5 × 415,2 × 480,0 mm gjennom `DEFAULT_PARAMS`. Det er ikkje ein
feil i seg sjølv — den gamle mappa vart rekna av den gamle Python-modellen —
men så lenge det ikkje stod nokon stad kva som gjaldt, skildra dei to
dokumenta to ulike krakkar.

**Kva som vart gjort.** Standardpunktet er retta, og grunnen var ikkje
kosmetikk. Ein gjennomgang synte at måltalet «setehøgd» var parameteren
send rett gjennom: `fitToCube` skalerer berre planet, så setekanten ligg
nøyaktig der ein sette han. Men det er ikkje der ein sit. Sitjeflata ligg
nede i skåla, og på ei skål på 40 mm er skilnaden 25 millimeter. Motoren
måler no båe, regelen les den nedste, og standardpunktet er flytt slik at
sitjehøgda — ikkje setekanten — landar i bandet frå NS-EN 1729.

| | før | no |
|---|---|---|
| setekant | 380 mm | 405 mm |
| sitjehøgd | 353 mm — utanfor bandet | 380 mm |
| ytre mål | 488,5 × 415,2 × 480,0 | 486,0 × 409,5 × 495,0 |
| lag / delar | 32 / 61 | 33 / 61 |
| masse ferdig | 3,38 kg | 3,82 kg |
| veltevinkel | 21,7° | 19,3° |

Tala frå denne motoren er dei som gjeld. SKAL-mappa er eit vitnemål om eit
steg, ikkje ei kjelde til tal.

### 1 · Slutt å byggje objektet tre gonger — GJORD

**Kvifor.** `measure(p)` bygde skal, lav-mesh og stabel om att. 882 av
1 024 ms var arbeid arbeidaren alt hadde gjort. `checkRules` byggjer skalet
ein fjerde gong; den står att.

**Kva.** `measure(p, pre)` tek imot `{ shell, mesh, stack }`. Arbeidaren
sender inn det han alt har, og byggjer no skalmeshet uansett lesemåte —
elles ville eit måltal skifte når ein gjekk frå «flate» til «lag», og då er
tabellen ikkje lenger den same tabellen.

**Målt etterpå** (`scripts/bench.ts`, same maskin):

| | før | etter |
|---|---|---|
| `measure` | 997 ms | 118 ms |
| full runde, mid | 2 315 ms | 1 352 ms |

**Kva som står att her.** `buildStack` er no det dyraste steget åleine
(615 ms av 1 352). Det er etappe 3. Og `checkRules` byggjer framleis sitt
eige skal — 80 ms, verd ei line når nokon er i fila likevel.

### 2 · Nett fyrst, tal etterpå — GJORD

**Kva det vart, mot planen.** Planen sa «tal fyrst» av di talrekninga var
billeg etter etappe 1. Motorregisteret snudde reknestykket: kontrakten gav
kvar motor sjølvstendige `build`/`measure`/`rules`, og dermed reiste kvart
kall den same kroppen frå botnen att — SKAL-runda voks til 1 750 ms per
skyvartrykk. Løysinga vart tredelt, og ho snudde òg rekkjefylgja: nettet
er det ein ser under eit drag, so nettet går fyrst.

1. **Hugs i konstruktørane** (`keep` i `lib/core.ts`): skal (skalet,
   stabelen), straum (kroppen, delane), ribbe (skalet, bygget), vaffel
   (kroppen, rutenettet) hugsar dei siste punkta sine. Bygg, mål og reglar
   for same punkt les no same objekt. Berre mellombygg vert hugsa — aldri
   eit nett som går gjennom postMessage, for overføringa koplar frå
   bufferane.
2. **Målinga i eiga melding, med frist.** Arbeidaren byggjer og sender
   nettet strakst; målinga fyrer 100 ms seinare og teier om eit nyare
   punkt har teke over. Fristen er ikkje pynt: klienten sender neste punkt
   fyrst når svaret på det førre er framme, so ei måling utan frist ville
   alltid vinne kappløpet mot rundturen og målt kvart mellombilete.
3. **Siste-vinn-porten i studioen.** Aldri meir enn eitt bygg i lufta; eit
   uteståande punkt vert bytt ut, ikkje lagt i kø. Utan porten bygde
   arbeidaren kvart einaste mellombilete i draget — nett ingen såg.

**Målt** (`scripts/`-benk, same maskin): SKAL flate-drag 1 750 → 260 ms
per steg; STRAUM 532 → 263 («flate» bygde delane til 24 finnar ingen
såg — dei er late no); VAFFEL flate-drag 15 ms. Oppgjeret når fingeren
stoggar: SKAL ~1,5 s, dei tre andre 130–690 ms — og tavla står dimma til
det er framme, so eit førebels tal aldri liknar eit ferdig.

### 3 · Grov stabel medan fingeren er nede — GJORD

**Kva det vart, mot planen.** Som planlagt, med to endringar. `nth` fylgjer
detaljnivået i staden for ein eigen drag-modus: 144 på «lav» (draget og
mobilen), 360 på «mid» og «hog». Og det fine steget brukar nøyaktig same
`nth` som målinga, so stabelen frå det fine bygget og stabelen kuttlista
les er eitt og same hugsa objekt — det er hugsen frå etappe 2 som gjer den
delinga gratis. SKAL lag-drag 730 → 315 ms per steg. Regelen står:
**eit førebels tal går aldri inn i ein eksport eller i PDF-en** — eksport
og mappe byggjer alltid sjølve, på 360.

### 4 · Indekser meshet

**Kvifor.** 116 296 trekantar vert sende som 348 888 lause hjørne — 8 177 kB
per bygging, kopiert til hovudtråden og lasta opp til GPU-en på nytt kvar
gong. På `hog` er det 17 317 kB.

**Kva.** Del hjørne over rutenettet. Berre dei klipte rutene langs
opningskantane treng sine eigne.

**Synleg resultat.** Meshet under 2 500 kB på mid, mindre GC-rykk, og `hog`
blir brukande på ein berbar.

### 5 · Kort lenkje — GJORD

**Kva det vart, mot planen.** Som planlagt, med registeret teke på alvor
— og so korta til beinet: ÉIN bokstav ber både motor og versjon (endrar
banda i ein motor seg, får han ny bokstav og den gamle står att og les
gamle lenkjer), so nyttelasta rett på. Kodinga i `lib/hash.ts` er
motoruavhengig: kvart felt kvantisert til sitt eige steg og pakka i
blanda radiks. Rekkjefylgjene er FROSNE og dokumenterte i fila; `#p=`
vert lesen for alltid, all avkoding går gjennom motoren sin eigen clamp,
og søppel gjev null i staden for å felle sida.

**Målt** (`scripts/hash.ts`, 40 kast per motor): verste lengd 27 teikn
for vaffel, 27–41 over motorane (mot 1 034 før — dømelenkja frå eigaren
gjekk frå 664 til 28 teikn med `#` medrekna). Det ER golvet: nyttelasta
ligg på summen av log2 av trinna i banda, og under det kjem ingen utan å
kaste trinn. Ingen verdi flytta over eit halvt steg, andre kvantiseringa
flyttar ingenting, #p= vert lesen felt for felt, overgangsforma «s=b…»
frå førehandsvisinga vert lesen, og rusk kastar aldri.

### 6 · Lenkja er lagringa

**Kvifor.** RIBBE-lista, punkt 7: «Varianten som vart vald kan i dag ikkje
hentast tilbake i nettlesaren.» Det er framleis sant, men svaret er ikkje
ein presetmeny — det er nett det bolk 4 seier ein ikkje skal byggje.

**Kva.** Lenkja *er* lagringa. Legg til eit lite lokalt spor: dei siste
punkta ein har stått i, som lenkjer, i `localStorage`. Kalla «det du har
sett på», ikkje «lagra former». Ingen server, ingen konto, ingen namn.

**Synleg resultat.** Ein kan gå attende til objektet ein var innom for tjue
minutt sidan utan å ha kopiert noko.

### 7 · Ein terning som gjev møblar

**Kvifor.** 30 % av uniforme trekk held dei harde reglane; 0 % held alle
fjorten. Dei vanlegaste brota over 60 trekk:

| regel | hard | brot |
|---|---|---|
| utnytting | ja | 58 % |
| veltevinkel | ja | 47 % |
| bein på golvet | ja | 30 % |
| rygg | nei | 62 % |
| skal | nei | 43 % |
| kuben | ja | 12 % |

Ein terning som stort sett leverer noko ulovleg lærer ingen noko.

**Kva.** Trekk, så reparer: ei kort løkke som berre rører dei parametrane
den brotne regelen faktisk heng av, og som stoppar. Klarer han det ikkje på
eit fast tal steg, vis objektet med brota merkte i staden for å kaste det —
kanten av rommet er verd å sjå.

**Synleg resultat.** Minst 60 % av kasta held dei harde reglane, og panelet
seier kva skyvar som redda dei.

### 8 · Regelen skal peike — GJORD

**Kva det vart, mot planen.** `Rule` fekk det valfrie feltet `peikar` —
skyvarane som faktisk flytter regelen, viktigast fyrst, lesne ut av
regelkoden og ikkje av namnet. Kvar broten regel i panelet er trykkbar:
trykket opnar «alt», rullar til den fyrste skyvaren og let alle regelen
sine blinke éin gong. Reglar ingen skyvar eig — innpassinga i kuben,
materialvalet — står som liner utan pil, med vilje: å peike på noko som
ikkje kan rette dei ville vore løgn.

**Synleg resultat.** Trykk på «veltevinkel» i VAFFEL, og panelet rullar
til `fot`, `planA`, `planB` og `hogd` — dei fire som faktisk flytter
vippearmen.

### 9 · Alle platene ut — GJORD

**Kva det vart, mot planen.** `alleArkSvg` stablar alle arka under
kvarandre i ÉI fil i staden for å eksportere plate éin og teie om resten
— STRAUM med kvar si arkhøgd, sidan finner, sokkel og kappe har kvar si
platetjukn. Filnamnet ber platetalet (`skive-2ark.svg`), og panelet sa
alt talet ved plateutnyttinga (etappe 13).

### 10 · Éin kommando for mappa

**Kvifor.** `dump-doc` (20 s, 67 MB) og `render.py` (385 s) er to steg, og
ingen ting hindrar ein PDF av eit objekt som bryt ein hard regel.

**Kva.** `npm run mappe` køyrer begge, nektar på hardt brot, og stemplar
framsida med den korte hashen til objektet.

**Synleg resultat.** Mappa ber ei lenkje som opnar nøyaktig det objektet ho
skildrar.

### 11 · Mål på maskinvare

**Kvifor.** Bilderata i denne planen er målt med programvare-GL i eit
hovudlaust nettlesarmiljø. Det er ikkje eit einaste tal om ein telefon.

**Kva.** Ein telefon, den delte lenkja, og tala skrivne ned med
apparatnamnet ved sida av.

**Synleg resultat.** Ei rad i måletabellen med eit apparatnamn i.

### 12 · Variantane som lenkjer

**Kvifor.** Dei tolv finst i `variants.ts` og berre PDF-en ser dei. Dei bør
kunne opnast — men som argument med motargument, ikkje som ein meny.

**Kva.** Kvar variant får den korte lenkja si trykt i mappa, ved sida av
grunngjevinga og motargumentet.

**Synleg resultat.** Ein lesar kan opne A2 og sjå kvifor han vart forkasta,
i staden for å ta ordet mitt for det.

### 13 · Mot konseptet: FLETT ut, avfallsrekninga inn — GJORD

**Kvifor.** Prosjektet dreier mot konseptpresentasjonen, og ein presentasjon
ber ikkje åtte typologiar — han ber eit argument. FLETT var den einaste
motoren der flata ikkje var plate men band, og det svaret høyrde til eit
anna spørsmål enn det sandkassen stiller. Han er teken heilt ut: motoren,
posane og id-en, 3 228 liner. Att står seks typologiar i nedtrekket og eitt
spørsmål — og to tal som ber argumentet vidare enn silhuetten gjer.

**Aksane.** Konseptet er ei avfallsrekning med to aksar:

1. **Avfallet på arket.** Delane vert nesta på standardplater i alle
   motorane frå før — men talet vart rekna og kasta. No står det i
   kontrakten: `sheets`, `sheetArea` (breidda gonger den brukte lengda —
   stripa som går gjennom maskina) og `sheetUtil` (netto delareal delt på
   medgått plateareal; hòl i ein del er avfall, ikkje del). Same rekning i
   alle motorane, so talet kan samanliknast på tvers. Ei mjuk regel per
   motor set golvet (19–38 % etter typologi, målt under standardobjekt og
   posar), og panelet viser talet med platetalet attåt.

2. **Avfallet i objektet.** Utnyttinga under NS-EN 1728-lasta stod i tavla
   frå før; ho er den andre aksen. Materiale som ikkje ber, er avfall som
   står att i møbelet — standardobjekta ligg på 1–38 % utnytting, so det
   meste av godset gjer ingenting.

Målt på standardobjekta: vaffel 34,8 % av arket, skive 31,1 %, straum
27,0 %, ribbe 32,4 %, kote 21,9 %, karve 31,9 %, bøyg 41,6 %.

**Avlen.** Dei to aksane er summerte i eitt tal, og eit generativt søk
minimerer det: *plata gjennom maskina*, `massCut / (rho · sheetUtil)`, i
kubikkdesimeter. Talet fell når delane vert færre, tynnare eller mindre, OG
når dei pakkar betre — avfallet i objektet og avfallet på arket i same
eining. Søket (`lib/avl.ts`) er utglødd fjellklatring med frø bak same
kontrakt som alt anna: kvart kandidatpunkt går gjennom motoren sin eigen
clamp, terningsprang brukar motoren sin eigen reparasjon, harde brot kostar
so mykje at inga lovleg løysing taper mot ei ulovleg, og mjuke brot kostar
litt — dei er val, ikkje veggar. Spira (dobbelttrykk på terningen) køyrer 90 steg i
arbeidaren, eitt steg per makrooppgåve, so skyvarane aldri frys; dreg
brukaren i noko medan søket går, vinn handa og søket vert lagt frå seg.
`scripts/avl.ts` køyrer same søket frå kommandolina og skriv ut rekneskapen
og den delbare lenkja til det avla punktet.

**Målt** (`scripts/avl.ts`, 140 steg, frø `prosjekt`, denne maskina; alle
utan harde brot):

| motor | plate inn, standard | plate inn, avla | spart | ark | styrke | søk |
|---|---|---|---|---|---|---|
| vaffel | 23,3 dm³ | 18,3 dm³ | 21 % | 35 → 45 % | 18 → 37 % | 37 s |
| skive | 51,9 dm³ | 22,1 dm³ | **57 %** | 31 → 61 % | 3 → 3 % | 4 s |
| straum | 39,2 dm³ | 21,8 dm³ | 44 % | 27 → 39 % | 8 → 22 % | 123 s |
| ribbe | 50,2 dm³ | 38,1 dm³ | 24 % | 32 → 30 % | 15 → **84 %** | 15 s |
| kote | 56,2 dm³ | 36,2 dm³ | 36 % | 22 → 45 % | 29 → 65 % | 9 s |
| karve | 86,6 dm³ | 71,1 dm³ | 18 % | 32 → 52 % | 1 → 1 % | 3 s |

**Det som er verdt å lese ut av tabellen.** Sparinga kjem to vegar, og
motorane vel kvar sin: skive og karve pakkar arket betre (31 → 61 og
32 → 52 prosent) utan at materialet arbeider hardare, medan ribbe går
motsett veg — arket står i ro, men atten tynnare blad i staden for
tjueto tjukke lyfter utnyttinga frå 15 til 84 prosent. Og to av motorane
avslører seg: skive og karve står att på éin til tre prosent styrke same
kor mykje avlen tek, av di det styrande snittet deira er sett av heilt
andre omsyn enn lasta. Det er ikkje ein feil i avlen — det er eit
måltal på kor overdimensjonert typologien er i utgangspunktet, og det
høyrer heime i mappa. Straum sitt eine mjuke brot er materialvalet:
avlen fann poppel, og poppel-regelen seier frå — som han skal.

**Kva avlen ikkje er.** Han er ikkje ein fasit og ikkje ein knapp som
teiknar møbelet ferdig. Han er ein reiskap som syner kva materialrekninga
kostar i form: kvar gong han tek 30–40 prosent av plata, er det fordi han
flytta band designaren óg kunne flytta — færre og breiare delar, tettare
pakking, hardare arbeidande snitt. Bolk 4 gjeld framleis: brotet er
framleis dyrare enn variasjonen, og avlen går aldri over ei motorgrense.

### 14 · Panelet snudd: posar og hovuddrag fyrst, veggen bak «alt» — GJORD

**Kvifor.** Bolk 4 seier det sjølv: fleire skyvarar er det motsette av
svaret. Men panelet SYNTE dei som svaret — skyveveggen med 21 til 45 band
var det fyrste ein møtte bak opnaren, og prosjektet dreier mot ein
konseptpresentasjon der sandkassen skal brukast av folk som ikkje kjenner
parameterromma. Ein vegg av band ein ikkje forstår er ikkje ein reiskap;
han er eit arkiv med ei framside.

**Kva som vart gjort.** Tre nivå, og skyvarveggen er det siste:

1. **Posane vart inngangar.** Dei handdesigna punkta terningen jittrar
   kring har alltid lege i `params.ts` per motor; no ber dei namna sine
   sjølve (`poses` i kontrakten) og står som chips øvst i panelet, med
   «standard» fyrst. Eit trykk er eit hopp til nøyaktig det punktet;
   materialet ein står i vert med. Namna som før låg i ein parallell
   tabell i `scripts/posar.ts` kjem no frå motoren — det som vert prøvd
   er det brukaren ser. Dette er ikkje presetmenyen bolk 4 åtvarar mot:
   posane var alt i grensesnittet gjennom terningen, dei var berre
   usynlege og utan namn.

2. **Hovuddraga.** Tre til seks semantiske kontrollar per motor
   (`hovuddrag` i kontrakten): kvart drag har ein primær som gjev
   posisjonen og talet, og fylgjarar som går med same normaliserte steg
   gonger vekta si (`applyDrag` i `core.ts`, klemt inn i kvart band).
   Ingen nye parametrar — parametertalet er frose, og eit drag er ein
   peikar inn i rommet som finst, ikkje ei utviding av det.

3. **«Alt».** Måltavla og heile veggen står bak ein knapp som ber ordet.
   Finstilling, ikkje fyrsteinntrykk.

**Scena reknar arket inn.** Arkmodusen flytte til studioen, og kameraet
rammar objektet inn i bandet av skjermen arket ikkje dekkjer — same
perspektivrekning som innramminga elles (`pad` i `FitCamera`), ingen
heuristikk. Objektet vert aldri gøymt bak panelet, på noko arknivå.

**Gesten fekk namn.** To fingrar på lerretet har alltid skrudd to band;
no seier ein chip KVA band og kva tal, medan draget går. Ein gest utan
namn er ein løyndom, og løyndomar er ikkje interaksjon.

**Klypa slutta å zoome.** Alt bur i same 500-kuben og innramminga er
automatisk, so klyp-zoom var ein gest brukt på ingenting. No skrur klypa
storleiken — den tredje aksen som formar mest per motor: planet på
VAFFEL, setet på STRAUM og KARVE, fotradien på KOTE. Sprikande fingrar
gjer møbelet breiare, og peikar nøkkelen på primæren i eit hovuddrag,
køyrer gesten heile draget. Musehjulet på desktop zoomar framleis; der
finst ingen gestkonflikt, og eit skøytepunkt toler eit nærbilete.

**Terningen ber avlen.** Spira hadde sin eigen knapp i hovudlina; no er
han borte, og avlen ligg som dobbelttrykk på terningen — same språket
som låsen på modulveljaren. Trykket ventar det same vesle vindauga på
tvillingen sin, av di rekkjefylgja ber meining: eit kast som fyrte fyrst
ville flytte punktet avlen skulle starte i. Lina vart ein knapp kortare,
og dei to generative flytane bur i same fingeren: eitt trykk spreier,
to trykk strammar.

**Vurdert og lagt vekk:** direkte 3D-handtak på sjølve objektet. Det krev
ankerpunkt i geometrien per motor — kvar sit «midja» på ein KARVE? — og
kontrakten ber ikkje slike punkt. Gesten pluss hovuddraga gjev det meste
av verdien utan å røre motorane; handtaka kan kome den dagen kontrakten
har ein grunn til å bera anker.

### 15 · Snittet: KOTE og KARVE ut, fire svar står — GJORD

**Kvifor.** Eit steg tilbake og eit hyperkritisk blikk på kva prosjektet
faktisk er: eitt møbel i ein 500-kube og ein presentasjon som ber EITT
argument — korleis byggjer ein ei krum sitjeflate av flate plater, og kva
kostar kvart svar i materiale. Målt mot det spørsmålet fall to av seks:

- **KARVE svara på eit anna spørsmål.** Ei limt blokk frest ned er
  subtraktiv skulptur — flata vert ikkje BYGD av plater, ho vert GRAVEN
  ut av dei. Same grunnen som felte FLETT (band er ikkje plate). Og
  avlstabellen i etappe 13 hadde alt dømt han: 1 % styrke same kva søket
  tok, 86,6 dm³ plate inn — verst i heile registeret.
- **KOTE svara svakt.** Vassrette koter på stavar er ein stabel som aldri
  når flata: setet er riller, silhuetten trappesteg. Det er SKAL-vegen
  utan konklusjonen hans (slipinga) — og SKAL står alt i mappa som
  vitnemål om det steget.

Etappe A sa det sjølv: éin motor er ein demonstrasjon, fire er eit
argument. Seks var ikkje eit sterkare argument enn fire — dei var to
svar på andre spørsmål, stilte ved sida av det eine.

**Kva som vart gjort.** Som FLETT: heilt ut — mappene, registeret og
id-ane. Gamle lenkjer med `engine: "kote"` eller `"karve"` fell tilbake
til standardobjektet, som lenkjer med `"flett"` alt gjer. Etappe 13 og 14
står som dei vart skrivne; tala deira om kote og karve er historie, ikkje
notid.

**Og informasjonsdritten ut.** Avl-kvitteringa («avla · plate inn …»)
som kom i etappe 14-runda er fjerna. Resultatet av avlen er objektet som
står der og tala som alltid er synlege — ein reiskap kvitterer med
verkstykket, ikkje med ein lapp om det. Gestechipen står: han er handa
sitt spegelbilete medan gesten går, ikkje ein informasjonskanal.

### 16 · VAFFEL-runda: lasta på flata, tett pakking, reiskapen for brukaren — GJORD

**Kvifor.** VAFFEL er svaret prosjektet landar på, og reiskapen fekk eit
føremål som kan seiast i éi setning: lage ÉIN krakk som passar brukaren
sin, med minst mogleg materialsvinn. Det kravde tre ting motoren ikkje
hadde: lasta synleg, arket pakka tett, og terningen heime.

**Lastkartet.** Lesemåten «last» fargar lag-nettet etter utnyttinga under
NS-EN 1728-lasta — same modell som `measure` (bøying i bandet over
kvelvinga med djupna lesen av geometrien punkt for punkt, fiberfordelinga
over høgda, trykk i beinet), evaluert langs kvar ribbe i `lib/vaffel/last.ts`.
1,0 på kartet ER kapasiteten, og kontraktprøva vaktar samsvaret med tavla.
Skalaen er husets fargar på kvadratrot — eit lovleg møbel ligg under 40 %,
og lineær skala gjorde heile kartet marineblått. Det kartet ikkje er, seier
fila sjølv: elementmetode. Ingen samverknad mellom ribbene — eit overslag.

**Tett pakking.** Giljotin-rektanglane i `vaffel/nest.ts` er bytte med
rasterpakking: kvar del rastrert etter ytterkonturen (celle 6 mm, dilatert
éi celle som PROV på minst 8 mm luft — målt minste faktiske luft 10,0 mm),
fire kvartrotasjonar, botn-venstre, deterministisk. Like delar deler
masker og søkjepeikar, so kvar (del, rotasjon) skannar arket høgst éin
gong — verste pakketid 47 ms over 25 terningkast, godt under 80 ms-taket
målinga og avlen krev. `Placed.rot` voks frå boolean til kvartrotasjonar;
`placedRings` er einaste tolkaren, og svg/dxf/ark går gjennom han.

**Målt** (`scripts/nesting.ts`, standardobjekt):

| motor | plateutnytting før → etter | tid |
|---|---|---|
| vaffel | 34,8 → **48,6 %** | 17 ms |
| boyg | 41,6 → **60,6 %** | 13 ms |
| skive | 31,1 → **34,6 %** | 14 ms |

Straum og ribbe har eigne nest-filer og står urørte (27,0 / 32,4 %).
Over 25 seeda kast på vaffel: 41–61 %, dei fleste på eitt ark. Snudde
ribber grip inn i naboens boge — det er den pakkinga kommentaren i
nest.ts har lova sidan fyrste line.

**Reiskapen heim til brukaren.** Terningen startar låst på VAFFEL
(dobbelttrykk slepper han over motorgrensa), dobbelttrykk på eit
variabelnamn låser det mot terningen (draget låser heile flokken sin),
og halvope ark er reinska til det som formar: posar, hovuddrag,
lesemåtar, eksport. Materialet, beisen og ark-kortet bur i «alt».

### 17 · Lasta vart lesemåte, og skyvaren vart tommelens — GJORD

**Kvifor.** Etappe 16 gav VAFFEL lastkartet; dei tre andre stod att med
`kanLast` usett, og kartet var ikkje til å stole på: tavla kunne seie
65 % medan kartet stod blått. Ein reiskap der to visingar av same modell
seier kvar sitt tal, er verre enn ein reiskap utan kart.

**Delt modell som invariant.** Kvar motor fekk si `lib/<motor>/last.ts`
med éin funksjon båe les: `lastVerste` (det analytiske verste punktet —
talet i tavla) og `feltPaMesh` (utnyttinga per hjørne — fargane i
kartet). `BuildOut` ber `felt` og `feltTak`, og fargeskalaen ankrar i
`feltTak` — same talet som tavla. Kontraktprøva vaktar samsvaret per
motor: kartmaks = tavla, 0,0 prosentpoeng slark. STRAUM sist ut: heile
snittmaskineriet (kva høgder kvart skiveplan lever i, stykka i snittet,
spenninga) flytt frå `metrics.ts` til `last.ts` og PROVA mot ein fasit
på seks desimalar før og etter — tavla, volumintegralet og kartet les no
bokstaveleg same funksjon.

**Finmaska nett.** Lag-netta er bygde for å SJÅAST — store flate
trekantar. Med éin verdi per hjørne vart kvar stor trekant ein lineær
fargeovergang, og kartet fekk diagonale blomar som ikkje finst i
fysikken. `lib/lastnett.ts` deler kvar trekant i eit jamt rutenett til
ingen kant er over 24 mm (tak på 400 000 trekantar, jamt nedskalert),
so hjørna SAMPLAR feltet i staden for å diktere det.

**Skyvaren for tommelen.** Sida vert brukt på telefon; skyvarane var
skrivne for mus. Ny `Skyvar`: relativ drag (ingen hopp til
trykkpunktet), og vertikal avstand girar presisjonen ned — over 45 px
frå spora gjev kvartfart, over 90 gjev tjuedelsfart, med FIN/FINAST som
kvittering. Målt på 100 px drag: 59 mm grovt, 3,0 mm finaste gir.

**Form av lasta.** Motorar med lastmodell fekk `lastForm`: eitt trykk
formar objektet til lasta med modellen sjølv som dommar — VAFFEL og
SKIVE hevar bogen til verste punktet står på 60 % av kapasiteten
(halvering på bogehøgda, ærleg retrett om ein hard regel ryk), RIBBE
tynnar bladet steg for steg med heile regelkjeda som vakt (utnyttinga er
ikkje monoton i tjukna der, so halvering ville navigert etter to galne
fyrtårn). Éin knapp under lastskalaen, rekna i arbeidaren.

### 18 · Sparsemdrunda: svinnet inn i funksjonane — GJORD

**Kvifor.** Brukaren bad om ti store betringar i eitt jafs, med to krav
i klartekst: SKIVE skulle sjå mykje betre ut, og materialsparinga skulle
INNVERKE på funksjonane — ikkje stå i ei tavle og sjå på.

**Svinnet tel dobbelt i avlen.** Målet i `lib/avl.ts` var plata inn
(`massCut / (rho · plateutnytting)`) — eit fysisk tal som alt straffar
avfall éin gong. No vert det gonga med `(2 − plateutnytting)`: eit ark
halvfullt av delar kostar halvannan gong seg sjølv. Sparsemda på arket
er ikkje lenger ein bieffekt av sparsemda i objektet; ho er sitt eige
ledd i målet.

**% ark i hovudlina.** Fjerde talet i hovudlina er plateutnyttinga, ved
sida av kilo, veltevinkel og utnytting. Kvart drag i kvar skyvar viser
kva han gjer med arket, utan at panelet må opnast.

**SKIVE grunnlagd på nytt.** Det gamle standardobjektet bar 11,1 kg og
kravde to ark der det andre stod 97 % tomt. Det nye (9 skiver på 9 mm,
djupare luft, lågare rygg med grep, høgare boge) veg 6,7 kg, går på
EITT ark med 49 % utnytting — og terningen held 100 av 100 kast innanfor
dei harde reglane. Alle tolv posane fekk dei gamle tala sine eksplisitt,
so dei står som dei var. Og skivene fekk FAS: kvar skive ber eit 2,5 mm
kantpass frå fresen i lag-nettet, plateflatene trekte inn og ei fasa
rand imellom — stabelen les som bygde delar, ikkje som ekstrudering.

**Alle standardobjekta på slankekur, med forma låst.** Avlen med forma
låst (berre tjukner og tal frie) fann same dommen i kvar motor: dei bar
fleirfaldig lasta utan at nokon hadde spurt. Grid-målingar valde punkta,
og alle held kvar einaste regel:

| motor | masse | plata inn | plateutnytting |
|---|---|---|---|
| vaffel | 5,5 → **4,3 kg** | 11,3 → **8,4 dm³** | 49 → **52 %** |
| skive | 11,1 → **6,7 kg** | 32 → **13,6 dm³** | 35 → **49 %** |
| straum | 5,1 → **4,2 kg** | 26,6 → **22,8 dm³** | 27 → **28 %** |
| ribbe | 10,4 → **9,1 kg** | 34,1 → **25,7 dm³** | 32 → **38 %** |

Kvar grense er grunngjeven i params-fila der ho står: RIBBE stoggar på
11 mm av di tynnare vipper nestinga til to ark (målt, ikkje meint);
STRAUM stoggar på 8/10 av di modellen ikkje reknar knekking og botnen av
banda difor ikkje er hans å ta; VAFFEL rører ikkje bogen, for han er
spaken «form av lasta» skal få dra i. Posane i alle motorane fekk dei
gamle tjuknene sine eksplisitt — ingen pose endra seg ein millimeter.

### 19 · Skrubben, det stille vindauget, og posane grunnlagde på nytt — GJORD

**Kvifor.** Tre krav i klartekst frå brukaren: ingenting i vindauget
skal variere medan ein dreg i ein skyvar, skyvaren skal vera ein skrubb
i slekt med ein dreiegjevar utan meir tekst i grensesnittet, og posane
skal verta mykje betre.

**Skrubben.** Gira er ute. Den gamle skyvaren bytte utveksling etter
kor langt fingeren stod frå spora, voks prikken og synte FIN/FINAST
midt i draget. No er skrubben ein dreieskive lagd flat: relativ,
konstant utveksling (eitt strok over spora flytter 65 prosent av
bandet, alltid), strok legg seg oppå kvarandre som omdreiingar, og
hakka i spora — ein still linjal — er dei einaste orda han treng. På
vegen fall ein ekte feil: peikarfangsten kom fyrst ved
intensjonsterskelen, so eit strok som vandra ut av den 44 px høge rada
mista hendingane sine (målt: 1 mm mot 21). Fangsten sit no på fyrste
trykk, og delta er identisk med og utan loddrett avdrift.

**Det stille vindauget.** Panelet er botnfest, so kvar varselline som
kom inne i arket lyfte heile panelet — skyvaren flytte seg under
fingeren nett i det draget som skapte brotet. Reglane som ryk ligg no
utanfor dokumentflyten: piller over panelet, veksande oppover over
lerretet, med same innhald og peiking som før. Målt: 0,0 px flytt av
panel-toppen gjennom eit drag der brotet lækjest undervegs.

**Posane.** Fire agentar — ein per motor — målte kvar pose gjennom den
verkelege kjeda (clamp → measure → rules) og leverte nye sett;
framlegga vart etterprøvde uavhengig og dømde mot skjermbilete av alle
29 gamle og 30 nye posar. Resultatet: SKIVE frå tolv til åtte (fem
nesten like bogekrakkar ute, «stylta» inn; alle åtte på EITT ark der
fem av tolv før tok to), VAFFEL frå sju til åtte (to karakterlause ute,
amfora/tuva/hallen inn — hallen med lastkartet glødande på 80 %),
STRAUM frå fem til sju (vridd søyle omdesigna til eit verkeleg vridd
prisme, timeglas til det reine dobbeltkjegle-glaset, «heilarket» — alt
av eitt ark i éi tjukn med friksjonsfuge — og «tua» inn), RIBBE frå fem
til sju (amfora og søyla inn, to kandidatar vraka på måling). Kvar
tjukn i kvar pose er ein målt botn med grunn i fila: sopp stoggar på 10
av di 9,5 vipper nestinga til to ark, dokumentobjektet på 9 av di 8,5
opnar spalta inn i fingerbandet. Alle 30 held alle reglane, og massane
fall med 0,3–3,2 kg per pose.

### 20 · Produksjonsrunda: rasteret overalt, freda tjukner, laseren — GJORD

**Kvifor.** Reiskapen skal publiserast som open kode og brukast av folk
med fres OG folk med laserkuttar. Då må tre ting stemme: pakkinga må
vera tett, materialet og tjukna må vera VAL og ikkje terningkast, og
kuttfilene må kunne gå til ei laserseng med tynne plater.

**Rasteret overalt.** Pakkaren flytte frå vaffel/nest.ts til
lib/nestraster.ts og vart parameterisert (arkmål, luft, celle) — og
STRAUM og RIBBE, som hadde kvar sin enklare pakkar (hyllerader med
12 mm luft; frie rektangel over omrissa), fekk rasteret. Målt på
standardobjekta: STRAUM 28 → 40 % plateutnytting (plata inn 22,8 →
16,0 dm³), RIBBE 38 → 47 % (25,7 → 20,7). RIBBE-fila hadde sjølv sagt
kva pakkinga hennar kosta; no er lovnaden halden.

**Freda produksjonsval.** Terningen rører aldri meir tjukner og
innpassing (FREDA per motor: ribbT/plyT/finneT/bladeT med fylgje), og
avlen byter aldri meir material — plata og maskina er brukaren sine
val, ikkje aksar søka eig. Prisen er ærleg og målt: vaffel-terningen
fell frå 100 til 95 % på dei harde (eitt kast deler forma og
reparasjonen får ikkje lenger tjukna som spak), men «held alle» STIG i
alle motorane (ribbe 40 → 98 %) av di kasta ikkje lenger landar på
ville plater.

**Laseren.** MDF og akryl inn i materialregisteret, og eit maskinval i
panelet: fres (heil plate, 1:1) eller laser (600 × 400-seng, 2 eller
3 mm ark). Laserfilene er ein MODELL: heile geometrien skalert med
tjukn/hovudtjukn — den einaste skaleringa som held kvart spor nøyaktig
lik plata — nesta på lasersenga med 2 mm luft og fint raster, og
laserens eigen kerf gjev fugeklaringa. STRAUM legg attpåtil sokkel og
kappe i same tynne arket som finnane: éin materiale, éin modell.
Standardvaffelen på 3 mm MDF: to laserark, 53 % utnytting.

**Taket, målt.** «Burde lett nå 80–90» vart prøvd mot geometrien:
delane sjølve er 50–67 % av eigne omskrivne boksar (netto/boks: vaffel
67, skive 58, straum 52, ribbe 50) — kammane, bogane, tomromma og
ringsentera er luft FORMA ber med seg, og ingen pakkar får dei
prosentane att. Tre spakar vart likevel dregne: hòla i delane er no
LEDIG plate (skrotet i eit ringsenter fell ut same kva, so smådelar
ligg inne i tomromma), eksporten pakkar med celle 4/1 og prøver tre
sorteringar (den levande målinga held budsjettet sitt på celle 6), og
STRAUM sin per-ark-etikett les mot brukt stripe som alle andre.
Eksportpakkinga treffer no 96–110 % av delane sin eigen bokstettleik
— straum 43 → 56 % — og DER ligg taket: skal talet høgare, må FORMA
endrast (færre tomrom, éi tjukn), ikkje pakkaren.

**VAFFEL, dekomponert.** Kravet «nesten ingen svinn» vart prøvd mot
tal: eit sveip over lufta (gap 8 → 1 mm, celle 4 → 0,5) gjev 52,8 →
59,4 % — lufta mellom delane kostar altså seks–sju poeng, og resten av
avstanden opp til hundre er BOGEN sjølv: hòlet som gjer ribba til bein
og sparer dei kiloa som gjer vaffelen lettast i registeret. Prosenten
og massen dreg kvar sin veg — ein vaffel med små bogar pakkar «betre»
og kjøper MEIR plate — so talet som skal jagast er plata inn (dm³),
der vaffelen alt leier med 8,4. To ting vart likevel henta: laserlufta
ned frå 2 til 1,2 mm (målt: +3 poeng, 54 → 57 %; under 1,2 kom
ingenting att), og lærdomen står her. Avkappet frå bogane er dessutan
store, reine stykke — plate ein har, ikkje flis.

---

## 6 Kva som skal målast

Alt i denne tabellen er målt på denne maskina i dag. Kolonnen «mål» er kva
etappane skal gjera det til.

### Bygg og last

| kva | i dag | mål | korleis |
|---|---|---|---|
| `next build` | 12 s | under 30 s | `npx next build` |
| JS til nettlesaren | 1 571 kB rått, 444 kB gzip | 500 kB gzip | `.next/static` |
| største bunt | 921 kB rått, 239 kB gzip | — | three.js; ikkje mykje å gjera med |
| lerretet på skjermen | 295 ms desktop | under 600 ms | Playwright |

### Motoren

| kva | i dag | mål | skript |
|---|---|---|---|
| `makeShell` | 16 ms | — | `plan-budget.ts` |
| `buildStack` (nth 360) | 583 ms | 198 ms under drag | `plan-probe.ts` |
| `buildMesh` lav / mid / hog | 244 / 605 / 1 087 ms | — | `plan-budget.ts` |
| `measure` | 1 024 ms, 882 av dei dobbeltarbeid | 150 ms | `plan-probe.ts` |
| `checkRules` | 84 ms | — | `plan-budget.ts` |
| **full runde, mid** | **2 315 ms** | **under 400 ms** | `plan-budget.ts` |
| full runde, hog | 2 741 ms | under 1 200 ms | `plan-budget.ts` |
| verste runde over 24 tilfeldige punkt | 2 562 ms | under 600 ms | `plan-budget.ts` |

### Meshet

| kva | i dag | mål | skript |
|---|---|---|---|
| lav | 50 760 tri, 3 569 kB | 1 100 kB indeksert | `plan-budget.ts` |
| mid | 116 296 tri, 8 177 kB | 2 500 kB indeksert | `plan-budget.ts` |
| hog | 246 288 tri, 17 317 kB | 5 200 kB indeksert | `plan-budget.ts` |
| kostnad per rute | 14,6 µs | — | `plan-probe.ts` |

### Grensesnittet

| kva | i dag | mål | korleis |
|---|---|---|---|
| skyvar → nytt tal | 90 ms utsetjing + runda | under 250 ms | Playwright, panelet ope |
| bilderate under orbit, desktop | ikkje målt på GPU | 60 fps | ekte maskin |
| bilderate under orbit, mobil | ikkje målt på maskinvare | minst 30 fps | ekte telefon |
| delt URL | 1 034 teikn, 1 186 verst | under 80 | `plan-hash.ts` |

### Eksport og mappe

| kva | i dag | skript |
|---|---|---|
| STL på hog | 12 026 kB, 30 ms | `plan-budget.ts` |
| DXF | 766 kB, 389 ms | `plan-budget.ts` |
| kuttark SVG | 235 kB, 9 ms | `plan-budget.ts` |
| konturkart SVG | 210 kB, 9 ms | `plan-budget.ts` |
| `dump-doc.ts` | 20 s, 67 MB | — |
| `render.py` | 385 s, 15 sider, 1,45 MB | — |

### Rommet

| kva | i dag | mål | skript |
|---|---|---|---|
| uniforme trekk som held dei harde reglane | 30 % | minst 60 % | `plan-feasible.ts` |
| trekk som held alle 14 | 0 % | — | `plan-feasible.ts` |
| brot i standardobjektet | 0 av 14 | 0 | `plan-feasible.ts` |

Måla er ikkje ynske. Dei er dei tala som skal stå i denne tabellen når ein
etappe er ferdig, og ein etappe er ikkje ferdig før talet er målt om att.

---

## 7 Drift

**Vercel, vanleg Next-bygg.** Alle fire rutene vert alt prerendra statisk,
så det ligg ingen serverkode her. `output: "export"` er difor ei
eittlinjes endring den dagen mappa må liggja på ein minnepinne på ein
gjennomgang — arbeidaren går gjennom `new URL(..., import.meta.url)` og
overlever ein statisk eksport. Til då er det ingen grunn til å byte.

**Analyse.** `@vercel/analytics` er alt kopla inn og køyrer berre i
produksjon. Det som er verdt å sjå på er om delte lenkjer vert opna og kva
lesemåte folk står i. Ikkje meir. Ingen telemetri per parameter:
parametrane er arbeidet, og dei høyrer til den som skrur, ikkje til eit
instrumentbord.

**Domene.** `50x50x50.iverfinne.no`. `parametric.iverfinne.no` står der
han står, og `iverfinne.no` er urørt.

**PDF-en vert ikkje deployert.** `doc/out/` er eit byggjeprodukt som vert
levert, ikkje ei side som vert serva.

**Innlevering.** Sandkassen skal vera frosen på innleveringsdagen. Det
tyder at etappe 0 og etappe 10 må vera ferdige i god tid: kva objekt som
gjeld, og at mappa ikkje kan byggjast av eit ulovleg objekt.

---

## 8 Att

Ærleg liste, i den rekkjefylgja eg ville teke dei. Det som stod her og er
gjort (measure-dobbeltarbeidet, delt svar, grov stabel, kort hash, reglar
som peikar, alle platene, snittet ned til fire) står i etappane over —
lista ber berre resten.

| | Kva | Kvifor |
|---|---|---|
| 1 | `npm run mappe` for dei fire, som nektar på hardt brot | Mappa ER innleveringa. Dumpen og render.py kan i dag berre SKAL; dei fire i registeret har ingen veg til papir. Stempla med kortlenkja som reproduserer objektet. |
| 2 | Terning som reparerer, målt om | Reparasjonane per motor finst; kor stor del av kasta som no held dei harde reglane på dei FIRE er ikkje målt sidan registeret var seks. |
| 3 | Lokalt spor over lenkjer | Punktet ein var innom for tjue minutt sidan er borte. Presetmeny er ikkje svaret; kortlenkja gjer kvart spor til under 30 teikn. |
| 4 | Indekser meshet | 8 177 kB per bygging er tre kopiar av kvart hjørne. |
| 5 | Mål bilderata på ein telefon | Alle bilderatetal i dette dokumentet er programvare-GL. |
| 6 | Variantane som lenkjer i mappa | Med kortlenkja er kvar variant under 30 teikn og ein QR-kode. |
| 7 | Kopier scena frå parametric ein siste gong | To kopiar utan vedlikehaldsregel driv frå kvarandre utan at nokon oppdagar det. |

Objektlista — bygg det, prøv NS-EN 1022, dybelplan, fas mot golvet,
skiveavfallet, fargen — står i SKAL-mappa og høyrer ikkje heime her. Det
denne planen kan gjera for henne, er å sørgje for at tala ho vert prøvd mot
kjem frå éin stad.

---

## Skript

| fil | kva han måler |
|---|---|
| `scripts/plan-budget.ts` | tid per steg, mesh-storleik, eksportstorleik, hash-lengd, verste av 24 tilfeldige punkt |
| `scripts/plan-probe.ts` | kvar tida i `measure` går, `buildStack` mot vinkeloppløysing, `buildMesh` mot rutenett |
| `scripts/plan-hash.ts` | informasjonsgrensa i eit punkt, og kva ei kvantisert koding ville kosta |
| `scripts/plan-feasible.ts` | kor stor del av parameterrommet som er eit møbel, og kva reglar som fell |
