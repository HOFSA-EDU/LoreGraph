# LoreGraph

> "Paste your campaign → get a relationship map."

LoreGraph nimmt unstrukturierten Pen-&-Paper-Kampagnentext (Lore, Session Notes,
NPC-Beschreibungen, Abenteuer-Zusammenfassungen) entgegen und baut daraus eine
interaktive Beziehungskarte mit Entitäten, Beziehungen und konkreten
Spielimpulsen für die nächste Session.

## Tech-Stack

- **Frontend:** React + Vite + TypeScript, Tailwind, shadcn-style UI, React Flow (`@xyflow/react`), `dagre` für Auto-Layout
- **Backend:** Node.js + Express + TypeScript, `zod` für Validierung
- **Datenbank:** PostgreSQL via Prisma
- **Analyzer:** austauschbarer `CampaignTextAnalyzer` — `MockAnalyzer` (regelbasiert, offline) im MVP, `LLMAnalyzer` als vorbereiteter Stub
- **Run:** Docker Compose

## Projektstruktur

```
root/
├─ docker-compose.yml
├─ .env.example
├─ README.md
├─ backend/
│  ├─ Dockerfile
│  ├─ package.json
│  ├─ tsconfig.json
│  ├─ prisma/
│  │  ├─ schema.prisma
│  │  └─ seed.ts
│  └─ src/
│     ├─ index.ts
│     ├─ lib/                # prisma client, async handler
│     ├─ routes/             # campaigns, source-texts, analyze, entities,
│     │                      # relationships, graph, prompts, session-prep, import/export
│     ├─ services/           # persistAnalyzerResult
│     ├─ analyzers/          # CampaignTextAnalyzer interface, MockAnalyzer, LLMAnalyzer
│     └─ validators/         # zod schemas, enum normalization
└─ frontend/
   ├─ Dockerfile
   ├─ package.json
   ├─ index.html
   ├─ vite.config.ts
   ├─ tailwind.config.js
   └─ src/
      ├─ main.tsx / App.tsx
      ├─ pages/              # Dashboard, CreateCampaign, AnalyzePage,
      │                      # GraphPage, SessionPrepPage, ImportExportPage
      ├─ components/
      │  ├─ ui/              # button, card, input, textarea, select, label, badge, separator
      │  └─ graph/           # LoreNode, LoreEdge, EntityPanel, RelationshipPanel, layout (dagre)
      ├─ lib/                # api client, utils, entityStyles
      └─ types/              # shared type definitions
```

## Start

### Voraussetzungen

- Docker Desktop oder Docker Engine + Compose v2

### 1. Repo holen und `.env` anlegen

```bash
cp .env.example .env
```

Die Defaults reichen für lokale Entwicklung. Du brauchst **keinen** API-Key.

### 2. Mit Docker Compose hochfahren

```bash
docker compose up --build
```

Beim ersten Start passiert:

1. Postgres startet.
2. Das Backend:
   - generiert den Prisma-Client (`prisma generate`),
   - legt das Schema in der DB an (`prisma db push`),
   - führt den Seed aus (`prisma db seed`) — erstellt eine Beispielkampagne
     "Graufurt – Beispielkampagne" und schickt den Beispieltext einmal durch
     den `MockAnalyzer`,
   - startet den dev-Server (tsx watch) auf Port `4000`.
3. Das Frontend startet `vite dev` auf Port `5173`.

Öffne dann **http://localhost:5173**.

### 3. Stoppen / Aufräumen

```bash
docker compose down            # Container stoppen
docker compose down -v         # zusätzlich die DB löschen
```

## Lokale Installation ohne Docker

Wer Backend und Frontend direkt auf dem Host laufen lassen will, braucht
**Node.js 20+** und eine erreichbare **PostgreSQL-Instanz**.

```bash
# 1. .env anlegen und DATABASE_URL auf deine Postgres-Instanz zeigen lassen
cp .env.example .env

# 2. Backend
cd backend
npm install
npx prisma generate
npx prisma db push      # Schema in die DB schreiben
npm run seed            # optional: Beispielkampagne anlegen
npm run dev             # startet auf http://localhost:4000

# 3. Frontend (zweites Terminal)
cd frontend
npm install
npm run dev             # startet auf http://localhost:5173
```

> Beim lokalen Lauf ohne Docker setzt das Backend `DATABASE_URL` aus der `.env`.
> Im Compose-Setup wird `DATABASE_URL` dagegen automatisch aus den `POSTGRES_*`-
> Variablen zusammengesetzt (siehe `docker-compose.yml`).

### Tests

```bash
cd backend && npm test     # Vitest (MockAnalyzer, LLMAnalyzer, Validator)
```

## Environment-Variablen

Alle Variablen werden über `.env` gesetzt (Vorlage: `.env.example`). Die `.env`
selbst ist in `.gitignore` und wird **niemals** committet. Echte Keys gehören
ausschließlich in deine lokale `.env`.

| Variable | Default | Beschreibung |
|---|---|---|
| `POSTGRES_USER` | `loregraph` | Postgres-Benutzer (nur Compose) |
| `POSTGRES_PASSWORD` | `loregraph` | Postgres-Passwort — für Produktion ändern! |
| `POSTGRES_DB` | `loregraph` | Datenbankname (nur Compose) |
| `POSTGRES_PORT` | `5432` | Exponierter Postgres-Port (nur Compose) |
| `DATABASE_URL` | — | Postgres-Connection-String (nur nötig beim Lauf ohne Docker) |
| `BACKEND_PORT` | `4000` | Port des Express-Backends |
| `CORS_ORIGIN` | `http://localhost:5173` | Erlaubte Origin für CORS |
| `FRONTEND_PORT` | `5173` | Port des Vite-Dev-Servers |
| `VITE_API_BASE_URL` | `http://localhost:4000` | Basis-URL, die das Frontend fürs Backend nutzt |
| `ANALYZER_PROVIDER` | `mock` | Default-Analyzer: `mock` (offline) oder `llm` |
| `LLM_BASE_URL` | `https://api.openai.com/v1` | OpenAI-kompatibler Endpunkt |
| `LLM_API_KEY` | *(leer)* | API-Key des LLM-Providers — **Secret, nur lokal** |
| `LLM_MODEL` | `gpt-4.1-mini` | Modellname |
| `LLM_TEMPERATURE` | `0.2` | Sampling-Temperatur |
| `LLM_MAX_TOKENS` | *(leer)* | optionales Token-Limit |
| `LLM_JSON_MODE` | *(leer)* | `false` deaktiviert `response_format` (z. B. für Ollama) |
| `LLM_TIMEOUT_MS` | *(leer)* | optionaler Request-Timeout in ms |

> **Sicherheit:** Im `mock`-Modus wird kein Key benötigt. Der `LLM_API_KEY`
> verlässt das Backend nie — das Frontend fragt nur `GET /api/analyzer/status`
> ab und bekommt dort ausschließlich den Konfigurations-Status, nie den Key.

## Workflow

1. **Dashboard** zeigt alle Kampagnen — die Seed-Kampagne ist bereits da.
2. **Neue Kampagne** → Name, System, Tonalität, Beschreibung.
3. **Analyse-Seite:**
   - Texttyp wählen (Lore / Session Notes / Abenteuer / Charakter-Hintergrund / Sonstiges).
   - Analysemodus = **Mock** (LLM ist sichtbar als "coming soon").
   - Text einfügen oder den Button "Beispieltext" nutzen.
   - "Vorschau erzeugen" zeigt erkannte Entitäten, Beziehungen, Spielimpulse mit Confidence — nichts wird gespeichert.
   - "Beziehungskarte erstellen" / "Übernehmen" speichert alles und springt zur **Graph-Ansicht**.
4. **Graph-Ansicht:**
   - Knoten unterscheiden sich pro Entitätstyp (Icon + Farbe).
   - Kanten sind nach Beziehungstyp eingefärbt; geheime Kanten gestrichelt; eskalierende mit Glow.
   - Klick auf Knoten oder Kante öffnet ein **Side-Panel** zur Bearbeitung.
   - **Filter** (Typ, Sichtbarkeit, Wichtigkeit, Status, Confidence) und **Suche**.
5. **Session Prep:** automatisch sortiert in Kritische Konflikte / Geheime Beziehungen / Schulden / Instabile Allianzen / Mögliche Reveals / Hooks.
6. **Import / Export:** JSON-Snapshot der Kampagne, Import legt eine neue Kampagne an.

## Endpunkte (Backend, Port 4000)

| Methode | Pfad |
|---|---|
| GET | `/health` |
| GET | `/api/analyzer/status` — Default-Mode + LLM-Konfigurations-Status (kein Key wird zurückgegeben) |
| GET/POST | `/api/campaigns` |
| GET/PUT/DELETE | `/api/campaigns/:id` |
| GET/POST | `/api/campaigns/:id/source-texts` |
| POST | `/api/campaigns/:id/analyze` |
| GET/POST | `/api/campaigns/:id/entities` |
| PUT/DELETE | `/api/entities/:entityId` |
| GET/POST | `/api/campaigns/:id/relationships` |
| PUT/DELETE | `/api/relationships/:relationshipId` |
| GET | `/api/campaigns/:id/graph` (React-Flow-ready) |
| GET | `/api/campaigns/:id/generated-prompts` |
| GET/PUT/DELETE | `/api/campaigns/:id/open-questions[/:questionId]` |
| GET | `/api/campaigns/:id/session-prep` |
| GET | `/api/campaigns/:id/export` |
| POST | `/api/campaigns/import` |

### Analyze-Request

```json
POST /api/campaigns/:id/analyze
{
  "text": "...",
  "sourceType": "session_notes",
  "mode": "llm",
  "preview": false,
  "storeSourceText": true,
  "allowFallback": false
}
```

- `mode` ist optional — der Default wird über `ANALYZER_PROVIDER` festgelegt.
- `preview: true` liefert nur das Analyzer-Resultat zurück, ohne in der DB zu schreiben.
- `allowFallback: true` weicht still auf den Mock-Analyzer aus, falls `llm` angefragt wird aber nicht konfiguriert ist.

Response:

```json
{
  "analyzed": {
    "entities":         [{ "name", "type", "description", "imagePrompt", "isUncertain", ... }],
    "relationships":    [{ "sourceName", "targetName", "type", "isUncertain", ... }],
    "generatedPrompts": [{ "title", "description", "type" }],
    "openQuestions":    [{ "question", "relatedEntityNames" }]
  },
  "persisted": {
    "entityCount": 16, "relationshipCount": 8, "promptCount": 5, "openQuestionCount": 3,
    "sourceTextId": "..."
  },
  "analyzerMode": "llm"
}
```

## Analyzer: Mock vs. LLM

Der zentrale Workflow ist eine **semantische LLM-Analyse** des Kampagnentexts.
Der `MockAnalyzer` bleibt als Offline-Fallback (regelbasiert, keine API-Kosten)
für lokale Tests und für den Fall, dass kein LLM konfiguriert ist.

| Modus | Wann | Liefert |
|---|---|---|
| `mock` | Default ohne Konfiguration, lokale Tests, CI | Heuristische Entitäten/Beziehungen, einfache Spielimpulse |
| `llm` | Produktivnutzung mit OpenAI-kompatibler API | Semantisch verstandene Entitäten, Beziehungen, Geheimnisse, **offene Fragen**, **Bild-Prompts**, **Unsicherheitsmarkierung** |

### LLM-Modus aktivieren

LoreGraph spricht jede **OpenAI-kompatible API**. Setze in `.env`:

```env
ANALYZER_PROVIDER=llm
LLM_BASE_URL=https://api.openai.com/v1
LLM_API_KEY=sk-...
LLM_MODEL=gpt-4.1-mini
LLM_TEMPERATURE=0.2
```

Beispiele für andere Provider (alle in `.env.example` dokumentiert):

| Provider | `LLM_BASE_URL` | Key nötig? | Hinweis |
|---|---|---|---|
| OpenAI | `https://api.openai.com/v1` | ja | Standard |
| OpenRouter | `https://openrouter.ai/api/v1` | ja | Routing zu vielen Modellen |
| LM Studio | `http://host.docker.internal:1234/v1` | nein | lokal |
| Ollama | `http://host.docker.internal:11434/v1` | nein | ggf. `LLM_JSON_MODE=false` setzen |
| llama.cpp / vLLM | je nach Setup | je nach Setup | OpenAI-kompatibel |

### Was die LLM-Analyse produziert

Zusätzlich zu Entitäten, Beziehungen und Spielimpulsen liefert der LLM-Analyzer:

- **`openQuestions`** — offene Fragen an die Spielleitung, wenn der Text Lücken oder Andeutungen hat.
- **`imagePrompt`** pro Entität — kurzer englischer KI-Bild-Prompt (Fantasy-Stil) für Character/Place/Item-Portraits.
- **`isUncertain`** — Flag für Information, die die KI erschlossen hat und der SL bestätigen sollte.
- **`visibility: gm_only`** — vom Modell explizit erkannte SL-Geheimnisse (z. B. aus „verschweigt", „in Wahrheit", oder semantischem Subtext).

Alle Werte werden anschließend von `normalizeAnalyzerResult` validiert: unbekannte
Enum-Werte werden auf `unknown` / `unknown_connection` gemappt, Duplikate
zusammengeführt, fehlende Beziehungs-Endpunkte automatisch als Entitäten angelegt.

### Architektur

Beide Analyzer implementieren das gleiche Interface:

```ts
interface CampaignTextAnalyzer {
  readonly mode: 'mock' | 'llm';
  analyze(input: { text: string; sourceType?: SourceType }): Promise<AnalyzerResult>;
}
```

Die Auswahl läuft über die Factory in [backend/src/analyzers/index.ts](backend/src/analyzers/index.ts):

- `ANALYZER_PROVIDER` legt den Default fest.
- Der `/api/campaigns/:id/analyze`-Body kann `mode: 'mock' | 'llm'` explizit setzen.
- Wird `llm` ohne `LLM_BASE_URL`/`LLM_MODEL` angefordert, antwortet der Server mit `503 llm_not_configured` (oder fällt mit `allowFallback: true` auf Mock zurück).
- Das Frontend prüft `GET /api/analyzer/status` und entsperrt die LLM-Option im Dropdown automatisch.

Keine API-Keys werden ans Frontend ausgeliefert.

## Testen

Backend manuell:

```bash
# Kampagnen abfragen
curl http://localhost:4000/api/campaigns

# Vorschau auf der Seed-Kampagne
CID=$(curl -s http://localhost:4000/api/campaigns | jq -r '.[0].id')
curl -X POST http://localhost:4000/api/campaigns/$CID/analyze \
  -H 'Content-Type: application/json' \
  -d '{"text":"Bürgermeister Tann verbirgt, dass er für den Kult der Asche arbeitet.","sourceType":"session_notes","mode":"mock","preview":true}'
```

Frontend:

- Dashboard auf http://localhost:5173 öffnen.
- Auf die Seed-Kampagne "Graufurt – Beispielkampagne" klicken → Graph.
- "Neue Kampagne" testen → leere Analyse-Seite → Beispieltext einfügen → Vorschau → Übernehmen.

## Deployment hinter Caddy (Skizze)

Für später, nicht Teil des MVP:

```Caddyfile
loregraph.example.com {
  handle /api/* {
    reverse_proxy backend:4000
  }
  handle {
    reverse_proxy frontend:5173
  }
}
```

Das Compose-Setup ist so geschnitten, dass Backend und Frontend hinter einem
Reverse-Proxy zusammenlaufen, ohne dass Ports nach außen exponiert werden müssen.

## Wichtige Design-Entscheidungen

- **Analyzer ist eine Schnittstelle.** `CampaignTextAnalyzer.analyze()` ist die einzige Stelle, an der Logik zur Extraktion lebt. Backend, Validator und Persistenz arbeiten ausschließlich mit `AnalyzerResult` — der Provider ist tauschbar.
- **Validator normalisiert.** Unbekannte Enum-Werte aus dem Analyzer (besonders relevant bei LLMs) werden auf `unknown` / `unknown_connection` gemappt statt zu Fehlern zu führen.
- **Beziehungen erzwingen Endpoint-Existenz.** Wenn der Analyzer eine Beziehung auf einen noch nicht erkannten Namen meldet, wird automatisch eine Entität mit `type: unknown` angelegt — Spielleiter:innen korrigieren das später in der Graph-Ansicht.
- **Dedupe auf Namensebene.** Innerhalb einer Kampagne ist `name` für Entitäten eindeutig; Analyzer-Outputs werden idempotent eingespielt.
- **Single-User MVP.** `User` existiert im Schema (für später), wird aber von keinem Endpoint erzwungen.
