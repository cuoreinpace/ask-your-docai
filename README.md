# Ask Your DocAI

Piattaforma italiana di verifica medica delle ipotesi diagnostiche emerse da ChatGPT.

## Descrizione

Ask Your DocAI è una piattaforma sanitaria asincrona che consente ai pazienti di caricare conversazioni ChatGPT e ricevere una valutazione clinica indipendente da un medico. Il medico può concordare, correggere, chiedere informazioni aggiuntive o indicare che sono necessari visita o accertamenti.

## Architettura

- **Frontend**: Next.js 14 (React + TypeScript)
- **Backend**: Python FastAPI
- **Database**: PostgreSQL (Cloud SQL in produzione)
- **Storage**: Google Cloud Storage (in produzione)
- **Auth**: Google Cloud Identity Platform (OIDC + MFA)
- **Deployment**: Google Cloud Run (backend), Vercel (frontend, opzionale)
- **CI/CD**: GitHub Actions + Workload Identity Federation
- **Region**: Europa - Milano (`europe-west8`)

## MVP — Scope

- Upload di conversazioni ChatGPT (PDF, TXT, immagini)
- Workflow di revisione clinica asincrona
- Firma elettronica qualificata PAdES
- Integrazione pagamenti (PSP)
- Audit trail completo
- Conformità GDPR e MDR

## Quick Start

```bash
# Backend
cd backend
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8080

# Frontend
cd frontend
npm install
npm run dev

# Database + Docker
docker-compose up -d db
```

## API

| Metodo | Endpoint | Descrizione |
|--------|----------|-------------|
| POST | `/v1/auth/register` | Registrazione utente |
| POST | `/v1/auth/login` | Accesso |
| GET | `/v1/auth/me` | Utente corrente |
| POST | `/v1/cases` | Crea caso |
| GET | `/v1/cases/:id` | Leggi caso |
| POST | `/v1/cases/:id/submit` | Invia caso |
| POST | `/v1/cases/:id/upload` | Inizializza upload |
| POST | `/v1/cases/:id/upload/:uploadId/complete` | Completa upload |
| POST | `/v1/cases/:id/messages` | Invia messaggio |
| GET | `/v1/cases/:id/messages` | Leggi messaggi |
| POST | `/v1/clinical/cases/:id/opinions` | Crea parere |
| PUT | `/v1/clinical/opinions/:id` | Aggiorna parere |
| POST | `/v1/clinical/opinions/:id/finalize` | Finalizza parere |
| POST | `/v1/clinical/opinions/:id/sign` | Firma parere |
| GET | `/v1/clinical/cases/:id/opinion` | Leggi parere |
| GET | `/v1/opinions/:id/document` | Scarica documento firmato |
| POST | `/v1/payments/authorization` | Preautorizza pagamento |
| POST | `/v1/payments/webhooks/payment-provider` | Webhook PSP |

## Deployment

### Google Cloud (raccomandato)

```bash
# Backend su Cloud Run
gcloud run deploy ask-your-docai-backend \
  --region europe-west8 \
  --source ./backend \
  --set-env-vars DATABASE_URL=postgresql://...

# Frontend su Vercel (opzionale)
vercel deploy
```

### Docker Compose (sviluppo locale)

```bash
docker-compose up -d
```

## Licenza

Proprietario — Tutti i diritti riservati.