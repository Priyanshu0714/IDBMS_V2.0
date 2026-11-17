# CollabSphere - IDMS (Intelligent Document Management System)

CollabSphere is an enterprise-grade Intelligent Document Management System (IDMS) featuring automated virus scanning, deep document text extraction, AI-powered structured metadata indexing, semantic querying, Kafka-driven asynchronous worker pipelines, and strict per-user file isolation.

Built with a high-performance **Go (Echo)** backend, **Next.js 16 (App Router)** frontend, **Apache Kafka**, **MinIO**, **PostgreSQL**, and **MongoDB**.

---

## 🌟 Key Features

- **🔐 Robust Authentication & Multi-Tenancy**:
  - User registration and login powered by **PostgreSQL** with `bcrypt` password hashing.
  - Stateless **JWT (JSON Web Token)** authorization with 24-hour expiration.
  - Strict **per-user file isolation**: all files are scoped under `username/<timestamp>_<filename>` with ownership checks preventing cross-tenant access.

- **⚡ Fast, Non-Blocking Upload Flow with Kafka**:
  - Secure **presigned PUT URLs** allow direct, high-throughput uploads to **MinIO** temporary storage (`tempbucket`).
  - Immediate user feedback upon upload (`202 Accepted`); upload events are published to **Apache Kafka**.
  - Background consumer workers process file queues independently without tying up HTTP request threads.

- **🛡️ Integrated Antivirus Pipeline**:
  - Stream-based virus scanning powered by **ClamAV**.
  - Malicious files are immediately isolated and wiped from temporary storage with alert logging.

- **🧠 AI Metadata Extraction & Text Analysis**:
  - Deep text extraction for PDFs and documents via **Apache Tika**.
  - Structured entity and header extraction (Title, Company, Date, People, Location, Financials) powered by **Groq LLM (Llama 3.1)**.
  - Document metadata and searchable AI schemas indexed in **MongoDB**.

- **🔍 Natural Language Semantic Querying**:
  - Query your document repository using natural language (`/api/query`).
  - Groq LLM parses queries into intelligent MongoDB `$or` filters for fast entity retrieval.

- **🎨 Modern, Responsive Next.js Frontend**:
  - Built with **Next.js 16**, **React 19**, and **Tailwind CSS v4**.
  - Live file exploration across both Temporary (`tempbucket`) and Processed (`userbucket`) stores.
  - Drag-and-drop file upload zone.
  - Dedicated authentication views with persistent sessions.

---

## 🏗️ Architecture & Processing Pipeline

```mermaid
flowchart TD
    Client["Client (Next.js 16 Frontend)"]
    Echo["Go Echo API Server (:8080)"]
    PG[("PostgreSQL\n(Auth & Users)")]
    MinIOTemp[("MinIO\n'tempbucket'")]
    MinIOMain[("MinIO\n'userbucket'")]
    Kafka[("Apache Kafka\n'file-processing'")]
    Worker["Kafka Consumer Worker"]
    ClamAV["ClamAV Antivirus Daemon"]
    Tika["Apache Tika Text Extractor"]
    Groq["Groq API (Llama 3.1 LLM)"]
    Mongo[("MongoDB\n(Document Metadata)")]

    Client -- "1. Login / Signup" --> Echo
    Echo <--> PG

    Client -- "2. Get Presigned Upload URL" --> Echo
    Echo -- "Returns Presigned PUT Key" --> Client
    Client -- "3. Direct Presigned PUT" --> MinIOTemp
    Client -- "4. Queue Processing" --> Echo
    Echo -- "Publish Event" --> Kafka
    Echo -. "202 Accepted (Instant)" .-> Client

    Kafka --> Worker
    subgraph "Background Worker Pipeline"
        Worker -- "Download Stream" --> MinIOTemp
        Worker -- "Scan Stream" --> ClamAV
        ClamAV -- "OK" --> Tika
        Tika -- "Extracted Text" --> Groq
        Groq -- "Structured Metadata" --> Mongo
        Worker -- "Move File" --> MinIOMain
    end
```

---

## 📁 Repository Structure

```text
collabsphere/
├── backend/
│   ├── go.mod
│   ├── go.sum
│   ├── .env                      # Backend configuration
│   └── idms/
│       ├── main.go               # Echo server entrypoint & worker bootstrap
│       ├── consumer/
│       │   └── worker.go         # Kafka consumer: ClamAV -> Tika -> Groq -> Mongo
│       ├── database/
│       │   ├── postgres.go       # PostgreSQL connection & user schema
│       │   └── mongo.go          # MongoDB connection & document schema
│       ├── handler/
│       │   ├── auth-handler.go   # /signup & /login handlers
│       │   ├── file-handler.go   # S3/MinIO upload, download & list handlers
│       │   ├── processing-handler.go # Kafka producer trigger (/process-file)
│       │   └── queryprocessing.go   # Natural language search handler
│       ├── middleware/
│       │   ├── auth.go           # JWT authorization middleware
│       │   └── auth_test.go      # JWT verification unit tests
│       └── services/
│           ├── kafka.go          # Kafka writer & event publisher
│           ├── minio-services.go # MinIO client operations & presigning
│           ├── apacheTika.go     # Text extraction client
│           └── headersExtractor.go # Groq LLM integration
└── frontend/
    └── app/
        ├── app/
        │   ├── context/
        │   │   └── AuthContext.js# User session & authenticated fetch wrapper
        │   ├── components/
        │   │   └── Sidebar.js    # Shared navigation & user profile
        │   ├── login/
        │   │   └── page.js       # Tabbed Sign In / Sign Up view
        │   ├── upload/
        │   │   └── page.js       # Fast drag-and-drop upload view
        │   ├── layout.js         # Root layout with AuthProvider
        │   ├── page.js           # Dashboard file explorer
        │   └── globals.css       # Tailwind CSS styling
        ├── next.config.mjs       # Next.js config & /api/* proxy rewrite
        └── package.json
```

---

## 🚀 Getting Started

### 1. Prerequisites
Ensure you have the following installed on your system:
- **Go** (v1.23+)
- **Node.js** (v20+) & **Yarn** or **npm**
- **Apache Kafka** running on port `9092`
- **PostgreSQL** running on port `5432`
- **MinIO** running on port `9000`
- **MongoDB** (Local or MongoDB Atlas)
- **ClamAV** daemon running on port `3310` (optional for local processing test)
- **Apache Tika** server running on port `9998` (optional for text extraction test)

---

### 2. Backend Configuration & Setup

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Configure environment variables in `backend/.env`:
   ```env
   # MinIO
   ENDPOINT="127.0.0.1:9000"
   ACCESS_KEY="minioadmin"
   SECRET_KEY="minioadmin"
   TEMP_STORE="tempbucket"
   MAIN_STORE="userbucket"
   USE_SSL="false"

   # PostgreSQL
   POSTGRES_URL="postgres://postgres:postgres@localhost:5432/idms?sslmode=disable"

   # JWT Secret
   JWT_SECRET="your-secure-jwt-secret-key"

   # Kafka
   KAFKA_BROKER="127.0.0.1:9092"
   KAFKA_TOPIC="file-processing"
   KAFKA_GROUP="idms-workers"

   # MongoDB
   MONGO_URL="mongodb://localhost:27017"

   # Groq API Key
   modelname="llama-3.1-8b-instant"
   API_KEY="gsk_your_groq_api_key_here"

   PORT="8080"
   ```

3. Install Go dependencies and run unit tests:
   ```bash
   go mod download
   cd idms
   go test -v ./...
   ```

4. Start the Go server:
   ```bash
   go run main.go
   ```
   *The server starts on `http://localhost:8080` and boots the background Kafka worker automatically.*

---

### 3. Frontend Setup

1. Open a new terminal and navigate to the Next.js app:
   ```bash
   cd frontend/app
   ```

2. Install dependencies:
   ```bash
   yarn install
   # or: npm install
   ```

3. Start the Next.js development server:
   ```bash
   yarn dev
   # or: npm run dev
   ```
   *The application will be live at `http://localhost:3000`.*

---

## 📡 API Reference

### Public Endpoints
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/signup` | Register a new user (`username`, `password`) |
| `POST` | `/api/login` | Authenticate and obtain JWT token |
| `GET` | `/test` | Health check probe |

### Protected Endpoints (`Authorization: Bearer <JWT>`)
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/upload-url` | Generate presigned PUT URL for `tempbucket` scoped to `username/` |
| `GET` | `/api/files` | List files belonging strictly to the authenticated user |
| `GET` | `/api/download-url` | Generate presigned GET download URL with ownership validation |
| `GET` | `/api/file-info` | Retrieve object metadata (size, content-type, last-modified) |
| `DELETE`| `/api/file` | Remove user file from MinIO storage |
| `POST` | `/api/move-file` | Move verified file between buckets |
| `POST` | `/api/process-file`| Queue file for processing via Kafka (returns `202 Accepted`) |
| `POST` | `/api/query` | Query MongoDB files using natural language processed by Groq |

---

## 🧪 Running Tests

Run the automated backend test suite:

```bash
cd backend/idms
go test -v ./...
```

---

## 📄 License
This project is licensed under the MIT License.
