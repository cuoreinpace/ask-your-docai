# Ask Your DocAI

Piattaforma italiana di verifica medica delle ipotesi diagnostiche emerse da ChatGPT.

## Descrizione

Ask Your DocAI è una piattaforma sanitaria asincrona che consente ai pazienti di caricare conversazioni ChatGPT e ricevere una valutazione clinica indipendente da un medico. Il medico può concordare, correggere, chiedere informazioni aggiuntive o indicare che sono necessari visita o accertamenti.

## Architettura

- **Backend**: Node.js + TypeScript + Express (modular monolith)
- **Frontend**: React + TypeScript + Vite
- **Database**: PostgreSQL
- **Cache/Queue**: Redis + BullMQ
- **Deployment**: Docker + Docker Compose

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
npm install
npm run dev

# Frontend
cd frontend
npm install
npm run dev

# Database + Redis
docker-compose up -d db redis
```

## API

| Metodo | Endpoint | Descrizione |
|--------|----------|-------------|
| POST | `/v1/auth/register` | Registrazione utente |
| POST | `/v1/auth/login` | Accesso |
| POST | `/v1/cases` | Crea caso |
| POST | `/v1/cases/:id/submit` | Invia caso |
| POST | `/v1/cases/:id/upload` | Inizializza upload |
| POST | `/v1/cases/:id/messages` | Invia messaggio |
| GET | `/v1/cases/:id/messages` | Leggi messaggi |
| POST | `/v1/clinical/cases/:id/opinions` | Crea parere |
| POST | `/v1/clinical/opinions/:id/sign` | Firma parere |
| POST | `/v1/payments/authorization` | Preautorizza pagamento |

## Licenza

Proprietario — Tutti i diritti riservati.