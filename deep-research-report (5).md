# Blueprint tecnico operativo per la piattaforma di verifica medica delle diagnosi generate da ChatGPT

## Executive summary

### Obiettivo del prodotto

La piattaforma deve realizzare un servizio molto preciso:

> **Il paziente ha già consultato autonomamente ChatGPT. Carica la conversazione e le conclusioni ricevute. Un medico abilitato esamina il materiale, può chiedere informazioni aggiuntive e produce una valutazione clinica indipendente.**

Per il primo prodotto raccomando di **non integrare alcun modello AI nel backend**. Il backend non deve interrogare ChatGPT, estrarre automaticamente diagnosi, riordinare il differenziale, assegnare probabilità o suggerire al medico cosa convalidare. Deve acquisire la documentazione fornita dal paziente, conservarla in sicurezza, renderla disponibile al medico assegnato e registrare il giudizio professionale.

Questa separazione è tecnicamente semplice e ha anche un'importante coerenza con il quadro privacy italiano. Nel Compendio del marzo 2024 dedicato proprio alle piattaforme che mettono in contatto pazienti e professionisti sanitari, il Garante distingue i trattamenti amministrativi effettuati dal gestore della piattaforma dai trattamenti sanitari per diagnosi e cura effettuati dal professionista. Per i dati sanitari trattati dal medico a fini di cura, il professionista opera come titolare; il gestore della piattaforma può svolgere per suo conto funzioni tecniche e amministrative, quali raccolta, archiviazione e conservazione della documentazione, in qualità di responsabile del trattamento. citeturn18view0turn19view1

### Architettura che raccomando

La mia scelta di riferimento per la prima versione di produzione sarebbe:

| Componente | Scelta raccomandata |
|---|---|
| Frontend | Next.js |
| Hosting frontend | Vercel **opzionale**, oppure Cloud Run per ridurre il numero di fornitori |
| Backend | Python FastAPI |
| Packaging backend | Docker |
| Hosting backend | Google Cloud Run, regione Milano `europe-west8` |
| Database | Cloud SQL for PostgreSQL, Milano |
| Documenti | Google Cloud Storage privato, Milano; successivamente eventuale dual-region italiana |
| Identità | Google Cloud Identity Platform |
| MFA | Obbligatoria per medici e amministratori, preferibilmente TOTP |
| Secrets | Secret Manager |
| CI/CD | GitHub Actions + Workload Identity Federation |
| Container registry | Artifact Registry |
| Audit | tabella applicativa append-only + logging infrastrutturale privo di dati clinici |
| AI nel prodotto MVP | **Nessuna** |

Cloud Run, Cloud SQL e Cloud Storage sono disponibili in regioni italiane; Cloud Run e Cloud SQL sono disponibili a Milano, mentre Cloud Storage supporta sia Milano sia Torino e consente configurazioni dual-region. citeturn16search2turn22search1turn22search3

La principale ragione per scegliere questa architettura non è che Google Cloud sia l'unica soluzione possibile. È che consente di tenere **API, database e documenti sanitari nello stesso ecosistema e nella stessa area geografica**, con un backend containerizzato ma senza dover amministrare server o Kubernetes. Cloud Run esegue direttamente immagini container e gestisce automaticamente l'infrastruttura di esecuzione. citeturn15search17turn16search2

### La risposta definitiva alla questione Docker

Per il team deve essere chiarissimo:

> **Docker contiene il backend. Cloud Run esegue quel container. PostgreSQL e i documenti dei pazienti non vengono messi dentro Docker.**

In questo progetto Docker serve a costruire una versione standard e riproducibile del backend:

```text
Codice FastAPI
+ Python
+ librerie
+ configurazione runtime
        ↓
    Docker image
        ↓
   Cloud Run
```

I dati persistenti stanno invece qui:

```text
Cloud SQL PostgreSQL     ← dati strutturati
Cloud Storage            ← PDF, immagini, conversazioni, documenti
```

Docker Compose è utile localmente per far partire API e PostgreSQL con un solo file; Docker documenta Compose precisamente come strumento per definire ed eseguire applicazioni multi-container mediante una configurazione YAML. citeturn0search6

### Vercel senza Docker è un'alternativa reale

È possibile costruire anche:

```text
Next.js
  ↓
Vercel
  ↓
Route Handlers / Vercel Functions
  ↓
PostgreSQL + Object Storage
```

e quindi **non usare Docker in produzione**.

Questa architettura è perfettamente plausibile per un MVP prevalentemente CRUD. Tuttavia le Vercel Functions hanno un limite di **4,5 MB per request/response body**, per cui gli allegati clinici devono essere caricati direttamente nell'object storage anziché passare attraverso la function. citeturn21search1turn21search10

Una correzione importante rispetto a quanto ti avevo detto precedentemente: nel 2026 Vercel **può anche eseguire container OCI costruiti da Dockerfile** mediante il nuovo Container Runtime. Al 27 ottobre 2026, però, il servizio risulta ancora in **Beta**, quindi non lo sceglierei come runtime primario del backend sanitario senza una valutazione specifica del rischio operativo. citeturn15search0turn15search8

### Regole architetturali non negoziabili

Nel blueprint userò tre livelli:

**MUST** = requisito che blocca il rilascio; **SHOULD** = requisito fortemente raccomandato; **MAY** = opzionale.

Per la prima produzione considero MUST: separazione degli ambienti, MFA per medici/admin, cifratura, autorizzazione a livello di singola risorsa, audit trail, backup testati, nessun dato sanitario nei log applicativi, object storage non pubblico, database non esposto direttamente a Internet, gestione formale dei fornitori/sub-responsabili e completamento della DPIA prima del go-live. Il GDPR richiede misure tecniche e organizzative commisurate al rischio, mentre il Garante dedica esplicitamente alle piattaforme sanitarie sezioni su DPIA, privacy by design e sicurezza. citeturn17search1turn18view0turn20view0


## Architettura applicativa e flussi di dati

### Architettura raccomandata

La configurazione che darei al team è questa:

```mermaid
flowchart TB
    P[Paziente]
    D[Medico]
    A[Amministratore]

    FE[Next.js Frontend<br/>Vercel opzionale]
    IDP[Google Identity Platform<br/>OIDC + MFA]
    API[FastAPI Backend<br/>Docker / Cloud Run<br/>Milano]
    DB[(Cloud SQL PostgreSQL<br/>Milano)]
    OBJ[(Cloud Storage privato<br/>Milano / Italia)]
    AUD[(Audit Events)]
    LOG[Cloud Logging<br/>senza PHI]
    SEC[Secret Manager]
    CI[GitHub Actions]
    REG[Container Registry]

    P --> FE
    D --> FE
    A --> FE

    FE --> IDP
    P -->|API HTTPS diretta| API
    D -->|API HTTPS diretta| API
    A -->|API HTTPS diretta| API

    API --> DB
    API --> AUD
    API --> LOG
    API --> SEC
    API -->|genera URL firmati| OBJ

    P -->|upload diretto con URL firmato| OBJ
    D -->|download autorizzato con URL temporaneo| OBJ

    CI --> REG
    REG --> API
```

Nel modello con Vercel, il frontend dovrebbe funzionare prevalentemente come **application shell**: le schermate vengono distribuite da Vercel, ma i dati clinici vengono richiesti dal browser direttamente all'API sanitaria su Cloud Run. In altre parole, una pagina come `/doctor/cases/123` può essere servita da Vercel, ma il contenuto sanitario del caso `123` viene recuperato nel browser dopo autenticazione, non renderizzato lato server da una Vercel Function.

Questo riduce il numero di componenti che ricevono effettivamente il contenuto sanitario. È una scelta architetturale di minimizzazione coerente con i principi di privacy by design richiamati dal Garante e dall'articolo 25 GDPR. citeturn19view2turn20view0

Per il frontend Vercel dispone di regioni compute europee; se si introducono Route Handlers o altre Functions che trattano dati sensibili, la regione deve essere configurata deliberatamente e posta vicino al datastore, invece di affidarsi implicitamente alle impostazioni di default. La stessa documentazione Vercel raccomanda di collocare compute e database vicini tra loro. citeturn21search0turn15search32

### Variante completamente Google Cloud

Per minimizzare ulteriormente fornitori e flussi, Next.js può essere containerizzato e ospitato anch'esso su Cloud Run:

```mermaid
flowchart LR
    U[Browser]
    WEB[Next.js<br/>Cloud Run]
    API[FastAPI<br/>Cloud Run]
    AUTH[Identity Platform]
    DB[(Cloud SQL)]
    STORE[(Cloud Storage)]

    U --> WEB
    U --> AUTH
    WEB --> API
    U -->|API autenticata| API
    API --> DB
    API --> STORE
```

Questa configurazione rinuncia a parte della comodità specifica di Vercel per Next.js, ma permette di gestire praticamente tutto il perimetro applicativo attraverso un unico cloud provider. È la variante che sceglierei qualora la priorità fosse **governance e riduzione del numero di responsabili/sub-responsabili** anziché massima comodità frontend. L'EDPB sottolinea che il titolare deve conoscere e governare i propri responsabili e sub-responsabili e verificarne nel tempo le garanzie, quindi ridurre la catena dei fornitori ha un valore operativo reale. citeturn17search2turn17search10

### Variante serverless Vercel

L'alternativa più semplice per gli sviluppatori sarebbe:

```mermaid
flowchart TB
    U[Paziente / Medico]
    NX[Next.js su Vercel]
    FN[Vercel Functions<br/>Route Handlers]
    AUTH[Identity Provider]
    PG[(PostgreSQL gestito UE)]
    OBJ[(Object Storage UE)]

    U --> NX
    NX --> AUTH
    NX --> FN
    FN --> PG
    FN -->|presigned upload URL| OBJ
    U -->|upload diretto| OBJ
```

Next.js Route Handlers consentono di implementare normali endpoint HTTP direttamente nell'applicazione Next.js, quindi per un prodotto piccolo possono fungere da backend-for-frontend o persino da backend applicativo. citeturn12search1turn12search28

Il limite più evidente per il nostro caso è l'upload: una conversazione testuale raramente sarà enorme, ma referti, PDF e immagini possono superare facilmente il limite applicativo. Vercel impone 4,5 MB al body di una Function e raccomanda l'upload diretto dal client per file più grandi. citeturn21search1turn21search13

La conseguenza è importante: **anche scegliendo serverless, l'upload diretto verso object storage è l'architettura corretta**.

### Flusso di caricamento consigliato

Il frontend non deve fare:

```text
Browser → backend → PDF → storage
```

ma:

```text
Browser
   │
   │ 1. POST /uploads/presign
   ▼
Backend
   │
   │ 2. URL temporaneo
   ▼
Browser
   │
   │ 3. Upload PDF diretto
   ▼
Object Storage
   │
   │ 4. object_key + hash
   ▼
Backend / Database
```

L'API non riceve quindi il file binario, ma soltanto i metadati e l'identificativo dell'oggetto. Google Cloud Storage supporta URL firmati che concedono accesso temporaneo a uno specifico oggetto, rendendo questo pattern adatto al caricamento e download controllato. citeturn6search23

Il backend deve convalidare prima di rilasciare l'URL: identità dell'utente, ownership del caso, MIME type ammesso, dimensione massima e finalità dell'upload. Dopo il caricamento deve verificare almeno dimensione, hash e stato di sicurezza prima di rendere il documento visibile al medico.

### Confine funzionale dell'MVP

Il backend **MUST NOT**:

```text
- chiamare ChatGPT per reinterpretare il caso
- generare una propria diagnosi differenziale
- assegnare probabilità alle diagnosi
- raccomandare automaticamente un trattamento
- decidere automaticamente che il caso è urgente/non urgente
- suggerire al medico "conferma questa diagnosi"
```

Può invece:

```text
- ricevere il testo o il PDF fornito dal paziente
- conservarlo
- verificare che il file sia tecnicamente valido
- assegnare il caso a un medico
- presentare la conversazione originale
- raccogliere richieste di integrazione
- registrare il giudizio del medico
- produrre un documento finale
- inviare notifiche prive di informazioni cliniche
```

Questo confine deve essere formalizzato in un **Architecture Decision Record**, perché una futura funzione che interpreti automaticamente il contenuto clinico modificherebbe non solo il software ma anche il profilo regolatorio e privacy del trattamento. Il Garante distingue espressamente il servizio tecnico-amministrativo della piattaforma dal trattamento effettuato dal professionista per finalità di diagnosi e cura. citeturn18view0turn19view1


## Docker, serverless e confronto degli hosting

### Cosa deve fare Docker nel nostro progetto

La definizione operativa per gli sviluppatori è:

> **Docker è il formato con cui confezioniamo il backend FastAPI in modo che la stessa applicazione testata localmente possa essere eseguita in staging e produzione.**

Non è:

```text
Docker ≠ server
Docker ≠ database
Docker ≠ storage
Docker ≠ cloud
Docker ≠ sistema di autenticazione
```

Il ciclo dovrebbe essere:

```mermaid
flowchart LR
    CODE[Codice]
    TEST[Test automatici]
    IMG[Docker image]
    REG[Container Registry]
    STG[Staging]
    PROD[Production]

    CODE --> TEST
    TEST --> IMG
    IMG --> REG
    REG --> STG
    STG --> PROD
```

Docker Compose consente invece al programmatore di avviare localmente più servizi descritti in un singolo YAML. Docker documenta inoltre l'uso di Compose anche su singoli host di produzione, ma per il nostro caso non utilizzerei questo approccio: in produzione database e storage devono essere servizi gestiti indipendentemente dal ciclo di vita dei container. citeturn0search6turn0search2

| Ambiente | Uso di Docker | Cosa contiene |
|---|---:|---|
| Laptop sviluppatore | Sì | API + dipendenze; PostgreSQL locale via Compose |
| Pull request | Sì | Build e test dell'immagine |
| Staging | Sì | Stessa immagine candidata alla produzione |
| Production Cloud Run | Sì | Backend stateless |
| PostgreSQL production | **No** | Cloud SQL gestito |
| Documenti production | **No** | Cloud Storage |
| Frontend Vercel | Normalmente no | Next.js nativo |
| Vercel serverless backend | No | Functions |
| Vercel Container Runtime | Possibile | Container OCI, ma attualmente Beta |

Vercel ha introdotto nel 2026 un runtime capace di eseguire immagini OCI costruite da `Dockerfile` o `Containerfile`, oltre a un registry Docker-compatible; al momento della ricerca il Container Runtime è indicato come Beta su tutti i piani. citeturn15search0turn15search8

### Confronto delle piattaforme

| Piattaforma | Modello | Docker | Regione UE utile | Scaling | Costi compute indicativi* | Valutazione per questo progetto |
|---|---|---:|---|---|---:|---|
| **Vercel Functions** | Serverless | Non necessario | Varie regioni europee | Automatico | Pro da $20/mese + usage | Ottima semplicità; buono per frontend/BFF |
| **Vercel Container Runtime** | Serverless container | Sì | Varie | Automatico | usage Vercel | Interessante, ma Beta |
| **Railway** | PaaS/container | Sì | Amsterdam | Gestito | Pro minimo circa $20; CPU/RAM a consumo | Molto semplice, valido per pilot |
| **Render** | PaaS/container | Sì | Francoforte | Gestito | istanze a prezzo fisso + servizi | Semplice, valido per pilot |
| **Google Cloud Run** | Serverless container | Sì | **Milano** | Automatico, anche scale-to-zero | circa $28,51/mese per 0,5 vCPU + 1 GiB sempre attivi, prima del free tier | **Raccomandato** |
| **AWS ECS/Fargate** | Container managed | Sì | **Milano** | Molto configurabile | compute base circa $17,8/mese nell'esempio us-east-1; servizi accessori extra | Ottimo, ma più complesso |
| **Azure Container Instances** | Container on-demand | Sì | region dependent | Più elementare | per secondo di CPU/RAM | Meglio per job semplici che come prima scelta API |
| **Azure Container Apps** | Serverless container | Sì | Varie | Gestito | usage based | Più adatto di ACI per API moderne |

\*Le cifre sono **compute-only**, non preventivi dell'intera infrastruttura, e non includono database, storage, networking, logging, backup, supporto, IVA o eventuali servizi di sicurezza.

Vercel Pro costa attualmente $20/mese per la piattaforma con un deploying seat incluso e $20 di credito mensile sull'infrastruttura; gli ulteriori seat di deploy costano anch'essi $20/mese. citeturn21search2turn21search11

Railway pubblica un prezzo di $20 per vCPU/mese, $10 per GB RAM/mese, $0,05/GB di egress e $0,15/GB/mese per i volumi; il piano Pro opera con un minimo mensile di utilizzo di circa $20. Railway dispone inoltre di una regione europea ad Amsterdam e può distribuire direttamente immagini Docker. citeturn16search0turn16search8turn7search1

Render supporta sia build da repository sia immagini Docker precompilate e offre una regione a Francoforte; il filesystem standard dei web service è effimero, quindi i file persistenti non devono essere considerati parte del container. Render offre anche PostgreSQL gestito. citeturn16search11turn7search2turn16search13turn16search1

Cloud Run ha pricing a consumo differente per regione e configurazione; Milano è inclusa tra le regioni disponibili. Utilizzando i prezzi Tier 1 documentati di `$0.000018/vCPU-second` e `$0.000002/GiB-second` per l'instance-based billing, 0,5 vCPU e 1 GiB allocati continuamente per 30 giorni equivalgono a circa `$28,51` di puro compute prima di free tier e altre componenti. Con billing request-based e scale-to-zero, un servizio poco utilizzato può costare molto meno. citeturn16search2turn9search0

AWS Fargate fattura vCPU, memoria e storage dal momento in cui inizia il pull dell'immagine fino alla terminazione del task, con fatturazione al secondo. Usando le tariffe dell'esempio ufficiale `us-east-1`, un task Linux x86 da 0,5 vCPU e 1 GB sempre acceso per 30 giorni vale circa `$17,77` di puro Fargate compute; **non è il prezzo di Milano**, e in una reale architettura ECS vanno aggiunti almeno gli eventuali componenti networking, bilanciamento, logging e database. ECS/Fargate è disponibile anche nella regione di Milano. citeturn16search3turn1search10

Azure Container Instances esegue container Docker on-demand e fattura memoria e core per secondo; lo considero meno conveniente operativamente per un'API sanitaria permanente perché mette a disposizione primitive più elementari rispetto a Cloud Run o Azure Container Apps. Microsoft descrive Container Apps, invece, come piattaforma serverless gestita per container. citeturn15search6turn15search18turn2search20

### Perché non sceglierei Railway o Render come prima produzione sanitaria

Non c'è un problema fondamentale che li renda inadatti. Entrambi riducono drasticamente il lavoro DevOps e supportano container; Railway pubblica una DPA GDPR e Render dichiara certificazioni come SOC 2 Type II, ISO 27001 e accordi GDPR. citeturn7search19turn7search15

La mia preferenza per GCP deriva invece dall'insieme:

```text
Cloud Run Milano
Cloud SQL Milano
Cloud Storage Milano/Torino
Identity Platform
IAM
Secret Manager
KMS
logging
backup
```

in un solo perimetro cloud. È quindi una **decisione di architettura e governance**, non un giudizio assoluto sulla sicurezza degli altri provider.

### Quando sceglierei invece Vercel-only

Lo sceglierei se le priorità fossero:

```text
1. arrivare all'MVP con pochissimo DevOps
2. team quasi esclusivamente TypeScript
3. backend semplice e request/response
4. pochi processi asincroni
5. upload tramite object storage diretto
```

In questa configurazione:

```text
Next.js
+ Route Handlers
+ Vercel Functions
+ PostgreSQL esterno
+ Object storage esterno
```

Docker diventa opzionale persino in sviluppo.

Il compromesso è una maggiore dipendenza dal runtime e dai limiti Vercel: le Functions hanno limiti documentati di memoria, durata e payload, incluso il tetto di 4,5 MB per request e response. citeturn21search1turn21search8


## Dati sanitari, autenticazione, sicurezza e audit

### Modello privacy da assumere in progettazione

Il punto più importante per backend e DPO è evitare di trattare tutti i dati come se avessero lo stesso ruolo giuridico.

Una matrice iniziale dovrebbe essere:

| Trattamento | Ruolo progettuale ipotizzato | Esempio |
|---|---|---|
| Creazione account paziente | Piattaforma titolare | email, account, preferenze |
| Gestione contratto medico | Piattaforma titolare | profilo professionale, fatturazione |
| Acquisizione amministrativa della richiesta | Piattaforma titolare per il proprio servizio, da validare nella DPIA | tipo di richiesta, stato |
| Documentazione clinica usata dal medico | Medico titolare; piattaforma responsabile ex art. 28 per le funzioni tecniche | conversazione ChatGPT, referti |
| Valutazione clinica | Medico titolare | parere conclusivo |
| Audit tecnico | ruolo da determinare per finalità specifica | accessi, operazioni |
| Marketing | finalità autonoma e separata | newsletter |

Il Garante indica che il gestore della piattaforma è titolare dei dati necessari a registrazione e servizi propri; per i dati sanitari trattati dal professionista per finalità di cura, invece, il professionista opera come titolare e la piattaforma può essere designata responsabile per attività tecniche quali raccolta, archiviazione e conservazione della documentazione. Il relativo atto deve rispettare l'articolo 28 GDPR. citeturn18view0turn19view1

Questa tabella è quindi una **base di progettazione**, non sostituisce la mappatura giuridica finale: l'effettivo ruolo dipende dalle finalità e dai mezzi determinati concretamente. Le linee guida EDPB definiscono infatti il responsabile come soggetto che tratta dati per conto del titolare e secondo le sue istruzioni. citeturn17search2turn17search18

### DPIA come gate di produzione

La DPIA non deve essere un documento scritto dopo aver completato il software. Deve essere un deliverable del progetto.

Per questa piattaforma suggerisco una regola semplice:

```text
No completed DPIA
       ↓
No production patient data
```

Il Garante richiama espressamente, nel proprio Compendio per le piattaforme sanitarie, la valutazione d'impatto per i trattamenti che comportano elevato rischio e sottolinea che la valutazione non deve essere considerata statica, ma soggetta a revisione. citeturn18view0

### Identità e ruoli

Userei tre ruoli primari applicativi:

| Ruolo | Permessi |
|---|---|
| `PATIENT` | creare e visualizzare esclusivamente i propri casi |
| `DOCTOR` | visualizzare esclusivamente i casi assegnati e produrre revisioni |
| `ADMIN` | amministrare la piattaforma, senza accesso clinico indiscriminato |

A livello interno dividerei poi `ADMIN` in almeno:

```text
SUPPORT_ADMIN
CLINICAL_ADMIN
SECURITY_ADMIN
```

Un addetto al customer support non deve poter leggere automaticamente l'intera conversazione clinica solo perché possiede un account amministrativo.

L'autorizzazione non deve fermarsi al semplice ruolo:

```python
if user.role == "PATIENT":
    assert case.patient_id == user.id

if user.role == "DOCTOR":
    assert case.assigned_doctor_id == user.id

if user.role == "ADMIN":
    assert user.has_permission("case_metadata:read")
```

Quindi: **RBAC + controllo della relazione con la risorsa**.

### MFA

Per medici e amministratori l'MFA deve essere obbligatoria. Come default suggerisco TOTP tramite authenticator app anziché basare l'architettura esclusivamente su SMS.

Google Identity Platform supporta TOTP come secondo fattore e permette configurazioni in cui l'MFA è obbligatoria; la documentazione supporta inoltre modelli di step-up authentication per operazioni più sensibili. citeturn22search2turn22search11turn22search4

Politica suggerita:

| Utente | MFA |
|---|---|
| Paziente al signup | facoltativa inizialmente |
| Paziente apertura documento medico | SHOULD: step-up |
| Medico | **MUST** |
| Admin | **MUST** |
| Cambio email/password | **MUST** step-up |
| Export massivo | **MUST** step-up + audit |

### Cifratura e accesso

Cloud SQL consente di mantenere l'istanza nella regione scelta e supporta meccanismi di connessione cifrata; Google Cloud offre inoltre CMEK per chi desidera il controllo delle chiavi di cifratura. Cloud Storage cifra i dati a riposo per default e può essere configurato con chiavi gestite dal cliente. citeturn22search0turn22search5turn22search7turn6search6

Per il progetto:

```text
Internet
   │ HTTPS
   ▼
API
   │ connessione privata / protetta
   ▼
PostgreSQL

Object Storage:
PUBLIC ACCESS = OFF

Accesso documento:
utente autorizzato
   ↓
backend
   ↓
signed URL breve
   ↓
singolo oggetto
```

Il nome del bucket e dell'object key non deve contenere nome, cognome, codice fiscale o diagnosi. Utilizzare UUID casuali:

```text
cases/01JCF.../attachments/01JCG....pdf
```

non:

```text
rossi_mario_infarto_chatgpt.pdf
```

### Logging

Il logging applicativo deve partire dal principio:

> **Un log serve a capire cosa ha fatto il sistema, non cosa ha raccontato il paziente.**

Quindi è vietato:

```text
INFO Patient said: "ho dolore toracico..."
INFO ChatGPT diagnosis: "pericardite..."
ERROR payload={"full_conversation": "..."}
```

È accettabile:

```json
{
  "event": "case_opened",
  "actor_id": "usr_01...",
  "case_id": "case_01...",
  "request_id": "req_01...",
  "status": 200,
  "duration_ms": 83
}
```

Il Garante richiede misure tecniche e organizzative adeguate alla natura dei dati e ai rischi, oltre a revisione periodica delle misure e procedure per i data breach. citeturn20view0turn17search1

### Audit trail

I normali log e l'audit trail devono essere due cose differenti.

`application_logs`:

```text
performance
errori
latency
request_id
metriche
```

`audit_events`:

```text
chi
ha fatto cosa
su quale risorsa
quando
da quale sessione
con quale risultato
```

Schema iniziale:

```sql
CREATE TABLE audit_events (
    id              UUID PRIMARY KEY,
    occurred_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    actor_id        UUID,
    actor_role      TEXT NOT NULL,
    action          TEXT NOT NULL,
    resource_type   TEXT NOT NULL,
    resource_id     UUID,
    result          TEXT NOT NULL,
    correlation_id  UUID NOT NULL,
    ip_hash         TEXT,
    metadata        JSONB NOT NULL DEFAULT '{}'::jsonb
);
```

`metadata` **MUST NOT** contenere testo libero clinico.

Gli eventi minimi da tracciare:

| Evento | Audit |
|---|---:|
| login/logout | sì |
| MFA enrollment/reset | sì |
| apertura caso clinico | sì |
| download allegato | sì |
| assegnazione medico | sì |
| modifica stato | sì |
| richiesta integrazione | sì |
| submit review | sì |
| generazione documento finale | sì |
| accesso admin eccezionale | sì |
| export | sì |

Per aumentare la resistenza alle alterazioni, l'applicazione non deve avere normali operazioni `UPDATE` o `DELETE` sugli audit event; eventuali correzioni generano nuovi eventi.

### Database

Il database relazionale dovrebbe partire da queste entità:

```mermaid
erDiagram
    USER ||--o| PATIENT_PROFILE : has
    USER ||--o| DOCTOR_PROFILE : has
    PATIENT_PROFILE ||--o{ CASE : creates
    DOCTOR_PROFILE ||--o{ CASE : assigned
    CASE ||--o{ ATTACHMENT : contains
    CASE ||--o{ CASE_MESSAGE : contains
    CASE ||--o{ REVIEW : receives
    CASE ||--o{ CASE_EVENT : changes
    USER ||--o{ AUDIT_EVENT : produces
```

Tabelle minime:

```text
users
patient_profiles
doctor_profiles
doctor_credentials
cases
case_assignments
attachments
case_messages
reviews
review_documents
case_events
audit_events
consent_records
notification_events
```

Le conversazioni di ChatGPT non dovrebbero essere duplicate contemporaneamente in tre posti. Se l'originale è un PDF, il binario resta nello storage e PostgreSQL conserva metadati, hash e object key. Se il paziente incolla testo, la scelta tra PostgreSQL e object storage deve essere standardizzata dal team; io preferirei object storage anche per il payload lungo e PostgreSQL per i campi indicizzati.

### Stato del caso

Userei una macchina a stati esplicita:

```mermaid
stateDiagram-v2
    [*] --> DRAFT
    DRAFT --> SUBMITTED
    SUBMITTED --> ASSIGNED
    ASSIGNED --> UNDER_REVIEW
    UNDER_REVIEW --> NEEDS_INFORMATION
    NEEDS_INFORMATION --> UNDER_REVIEW
    UNDER_REVIEW --> REVIEWED
    DRAFT --> CANCELLED
    SUBMITTED --> CANCELLED
    REVIEWED --> [*]
```

Un eventuale esito medico di urgenza **non deve essere confuso con lo stato tecnico del workflow**. Potrebbe essere:

```text
review.outcome = URGENT_EVALUATION
case.status = REVIEWED
```

Questo rende chiaro che è stato il medico a esprimere l'indicazione.

### Backup, ripristino e retention

Cloud SQL è un database gestito e dispone di funzionalità di backup e recovery; Google ha inoltre esteso nel 2026 le funzioni di enhanced backup e protezione tramite CMEK. citeturn6search17turn22search5

Come target tecnico iniziale proporrei:

| Parametro | Target progettuale |
|---|---:|
| RPO database | ≤ 15 minuti |
| RTO core service | ≤ 4 ore |
| Restore test | trimestrale |
| Backup encryption | obbligatoria |
| Staging con dati reali | vietato |
| Copia DB production → staging | vietata salvo procedura di anonimizzazione verificata |

Questi sono **obiettivi architetturali**, non periodi imposti dalla legge.

Non inserirei invece nel codice qualcosa come:

```python
RETENTION_YEARS = 10
```

senza prima definire giuridicamente la categoria documentale. Il GDPR impone il principio di limitazione della conservazione: i dati devono essere conservati per un arco di tempo non superiore al necessario rispetto alle finalità, salvo specifici obblighi applicabili. citeturn17search1

Costruirei quindi una policy configurabile:

```text
account_data
clinical_case
clinical_document
billing_data
audit_log
security_log
temporary_upload
abandoned_draft
```

con per ciascuna:

```text
retention period
legal basis
delete/anonymize action
owner
legal approval date
```

Il periodo effettivo per i documenti clinici deve essere approvato dal responsabile legale/DPO e coerente con la natura della prestazione sanitaria.


## Contratto API e modello operativo frontend-backend

### Convenzioni API

Il backend espone API JSON versionate:

```text
https://api.example.it/v1/...
```

Ogni richiesta sensibile deve avere:

```http
Authorization: Bearer <token>
X-Request-ID: <uuid>
```

Per le operazioni di creazione importanti utilizzerei inoltre:

```http
Idempotency-Key: <uuid>
```

in modo che un doppio click o un retry di rete non generi due casi o due revisioni.

L'API dovrebbe essere definita prima nel file OpenAPI e poi implementata. OpenAPI è uno standard indipendente dal linguaggio per descrivere API HTTP; la specifica più recente pubblicata nel 2026 è la famiglia 3.2, mentre per l'MVP utilizzerei `3.1.1` per massimizzare la compatibilità con generatori e tooling esistenti. citeturn12search0turn12search6

### Endpoint principali

Contratto minimo:

| Metodo | Endpoint | Ruolo |
|---|---|---|
| `POST` | `/v1/uploads/presign` | patient |
| `POST` | `/v1/submit-conversation` | patient |
| `GET` | `/v1/case/{id}` | owner/assigned doctor |
| `POST` | `/v1/case/{id}/request-information` | doctor |
| `POST` | `/v1/case/{id}/information` | patient |
| `POST` | `/v1/doctor/review` | doctor |
| `GET` | `/v1/doctor/cases` | doctor |
| `GET` | `/v1/me/cases` | patient |
| `GET` | `/v1/case/{id}/document` | authorized |
| `POST` | `/v1/case/{id}/cancel` | patient/admin policy |

### Esempio OpenAPI

```yaml
openapi: 3.1.1

info:
  title: Medical AI Verification API
  version: 0.1.0

servers:
  - url: https://api.example.it/v1

security:
  - bearerAuth: []

paths:

  /submit-conversation:
    post:
      summary: Invia una conversazione ChatGPT per revisione medica
      operationId: submitConversation
      tags: [Patient]
      parameters:
        - in: header
          name: Idempotency-Key
          required: true
          schema:
            type: string
            format: uuid
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/SubmitConversationRequest"
      responses:
        "201":
          description: Caso creato
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Case"
        "401":
          description: Non autenticato
        "403":
          description: Non autorizzato
        "409":
          description: Richiesta già elaborata
        "422":
          description: Payload non valido

  /case/{id}:
    get:
      summary: Restituisce un caso autorizzato
      operationId: getCase
      tags: [Case]
      parameters:
        - in: path
          name: id
          required: true
          schema:
            type: string
            format: uuid
      responses:
        "200":
          description: Caso
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/CaseDetail"
        "401":
          description: Non autenticato
        "403":
          description: Utente autenticato ma non autorizzato
        "404":
          description: Caso non trovato

  /doctor/review:
    post:
      summary: Registra la valutazione indipendente del medico
      operationId: submitDoctorReview
      tags: [Doctor]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/DoctorReviewRequest"
      responses:
        "201":
          description: Revisione registrata
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Review"
        "401":
          description: Non autenticato
        "403":
          description: Non medico, MFA insufficiente o caso non assegnato
        "409":
          description: Versione del caso non più corrente
        "422":
          description: Revisione non valida

components:

  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT

  schemas:

    SubmitConversationRequest:
      type: object
      required:
        - source
        - patient_attestation
      properties:
        source:
          type: string
          const: chatgpt
        conversation_text:
          type: string
          maxLength: 100000
        attachment_id:
          type: string
          format: uuid
        patient_context:
          type: object
          properties:
            age:
              type: integer
              minimum: 18
              maximum: 120
            sex:
              type: string
              enum: [female, male, other, prefer_not_to_say]
        patient_attestation:
          type: boolean
          description: Conferma che il contenuto caricato corrisponde a quello fornito dal paziente
      oneOf:
        - required: [conversation_text]
        - required: [attachment_id]

    Case:
      type: object
      required: [id, status, created_at, version]
      properties:
        id:
          type: string
          format: uuid
        status:
          type: string
          enum:
            - DRAFT
            - SUBMITTED
            - ASSIGNED
            - UNDER_REVIEW
            - NEEDS_INFORMATION
            - REVIEWED
            - CANCELLED
        version:
          type: integer
        created_at:
          type: string
          format: date-time

    CaseDetail:
      allOf:
        - $ref: "#/components/schemas/Case"
        - type: object
          properties:
            attachments:
              type: array
              items:
                type: object
                properties:
                  id:
                    type: string
                    format: uuid
                  filename:
                    type: string
                  mime_type:
                    type: string
            review:
              oneOf:
                - $ref: "#/components/schemas/Review"
                - type: "null"

    DoctorReviewRequest:
      type: object
      required:
        - case_id
        - expected_case_version
        - outcome
        - clinical_assessment
        - attestation
      properties:
        case_id:
          type: string
          format: uuid
        expected_case_version:
          type: integer
        outcome:
          type: string
          enum:
            - CONFIRMED
            - MODIFIED
            - INSUFFICIENT_DATA
            - NEEDS_DIRECT_EVALUATION
            - URGENT_EVALUATION
        clinical_assessment:
          type: string
          minLength: 20
          maxLength: 20000
        recommended_actions:
          type: string
          maxLength: 10000
        attestation:
          type: boolean
          const: true

    Review:
      type: object
      required:
        - id
        - case_id
        - doctor_id
        - outcome
        - created_at
      properties:
        id:
          type: string
          format: uuid
        case_id:
          type: string
          format: uuid
        doctor_id:
          type: string
          format: uuid
        outcome:
          type: string
        created_at:
          type: string
          format: date-time
        document_id:
          type:
            - string
            - "null"
          format: uuid
```

### Concorrenza e double-submit del medico

Supponiamo che il medico apra il caso nella versione `7`.

Nel frattempo il paziente aggiunge un documento e il caso diventa versione `8`.

Quando il medico prova a inviare:

```json
{
  "case_id": "...",
  "expected_case_version": 7
}
```

il backend deve rispondere:

```http
409 Conflict
```

e chiedere di riesaminare il materiale aggiornato.

Questo semplice optimistic locking evita che un medico firmi una valutazione ignorando inconsapevolmente informazioni arrivate durante la compilazione.

### Il frontend non deve essere fonte di autorizzazione

Nascondere un pulsante nel browser non è controllo di accesso.

Quindi:

```typescript
// corretto come UX, ma NON come sicurezza
if (user.role !== "DOCTOR") {
  hideReviewButton();
}
```

deve essere accompagnato sempre da:

```python
# controllo reale sul server
require_role(user, "DOCTOR")
require_mfa(user)
require_assigned_doctor(case, user)
```

L'API deve respingere la richiesta anche se un utente costruisce manualmente la chiamata HTTP.

### Documento conclusivo

Una volta salvata la revisione, il backend dovrebbe creare una versione immutabile:

```text
review record
     ↓
render template
     ↓
PDF
     ↓
SHA-256
     ↓
object storage
     ↓
review_documents
```

Campi minimi:

```text
document_id
review_id
doctor_id
generated_at
sha256
storage_object_key
template_version
```

Non affermerei nel blueprint che una particolare tipologia di firma elettronica sia giuridicamente obbligatoria senza prima definire precisamente il tipo di prestazione e di documento. A livello tecnico, però, identità del medico, timestamp, versione e hash del documento devono essere conservati in modo verificabile.


## Repository, Docker e pipeline CI/CD

### Struttura del repository

Per un team piccolo sceglierei un monorepo:

```text
medical-verification/
│
├── apps/
│   └── web/
│       ├── app/
│       ├── components/
│       ├── lib/
│       └── package.json
│
├── services/
│   └── api/
│       ├── app/
│       │   ├── api/
│       │   ├── auth/
│       │   ├── cases/
│       │   ├── reviews/
│       │   ├── audit/
│       │   └── main.py
│       ├── tests/
│       ├── requirements.txt
│       └── Dockerfile
│
├── packages/
│   └── api-client/
│
├── infra/
│   ├── terraform/
│   └── docker/
│
├── docs/
│   ├── openapi.yaml
│   ├── architecture/
│   ├── adr/
│   └── threat-model/
│
├── compose.yaml
└── .github/
    └── workflows/
        ├── ci.yml
        └── deploy-api.yml
```

La specifica OpenAPI deve poter generare automaticamente i tipi TypeScript per il frontend. In questo modo il team frontend non riscrive manualmente le interfacce di ogni risposta.

### Dockerfile backend

Esempio di base:

```dockerfile
# services/api/Dockerfile

FROM python:3.13-slim AS builder

ENV PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /build

COPY requirements.txt .

RUN pip wheel \
    --wheel-dir /wheels \
    -r requirements.txt


FROM python:3.13-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8080

RUN groupadd --system app \
    && useradd --system \
       --gid app \
       --home /app \
       app

WORKDIR /app

COPY --from=builder /wheels /wheels

RUN pip install \
    --no-cache-dir \
    /wheels/* \
    && rm -rf /wheels

COPY app ./app

RUN chown -R app:app /app

USER app

EXPOSE 8080

CMD [
  "uvicorn",
  "app.main:app",
  "--host", "0.0.0.0",
  "--port", "8080",
  "--proxy-headers"
]
```

Principi:

```text
MUST: utente non-root
MUST: nessun secret nell'immagine
MUST: immagine immutabile
MUST: dipendenze versionate
SHOULD: image scanning
SHOULD: SBOM
SHOULD: base image aggiornata periodicamente
```

Cloud Run accetta direttamente immagini container per creare nuove revisioni del servizio. citeturn15search17

### Docker Compose per sviluppo locale

```yaml
# compose.yaml

services:

  api:
    build:
      context: ./services/api
    ports:
      - "8080:8080"
    environment:
      APP_ENV: development
      DATABASE_URL: postgresql+asyncpg://app:app@postgres:5432/medical
      STORAGE_BACKEND: local
      STORAGE_LOCAL_PATH: /data/uploads
    volumes:
      - ./services/api/app:/app/app
      - local_uploads:/data/uploads
    depends_on:
      postgres:
        condition: service_healthy

  postgres:
    image: postgres:17-alpine
    environment:
      POSTGRES_USER: app
      POSTGRES_PASSWORD: app
      POSTGRES_DB: medical
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test:
        [
          "CMD-SHELL",
          "pg_isready -U app -d medical"
        ]
      interval: 5s
      timeout: 5s
      retries: 10

volumes:
  postgres_data:
  local_uploads:
```

Il `compose.yaml` è esclusivamente per sviluppo. Non è il modello production.

In produzione:

```text
postgres service in compose
            ↓
        RIMOSSO

local_uploads volume
            ↓
        RIMOSSO
```

e sostituito con:

```text
Cloud SQL
Cloud Storage
```

### Configurazione applicativa

L'applicazione deve leggere la configurazione dall'ambiente:

```text
APP_ENV
DATABASE_URL
AUTH_ISSUER
AUTH_AUDIENCE
GCP_PROJECT_ID
STORAGE_BUCKET
LOG_LEVEL
ALLOWED_ORIGINS
```

I secret non devono stare in:

```text
.git
Dockerfile
compose.yaml production
Next.js public env
```

Cloud Run può utilizzare Secret Manager per fornire i segreti al servizio senza inserirli nell'immagine. citeturn15search37

### Pipeline per pull request

```mermaid
flowchart LR
    PR[Pull Request]
    LINT[Lint]
    UT[Unit tests]
    IT[Integration tests]
    API[OpenAPI validation]
    BUILD[Docker build]
    SCAN[Security scan]
    PREVIEW[Frontend preview]

    PR --> LINT
    PR --> UT
    PR --> IT
    PR --> API
    UT --> BUILD
    BUILD --> SCAN
    PR --> PREVIEW
```

Nessuna pull request deve poter fare deploy in produzione.

### Pipeline di deploy

```mermaid
flowchart LR
    MAIN[Merge main]
    TEST[Test]
    BUILD[Build immagine]
    REG[Registry]
    STAGE[Deploy staging]
    SMOKE[Smoke test]
    APPROVE[Production gate]
    PROD[Deploy production]

    MAIN --> TEST
    TEST --> BUILD
    BUILD --> REG
    REG --> STAGE
    STAGE --> SMOKE
    SMOKE --> APPROVE
    APPROVE --> PROD
```

L'immagine che passa staging deve essere la **stessa immagine per digest** che viene promossa in produzione. Non deve essere ricostruita dopo l'approvazione.

### GitHub Actions

Per l'autenticazione di GitHub verso Google Cloud userei Workload Identity Federation, evitando di salvare nel repository una chiave JSON di service account permanente. Google raccomanda esplicitamente questa modalità per deployment pipeline come GitHub Actions; l'action ufficiale `google-github-actions/auth` indica la federazione come approccio preferenziale rispetto alle chiavi statiche. citeturn23search0turn23search1turn23search7

Esempio:

```yaml
# .github/workflows/deploy-api.yml

name: Deploy API

on:
  push:
    branches:
      - main
    paths:
      - "services/api/**"
      - ".github/workflows/deploy-api.yml"

permissions:
  contents: read
  id-token: write

env:
  SERVICE_NAME: medical-verification-api
  REGION: europe-west8

jobs:

  test-build-deploy:
    runs-on: ubuntu-latest

    steps:

      - name: Checkout
        uses: actions/checkout@v7

      - name: Set up Python
        uses: actions/setup-python@v6
        with:
          python-version: "3.13"

      - name: Install dependencies
        working-directory: services/api
        run: |
          python -m pip install --upgrade pip
          pip install -r requirements.txt
          pip install pytest ruff

      - name: Lint
        working-directory: services/api
        run: ruff check .

      - name: Tests
        working-directory: services/api
        run: pytest -q

      - name: Authenticate to Google Cloud
        uses: google-github-actions/auth@v3
        with:
          workload_identity_provider: ${{ vars.GCP_WIF_PROVIDER }}
          service_account: ${{ vars.GCP_DEPLOY_SERVICE_ACCOUNT }}

      - name: Set up gcloud
        uses: google-github-actions/setup-gcloud@v3

      - name: Configure Docker registry
        run: |
          gcloud auth configure-docker \
            "${{ vars.ARTIFACT_REGISTRY_HOST }}" \
            --quiet

      - name: Build image
        run: |
          IMAGE="${{ vars.ARTIFACT_REGISTRY_REPO }}/api:${GITHUB_SHA}"
          docker build \
            -t "${IMAGE}" \
            ./services/api
          docker push "${IMAGE}"
          echo "IMAGE=${IMAGE}" >> "$GITHUB_ENV"

      - name: Deploy staging
        run: |
          gcloud run deploy "${SERVICE_NAME}-staging" \
            --image="${IMAGE}" \
            --region="${REGION}" \
            --platform=managed \
            --quiet

      - name: Smoke test
        run: |
          ./scripts/smoke-test-staging.sh
```

L'action ufficiale Google attuale mostra `actions/checkout@v7`, `google-github-actions/auth@v3` e richiede `id-token: write` per Workload Identity Federation. citeturn23search2turn23search6

Per la produzione aggiungerei un GitHub Environment `production` con gate di approvazione e un job separato che utilizza **lo stesso digest** dell'immagine approvata.

In un repository reale, le Actions di terze parti dovrebbero essere bloccate a commit SHA verificati invece di dipendere indefinitamente dal tag major; nel blueprint il tag major rende semplicemente leggibile l'esempio.

### Migrazioni database

Le migrazioni non devono partire automaticamente a ogni startup del container.

Pattern:

```text
deploy candidate
      ↓
migration job
      ↓
migration successful?
      ↓ yes
deploy application
```

Ogni migrazione deve avere:

```text
numero/versione
forward migration
strategia rollback o roll-forward
compatibilità con versione precedente dell'app
test su staging
```

Per modifiche critiche adottare il pattern expand/contract:

```text
1. aggiungi nuova colonna
2. deploy codice compatibile con vecchio + nuovo
3. migra dati
4. passa al nuovo campo
5. rimuovi vecchio campo in release successiva
```

Questo evita che una migration renda immediatamente impossibile il rollback dell'applicazione.


## Backlog operativo frontend e backend

### Milestone di fondazione

| Area | Task | Acceptance criteria |
|---|---|---|
| Architecture | ADR stack tecnologico | scelta frontend hosting, backend, DB, storage documentata |
| Backend | progetto FastAPI | `/health` restituisce 200; test automatici attivi |
| Frontend | skeleton Next.js | routing e layout responsive funzionanti |
| DevOps | Dockerfile | backend builda e parte senza privilegi root |
| DevOps | Compose | nuovo sviluppatore avvia API + DB con un comando |
| Security | environments | `dev`, `staging`, `production` completamente separati |
| Privacy | data inventory | ogni categoria di dati mappata a finalità e sistema |
| Privacy | DPIA | documento avviato e owner assegnato |

**Definition of Done:** nessun dato reale viene utilizzato; pipeline CI esegue lint, test e build; repository dispone di ADR e documentazione di setup.

### Milestone identità e autorizzazione

| Frontend | Backend | Acceptance criteria |
|---|---|---|
| signup/login paziente | verifica JWT | token invalido → 401 |
| login medico | middleware ruolo | paziente su endpoint medico → 403 |
| enrollment MFA | verifica claim MFA | medico senza MFA → review bloccata |
| session expiry UX | session policy | token scaduto → re-auth |
| pagina profilo | profili DB | ownership corretta |
| reset account | audit identity events | reset registrato nell'audit |

La piattaforma non è pronta per la milestone successiva finché un test automatico non dimostra che un paziente A non può recuperare il caso del paziente B e che un medico non assegnato non può aprirlo.

### Milestone acquisizione del caso

Frontend:

```text
Nuovo caso
→ informativa
→ inserimento conversazione
→ upload eventuali file
→ riepilogo
→ conferma
→ submit
```

Backend:

```text
POST /uploads/presign
POST /submit-conversation
GET /case/{id}
GET /me/cases
```

Acceptance criteria:

| Requisito | Test |
|---|---|
| ownership | altro paziente riceve 403/404 |
| idempotenza | doppio submit genera un solo caso |
| upload | file va direttamente allo storage |
| private storage | object URL pubblico non funziona |
| audit | submit genera evento |
| integrity | SHA-256 registrato |
| file validation | MIME/size non ammessi respinti |
| logging | nessun testo clinico nei log |

### Milestone dashboard medico

Frontend:

```text
Lista casi assegnati
→ filtri stato
→ dettaglio
→ conversazione originale
→ allegati
→ richiesta informazioni
→ form di revisione
```

Backend:

```text
GET /doctor/cases
GET /case/{id}
POST /case/{id}/request-information
POST /doctor/review
```

Acceptance criteria:

```text
MUST MFA
MUST verified_doctor = true
MUST assigned_doctor_id == current_user
MUST optimistic locking
MUST audit case_opened
MUST audit review_submitted
```

Un medico non assegnato deve ottenere `403` anche conoscendo esattamente l'UUID del caso.

### Milestone comunicazione medico-paziente

Il sistema deve supportare la richiesta di integrazioni senza trasformarsi necessariamente in una chat generalista.

Struttura:

```text
Doctor:
"Per valutare il caso servono le seguenti informazioni..."

Patient:
risponde / carica documento

Case version:
7 → 8
```

Acceptance criteria:

| Scenario | Risultato |
|---|---|
| medico richiede integrazione | stato `NEEDS_INFORMATION` |
| paziente risponde | stato torna `UNDER_REVIEW` |
| nuova informazione | `case.version` incrementa |
| medico aveva review aperta | submit vecchia versione → `409` |
| notifica email | nessun contenuto clinico nell'email |

L'email deve dire, ad esempio:

> “È disponibile un aggiornamento sul tuo caso.”

non:

> “Il cardiologo chiede ulteriori informazioni per la sospetta fibrillazione atriale.”

### Milestone revisione e documento finale

Frontend medico deve offrire esiti strutturati:

```text
Confermo sostanzialmente
Modifico le conclusioni
Informazioni insufficienti
Necessaria valutazione diretta
Necessaria valutazione urgente
```

La terminologia finale deve essere validata clinicamente e legalmente.

Backend:

```text
Review immutable version
PDF generation
document hash
audit
patient availability
```

Acceptance criteria:

| Test | Criterio |
|---|---|
| completezza | review senza assessment respinta |
| concorrenza | versione case errata → 409 |
| immutabilità | review firmata non modificabile in-place |
| nuova versione | correzione crea nuova revision |
| documento | hash coincide col PDF |
| autorizzazione | solo paziente/medico autorizzato lo scaricano |

### Milestone hardening

Prima di utilizzare pazienti reali devono essere completati:

| Dominio | Gate |
|---|---|
| DPIA | approvata |
| DPA | fornitori mappati |
| Subprocessors | registro disponibile |
| MFA | obbligatoria medico/admin |
| Secrets | assenti dal repository |
| DB | non pubblicamente accessibile |
| Storage | accesso pubblico disabilitato |
| Encryption | verificata |
| Audit | copertura degli eventi critici |
| Backup | restore eseguito con successo |
| Retention | policy approvata |
| Incident response | runbook testato |
| Security | penetration test / security review |
| Monitoring | alert errori e disponibilità |
| Staging | nessun dato paziente reale |
| Logging | test automatici contro PHI leakage |

Il Garante evidenzia esplicitamente che privacy by design richiede misure appropriate fin dalla progettazione e revisioni periodiche della sicurezza, inclusa una procedura per le violazioni di dati personali ai sensi degli articoli 33 e 34 GDPR. citeturn20view0

### Milestone pilot

Il pilot deve misurare almeno:

```text
completion rate
tempo submit → assegnazione
tempo medico per review
percentuale NEEDS_INFORMATION
percentuale INSUFFICIENT_DATA
percentuale NEEDS_DIRECT_EVALUATION
error rate API
upload failure rate
login/MFA failure rate
numero accessi admin eccezionali
incidenti privacy/security
```

Aggiungerei fin dall'inizio un indicatore clinicamente molto importante:

```text
AI conclusion vs physician conclusion
```

con categorie strutturate:

```text
agree
partially agree
disagree
insufficient information
```

ma **senza usare queste informazioni per addestrare automaticamente alcun modello**. Qualsiasi riuso secondario del dataset clinico richiederebbe una propria valutazione di finalità, base giuridica e governance; il Garante segnala espressamente che utilizzi ulteriori dei dati raccolti dalla piattaforma non possono essere considerati automaticamente compatibili con la finalità originaria. citeturn18view0


## Decisione raccomandata e specifica da consegnare ai team

### Stack finale consigliato

Per la versione che svilupperei oggi:

```text
                         INTERNET
                            │
                            ▼
                ┌──────────────────────┐
                │   Next.js frontend   │
                │ Vercel oppure GCP    │
                └──────────┬───────────┘
                           │
             auth          │ API
        ┌──────────────────┼──────────────────┐
        ▼                  ▼                  │
┌───────────────┐  ┌────────────────────┐     │
│ Identity      │  │ FastAPI            │     │
│ Platform      │  │ Docker             │     │
│ MFA / OIDC    │  │ Cloud Run Milano   │     │
└───────────────┘  └──────────┬─────────┘     │
                              │               │
                     ┌────────┴────────┐      │
                     ▼                 ▼      │
             ┌───────────────┐ ┌─────────────┴────┐
             │ Cloud SQL     │ │ Cloud Storage     │
             │ PostgreSQL    │ │ documenti         │
             │ Milano        │ │ privati           │
             └───────────────┘ └──────────────────┘
```

Cloud Run è disponibile a Milano e permette di distribuire direttamente container; Cloud SQL PostgreSQL è disponibile nella stessa regione, e Cloud Storage dispone sia di Milano sia di Torino. Questa combinazione consente di collocare il core sanitario in Italia senza dover amministrare macchine virtuali. citeturn16search2turn22search1turn22search3

### Frontend: Vercel sì o no?

**La mia raccomandazione pratica è sì, ma con un confine preciso.**

Userei Vercel per:

```text
Next.js
static assets
routing
frontend deployment
preview environment con dati sintetici
```

Eviterei di far transitare da Vercel Functions:

```text
PDF clinici
conversazioni ChatGPT
review del medico
referti
allegati
```

quando non necessario.

Questo permette di beneficiare del workflow frontend di Vercel senza trasformarlo nel principale data plane sanitario.

Se il DPO o la governance aziendale preferiscono minimizzare i fornitori, spostare Next.js su Cloud Run non richiede una modifica concettuale del backend.

### Backend: container oppure serverless?

La risposta apparentemente paradossale è:

> **Cloud Run è entrambe le cose utili al progetto: esegue un container Docker, ma l'infrastruttura è gestita in modalità serverless.**

Non dobbiamo quindi scegliere necessariamente tra “Docker” e “serverless”.

Possiamo avere:

```text
Docker
   +
serverless infrastructure
   =
Cloud Run
```

È esattamente il compromesso che sceglierei.

Lo sviluppatore ha un artefatto portabile e riproducibile; l'azienda non deve amministrare una VM sempre accesa.

### Perché non Vercel Functions per tutto

Potremmo farlo, ed è probabilmente l'MVP tecnicamente più rapido.

Non lo preferisco per il core sanitario perché:

| Tema | Vercel-only | Cloud Run backend |
|---|---|---|
| Setup | più semplice | leggermente maggiore |
| Docker necessario | no | sì |
| Portabilità backend | minore | maggiore |
| Upload grande | diretto a storage obbligato | comunque consigliato |
| Runtime control | più vincolato | maggiore |
| Python/FastAPI | possibile | naturale |
| Processi futuri | più dipendenti dal modello Functions | più flessibili |
| Core sanitario in Milano | non la scelta naturale | sì |
| DB + storage stesso cloud | dipende dai provider | sì |
| Future worker/job | maggiore adattamento | Cloud Run ecosystem |
| Vendor governance | può diventare multi-provider | più centralizzata |

Vercel Functions hanno inoltre il limite documentato di 4,5 MB per request/response, mentre il suo nuovo runtime container è ancora Beta al 27 ottobre 2026. citeturn21search1turn15search0

### Stima economica corretta

Non darei ai dipendenti una cifra tipo “costerà €100 al mese”, perché sarebbe falsa precisione prima di conoscere database sizing, HA, traffico, retention e logging.

Darei invece questo modello:

```text
COSTO MENSILE =
frontend
+ API compute
+ PostgreSQL
+ object storage
+ backup
+ egress
+ authentication
+ monitoring/logging
+ security/networking
```

Per il compute abbiamo già ordini di grandezza verificabili:

| Servizio | Baseline indicativa |
|---|---:|
| Vercel Pro | $20/mese + usage |
| Railway Pro | minimo circa $20/mese + eventuale usage |
| Cloud Run 0,5 vCPU + 1 GiB sempre attivo | circa $28,51/mese compute-only |
| Fargate 0,5 vCPU + 1 GB, usando esempio tariffario us-east-1 | circa $17,77/mese compute-only |
| Render | tariffazione per istanza + servizi |
| Azure ACI | vCPU/RAM al secondo |

Le basi tariffarie sono quelle pubblicate dai rispettivi provider; Fargate e Cloud Run variano per regione/configurazione e vanno finalizzati con i loro calculator prima dell'acquisto. citeturn21search2turn16search0turn16search2turn16search3

Nel nostro progetto, a basso traffico **il database gestito e le caratteristiche di resilienza possono incidere più del container API**, quindi non ottimizzerei prematuramente pochi dollari di compute sacrificando isolamento e governance.

### Architecture Decision Record da approvare

Il documento `docs/adr/0001-production-architecture.md` dovrebbe contenere:

```markdown
# ADR: Production architecture

Status: Proposed

## Decision

Frontend:
- Next.js
- Vercel optional
- no clinical SSR / server-side processing on Vercel by default

Backend:
- FastAPI
- Docker OCI image
- Google Cloud Run
- region europe-west8

Database:
- Cloud SQL PostgreSQL
- region europe-west8

Documents:
- private Cloud Storage
- Italian region
- direct signed uploads

Authentication:
- Google Identity Platform
- MFA mandatory for doctors/admins

CI/CD:
- GitHub Actions
- Workload Identity Federation
- immutable container promotion

MVP boundary:
- no AI inference
- no automated diagnosis
- no automated clinical triage
- patient supplies ChatGPT conversation
- physician performs independent review

Production gates:
- DPIA
- DPA/subprocessor inventory
- restore test
- security review
- audit coverage
- approved retention policy
```

### Definition of Done dell'intero MVP

Il prodotto è tecnicamente pronto a entrare nel processo di go-live solo quando questo scenario passa end-to-end:

```text
Paziente crea account
        ↓
verifica identità/account
        ↓
crea caso
        ↓
ottiene signed upload URL
        ↓
carica conversazione/documenti
        ↓
conferma submit
        ↓
caso registrato + audit
        ↓
assegnazione a medico verificato
        ↓
medico autentica con MFA
        ↓
apre esclusivamente il proprio caso
        ↓
richiede eventuale integrazione
        ↓
paziente risponde
        ↓
versione del caso incrementata
        ↓
medico inserisce valutazione indipendente
        ↓
optimistic lock verificato
        ↓
review immutabile
        ↓
PDF + hash
        ↓
audit event
        ↓
paziente autenticato visualizza documento
        ↓
nessun dato clinico presente nei log
```

A questo si aggiungono i gate organizzativi: DPIA, accordi ex articolo 28 ove applicabili, mappa dei sub-responsabili, policy di retention, procedura data breach e misure di sicurezza verificate. Il Garante considera espressamente la piattaforma un soggetto che può agire come responsabile per conto del professionista nell'archiviazione e conservazione della documentazione sanitaria, e richiede che tali rapporti e misure siano formalizzati correttamente. citeturn19view1turn20view0

**Decisione architetturale finale:** per il core della piattaforma sceglierei **FastAPI containerizzato con Docker su Google Cloud Run a Milano, PostgreSQL su Cloud SQL a Milano e documenti in Cloud Storage privato italiano; Next.js può partire su Vercel purché il contenuto clinico venga recuperato direttamente dal backend sanitario e non elaborato inutilmente dalle Vercel Functions.** Docker rimane quindi nel progetto non perché “serve un server Docker”, ma perché costituisce l'artefatto standard e riproducibile del backend che Cloud Run esegue. Vercel-only/serverless resta una valida alternativa più semplice, ma non è quella che sceglierei come architettura di riferimento per una piattaforma destinata a gestire stabilmente dati sanitari.