# Ask Your DocAI

Piattaforma italiana di revisione clinica documentale delle ipotesi diagnostiche emerse da
ChatGPT. Il paziente carica una conversazione già avuta con ChatGPT; un medico abilitato esamina
il materiale, può chiedere integrazioni e firma un parere indipendente.

**Nessuna AI nel percorso clinico.** Il backend non interroga modelli, non riassume, non classifica
e non assegna priorità. La decisione è umana e firmata.

## Stack

| Componente | Scelta |
|---|---|
| Frontend | Next.js 14 (App Router, TypeScript) |
| Backend | Python 3.12 + FastAPI |
| Database | PostgreSQL 16 (Cloud SQL in produzione) |
| Documenti | Object storage + URL firmati (Cloud Storage in produzione) |
| Auth | JWT HS256 in sviluppo; Google Identity Platform (OIDC + MFA) in produzione |
| Deploy | Cloud Run `europe-west8` (Milano) + Vercel opzionale |
| Audit | tabella `audit_events` append-only, senza contenuto clinico |

## Avvio locale

Prerequisiti: Python 3.12+, Node 20+, PostgreSQL in esecuzione.

```bash
# 1. Database
createdb ask_docai
psql -d ask_docai -f database/migrations/001_init.sql

# 2. Backend
cd backend
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
cp .env.example .env            # adatta DATABASE_URL se serve
.venv/bin/python -m scripts.seed
.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8080

# 3. Frontend (seconda shell)
cd frontend
npm install
cp .env.local.example .env.local
npm run dev
```

- Frontend: http://localhost:3000
- API: http://127.0.0.1:8080
- OpenAPI: http://127.0.0.1:8080/docs

### Account demo (creati da `scripts.seed`)

| Ruolo | Email | Password |
|---|---|---|
| Paziente | `paziente@demo.it` | `password123` |
| Medico (identità STRONG) | `medico@demo.it` | `password123` |

Il medico demo ha `identity_level = STRONG` perché la firma del parere richiede
autenticazione forte. La registrazione pubblica crea solo account paziente: gli account medici
sono provisionati da clinical operations dopo il credentialing.

## Flusso funzionale

1. Il paziente descrive il problema, incolla la conversazione o carica un file, accetta lo scope
   del servizio e invia il caso (`DRAFT → SUBMITTED`).
2. Il medico prende in carico il caso dalla coda (`SUBMITTED → IN_REVIEW`), creando
   l'assegnazione.
3. Il medico può chiedere integrazioni (`NEEDS_INFORMATION`), fare escalation
   (`CLINICAL_ESCALATION`) o redigere il parere (`OPINION_DRAFT`).
4. Il parere viene finalizzato (versione immutabile con hash) e firmato
   (`FINALIZED → SIGNED`); il caso passa a `SIGNED`.
5. Il paziente vede il parere firmato e può scaricare il documento.

Esiti ammessi per il parere: concorda, concorda parzialmente, non concorda, informazioni
insufficienti, non valutabile a distanza. Il medico assegna manualmente l'urgenza; il backend non
la calcola.

## API principali

| Metodo | Endpoint | Ruolo |
|---|---|---|
| POST | `/v1/auth/register` | pubblico (solo paziente) |
| POST | `/v1/auth/login` | pubblico |
| GET | `/v1/auth/me` | autenticato |
| GET | `/v1/cases` | paziente / medico / admin |
| POST | `/v1/cases` | paziente |
| GET | `/v1/cases/{id}` | proprietario o medico assegnato |
| POST | `/v1/cases/{id}/submit` | paziente |
| GET | `/v1/cases/{id}/sources` | proprietario o medico assegnato |
| POST | `/v1/cases/{id}/uploads` | paziente |
| POST | `/v1/cases/{id}/uploads/{uploadId}/complete` | paziente |
| POST/GET | `/v1/cases/{id}/messages` | proprietario o medico assegnato |
| POST | `/v1/clinical/cases/{id}/accept` | medico |
| POST | `/v1/clinical/cases/{id}/request-information` | medico assegnato |
| POST | `/v1/clinical/cases/{id}/escalate` | medico assegnato |
| POST | `/v1/clinical/cases/{id}/opinions` | medico assegnato |
| PUT | `/v1/clinical/opinions/{id}` | medico autore (solo DRAFT) |
| POST | `/v1/clinical/opinions/{id}/finalize` | medico autore |
| POST | `/v1/clinical/opinions/{id}/sign` | medico autore + strong auth |
| GET | `/v1/clinical/cases/{id}/opinion` | proprietario o medico assegnato |
| GET | `/v1/clinical/opinions/{id}/document` | proprietario o medico assegnato |
| POST | `/v1/payments/authorization` | paziente |
| POST | `/v1/payments/webhooks/payment-provider` | PSP |

Tutte le route sensibili scrivono un evento in `audit_events` (actor, azione, risorsa, esito) senza
contenuto clinico.

## Sicurezza e privacy

- Autorizzazione per oggetto: un medico vede solo i casi assegnati.
- Firma del parere: richiede `identity_level = STRONG`; in produzione il documento è firmato PAdES
  tramite QTSP e il backend non custodisce chiavi private.
- Nessun dato clinico in URL, log applicativi, email o metadati dei pagamenti.
- Upload: controlli di dimensione, MIME ed hash SHA-256; in produzione URL firmati verso object
  storage con quarantena e malware scan.
- Retention e DPIA sono fuori dal perimetro del codice e devono essere definite prima del go-live.

## Test rapido con curl

```bash
# Login paziente
TOKEN=$(curl -s -X POST http://127.0.0.1:8080/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"paziente@demo.it","password":"password123"}' | python3 -c 'import sys,json;print(json.load(sys.stdin)["token"])')

# Crea e invia un caso
CASE=$(curl -s -X POST http://127.0.0.1:8080/v1/cases \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"patient_summary":"Cefalea da 3 giorni","service_scope_acknowledged":true}' \
  | python3 -c 'import sys,json;print(json.load(sys.stdin)["id"])')
curl -s -X POST http://127.0.0.1:8080/v1/cases/$CASE/submit -H "Authorization: Bearer $TOKEN"
```

## Docker Compose

```bash
docker compose up --build
```

Compose avvia PostgreSQL (con migrazione automatica), il backend su `:8080` e il frontend su
`:3000`. Il proxy `/v1/*` del frontend punta al servizio `backend` nella rete Compose.

## Struttura

```
backend/
  app/
    main.py            entrypoint FastAPI
    config/            settings (pydantic-settings)
    core/              database pool, deps, audit, error handler
    routes/            auth, cases, messages, upload, opinions, payments
    schemas/           modelli Pydantic
  scripts/seed.py      account demo
frontend/
  src/app/             route Next.js (App Router)
  src/components/      AuthProvider, NavBar, RequireAuth
  src/lib/api.ts       client API + sessione
database/migrations/   schema SQL
```

## Limiti noti dell'MVP

- Firma qualificata e pagamenti sono simulati (nessun QTSP/PSP reale collegato).
- Upload locale: in produzione va sostituito con URL firmati verso Cloud Storage.
- MFA/Identity Platform, DPIA, autorizzazione regionale e pen-test sono gate esterni al codice.
