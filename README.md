# AI-Powered Student Academic Intelligence & Rate-Limited Reminders System

An intelligent, full-stack Academic Management & AI Analytics Portal built with React 18, Express, Gemini AI, and Google Gmail OAuth.

---

## 🌟 Key Features

### 1. 🥇 Default Rank #1 Student View
- Defaults student view to the top student (**Rank #1** based on CGPA) upon initial session launch.
- Provides fallback to the highest CGPA student if explicit rank indexing updates.

### 2. 📧 Rate-Limited & Throttled Email Reminder Engine
- **20-Day Supplementary Exam Scanner**: Automatically scans all student records and identifies supplementary/backlog exams occurring within the next 20 days.
- **In-Memory Sequential Queue**: Enqueues eligible notifications and dispatches emails sequentially (1 email every 7 seconds, avoiding parallel spamming and quota exhaustion).
- **Quota & Rate Limit Defense**: Automatically detects Gmail API `429` / quota errors, triggers a **60-second cooldown pause**, and retries failed dispatches up to 3 times before logging error status.
- **Live Progress Dashboard**: Visual progress bar showing real-time stats for `Pending`, `Sending`, `Sent`, and `Failed` items, alongside countdown timer during cooldown pauses.
- **Gmail OAuth & SMTP Support**: Real inbox delivery via Google Gmail API OAuth (`gmail.send` scope) or custom SMTP credentials.

### 3. 🤖 AI-Powered Academic Assistant & Vector RAG Chatbot
- Integrated RAG engine powered by Gemini AI.
- Contextual queries on exam timetables, regulations, backlogs, CGPA benchmarks, and student academic performance.

### 4. 📊 Admin & Analytics Dashboard
- Comprehensive metrics: Total Students, Pass Rate %, Departmental Distributions, and Placement Eligibility breakdown.
- **Bulk CSV Data Operations**: Upload CSV or paste raw text to update student records, with optional *Replace Dataset* or *Append/Merge* modes.
- Fast mock data generator for stress testing.

---

## 🏗 System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      Client (React + Vite)                      │
│  - Admin Dashboard & CSV Importer                               │
│  - Student Academic View (Rank #1 Default)                       │
│  - Rate-Limited Email Reminder Center (Live Progress Bar)       │
│  - AI RAG Academic Chatbot                                      │
└────────────────────────────────┬────────────────────────────────┘
                                 │ HTTP REST API
┌────────────────────────────────▼────────────────────────────────┐
│                   Express Backend (server.ts)                   │
│  - In-Memory Throttled Queue Processor (1 mail / 7s)            │
│  - 60s Rate Limit Cooldown Guard & Auto-Retry Handler            │
│  - Gemini AI Text Generation (@google/genai)                    │
│  - Gmail API OAuth Proxy                                        │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🚀 Environment Variables

Create a `.env` file (or set environment variables in your deployment hosting platform):

```env
# Server Port (Defaults to 3000 in Cloud Run / AI Studio container environment)
PORT=3000

# Gemini AI Key for Academic Advice & Email Generation
GEMINI_API_KEY=your_gemini_api_key_here

# Optional: SMTP Server Credentials (if not using Google OAuth)
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
```

---

## 🛠 Installation & Running Locally

### 1. Clone & Install Dependencies
```bash
npm install
```

### 2. Development Mode
```bash
npm run dev
```
The server will boot on `http://localhost:3000`.

### 3. Production Build & Execution
```bash
npm run build
npm start
```

---

## 📋 API Endpoints Summary

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/api/students` | `GET` | Retrieve list of students (calculated ranks, backlogs, eligibility) |
| `/api/students/bulk-import` | `POST` | Bulk import CSV dataset (`replaceExisting: true/false`) |
| `/api/students/clear` | `DELETE` | Clear all student records |
| `/api/students/reset` | `POST` | Reset database to initial sample dataset |
| `/api/emails/send-reminders` | `POST` | Trigger 20-day backlog scanner & populate rate-limited queue |
| `/api/emails/queue-status` | `GET` | Polling endpoint for queue status, progress %, and live logs |
| `/api/emails/queue-clear` | `POST` | Clear completed/failed items from queue |
| `/api/chat` | `POST` | Process AI RAG chatbot query |

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.
