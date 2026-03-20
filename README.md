# Frontend

Frontend je React + Vite aplikácia pre projekt HealthyU / Kouč v zácviku.

Aplikácia slúži ako používateľské rozhranie pre:

- prihlasovanie používateľov
- prehliadanie modulov a scenárov
- sledovanie progresu
- textový chat a realtime voice konverzáciu
- diagnostiku kvality voice hovoru

## Stack

- React 19
- Vite 7
- React Router DOM 7
- Directus ako autentifikačný a dátový backend
- samostatný `ai-server` pre AI komunikáciu

## Spustenie

```powershell
cd C:\projekty\AI_TOOL_ERAZMUS\frontend
npm install
npm run dev
```

Produkčný build:

```powershell
npm run build
```

Lokálny preview build-u:

```powershell
npm run preview
```

## Environment premenné

Frontend používa najmä tieto premenné:

```env
VITE_API_URL=http://localhost:3001
VITE_DIRECTUS_URL=http://localhost:8055
```

Význam:

- `VITE_API_URL` – URL `ai-server`
- `VITE_DIRECTUS_URL` – URL Directus backendu

## Routing

Hlavné routy sú definované v [`src/App.jsx`](./src/App.jsx):

- `/` – login
- `/forgot-password`
- `/reset-password`
- `/info`
- `/modules`
- `/modules/:moduleId`
- `/modules/:moduleId/scenarios/:scenarioId`

Chránené routy idú cez [`src/components/RequireAuth.jsx`](./src/components/RequireAuth.jsx).

Správanie:

- ak používateľ nie je prihlásený, chránené routy ho pošlú na `/`
- po prihlásení sa používateľ môže vrátiť na pôvodnú route, ak tam prišiel cez auth guard

## Autentifikácia

Autentifikácia ide cez Directus.

Kľúčové časti:

- [`src/lib/directus.js`](./src/lib/directus.js) – login, refresh token, logout, password reset
- [`src/context/AuthContext.jsx`](./src/context/AuthContext.jsx) – držanie používateľa v stave aplikácie
- [`src/lib/api.js`](./src/lib/api.js) – wrapper na volania Directusu s refresh token logikou

Použitý mechanizmus:

- `access_token` a `refresh_token` sa ukladajú do `localStorage`
- pri štarte aplikácie sa skúsi obnoviť user cez `/users/me`
- každé 4 minúty sa user refreshuje

## Hlavné obrazovky

### Login

- vstupná stránka aplikácie
- spracováva login cez Directus
- obsahuje link na reset hesla

### Modules

- načíta zoznam modulov
- zobrazuje celkový progress používateľa
- používa prefetch detailu modulu pri hover/click

Kľúčové súbory:

- [`src/pages/Modules.jsx`](./src/pages/Modules.jsx)
- [`src/lib/prefetchModuleDetail.js`](./src/lib/prefetchModuleDetail.js)
- [`src/lib/progress.js`](./src/lib/progress.js)

### ModuleDetail

- načíta detail modulu
- načíta scenáre pre konkrétny modul
- ukazuje dokončené/nedokončené scenáre

Kľúčový súbor:

- [`src/pages/ModuleDetail.jsx`](./src/pages/ModuleDetail.jsx)

### ScenarioDetail

Najdôležitejšia obrazovka aplikácie.

Obsahuje:

- detail scenára
- voice button
- realtime voice logiku
- transcript saving
- voice diagnostics panel

Kľúčový súbor:

- [`src/pages/ScenarioDetail.jsx`](./src/pages/ScenarioDetail.jsx)

## Voice architektúra vo fronte

Voice flow je postavený nad WebRTC a OpenAI realtime session.

Zjednodušený tok:

1. frontend načíta scenár
2. frontend zavolá `GET /realtime-prewarm`
3. po kliknutí na mikrofón:
   - otvorí lokálny mikrofón
   - zavolá `POST /realtime-session`
   - vytvorí `RTCPeerConnection`
   - pošle SDP na `POST /realtime-connect`
4. vzdialené audio prehráva cez `audio` element
5. finálny transcript pošle na `POST /save-realtime-transcript`

## Audio profil

Frontend sa nespolieha len na `audio: true`, ale skúša explicitné speech profily podľa platformy:

- desktop
- iOS / WebKit
- Android / Chromium

Cieľ:

- konzistentnejší mono vstup
- zapnuté AEC/NS/AGC pre bežné použitie
- menšie rozdiely medzi zariadeniami

## Voice diagnostics

Na obrazovke scenára je dostupný diagnostický panel.

Zapnutie:

- query parameter `?voiceDebug=1`
- alebo `localStorage.setItem("voice_debug", "1")`

Panel ukazuje:

- kvalitu capture profilu
- najpomalší krok štartu hovoru
- zdravie WebRTC spojenia
- stav prewarmu
- pravdepodobnú príčinu problému

Použitie:

- pri porovnávaní iPhone vs Android
- pri hľadaní sekania, lagov, prerušovania a cold-start problémov

## Global header

Header je spoločný pre celú aplikáciu.

Kľúčový súbor:

- [`src/components/Header.jsx`](./src/components/Header.jsx)

Zodpovednosť:

- logo navigácia na `/modules`
- logout
- togglovanie draweru na mobilnom detaile scenára
- pri opustení scenára vysiela event `force-stop-realtime`

## Progress inicializácia

Pri prvom prihlásení sa vytvárajú záznamy do `user_scenario_progress`.

Kľúčový súbor:

- [`src/lib/initProgress.js`](./src/lib/initProgress.js)

Správanie:

- načíta aktuálneho usera
- overí rolu
- ak progress ešte neexistuje, vytvorí riadky pre všetky scenáre
- označí `first_login_completed`

## Deploy poznámky

Frontend je SPA s `BrowserRouter`, preto hosting musí vracať `index.html` aj pre hlboké route.

Pripravený Apache fallback:

- [`public/.htaccess`](./public/.htaccess)

To je dôležité hlavne pri hostingu mimo Vite dev servera, napríklad na Websupporte.

## Build a statické súbory

Po `npm run build` sa vytvorí adresár:

- `dist/`

Ten obsahuje:

- `index.html`
- zbuildené JS/CSS assets
- súbory skopírované z `public/`

Do produkcie sa nasádza práve obsah `dist/`.

## Najčastejšie problémy

### Priama URL scenára vracia `Not Found`

Príčina:

- hosting nevracia SPA fallback na `index.html`

Riešenie:

- nasadiť `.htaccess` alebo ekvivalent podľa hostingu

### Voice funguje inak na rôznych zariadeniach

Príčina:

- iný browser audio stack
- iný OS preprocessing
- iné WebRTC správanie

Pomoc:

- použiť `voiceDebug=1`
- porovnať diagnostics medzi zariadeniami

### Po prvom štarte po nečinnosti je hovor pomalší

Príčina:

- cold start alebo pomalé vytvorenie realtime session

Pomoc:

- sledovať položky `Cold start` a `Štart hovoru` v diagnostics paneli
