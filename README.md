# ⛳ Golf Livescoring

Echtzeit-Livescoring für ein 4-Tage-Turnier mit 7 Spielern.
Alle sehen das Leaderboard live — jeder Score-Eintrag erscheint sofort auf allen Geräten.

---

## Features

- **Live Scoring**: Bruttoschläge eingeben → Punkte werden automatisch berechnet
- **Realtime**: Alle Geräte sehen Änderungen sofort (Supabase Realtime)
- **Punktesystem**: 2 Pkt (Birdie+) · 1 Pkt (Par) · 0 Pkt (Bogey+)
- **Tages- & Gesamtwertung**: Getrennte Leaderboards + Tagessieger
- **Scorecard**: Pro Spieler, pro Tag oder Gesamtübersicht
- **Mobile-first**: Optimiert für schnelle Eingabe auf dem Platz
- **PWA**: Kann als App auf dem Homescreen installiert werden

---

## Setup-Anleitung (ca. 10 Minuten)

### 1. Supabase Projekt erstellen

1. Gehe zu [supabase.com](https://supabase.com) → kostenlosen Account erstellen
2. Klicke **New Project** → Name: `golf-livescoring`
3. Wähle Region **Frankfurt (eu-central-1)** für beste Latenz
4. Warte bis das Projekt bereit ist (~2 Min)

### 2. Datenbank einrichten

1. Im Supabase Dashboard → **SQL Editor** (linkes Menü)
2. Klicke **New Query**
3. Kopiere den gesamten Inhalt von `supabase-schema.sql` hinein
4. Klicke **Run** (oder Cmd+Enter)
5. Überprüfe: Unter **Table Editor** sollte die Tabelle `scores` erscheinen

### 3. API-Schlüssel holen

1. Im Dashboard → **Settings** → **API**
2. Kopiere:
   - **Project URL** → `https://xxxx.supabase.co`
   - **anon (public) key** → der lange String

### 4. Projekt lokal starten

```bash
# Ins Projektverzeichnis wechseln
cd golf-livescoring

# Abhängigkeiten installieren
npm install

# .env.local erstellen
cp .env.local.example .env.local
```

Öffne `.env.local` und trage deine Werte ein:

```
NEXT_PUBLIC_SUPABASE_URL=https://dein-projekt.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=dein-anon-key
```

Dann starten:

```bash
npm run dev
```

→ App läuft auf `http://localhost:3000`

### 5. Online deployen (Vercel)

Damit alle auf dem Platz die App nutzen können:

1. Erstelle ein Repo auf [github.com](https://github.com) und pushe das Projekt
2. Gehe zu [vercel.com](https://vercel.com) → **Import Project** → GitHub Repo wählen
3. Unter **Environment Variables** die zwei Supabase-Variablen eintragen:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Klicke **Deploy**
5. Nach ~1 Min hast du eine URL wie `golf-livescoring.vercel.app`

**Tipp**: Unter Vercel Settings → Domains kannst du eine eigene Domain verknüpfen.

---

## Anpassungen

### Spielernamen ändern

In `src/app/page.js` ganz oben:

```js
const PLAYERS = [
  "Patrick", "Thomas", "Michael", "Stefan",
  "Andreas", "Christian", "Markus",
];
```

### Par-Daten anpassen

Ebenfalls in `page.js` — die 18 Par-Werte für euren Platz:

```js
const PAR_DATA = [
  4, 3, 5, 4, 4, 3, 4, 5, 4,  // Loch 1–9
  4, 4, 3, 5, 4, 4, 3, 4, 5,  // Loch 10–18
];
```

---

## Wie es funktioniert

### Eingabe-Flow (auf dem Platz)

1. **Tag wählen** (1–4)
2. **Spieler antippen**
3. App springt automatisch zum **nächsten offenen Loch**
4. **Schlagzahl antippen** → Punkte werden sofort angezeigt
5. **Speichern** → Score erscheint auf allen Geräten

### Punkte-Berechnung

| Ergebnis | Bedingung | Punkte |
|----------|-----------|--------|
| Birdie+  | Schläge ≤ Par − 1 | **2** |
| Par      | Schläge = Par | **1** |
| Bogey+   | Schläge > Par | **0** |

### Leaderboard

- Sortierung: Punkte (absteigend), dann Bruttoschläge (aufsteigend)
- Tages- und Gesamtwertung werden getrennt berechnet
- Tagessieger werden automatisch ermittelt

---

## Technik

- **Next.js 14** (App Router)
- **Supabase** (PostgreSQL + Realtime Subscriptions)
- **Row Level Security**: Öffentlich (kein Login nötig)
- **PWA-fähig**: Manifest für Homescreen-Installation

---

## Datenbank-Schema

```
scores
├── id         (auto-increment)
├── player     (text)
├── day        (1–4)
├── hole       (1–18)
├── strokes    (Bruttoschläge)
├── par        (Par des Lochs)
├── points     (0, 1, oder 2 — automatisch berechnet)
├── created_at (timestamp)
└── updated_at (timestamp)

UNIQUE CONSTRAINT: (player, day, hole)
```
