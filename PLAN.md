# PLAN

Arbeidsdokument for utbygginga av sandkassen. Skriven for éin person med
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

| lag | fil | status |
|---|---|---|
| parameterrom | `params.ts` | 45 tal + materiale, 8 grupper, klemming, deterministisk terning |
| felt | `field.ts` | snitt, ryggrad, vriding, midje, opningar, rim, sete, kubekontroll |
| flate | `surface.ts` | mesh klipt mot feltet, tre detaljnivå |
| lag | `laminae.ts` | vassrette snitt gjennom godset, slipemon, masse |
| stabel | `stack-mesh.ts` | stabelen som mesh og konturkart |
| måling | `metrics.ts` | 32 måltal, alle lesne av geometrien |
| reglar | `rules.ts` | 14 reglar, 4 harde |
| nesting | `nest.ts` | delane på 2500 × 1250 |
| eksport | `export-stl/dxf/svg.ts` | STL, DXF med KUTT og GRAVER, SVG |
| tråd | `worker.ts` | alt som kostar tid, ute av hovudtråden |
| grensesnitt | `studio.tsx`, `viewer.tsx`, `controls-panel.tsx` | tre lesemåtar, skyvarar, tabell, reglar, eksport |
| mappe | `doc/render.py` | 15 sider, eigen rasterisator utan GPU |

Standardobjektet held alle 14 reglane. Det er ikkje det same som at det er
ferdig — sjå etappe 0.

---

## 3 Arkitektur

### 3.1 Kva som er ei rein funksjon av `Params`

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
skyvar i to sekund, står det ein ferdig, forelda bygging i kø for kvar 90
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
| lysriggen i `viewer.tsx` | éin styrbar hovudlampe og to faste, svake; ingen ambient, ingen environment map. Éin hard skugge er det som let ein lesa ei krum flate |
| `frameloop="demand"` | scena teiknar når noko endrar seg, ikkje 60 gonger i sekundet |
| fast orbitmål | golvet flyttar seg aldri; auto-innramminga går berre lenger bak |
| gestane i `gesture-params.tsx` | to fingrar skrur ein parameter, tre styrer lyset og legg kameraet tilbake |
| arket og utvidaren i panelet | draget og klikket deler same knapp |
| prinsippet om hashen | eit design er eit punkt, hashen kodar punktet nøyaktig, og hashen er ikkje til å stole på |

**Kva vi ikkje lånar:** geometri — ikkje ei line. Motorregisteret. Engelsken.

**Kvifor dette er eit eige domene og ikkje ein sjette motor:**

1. **Kontrakten.** Dei fem motorane der oppfyller éin kontrakt:
   `Params → mesh`. Sandkassen sin er `Params → mesh + stabel + 32 måltal +
   14 reglar + nesting + tre eksportformat + ei PDF-mappe`. Ein sjette
   motor måtte anten sprengje registeret eller tvinge dei fem andre til å
   bera felt dei ikkje har bruk for.
2. **Einingar og ei oppgåve.** Dei fem er dimensjonslaus skulptur; det
   einaste verkelege målet der borte er eit lyshaldarhol. Her er kvart tal
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

**Kostnaden, ærleg sagt:** to kopiar av scene, gestar og panel. Ein
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

### 0 · Rydd opp i kva objekt sandkassen faktisk viser

**Kvifor.** SKAL-mappa skildrar 33 lag, 50 delar, 3,9 kg og
460 × 472 × 488 mm. `DEFAULT_PARAMS` gjennom denne motoren gjev 32 lag, 61
delar, 3,38 kg og 488,5 × 415,2 × 480,0 mm. Det er ikkje ein feil i seg
sjølv — den gamle mappa vart rekna av den gamle Python-modellen, og
`sandkasse.pdf` er internt samstemt med koden — men så lenge det ikkje står
nokon stad kva som gjeld, skildrar dei to dokumenta to ulike krakkar. Det
er nett den utakta tesen lovar at ikkje skal skje.

**Kva.** Avgjer og skriv ned: tala frå denne motoren er dei som gjeld, og
SKAL-mappa er eit vitnemål om eit steg. Sjekk òg om `DEFAULT_PARAMS` skal
justerast slik at han faktisk landar på objektet i mappa, eller om mappa
skal reknast som forbi.

**Synleg resultat.** Éi setning i `README.md` som seier kva som er
gjeldande, og eit `sandkasse.pdf` ingen treng lese med to sett tal i hovudet.

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

### 2 · Tal fyrst, mesh etterpå

**Kvifor.** Tabellen ventar på eit mesh han ikkje les. Etter etappe 1 er
tal-delen 142 ms av ei runde som elles er 1 450.

**Kva.** To svar per førespurnad: `tal` (måling, reglar, stabelstatistikk),
så `mesh`. Panelet merkar seg sjølv som førebels medan meshet er undervegs.
Same melding får generasjonsteljaren som let arbeidaren droppe ei forelda
bygging mellom fasane.

**Synleg resultat.** Tabellen skiftar om lag 250 ms etter at skyvaren
slepper, òg på `hog`.

### 3 · Grov stabel medan fingeren er nede

**Kvifor.** `buildStack` med `nth = 360` kostar 583 ms; med 120 kostar han
198 ms, og massen skil 1,2 % (5,121 mot 5,184 kg). Under eit drag er 1,2 %
ingen ting; i eit kuttark er det alt.

**Kva.** `nth = 120` medan skyvaren er nede, 360 når fingeren slepper, og
alltid 360 i eksport og i mappa. Det førebelse talet får eit merke.

**Synleg resultat.** Runda under drag går under 500 ms.

**Risiko, sagt høgt.** To tal for same objekt. Regelen som held det ærleg:
**eit førebels tal går aldri inn i ein eksport eller i PDF-en.**

### 4 · Indekser meshet

**Kvifor.** 116 296 trekantar vert sende som 348 888 lause hjørne — 8 177 kB
per bygging, kopiert til hovudtråden og lasta opp til GPU-en på nytt kvar
gong. På `hog` er det 17 317 kB.

**Kva.** Del hjørne over rutenettet. Berre dei klipte rutene langs
opningskantane treng sine eigne.

**Synleg resultat.** Meshet under 2 500 kB på mid, mindre GC-rykk, og `hog`
blir brukande på ein berbar.

### 5 · Kort lenkje

**Kvifor.** 1 034 teikn, 1 186 på det verste. Får ikkje plass i ein QR-kode
og vert linedelt i e-post.

**Kva.** `#s=` — fast feltrekkjefylgje frå `PARAM_KEYS`, kvart felt
kvantisert til sitt eige steg, pakka til 40 byte, base64url. `#p=` vert
framleis lesen. Avkodinga går gjennom `clampParams` som før.

**Synleg resultat.** URL under 80 teikn. Grensa er 314,5 bit, så det finst
inga koding som er vesentleg kortare.

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

### 8 · Regelen skal peike

**Kvifor.** Ein regel seier nei og seier ikkje kva ein skal gjere. Det er
halvt arbeid. Skilnaden mellom ein reiskap og ein dommar er om han peikar.

**Kva.** Kvar regel namngjev dei parametrane han heng av og kva veg dei må.
Etiketten i panelet vert klikkbar.

**Synleg resultat.** Trykk på «veltevinkel», og panelet rullar til
`legStretch`, `foot` og `seatZ`.

### 9 · Alle platene ut

**Kvifor.** Nettsida eksporterer plate éin. Eit objekt som treng to, går
ut halvt, og ingen ting seier frå.

**Kva.** Eksporter alle platene frå `nest`, og skriv talet på plater i
panelet ved sida av utnyttinga.

**Synleg resultat.** Eksportnamnet ber platenummeret, og panelet seier
«2 plater» før ein trykkjer.

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
eittlinjes endring den dagen mappa må liggja på ein minnepinne på ei
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

Ærleg liste, i den rekkjefylgja eg ville teke dei.

| | Kva | Kvifor |
|---|---|---|
| 1 | Avgjer kva objekt som gjeld | Mappa seier 33 lag og 50 delar, motoren seier 32 og 61. Til det står skrive, skildrar dei to ulike krakkar. |
| 2 | Send det bygde inn i `measure` | 882 av 1 024 ms er arbeid som alt er gjort. |
| 3 | Del svaret i tal og mesh | Tabellen ventar på eit mesh han ikkje les. |
| 4 | Grov stabel under drag | 583 mot 198 ms, og massen skil 1,2 %. |
| 5 | Indekser meshet | 8 177 kB per bygging er tre kopiar av kvart hjørne. |
| 6 | Kort hash | 1 034 teikn mot ei nedre grense på 315 bit. |
| 7 | Lokalt spor over lenkjer | Punktet ein var innom for tjue minutt sidan er borte. Presetmeny er ikkje svaret. |
| 8 | Terning som reparerer | 30 % av trekka er møblar; resten er leksjonar i kva som ikkje går. |
| 9 | Reglar som peikar på ein skyvar | Ein regel som berre seier nei har gjort halve jobben. |
| 10 | Eksporter alle platene | I dag går berre plate éin ut, og ingen ting seier frå. |
| 11 | `npm run mappe`, som nektar på hardt brot | Ein PDF av eit ulovleg objekt ser like ferdig ut som ein av eit lovleg. |
| 12 | Mål bilderata på ein telefon | Alle bilderatetal i dette dokumentet er programvare-GL. |
| 13 | Variantane som lenkjer i mappa | Dei tolv finst berre som argument eg har skrive sjølv. |
| 14 | Kopier scena frå parametric ein siste gong | To kopiar utan vedlikehaldsregel driv frå kvarandre utan at nokon oppdagar det. |

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
