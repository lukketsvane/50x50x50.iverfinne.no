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

Sandkassen er ikkje éin generator lenger. Han er eit register med tre, og
skalet veit ingenting om kva som ligg under nedtrekket.

| lag | fil | status |
|---|---|---|
| kontrakt | `lib/core.ts` | `EngineDef`: parameterrom, tre lesemåtar, måltavle, reglar, fire eksportformat. Pluss geometrien alle treng: hylster, superellipse, meshvolum, kapasitetar |
| register | `lib/engines.ts` | tre motorar, nedtrekk, per-motor tilstand |
| tråd | `lib/worker.ts` | motoruavhengig; rutar på `req.engine` |
| grensesnitt | `studio.tsx`, `viewer.tsx`, `controls-panel.tsx` | skriven éin gong, tener alle tre |
| prøve | `scripts/typologies.ts` | kontraktprøva: nøklar, terning, lukka nett, NaN, kuben, reglar, tid |
| mappe | `doc/render.py` | 16 sider, eigen rasterisator utan GPU |

Og motorane i registeret, med tala frå `scripts/typologies.ts`. (`skal`,
`boyg` og `viking` står ikkje i nedtrekket; `laft` og `skive` er tekne
heilt ut — sjå etappe 27. Skyvartala til VAFFEL og RIBBE er dei etter
formspennrunda i etappe 28.)

| motor | produksjonsveg | skyvarar | reglar (harde) | masse | utnytting | bygg + mål |
|---|---|---|---|---|---|---|
| `vaffel` | kryssholdte ribber i to retningar, utan lim og utan skruar | 26 | 17 (8) | 4,32 kg | 52 % | 282 ms |
| `straum` | éin kropp skoren i skrå skiveplan, finnar sette i spor | 35 | 18 (6) | 4,25 kg | 40 % | 855 ms |
| `ribbe` | radiale blad og vassrette band, kryssholdte i kvarandre | 38 | 17 (9) | 9,05 kg | 47 % | 317 ms |

Alle tre held alle reglane sine på standardobjektet. Ingen av dei held
alle reglane på eit tilfeldig trekk — sjå etappe 7.

**Det som er verdt å lese ut av tabellen:** RIBBE ber dobbelt so mykje
masse som VAFFEL for den same sitjeflata. Det er ikkje ei slurv i RIBBE —
det er prisen på radialt: blada møtest i eit senter der det ikkje er plass
til dei alle, og godset må vekse for å bere same lasta. Etappe 27 handlar
om kva den prisen kjøper.

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

### 21 · LAFT: typologien som nektar spørsmålet — GJORD

**Kvifor.** Dei fire motorane var fire svar på det same: korleis byggje ei
KRUM sitjeflate av flate plater. Fire svar på eitt spørsmål er ein
metode; dei viser kva krumminga kostar, men ingen av dei viser kva ho er
VERD, av di ingen av dei står utan henne. Referansane som sette dette i
gang — flatpakka kryssfinérstolar med ei ryggplate med berehol, ei
seteplate, to beinblad og ein kile i kontrastfarge — svarar ikkje på
spørsmålet i det heile. Dei seier at ei plate er ei plate, at komforten
kjem av VINKLAR, og at flata får vera flat. Det er den andre enden av
rommet, og eit argument treng begge endane.

**Kva han er.** Fire heile plater og ein kile: seteplate med to
gjennomgåande spor, to beinblad med tapp opp gjennom setet og ein boge
kutta ut under, ei rygglist som går NED gjennom setet, og ein kile som
vert slegen gjennom tunga under. Skuldra ligg over setet, kilen under —
plata er klemd mellom dei to, og då sit møbelet. Ingen lim, ingen skruar.
Rekkjefylgja er: reis bladene, slepp setet ned, slepp lista ned, slå
kilen. Kilen er den einaste delen som er RETT å kutte i eit anna treslag,
av di han er det som held alt saman og då skal ein sjå kvar han sit.

**Ryggen vart ei LIST, og det er kuben sin skuld.** Referansestolane er
kring åtte hundre millimeter høge. Oppgåva er fem hundre, og
NS-EN 1729 sin botn for setet er tre hundre og åtti. Rekninga går ikkje
opp: er setet lovleg, er det knapt hundre millimeter att til ryggen. Så
ryggen er ikkje ein rygg — han er ei list ein lener korsryggen mot, og
det er den SAME lista ein ber stolen etter. Bereholet er det einaste
hòlet i heile møbelet som ikkje er eit ledd.

**Tre feil i ledda, funne med tal og ikkje med auge.** Ein numerisk
leddsjekk (kvar del sitt hylster i verda, mot kvart spor) tok tre ting
teikninga aldri ville vist: setet var bygd OPP frå oversida si og stod
difor ei heil tjukn for høgt (framkanten på 416 i ein kube på 500);
lista stod ikkje midt i sporet sitt; og kilen kunne ikkje gå gjennom sitt
eige hòl — eit hòl i tunga går langs tunga sin normal, altså fram og
attende, so kilen MÅTTE vera ei plate i x–z-planet som vert driven
framover, ikkje ei som vert slegen ned.

**Viklinga og handa til planet.** Halve platene rendra kolsvarte. Grunnen
var at plana ikkje har same hand: setet og lista har eit høgrehendt
(u, v, n), bladene og kilen eit venstrehendt, og same viklingsrekkja gjev
då motsett geometrisk normal. Målt: 348 av 1848 trekantar i «lag» og 232
av 472 i «flate» var vrangt vikla. `tri()` rettar no viklinga etter
normalen, og veggene får utovernormalen rekna i PLANET — der utsida
alltid ligg til høgre for gangretninga, same kva hand planet har. Etter:
null vrange.

**Konturen bryt lina.** Dei andre motorane legg profilane sine på éi
line, som går bra når delane er mange og små. Fem store delar vart to
meter breie og ti centimeter høge, og innramminga — som reknar avstand av
halvdiagonalen og har eit tak på femten einingar — kutta teikninga i
begge endar. LAFT bryt difor lina i rader mot ei om lag kvadratisk
teikning.

**Plateutnyttinga, ærleg.** Fyrste utkast lova at «fire store, enkle
former pakkar tettast», og målinga sa nei: 42 %, mot vaffelen sine 53.
Grunnen er ikkje pakkaren — han finn alt det einaste bandet som finst
(bandhøgda er den høgaste delen, 399 mm, og lågare går det ikkje) — det
er at fem delar ikkje fyller ei plate som er 2500 mm brei på TVERS, og
bandet vert betalt i full breidd. Regelen seier no dette, og terskelen
står på 40 %, som er nedre kvartil i rommet. Det LAFT faktisk vinn står
under: EITT band, 14,9 dm³ plate inn, 4,3 kg, og fem ms frå skyvar til
måltal — tolv gonger raskare enn den nest raskaste motoren, av di det
ikkje er noko å byggje.

**Prøvd.** Kontraktprøva: alle held kontrakten. Terningen over 200 kast
(`scripts/terning.ts`): 100 % av kasta held dei harde reglane, 84 % held alle (resten er `plate` under 40 %,
altså den nedre kvartilen regelen er sett til å merke). Posane: alle fem
refunderte mot ein søkjar med mjuk skråning på dei to geometriske harde
reglane — lenestolen, pinnen, benken, spriket, tavla, frå 3,3 til 5,5 kg,
alle innanfor kuben og alle med lovleg sitjehøgd.

### 22 · LAFT bygd om: krysset, og spor som vert REKNA — GJORD

**Kvifor.** Referansefotoa vart lesne på nytt, og av tre uavhengige
lesingar sa alle tre det same: understellet i desse stolane er ikkje to
sidevegger. Det er to blad i kvar sitt loddrette plan som KRYSSAR
kvarandre midt under setet. Provet står i fotoa: fire føter i fire
kvadrantar og ikkje parvis langs to sider, ein utvitydig X i silhuetten,
det eine bladet som forsvinn bak det andre i krysset og kjem ut att på
andre sida, og to eksploderte beindelar som ikkje er spegelbilete av
kvarandre. Fyrste utkastet hadde to parallelle sidevegger. Det er ein
annan stol.

**Og so var det ikkje eit møbel.** Ei ny prøve — `scripts/laft-ledd.ts`,
som legg eit punktskyv gjennom godset i kvar plate og spør om to plater
deler eitt einaste punkt — felte fyrste utkastet fullstendig:

| ledd | delt materiale |
|---|---|
| sete × rygg | 17,8 cm³ |
| bein × rygg | 13,6 cm³ × 2 |
| sete × kile | 3,9 cm³ |
| rygg × kile | 2,2 cm³ |
| sete × bein | 0,8 cm³ × 2 |

Setet og beinblada skar tvers gjennom kvarandre i 356 millimeter. Dei låg
ikkje oppå kvarandre; dei var inne i kvarandre. På skjermen såg det heilt
fint ut — overlappande faste legeme rendrar utmerkt — og det er heile
grunnen til at prøva måtte skrivast.

**Rota: spor som vert TEIKNA.** Eit spor er ikkje eit rektangel ein
skriv opp av platetjukna. Det er SKUGGEN av den delen som skal gjennom,
kasta ned i verten sitt plan og sveipa gjennom heile tjukna hans. Ei
plate som lener seg tjueto grader gjennom eit sete på femten millimeter
flyttar seg seks millimeter sidelengs medan ho passerer; eit spor rekna
som «tjukn pluss klaring» er då seks millimeter for smalt. `lib/laft/spor.ts`
reknar no kvart einaste spor av gjesten, og ramma ligg langs
SKJERINGSLINA mellom dei to plana — ein akseparallell boks kring ein tapp
som står i trettini grader vert fem gonger så stor som leddet treng, midt
i den flata ein sit på.

Same feilen dukka opp att i krysshalvinga med eit ekstra ledd: naboen si
tilsynelatande tjukn i eit skrått plan er ikkje t/sin(2φ), men
t·(1 + |cos 2φ|)/sin(2φ) — plata si eiga tjukn sveipar òg. Utan det leddet
delte dei to blada ei flis materiale heile overlappet gjennom.

**Etter.** Null delt materiale mellom alle fem platene, målt med 1,4 mm
rutenett og 0,35 mm kontaktmargin — og kvart ledd grip verkeleg: prøva
stadfester at kvar del går TVERS GJENNOM den ho skal gripe i.

**Fire ting til som auget ikkje ser.** Trekantar utan areal i
øyreklippinga gav dobbelt gjennomgåtte kantar; tjuefem lause hòl-ringar
sydde inn i eitt omriss fekk trianguleringa til å kollapse, so setet vart
fullt av trekantar som vende feil veg (spor og avlasting er no ÉIN
kuttbane); ei vassrett skulder på ryggen gav fire punkt på line, og der
vart lokket og veggen usamde om kvar kanten går; og bladet sin overkant
gjekk i full høgd heilt ut til foten, so han las som ein vegg og ikkje som
eit bein — no fell han frå SKULDRA, og skuldra er ein skyvar med ein pris
lastmodellen tel.

**Variasjonen.** Seteplanet er éi likning over tre formspråk:
superellipsen gjev hjørna (eksponent to er ellipsen, tolv er rektangelet),
kilen gjer framkanten breiare enn bakkanten, og BUKTA skyv bakkanten fram
— det er halvmånen, og det er den einaste skilnaden mellom eit skjold og
ein sigd. Hòlet i bladet glir frå trekant gjennom drope til boge på same
viset. Parameterrommet er 28 skyvarar; kvart av dei tre formspråka i
referansane er eitt punkt i det.

**Lastmodellen skifta form med konstruksjonen.** Eit kryss under setet
gjer bjelkemodellen feil: setet ligg ikkje på to opplegg med noko
imellom, det ligg på to LINJER som skjer kvarandre og deler flata i fire
trekantar, kvar fri ute i hjørnet sitt. Då er det éin storleik som styrer
alt — avstanden frå lastpunktet til næraste arm — og lastkartet fargar
etter den avstanden.

**Kuben, ærleg.** Referansane er kring åtte hundre millimeter høge. Med
lovleg sitjehøgd er det knapt hundre og førti millimeter att til rygg i
ein halvmeterskube, og då er ryggen ei LIST og ikkje ein rygg. Det harde
bandet for sitjehøgda går no ned til 330 — loungehøgd — so rommet HAR den
låge, høgryggja stolen i seg; arbeidshøgda står att som ein mjuk regel som
seier kva ein har byta bort. Standardobjektet ligg i arbeidsbandet.

### 23 · Leddprøva over HEILE rommet, og fem posar som er fem stolar — GJORD

**Kvifor.** Leddprøva i etappe 22 målte eitt punkt: standardobjektet.
Eit ledd som held der seier ingen ting om dei andre, av di sporet er
rekna av gjesten og difor følgjer geometrien når ho endrar seg — men kva
som RØRER kva endrar seg òg. `scripts/laft-sveip.ts` køyrer same prøva på
kvar kuratert pose og eit sveip av terningkast. Fyrste køyringa: **elleve
av trettiseks punkt hadde brote geometri**, verste med 77 cm³ delt
materiale. Standardobjektet var eitt av dei fem som heldt.

**Fem feil, kvar med si årsak.**

1. *Tunga rekna med tangens.* Avstanden frå midtlina til eit bladplan er
   |x|·SIN(φ), den vinkelrette avstanden — ikkje |x|·tan(φ), som måler
   langs ein akse. Tangenten gjev tretti prosent for mykje rom, og med
   delt rygg gjorde han det dobbelt.
2. *Tunga gjekk dit det ikkje var rom.* Kryssarmane konvergerer mot
   midtlina, og ei tunge som lener seg framover medan ho fell rekk til
   slutt inn til krysset der rommet er null. Tunga følgjer no ARMANE med
   fast klaring, og djupna vert LØYST og ikkje bede om — `tunge` er eit
   ønske, geometrien har siste ordet, og regelen melder kva ho vart.
3. *Halveringa gjekk feil veg.* Løysinga av djupna starta markøren på den
   djupe sida i staden for den grunne, so han krøyp mot null uansett kor
   mykje rom det var: kvar einaste tunge vart seks millimeter.
4. *Ein kile i midtplanet med delt rygg.* To tunger står kvar for seg i
   kilerommet med ei glipe imellom, og éin kile i midten går gjennom
   glipa og ikkje gjennom nokon av dei. Kvar tunge har no sin eigen kile
   — kontrastkilen er ikkje eitt merke i møbelet, men to.
5. *Ein tapp som snudde seg.* Den bakre tappen vert kappa framfor ryggen
   so dei to ikkje deler rom i setet. Gjekk grensa forbi tappen si fremre
   ende, vart lo større enn hi: ein baklengs firkant i omrisset, som
   filteret som lagar sporet slepte gjennom null punkt av — plata full av
   materiale ingen hadde bedt om, og det såg ut som ein tapp.

**Og ei sjette som ikkje var i geometrien.** Ei tidlegare redigering i
same fila hadde fjerna heile den runda toppen på ryggen. `ryggtopp` gjorde
ingen ting, kvar rygg var flat, og ingen prøve fanga det opp, av di ei
flat plate er like lovleg som ei runda. Han er attende — og då sprengde to
posar kuben, av di dei no vart så høge som tala deira sa.

**Etter: alle 46 punkta held ledda.** Fem posar, førti terningkast og
standarden, null delt materiale, og kvar del i inngrep med den ho skal
gripe i.

**Posane var fem variantar av same stol.** `scripts/laft-avstand.ts` måler
avstanden mellom to posar i dei sytten parametrane som verkeleg formar,
kvar normalisert mot sitt eige band. Det som tel er MINSTEAVSTANDEN: eit
sett med fire vidt ulike og to som liknar, er eit sett med fem der to er
den same. Det gamle settet låg på 0,19 — og fire av dei fem hadde
sitjehøgd mellom 380 og 381.

Det nye settet ligg på **0,408**, og det er fem stolar:

| pose | kva han er | kva som skil han |
|---|---|---|
| **månen** | sigden — bakkanten buar 102 mm FRAM, so plata legg seg kring hoftene | einaste sigden, og han er KANTETE: sigd og rektangel på ein gong. Smalaste bladet, og det einaste fotavtrykket som er breiare enn djupt — krysset står på tvers |
| **steinen** | ellipsestol med veggblad, den tunge og stille | alt som kan vera rundt er rundt: sete, hòl og ryggskuldrer. Bladet held full høgd nesten ut til foten, so sida er ei FLATE med ein port i. Djupaste og smalaste fotavtrykk |
| **staken** | arbeidskrakken, 443 mm sitjehøgd | einaste i arbeidsbandet, og einaste som er høgare enn brei. Setet er ein vifte med kilen i taket av bandet. Leninga på 24° er ikkje komfort, ho er BETALING for høgda |
| **tofta** | benken til to, sju delar | einaste med DELT rygg: to stavar, kvar med sitt berehol og sin eigen kile. Reint rektangulært sete, einaste med negativ kile, lågaste og flataste boge med det største hòlet |
| **dvalen** | golvnær lesestol, sete på 336 | ryggen er 220 — taket i bandet — lena 34 grader, og SMAL: han les som ein planke og ikkje eit brett. Frå sida ein skrå strek der dei fire andre står oppreiste |

Sitjehøgda spenner no 336–443 mot 380–381 før, og kvar av dei fem brukar
kuben heilt ut: 488 til 497 millimeter i den bindande retninga.

### 24 · Pakken som objekt, og bladet som fekk ei midje — GJORD

**Kvifor.** Referansane syner noko dei tre fyrste etappane ikkje hadde
teke inn over seg: eit flatpakka møbel har TO former. Den eine er stolen.
Den andre er brettet han kjem som — alle delane nesta inne i eitt
rektangel med runda hjørne, med eit hòl å bera i. Det brettet er
designa, og det var ikkje teikna nokon stad i denne reiskapen.

**Pakken.** `lib/laft/pakke.ts` søkjer fram det minste brettet som tek
alle delane på eitt ark: rasterpakkaren i `lib/nestraster.ts` svarar på om
eit gjeve rektangel held, og resten er binærsøk på arealet. Kortet i
panelet — `arksyn` — syner no PAKKEN og ikkje kuttarket. Kuttarket svarar
på kor mange plater jobben krev, og det talet står framleis i tavla; men
det ein vil SJÅ av eit flatpakka møbel er brettet.

Målt over åtti terningkast: lengste sida mellom 857 og 1068 mm,
utnyttinga mellom 34 og 59 prosent, median 51.

**Hanken vert ikkje teikna, ho vert funnen.** Referansen legg bereholet i
ryggen øvst i pakken, so ein ber pakken etter det same hòlet ein seinare
ber stolen etter. Det krev at pakkaren veit kva ein rygg er, og det gjer
han ikkje. I staden får brettet sitt eige hòl, skore i AVKAPPET: eit
ledig stykke plate nær overkanten, stort nok til ei hand. Det kostar
ingen ting — plata der er skrot same kva. Finn han ikkje eit slikt
stykke, får pakken ingen hank, og den nye mjuke regelen `pakke` seier
frå. Det skjer i elleve av åtti kast: pakkingar so tette at det ikkje er
skrot att å ta i.

**Eit gir, ikkje to.** Fyrste utgåva hadde eit grovt søk til tavla og eit
fint til eksporten, av di det fine kosta to sekund per punkt. Det gav to
ulike svar på same spørsmålet — talet ved sida av biletet skildra eit
anna brett enn biletet, opp mot ein fjerdedel i areal. Ei tavle som ikkje
skildrar biletet ved sida av seg er verre enn ei grov tavle. No er det
eitt søk med fast sideforhold, brukt av begge, og delane vert pakka ein
siste gong TETT inne i brettet som er funne: biletet syner ein bunt og
ikkje eit sprei, og målet er det same i begge endar. Ein pakke som
skifter proporsjon frå skyv til skyv er heller ikkje eit produkt, det er
eit søkeresultat.

**Og so var det pris på det.** Søket er det dyraste i heile motoren, og
måltavla vert rekna på nytt for kvart skyvarslepp. Fyrste målinga:
**143 ms per punkt**, mot fem i etappe 21. To steg minne tok det ned til
**61**: eitt i pakkaren, og eitt i `bygg`, som eit skyvarslepp elles ville
kalla fire gonger — tavla, delelista, reglane og pakkaren spør alle om det
same objektet.

**Midja.** Referansebladene er ikkje A-rammer. Dei er breie under setet,
smale over foten og breie att heilt nede, so auget les to lemmer og ikkje
éi plate. `midje` er eit søkk midt på strekket mellom skuldra og foten,
null i begge endar. Målt på standardobjektet fell godset frå 325 mm på
det breiaste til 97 mm i ankelen og opp att til 129 ved foten; utan midje
går same strekket monotont ned til 129 og har inga innsving i det heile.
Søkket kan aldri eta seg ned i bogen — eit blad som er kutta av på midten
er ikkje ei midje, det er to delar.

Kvar pose fekk si eiga: **steinen 0** — han skal vera ei flate med ein
port i, og det står i forteljinga hans; **dvalen 0,62** — den djupaste,
so beina spriker som på eit insekt; månen 0,5, staken 0,18, tofta 0,12.

**Prisen står i tavla.** Eit blad med innsving tek same bandhøgda og
mindre av bandet, so plateutnyttinga fell fire prosentpoeng: 30 nedst, 37
i midten, 46 på det beste, mot 37/41/50 før. Terskelen i regelen er flytta
frå 37 til 34 og teksta hans seier kvifor.

**Etter:** alle 46 punkta held framleis ledda, terningen gjev 97,5 % på
dei harde, og minsteavstanden mellom posane står i 0,397.

---

### 25 · Pakken er ein stabel, og to spor som låg i lufta — GJORD

**Kvifor.** Fem nye referansebilete. Tre av dei syner den flatpakka
tilstanden, og alle tre syner det same: platene ligg flate mot kvarandre i
ein STABEL som står oppreist på sine eigne føter, med den største delen som
heile silhuetten. Ikkje eitt av bileta syner eit brett med delane nesta ved
sida av kvarandre — som er nettopp det `pakke.ts` frå etappe 24 søkte fram.
Han svara godt på eit spørsmål ingen av referansane stiller.

**Pakken, om att.** Skilnaden er tre ting, og ingen av dei er kosmetisk.

| | brettet (etappe 24) | stabelen (no) |
|---|---|---|
| forma | eit runda rektangel søkt fram kring delane | ingen eiga form — omrisset ER den største delen |
| talet | 925 × 841 mm, 49 % utnytta | 554 × 390 × 75 mm, 100 % utnytta |
| vekta ein ber | 3,9 kg stol + 4,0 kg skrot | 3,9 kg stol |
| grensa | ingen | den SAME kuben som stolen |

**Og då fann pakken noko ingen annan regel såg.** Krysshalvinga gjer det
lengste emnet til heile diagonalen i fotavtrykket — 2·√(fotX² + fotY²) — og
han er per definisjon lenger enn sida i fotavtrykket. Kuberegelen måler den
SAMANSETTE stolen, og `fiks()` klipte fotX og fotY kvar for seg: eit blad på
sju hundre millimeter gjekk rett gjennom. Alle fem posane hadde blad over
500. Ein stol som står i kuben kan altså ha ein pakke som ikkje gjer det, og
motoren sa ikkje frå.

No er det ein hard regel. Ei plate får plass anten beint fram, eller lagd på
skrå: eit rektangel på lengd × tjukn står i eit kvadrat på 500 når lengd +
tjukn ≤ 707. Månen og tofta måtte trekkje føtene inn for å koma i hus, og
det er kryssvinkelen som gjev seg — ikkje setet, som ikkje er skuld i noko
her.

**Hanken var eit hòl for mykje.** Den førre pakkaren skar ei ny hank i
avkappet, endå ryggen alt har ei; eksporten hadde TO. I bileta er hòlet ein
ber pakken etter nøyaktig det same hòlet ein seinare ber stolen etter — same
form, same plass, same del. No vert ho funnen i møbelet og ikkje i skrotet.

**Ei ting stabelen ikkje kan love.** I bileta står kilen driven gjennom heile
bunten og låser han. LAFT sine spor møtest ikkje når platene ligg oppå
kvarandre, so ein slik lås måtte peikast ut og ikkje reknast fram. Han er
ikkje her, og det står i fila.

---

**GODSPRØVA.** `scripts/laft-gods.ts` spør om noko ingen annan prøve fanga:
om eit hòl i det heile ligg inne i den delen det er skore i. Eit spor vert
rekna av gjesten sin skugge, og rekninga bryr seg ikkje om verten har
materiale der. **Elleve av 46 punkt braut.**

To årsaker, båe med same rot: ein KANT vart lesen som eit TAL.

1. *Ryggen stod på bakkanten lese på MIDTLINA.* Bakkanten er ei kurve som
   bøyer seg framover ut mot sidene, og ryggen er brei. På eit ellipseforma
   sete stod sporet hundre millimeter bak sin eigen kant, med 55 prosent av
   seg utanfor plata — ein rygg som ikkje er festa i noko. Stillinga og
   breidda vert no LØYSTE mot kurva. Fyrste forsøket las ytterkanten og
   braut sigden, som har hornene bak og bukta tom imellom; no vert det
   samanhengande godset kring midtlina målt, eit heilt gods bak sporet si
   eiga bakkant.
2. *Bereholet stod på eit tal ned frå toppen.* Er toppen runda, smalnar plata
   nettopp der, og kapselen braut ut gjennom hjørnet — verst med kanten éin
   millimeter UTANFOR plata. Både høgda og lengda vert no løyste mot den same
   toppkurva plata er teikna med.

Terskelane i prøva er **målte og ikkje sette**: alt som er meint å vera der
ligg mellom 91 og 100 prosent inne, og den trongaste staden i heile
konstruksjonen er kilesporet mot enden av tunga — 7,6 mm, som fell ut av to
reglar som alt finst.

**`lib/laft/seteplan.ts`** er skild ut av éin grunn: reparasjonen i
`params.ts` må rekne det same som geometrien. Gjorde ho ikkje det, klipte ho
mot ein stol som ikkje finst — og det var akkurat det som hende fyrst, då
tunga rann tom på tre prosent av terningen utan at nokon sa frå.

---

**PORTEN.** Bogen mellom føtene er den lengste samanhengande kurva i heile
silhuetten, og eksponenten hans stod på eit hardkoda tal. Han er heile
formspråket: éin er ein rein V med spissen i taket, to og eit halvt er ein
romansk boge, fem er gotisk — smal og høg, med beina som to skaft.
Referansane spenner over alle tre.

Posane fekk kvar sin: staken 1,0 (V), tofta 1,6, standard 2,2, steinen 2,6
(halvsirkelen), dvalen 3,4, månen 4,4 (gotisk). Prisen står i tavla som
alltid — plateutnyttinga fell eitt prosentpoeng til, av di eit meir utskore
blad tek same bandhøgda og mindre av bandet — og terskelen er flytta med
etter måling, ikkje etter skjøn.

**Etter:** 46 av 46 punkt har gods kring kvart hòl, alle 46 held ledda,
terningen gjev 98,5 % på dei harde og 95 % på alle (mot 97,5 og 74 før
etappen), og minsteavstanden mellom posane står i 0,389.

**Att, og medvite ikkje gjort.** Referansane har tre ting til som ikkje er
skyvarar men ANDRE STOLAR, og som difor står som val og ikkje som manglar:
klemleddet (ein tapp tvers gjennom med kile på utsida som DREG, i staden for
spor som losjerer), ryggen-som-bakbein (som fjernar krysshalvinga heilt), og
det delte bladet som møtest ende mot ende på midten — den einaste av
referansane som får pakken inn i kuben utan å ofre fotavtrykket.

---

### 26 · VIKING: den sjette typologien, og eit mål på kva ein typologi ER — GJORD

**Kvifor.** «Viking og laft bør vera ulike.» Det finst ingen viking i
repoet, so spørsmålet var eigentleg: kva rom er ledig?

**Kartet fyrst.** Fem lesarar gjekk gjennom kvar sin motor og svara på kva
han KAN og ikkje kan. Den skarpaste lina kom frå SKIVE: «det SKIVE ikkje
kan gje og som framleis ikkje er teke: ei LUKKA sitjeflate av flate
plater» — og grunnen står i same lesinga: i alle dei fire snittande
motorane **sit du på plata sin KANT**. Sju til tjueein tverrskorne
finérkantar under låret. LAFT lét deg sitje på flata, men flata er flat.

|  | du sit på KANTEN | du sit på FLATA |
|---|---|---|
| **krum flate** | vaffel · skive · straum · ribbe | **VIKING** |
| **flat flate** | — | laft |

**Klinkbygging fyller ruta.** Eit klinkbygd skrog er krumt utan at eit
einaste bord er krumt: kvart bord er ei flat stripe, og krumminga bur i
VINKELEN MELLOM DEI. Borda overlappar i lappen i staden for å møtast kant
i kant i eit spor, og skalet vert ei lukka flate ein kan leggje handa på.
Delelista er n bord, to spant og n−1 naglar.

**Prøva før bygginga.** `scripts/typologi-avstand.ts` vart skriven fyrst,
og ho prøver ein påstand `lib/engines.ts` har hatt heile tida utan at han
kunne målast: at dei fem ER fem typologiar. Motorane deler ikkje ein
einaste parameter, so det som kan samanliknast er det ferdige objektet —
skuggen på dei tre sideflatene i kuben, og delelista. Terskelen er ikkje
sett, han er målt: den likaste paringa mellom dei fem i nedtrekket er
**straum–ribbe på 0,635**, og det er baren ein sjette må halde seg under.

**Og ho beit med ein gong.** Fyrste VIKING landa på **0,650 mot RIBBE** —
over baren. Ikkje på skuggen (0,57), men på DELELISTA: 27 delar à 289 cm²
mot RIBBE sine 34 à 331. Årsaka var seksten bitte små naglar, to i kvar
lapp, og dei var dessutan eit dårleg flatpakkeval. Éin nagle i kvar lapp,
midt mellom spanta der han faktisk gjer arbeidet, tok delelista til 17 og
avstanden til **0,573**. Mot LAFT ligg han på **0,40** — godt klar.

**Tre kasta konstruksjonar undervegs**, alle av same slaget: eit tal som
skulle vore ei måling.

1. *Profilen sett som x og z i tre soner.* Rette mål, men sonene møttest
   med kvar sin tangent, og eit knekk på hundre grader hamna midt i eit
   bord. Ein hundre graders lapp er ikkje klink, det er eit hjørne.
2. *Profilen bygd av tangentvinkelen og skalert etterpå.* Glatt kurve, men
   skaleringa kopla alt til alt: ei skål på 44 mm gav ei leppe på 270, og
   reparasjonen jaga eit mål som flytta seg medan ho sikta. No er det fem
   punkt i millimeter og ein sentripetal spline gjennom dei.
3. *Skroget som nådde golvet.* Spant og skrog slost om å vera bein, so
   spantomrisset skar seg sjølv. Ein båt står ikkje på stamnen — han ligg
   i ei krybbe. Skalet er no berre skalet, og spanta ber det.

**Reparasjonen las to gonger feil, og begge gongene av same grunn:** ho
rekna ei formel der geometrien løyser noko. Høgda kjem av ei kurve som
vert skalert etter kvar ein sit; eit anslag bommar med tretti millimeter.
No les `fiks()` `skrogMaal()`, akkurat som LAFT no les `ryggPlass()`.

**Typologien sitt eige dilemma står i tavla.** Den same vinkelen som gjev
krumminga opnar ei GLIPE i lappen — `lapp · sin(vinkel)` — og ei opning
mellom fem og tjuefem millimeter tek ein finger. Målt over terningen ligg
lappevinkelen mellom 18 og 73 grader. Det finst to vegar ut og båe kostar:
fleire bord lukkar glipa, eller ein DJUPARE lapp gjer henne så brei at ho
ikkje er ei klemme. Rekninga seier at den andre er den brukande, og at ho
krev FÅ bord — fem til ni — som er nettopp det ein færing har. VIKING er
den einaste motoren der talet på delar er eit komfortval, og regelen slår
ut på tretti prosent av terningen med vilje.

**To filer flytta ut av lib/laft/.** `spor.ts` → `lib/plater.ts` og
prismenettet → `lib/platemesh.ts`. Ingen av dei visste kva dei teikna;
begge vert no lesne av to motorar, og øyreklippinga, hòlbrua og
veggnormalane skal skrivast éin gong. `reinsk()` fylgde med, og VIKING
trong henne straks: utan henne hadde skalet 82 kantar som ikkje lukka seg.

**Etter:** alle seks motorane held kontrakten, alle fem posane held alle
reglane, terningen gjev 96,5 % på dei harde, og VIKING står 0,573 frå den
næraste naboen sin mot ein bar på 0,635.

**Att.** Ein av dei tre framlegga i verkstaden foreslo noko betre enn det
som er bygd: å frese LANDET med fall, so borda ligg heilt inntil kvarandre
og glipa forsvinn heilt. Det krev eit skrått kutt og ikkje eit flatt, og
det er eit anna produksjonsvedtak enn resten av sandkassen gjer — men det
er den rette løysinga på klemfaren, og ho står att. Det same gjer SAUM:
fasettar butta kant i kant og SYDDE saman, utan spant og utan spor.

---

### 27 · LAFT og SKIVE ut, og VAFFEL som sluttprodukt — GJORD

**Kvifor.** Nedtrekket hadde fem, og fem er ikkje eit argument — det er
ei meny. LAFT svara aldri på spørsmålet sandkassen stiller; han NEKTA
det, og ei flat sitjeflate er eit anna prosjekt med ei anna grunngjeving.
SKIVE snitta berre éin veg, og det er den fattigaste av snittstrategiane:
alt han kunne seie om ei krum flate, seier VAFFEL og RIBBE betre, og han
kunne ikkje seie noko dei ikkje kan. Tre står att, og dei er tre ulike
svar: kartesisk kryssholdt (VAFFEL), skrått gjennomspor (STRAUM), radialt
kryssholdt (RIBBE).

**VAFFEL er sluttproduktet.** Det er ikkje ein preferanse lenger, det er
kva resten av arbeidet skal tene. STRAUM og RIBBE står som argumentet
kring valet.

**Kva som vart gjort.** `lib/laft/` og `lib/skive/` er sletta, med dei
fire LAFT-prøveskripta. `EngineId` mista to ledd, registeret to
motorar, `scripts/nesting.ts` sin SKIVE-arm og `scripts/typologi-avstand.ts`
sitt nedtrekkssett er retta.

**Hashen.** `lib/hash.ts` seier at rekkjefylgjene er FROSNE, og det står
ved lag. SKIVE og LAFT rakk å få kvar sin bokstav — «k» og «f» — og dei
to bokstavane er no BRENDE: dei står i kommentaren og skal aldri gjevast
til ein ny motor. Ei gammal SKIVE- eller LAFT-lenkje avkodar difor til
INGENTING i staden for til feil møbel. Det er den ærlege oppførselen når
motoren bak lenkja er borte.

**Att: lib/plater.ts og lib/platemesh.ts.** Begge låg under `lib/laft/`
til VIKING vart bygd og dei vart flytta ut. Dei står att av di dei aldri
var LAFT — dei kan ikkje namnet på ein einaste del — og VIKING byggjer
på dei.

**Prøvd:** kontraktprøva grøn på alle fem motorane som står att,
poseprøva grøn på alle posar, `npm run build` grøn, `npx tsc --noEmit`
rein.

### 28 · Formspennet: fire nye aksar, og kuben som svara nei — GJORD

Ni referansekrakkar i papp og kryssfiner, alle bygde av flate plater som
møtest i kryss. Spørsmålet var ikkje om dei var fine. Det var om dei let
seg nå frå VAFFEL eller RIBBE ved å SKRU — og der dei ikkje gjer det, om
det manglar ein akse eller om referansen er ein annan typologi.

**Åtte av ni er nådde. Den niande er ikkje ein manglande akse; han er ei
anna oppgåve.**

**Fire nye aksar, og ikkje ein einaste ny del.** Kvar av dei fire fell ut
av geometrien som alt stod der — dei skriv seg inn i feltet og i leddet,
ikkje ved sida av dei:

| akse | motor | kva han gjer |
|---|---|---|
| `ryggfall` | VAFFEL | over setekanten sig planet BAKOVER i staden for framover. Ryggen vert noko ein kan lene seg i og ikkje ein vegg |
| `skålkant` | VAFFEL | kanten stig kring HEILE setet. Ribbeprofilen vert ein U i staden for ein boge — og det er heile pod-forma, utan ei einaste ny line i `ribs.ts` |
| `bladtupp` | RIBBE | bladet sluttar ikkje der skalet gjer. Silhuetten vert teikna av tjueåtte frie tunger i staden for av éin jamn kontur |
| `leddeling` | RIBBE | kvar i overlappen mellom band og blad delinga ligg. Halvt om halvt er rett for ein RING; for ei HYLLE er det å kappe bladet med sitt eige ledd |

`rygg` gjekk frå 70 til 136 mm og `bandbreidd` frå 70 til 260 mm. Over
ringen sin eigen radius er bandet ikkje ein ring lenger, men ei plate med
eit nav att i midten — same delen, same leddet, berre breiare.

**Sju nye posar, alle prøvde gjennom heile kjeda med null brot:**

| referansen | posen | kva han vart |
|---|---|---|
| radial vifte med ringar over setet | RIBBE `vifta` | 28 tunger, øvste ringen so høgt han KAN stå — sjå funnet under |
| timeglaskrakk | RIBBE `timeglas` | stod alt |
| pod med langsgåande ribber | VAFFEL `skåla` | skålkant 84 mm, U-profil heile vegen rundt |
| eggekasse med rett, flutet rygg | VAFFEL `ryggstolen` | rygg 92 mm, fall 18° |
| bladvifte med frie, avrunda tuppar | RIBBE `bladet` | 14 breie blad, tupp 44 mm, hjørneradius 14 |
| vogge | — | **ikkje nådd** |
| lenestol: éin skål frå fot til rygg | VAFFEL `lenestolen` | rygg OG skålkant saman |
| enkel eggekasse 4 × 4 | VAFFEL `eggekassa` | 8 delar, **66 % av arket** — det beste talet i heile settet |
| dreia søyle med hyller | RIBBE `hyllesøyla` | band på 200 mm: plater med eit nav på 44 att |

#### Funnet: det er KUBEN som seier nei til ryggen, ikkje motoren

Dette er det ærlegaste svaret runda gav, og det var ikkje det eg venta.

Setehøgda skal liggja i 380–480 mm (NS-EN 1729), og taket i kuben er 486.
Det som er ATT over setekanten er difor 486 − 380 = **106 millimeter i
beste fall** — og då sit ein på det aller lågaste som er lov. Referansane
har ryggar på fire og fem hundre millimeter. Dei er ikkje utanfor VAFFEL;
dei er utanfor OPPGÅVA. `rygg` går til 136 av di reparasjonen skal ha noko
å ta av, men over kring hundre finst det ingen setehøgd att å setje han i.

Det er ikkje ei avgrensing å rette. Det er kva ein kube på 500 millimeter
BETYR, og det er verdt ei side i mappa: ein stol med rygg og ein kube på
500 er to krav som et kvarandre, og prosjektet må velja kva `rygg` er —
eit ryggstø, eller ei markering av at det finst ein bakside.

#### Att, og kvifor

**Vogga.** Krum understøtte i staden for føter. Feltet toler det — golvet
er berre `z − arch(x, y)` og kunne like godt vore ein sylinder — men tre
harde reglar les fotavtrykket som ei FLATE: støtteflata, talet på skilde
kontaktflater og veltevinkelen. Ei vogge har LINEKONTAKT og veltar med
vilje. Å byggje henne er ikkje å leggje til ein akse; det er å svare på
kva NS-EN 1022 tyder for eit møbel som skal røre seg. Det er eit eige
stykke arbeid, og det skal ikkje gøymast som ein skyvar.

**Ringar over setet i RIBBE.** `vifta` når referansen sine tuppar, men
ikkje ringane hans: blada sluttar under setet (`zBlade = seatZ − seatT`),
so eit band over setekanten har ingenting å gripe i. Det krev at bladet
held fram OVER setet i ein sektor — same tanken som VAFFEL sin rygg, men
i RIBBE sitt koordinat, og det rører `blade`, `band`, `seat`, nettet,
kuttarket og alle fire eksportane. Ein akse, ikkje ein parameter.

**Skåla si innoverkrumming.** Skålkanten stig, men han krøkjer seg ikkje
INN på toppen slik eit egg gjer. Over setekanten står planet stille
(`rho` er klemd til [0,1]), og eit ledd som let han halde fram å smalne
er billeg — men det er òg det som skil ei skål frå ei tønne, so det skal
prøvast mot referansane og ikkje berre leggjast til.

#### Baren held

`scripts/typologi-avstand.ts` etter runda: den likaste paringa i
nedtrekket er framleis straum–ribbe på **0,635**, og vaffel–ribbe ligg på
0,49. Dei fire nye aksane har altso ikkje drege VAFFEL og RIBBE mot
kvarandre — dei har flytt dei kvar sin veg, og det var poenget med å ha
begge.

#### Lenkjene, som er den eine tilstanden som ikkje kan rettast

Nye band flyttar kvart einaste siffer i nyttelasta. VAFFEL og RIBBE fekk
difor kvar sin nye bokstav — store **V** og **R** — og dei gamle, små
`v` og `r`, les framleis dei gamle lenkjene gjennom `GAMLE_BAND` i
`lib/hash.ts`. Ei lenkje som er delt skal peike på det møbelet ho vart
delt av, og aldri på eit anna.

`scripts/lenkjer.ts` er ny og vaktar det: fire ekte v1-hashar med fasit,
pluss rundgang på det som står i dag. Han er den einaste prøva som ser på
tilstand som lever UTANFOR koden.

**Prøvd:** kontraktprøva grøn på alle fem motorar, poseprøva grøn på alle
22 posar, lenkjeprøva grøn, terningen 96,6 % (vaffel) og 98,6 % (ribbe) på
dei harde, `npm run build` grøn, `npx tsc --noEmit` rein.

---

### 29 · Pakkinga: eit tal å optimere mot, og eit løfte å halde — GJORD

**Kvifor.** «Betre nesting» var ei kjensle og ikkje eit tal. `scripts/
nesting.ts` målte standardobjektet i kvar motor — eitt punkt per motor —
og eit punkt kan ein flytte utan å flytte pakkinga. Fyrste steget var
difor ikkje ei betring; det var ein BENK.

**`scripts/nestbenk.ts`** pakkar kvart einaste punkt i settet — standard
pluss alle posane, 32 delelister i dag — i båe modusane pakkaren har, og
melder middelet, det verste, arktalet og tida. Talet som tel er snittet:
eit tillegg som lyfter snittet og ikkje senkar det verste er ei betring,
alt anna er ei omfordeling.

Utgangspunktet, målt: **levande 46,3 %**, **tett 49,1 %**, 42 ark.

**Og so det som ikkje er eit tal.** Benken måler dessutan LUFTA: avstanden
mellom kvar del og kvar annan del på same arket, kant mot kant. Det er
det einaste løftet pakkaren gjev — åtte millimeter, som er fresen pluss
monn — og ingen prøve hadde halde auge med det. Grunnen til at det er
farleg er at det ikkje syner seg i utnyttinga: **ei pakking som lèt
delane gå inn i kvarandre får BETRE tal.** Ein feil der les som ei
forbetring heilt til nokon kuttar plata.

#### Fire framlegg, tre forkasta

| framlegg | kva han gav | dom |
|---|---|---|
| kontaktval: mellom plasseringar som ikkje gjer stripa lengre, ta den som ligg tettast inntil naboane | +0,1 pp, 15 % meir tid | **ut** — innanfor støyen |
| finare rastercelle i levande modus (6 → 4) | +1,5 pp, 3 × tida | **ut** — verste kastet går frå 59 til 170 ms, og avlen sitt tak er 80 |
| ommerke maskene i staden for å rasterisere kvar stilling | 22 % raskare | **ut** — og det er den viktige: sjå under |
| spegla stillingar i eksporten (fire → åtte) | +0,5 pp, ~2 × tida | **inn** — eksporten skjer éin gong |

**Ommerkinga, og kva benken fanga.** Ei kvart omdreiing flyttar vel celler
til celler? Nei — ikkje når boksen ikkje er eit heilt tal celler høg. Då
straddar ei rotert celle TO celler i det nye rutenettet, og ommerkinga
lèt den eine stå tom. Maska vart 22 % billegare og la delar **6,1 mm frå
kvarandre der kravet er 8**. Utnyttingstalet gjekk OPP. Utan luftprøva
hadde det stått som ei forbetring i denne tabellen.

Kvar stilling rasteriserer difor sitt eige polygon, og speglinga vert
rekna inn i POLYGONET og ikkje i cellene etterpå.

**Spegling er lovleg her,** og det er verdt å skrive ned kvifor: kvart
einaste snitt i sandkassen går heilt gjennom plata — spor, hòl,
avlasting, mortis — og båe sidene av ei finérplate er finér. Ein spegla
del, snudd om på bordet, ER den opphavlege delen. Fyrste dagen ein motor
får eit snitt som ikkje går gjennom — ei lomme, ein fas, ein halvdjup
fals — sluttar dette å halda.

**Etter:** levande **46,3 %** (uendra, som det skal vera — ingenting i den
vegen vart rørt), tett **49,6 %**, 41 ark. Minste målte luft: 12,00 mm med
cella på 6, 8,00 mm med cella på 4.

#### Funnet: garantien er tett, og cella på 4 ligg på grensa

Provet seier at to masker som ikkje deler celle ligg minst 2·cell frå
kvarandre. Benken måler nøyaktig det: 12,00 og 8,00. Cella på 4 med luft
på 8 har altso INGEN monn — ho ligg på grensa provet set. Går cella
lågare utan at `gap` fylgjer med, held ikkje lufta, og feilen vil sjå ut
som betre utnytting.

#### Att

**Skanninga, ikkje maskene.** Tida ligg i `fits` over rutenettet og ikkje
i å byggje maskene — det er difor ommerkinga berre gav 22 %. Ein pakkar
som skal ha råd til cella på 4 i levande modus må gjera SØKET billegare,
ikkje maska. Ei skyline-avgrensing er det vanlege svaret, men ho kan ikkje
leggje ein del ned i ei LOMME under kanten, og det er nettopp lommene
denne pakkaren lever av: hòlet i ein ring er ledig plate.

**Taket er ikkje pakkaren.** Delane er berre 50–67 % av sine eigne
omskrivne boksar (vaffel 66,6, straum 52,0, ribbe 49,9). RIBBE pakkar til
47–49 % og ligg altso på 96 % av det ei rein boks-pakking kunne gjeve —
han grip alt inn i seg sjølv. Rommet som er att ligg i VAFFEL og STRAUM,
og det ligg i FORMA på delane like mykje som i pakkinga av dei.

---

### 30 · SKIVE attende, og ei dør inn utanfrå — GJORD

#### SKIVE var feil å ta ut

Argumentet i etappe 27 var at han berre snittar éin veg og at VAFFEL og
RIBBE seier alt han kan seie. Det var feil, og det tok ni referansekrakkar
å sjå det: **éi retning er ikkje ein fattigare versjon av to — det er ein
ANNAN ting.** Ei skive treng ikkje møte nokon på tvers, og då er heile
konturen hennar fri. Ei kryssholdt ribbe har eit spor kvar ho kryssar ein
nabo og må ha gods kring kvart av dei; ei skive kan vera kva form som
helst. Det er difor mest kvar einaste papp- og finérkrakk i verda er
skiver, og ein sandkasse som ikkje kan lage dei manglar ikkje ein pose —
han manglar eit svar.

`lib/skive/` er henta uendra ut av historia. Banda hans er BIT-IDENTISKE
med dei han gjekk ut med, og difor får han bokstaven «k» attende i staden
for ein ny: ei SKIVE-lenkje frå før utgangen peikar på det same møbelet no
som ho gjorde då. `scripts/lenkjer.ts` provar det med ein hash laga med
koden slik han stod FØR utgangen — hadde eitt einaste band vore rørt i
mellomtida, hadde den rada slege ut og han måtte hatt ein ny bokstav.

Fire i nedtrekket att: VAFFEL, SKIVE, STRAUM, RIBBE.

#### GJEST: ei GLB inn, ei kuttliste ut

`lib/gjest/` er ikkje ein femte typologi. Det er ei anna DØR inn til dei
same delane: eit møbel nokon andre har teikna, snitta i to ribbefamiliar
med det same kryssholdte leddet, pakka med den same pakkaren og med det
same luftkravet.

| fil | kva |
|---|---|
| `glb.ts` | GLB → trekantar. Handskriven, utan bibliotek: tolv byte hovud, ein JSON-bit og ein binærbit. Køyrer uendra i noden, i nettlesaren og i workeren, og dreg ikkje inn ein loader som vil ha eit DOM |
| `skjer.ts` | plansnitt gjennom trekantsuppa, kjeda til lukka konturar |
| `vev.ts` | to ribbefamiliar, overlappa lesne ut av båe konturane, og spora skorne |

**Kjedinga.** Kvar trekant som kryssar planet gjev eitt linestykke, og
endane skal møtast — men dei er REKNA punkt, kvart frå si eiga
interpolasjon, so dei er aldri bit-like. Endane vert difor kvantiserte til
eit rutenett før dei vert slegne saman, og ruta er relativ til objektet og
ikkje ein konstant.

**Ein mesh som ikkje er lukka** gjev opne kjeder. Dei vert ikkje kasta,
dei vert lukka med ei rett line, og TALET vert meldt. Ein brukar som
importerer eit skal utan botn skal få eit møbel og ei melding, ikkje ein
tom skjerm.

**Sporet er ein KANAL og ikkje eit hakk.** Konturen som før gjekk rett
over sporet skal gå ned den eine sporveggen, langs botnen og opp den
andre. Fyrste utgåva klemte punkta inn til sporranda i staden, og det gav
ei BULK — ein del som ikkje går ned over naboen sin. Ho såg rett ut på
arket, og det er nettopp difor ho stod ei runde: `scripts/gjest.ts` melder
no om ein kontur kryssar seg sjølv, av di ein slik kontur pakkar FINT
(arealet vert rekna som om han var enkel) og les som ein billeg del.

Krysstestet måtte dessutan reknast om: eit rått kryssprodukt er eit AREAL,
so han er null når eit punkt tilfeldigvis ligg på den uendelege lina
gjennom eit segment langt vekke. Ein rotasjonsflate gjev slike samanfall
heile tida. Delt på segmentlengda er talet ein avstand i millimeter, og då
tyder terskelen noko.

**Målt** på ei skål med 3 200 trekantar, passa inn til 470 mm:

| ribber | ledd | plate | utnytting |
|---|---|---|---|
| 7 × 7 | 45 | 1 | 55,7 % |
| 9 × 9 | 69 | 1 | 60,5 % |
| 13 × 13 | 149 | 1 | 65,6 % |

Snittet tek 23–43 ms. Alle konturane er enkle i alle fire oppsetta som
vart prøvde.

#### Og eit funn om pakkinga

**GJEST pakkar betre enn motorane i sandkassen.** 60–66 % mot 46–50 %.
Det er ikkje ein betre pakkar — det er den SAME pakkaren — og det seier
difor noko om delane: ei skålribbe er brei og nesten konveks, medan ei
vaffelribbe er lang, smal og bogeforma med ei stor opning under. Det
stadfester det etappe 29 fann frå ein annan kant: **taket er ikkje
pakkaren, det er forma på delane.** Vil ein ha arket betre utnytta, er
det bogen og ikkje bin-packinga ein skal sjå på.

#### Att

**Grensesnittet.** Kjeda er prøvd frå fil til kuttark på kommandolina,
men GLB-en er ikkje kopla til appen enno. Det er ikkje berre eit
filfelt: ein mesh er DATA og ikkje eit punkt i eit parameterrom, so han
kan ikkje kodast i hashen. Ei delt GJEST-lenkje kan bera nX, nY, tjukna
og målet — men ikkje forma. Det må stå i grensesnittet og ikkje berre i
ein kommentar, elles deler nokon ei lenkje som opnar feil møbel.

---

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
| `scripts/typologi-avstand.ts` | om to motorar er same krakken: skugge på tre sider pluss deleliste |
| `scripts/lenkjer.ts` | om ei delt lenkje framleis peikar på det same møbelet — den einaste prøva som ser på tilstand utanfor koden |
| `scripts/nestbenk.ts` | plateutnyttinga over HEILE settet, i båe pakkemodusane — og lufta mellom kvar del og kvar annan del |
| `scripts/gjest.ts` | ei GLB inn, ei kuttliste ut: snitt, ledd, pakking, kuttark — og om nokon kontur kryssar seg sjølv |
