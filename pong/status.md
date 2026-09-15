# Pong igra — Status projekta
**Datum:** 06.05.2026
**Lokacija:** `E:\Claude\Nejc\Pong\`
**Datoteke:** `index.html`, `style.css`, `game.js`

---

## Kaj sva naredila

### Osnova
- Osnoven Pong v vanila HTML/CSS/JS (brez frameworkov)
- Canvas 800×500px
- Dve palici, žogica z odbojem od sten in palic
- Zmaga pri **10 točkah**

### Vizualni stil
- Temno ozadje (`#050510`) z grid teksturo in barvnima žaroma (modra levo, rdeča desno)
- **Ozadje animacija:** 8 žogic (modre + rdeče) letijo iz vsakega kota in sredine proti centru, vsake **1,5 sekunde** nov val, stari ostanejo vidni
- Font: **Orbitron** (Google Fonts) — futuristični gaming stil
- Palici sta **zaobljeni z glow efektom**
- Leva palica barva = aktivni skin (privzeto modra)
- Žogica ima **rep/trail** in glow
- Score bar z velikimi številkami nad canvasom

### Meni
- Glassmorphism stil z backdrop-filter blur
- Naslov **PONG** (P=moder, O=rdeč, N=moder, G=rdeč)
- Tri možnosti: **👥 Dva igralca** / **🎮 En igralec** / **💀 Boss Fight**
- Pod karticami: gumba 🏆 Leaderboard in 💎 Shop

### Načini igre
- **Dva igralca:** Moder W/S, Rdeč ↑/↓
- **En igralec (vs Robot):** 3 težavnosti — 😴 Lahka / 😐 Srednja / 😈 Težka
- **Boss Fight:** Moder W/S, boss ima ogromno palico (2.5×), zmaga pri 50 odbojih

### AI (Robot)
- Predvideva **trajektorijo žogice** z odboji od sten (ne samo sledi trenutni poziciji)
- Konfiguracija:
  ```
  easy:   speed: 1.8, errorY: 90, updateChance: 0.02
  medium: speed: 3.0, errorY: 45, updateChance: 0.07
  hard:   speed: 5.0, errorY: 18, updateChance: 0.5
  boss:   speed: 8.0, errorY: 3,  updateChance: 1.0
  ```
- `updateChance` = verjetnost da posodobi cilj vsak frame
- `errorY` = naključni odmik od prave pozicije (višji = več napak)

### Boss Fight mode
- **Zmaga:** 50 odbojev (štejejo odboji od obeh palic skupaj)
- **Življena:** 3 × ❤️ — ob zgrešitvi −1, odboji se **ne resetirajo** čez življa
- **Boss palica:** 2.5× normalna (200px), oranžen pulzirajoč glow
- **Progress bar** na canvasu (oranžno-rumena črta, narašča 0→50)
- **Score bar** prikazuje: levo = `ODBOJI` (število), desno = `ŽIVL.` (srčki)
- **Nagrada za zmago:** +5000 💎
- Cheat `L` (auto-pilot) ni na voljo v boss modu
- Boss ni vpisan v leaderboard

### Gem sistem (valuta)
- Gemi se hranijo v `localStorage` (`pong_gems`)
- **+10 💎** ko moder (ali player vs AI) doseže točko
- **+45 💎** bonus za 5x zapored (streak) — prikaže se popup
- **+100 💎** za zmago navadne igre
- **+5000 💎** za zmago Boss Fighta
- V 1v1: rdeč NE dobiva gemov ko on doseže točko
- Gem count prikazan v score baru (sredina)

### Leaderboard
- Shranjeno v `localStorage` (`pong_lb`)
- Ločeno za 1v1 (Moder vs Rdeč) in AI (po težavnosti)
- Prikazuje: Zmage / Porazi / %
- Gumb 🗑 Pobriši statistiko

### Shop — dva dela
Shop ima dva taba:

#### ⚡ Power Shop
- 6 power-upov za nakup z gemi:
  | ID | Ikona | Ime | Cena | Trajanje |
  |----|-------|-----|------|---------|
  | bigpad | 📏 | Velika Palica | 80 💎 | 10s |
  | turbo | ⚡ | Turbo | 60 💎 | 8s |
  | freeze | 🧊 | Zamrzni | 120 💎 | 3s |
  | shrink | 🌀 | Pomanjšaj | 100 💎 | 10s |
  | slowball | 🐢 | Počasna Žoga | 70 💎 | 6s |
  | ghost | 👻 | Duh | 90 💎 | 6s |
- Shranjeno v `localStorage` (`pong_items`)

#### 🎨 Skin Shop
- 8 barv za levo (igralčevo) palico:
  | ID | Ime | Barva | Cena |
  |----|-----|-------|------|
  | default | Modra | #44aaff | brezplačna |
  | green | Zelena | #44ff88 | 200 💎 |
  | cyan | Cyan | #00ffee | 300 💎 |
  | white | Bela | #ffffff | 400 💎 |
  | purple | Vijolična | #aa44ff | 500 💎 |
  | pink | Roza | #ff44aa | 600 💎 |
  | fire | Ognjena | #ff6600 | 800 💎 |
  | gold | Zlata | #ffcc00 | 1000 💎 |
- Shranjeno v `localStorage` (`pong_skins`, `pong_skin_active`)
- Skin se takoj vidi na palici med igro

### Power-up sistem
- Vsak power-up dela **v korist tistega, ki ga aktivira**:
  - `bigpad` → lastna palica večja (×1.6)
  - `turbo` → lastna palica hitrejša (2×)
  - `freeze` → nasprotnikova palica zamrznjena
  - `shrink` → nasprotnikova palica manjša (×0.5)
  - `slowball` → žogica upočasnjena (×0.5)
  - `ghost` → lastna palica postane nevidna (opacity 0.15)
- **Tipke:**
  - Moder (P1): `1` `2` `3` `4` `5` `6`
  - Rdeč (P2, samo 2p): `Numpad1` – `Numpad6`
- **V 2-player načinu:** ob vsakem odboju od palice se avtomatsko sproži **naključna super moč** za tistega, ki je odbil
- Power-upi delujejo tudi v Boss Fightu (freeze/shrink na bossu)

### Cheat
- Tipka `L` v 2p načinu: rdeči dobi **nepremagljiv auto-pilot** (palica se teleportira na žogico), toggle on/off

### Play gumb
- Okrogel ▶ gumb na sredini canvasa ko igra ni aktivna
- Ob kliku (ali SPACE) sproži žogico

### Win overlay
- Prikaže zmagovalca z barvo, animirano trofejo, rezultatom
- Gumba: **▶ Igraj znova** (isti način) / **☰ Menu**

---

## Možne nadgradnje (TODO)

- [ ] Zvočni efekti (odboj, gol, power-up)
- [ ] Animacija pri aktivaciji power-upa
- [ ] Online multiplayer (WebSocket)
- [ ] Mobilna podpora (touch events)
- [ ] Turnirski način (best of 3/5)
- [ ] Power-up na igrišču (žogica, ki jo ujameš)
- [ ] Različne barve žogice za vsak power-up stanje
- [ ] Boss Fight v leaderboardu

---

## Znane težave / opombe

- `roundRect` zahteva Chrome 99+ / Firefox 112+ / Edge 99+
- Orbitron font zahteva internet (Google Fonts CDN)
- Gem popup in streak popup sta na fiksnih pozicijah — morda se prekrivata
- V 2p načinu oba delita isti inventar gemov in power-upov
