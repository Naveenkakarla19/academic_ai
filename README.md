# AI Powered Student Academic Intelligence System (AR23 Regulation)

A full-stack, enterprise-grade AI application designed for colleges and universities to automate academic tracking, student performance ranking, backlog detection, vector RAG document intelligence, and automated email reminders for supplementary examinations under the **AR23 Academic Regulations**.

---

## 🌟 Key Features

### 1. Admin Command Hub
* **Bulk Student Import**: Upload and parse student record CSVs instantly.
* **Document RAG Indexer**: Upload College Regulations (AR23), Exam Schedules, and Placement Policy PDFs/TXTs into vector storage.
* **AR23 CGPA Ranking Engine**: Automatic segregation of backlog vs. clear students. Ranks clear students using the official AR23 formula:
  1. **Highest CGPA** (Primary sort)
  2. **Attendance Percentage** (First tie-breaker)
  3. **Total Earned Credits** (Second tie-breaker)
* **Campus Placement Eligibility Filter**: Evaluates students against AR23 placement criteria (CGPA ≥ 6.50, 0 Standing Backlogs, Attendance ≥ 75%).
* **Analytics & Report Exporter**: Visual department-wise charts and downloadable CSV summary reports.

### 2. Student Portal & Academic Assistant
* **Personal Academic Metrics**: Real-time view of CGPA, Department Rank, Enrolled Subjects, and Active Backlogs.
* **Backlog Exam Countdown**: Live countdown timer for upcoming supplementary exams.
* **Placement Eligibility Status**: Transparent breakdown of eligibility under AR23 rules.
* **RAG AI Academic Chatbot**: Conversational AI assistant trained on college regulations and exam schedules with document source citations.
* **LangGraph Trace Visualizer**: Live step-by-step trace showing real-time agent execution across all 8 workflow nodes.

### 3. Automated 20-Day Email Scanner Agent
* **Automated Daily Scanner**: Scans active backlog exam dates across all enrolled students.
* **Personalized AI Emails**: When a backlog exam is within 20 days, the agent generates an encouraging, personalized email via Gemini and dispatches it via SMTP.

---

## 🏗️ LangGraph Agentic Pipeline Architecture

The system executes a graph flow across 8 specialized AI node agents:

```
[START] 
  └─> [Authenticate User Agent]
        └─> [Intent Classifier]
              ├──> [SQL Agent] (Queries student database tables)
              ├──> [RAG Retriever] (FAISS/ChromaDB Vector match on AR23 docs)
              └─> [Gemini LLM Synthesis Node] 
                    └─> [Response] ──> [END]
```

---

## 🗄️ Database Schema (PostgreSQL)

The application includes a relational database schema supporting:
* `students`: Core academic profiles, CGPA, attendance, credits, backlog counts, and placement status.
* `backlogs`: Active pending backlogs, subject codes, exam dates, and countdown days remaining.
* `rankings`: Computed overall and department rankings for zero-backlog students.
* `documents`: Ingested college regulations (AR23), exam schedules, and chunk metadata for vector search.
* `emails`: Audit history log of automated backlog exam reminder emails.
* `chat_history`: Student query logs and LangGraph step execution traces.

---

## 🛠️ Technology Stack

* **Frontend**: React 18, Tailwind CSS, Lucide React Icons, Recharts
* **Backend**: Node.js / Express.js custom full-stack server
* **AI & RAG Engine**: Google Gemini API (`@google/genai`), LangGraph agentic flow, Vector embeddings
* **Database**: PostgreSQL schema compatible
* **Deployment**: Multi-stage Docker, Docker Compose

---

## 🚀 How to Export & Deploy to GitHub

### Option 1: Export Directly from AI Studio (Recommended)

1. Look at the top navigation bar or settings menu in **AI Studio**.
2. Click on **Export** / **GitHub**.
3. Authenticate with your GitHub account and select a repository name.
4. Click **Publish to GitHub**.

---

### Option 2: Push via Local Git CLI

If you download or clone the project files locally:

```bash
# 1. Initialize git repository
git init

# 2. Add all files
git add .

# 3. Create initial commit
git commit -m "Initial commit: AI Powered Student Academic Intelligence System (AR23)"

# 4. Rename branch to main
git branch -M main

# 5. Link your GitHub remote repository
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPOSITORY_NAME.git

# 6. Push to GitHub
git push -u origin main
```

---

## 💻 Local Setup Instructions

```bash
# 1. Clone your repository
git clone https://github.com/YOUR_USERNAME/YOUR_REPOSITORY_NAME.git
cd YOUR_REPOSITORY_NAME

# 2. Install dependencies
npm install

# 3. Configure environment variables
cp .env.example .env
# Edit .env and add your GEMINI_API_KEY

# 4. Run in development mode
npm run dev
```

Open `http://localhost:3000` in your browser.

---

## 🐳 Running with Docker

```bash
# Build and run containers with Docker Compose
docker-compose up --build
```

---

## 📄 License

This project is open-source and available under the [MIT License](LICENSE).
