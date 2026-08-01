import React, { useState } from 'react';
import {
  FileText,
  FolderTree,
  Cpu,
  Server,
  Terminal,
  BookOpen,
  Code,
  Shield,
  Layers,
  Copy,
  Check,
} from 'lucide-react';

export const DocumentationHub: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'overview' | 'structure' | 'langgraph' | 'docker' | 'api' | 'prompts'>('overview');
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(id);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  const folderStructureText = `
ai-student-intelligence-system/
├── server.ts                    # Full-Stack Express server with Gemini AI & RAG vector search
├── package.json                 # Dependencies (Express, @google/genai, React, Recharts, PapaParse)
├── metadata.json                # AI Studio Metadata
├── vite.config.ts               # Vite configuration
├── tsconfig.json                # TypeScript settings
├── .env.example                 # Environment variables specification
├── Dockerfile                   # Production Multi-Stage Container Dockerfile
├── docker-compose.yml           # Docker Compose setup with PostgreSQL & App
├── src/
│   ├── main.tsx                 # React Application Entrypoint
│   ├── App.tsx                  # Main Layout & Tab Routing
│   ├── index.css                # Tailwind CSS imports
│   ├── types.ts                 # TypeScript Interfaces (Student, Backlog, Document, AgentStep, Chat)
│   ├── lib/
│   │   └── api.ts               # Frontend API client library
│   ├── data/
│   │   └── initialData.ts       # Initial student dataset, documents, and email templates
│   └── components/
│       ├── Navbar.tsx           # Navigation Header & Persona Switcher
│       ├── AdminDashboard.tsx   # Admin CSV upload, ranking engine, charts & report exporter
│       ├── StudentDashboard.tsx # Student dashboard, backlogs, & RAG Chatbot
│       ├── AgentGraphVisualizer.tsx # Live LangGraph execution step visualizer
│       ├── EmailReminderCenter.tsx  # 20-Day Backlog Email Scanner Agent
│       ├── DatabaseSchemaViewer.tsx # Interactive ER Diagram & DDL SQL Viewer
│       └── DocumentationHub.tsx     # Technical Documentation Center
`;

  const dockerfileText = `
# Production Multi-Stage Dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
COPY package*.json ./
RUN npm ci --only=production
COPY --from=builder /app/dist ./dist
EXPOSE 3000
CMD ["node", "dist/server.cjs"]
`;

  const dockerComposeText = `
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - GEMINI_API_KEY=\${GEMINI_API_KEY}
      - DATABASE_URL=postgres://academic_user:securepass@db:5432/academic_db
    depends_on:
      - db

  db:
    image: postgres:15-alpine
    restart: always
    environment:
      POSTGRES_USER: academic_user
      POSTGRES_PASSWORD: securepass
      POSTGRES_DB: academic_db
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

volumes:
  pgdata:
`;

  const promptTemplatesText = `
-- PROMPT TEMPLATE 1: LangGraph RAG Academic Chatbot
System Instruction:
"You are the AI Academic Assistant for the Student Academic Intelligence System.
User Profile:
- Name: {student_name} ({student_id})
- Department: {department}, Year {year}, Semester {semester}
- CGPA: {cgpa}
- Active Backlogs Count: {backlog_count}
- Active Backlogs: {backlogs_json}
- Rank: {rank}
- Placement Eligibility: {placement_eligible}

Retrieved College Context Documents:
{retrieved_rag_chunks}

Instructions:
1. Answer directly based on student records and retrieved college regulations/exam schedules.
2. If answering about backlogs, specify subject code, exam date, and countdown days remaining.
3. Cite sources for college regulations."

-- PROMPT TEMPLATE 2: Email Reminder Agent (20-Day Backlog Trigger)
Prompt:
"You are the College AI Academic Advisor. Write a personalized, highly encouraging 4-line email to student {student_name} ({student_id}) reminding them that their backlog exam for {subject_name} is scheduled on {exam_date} ({days_remaining} days remaining). Highlight the importance of clearing it for placement eligibility. Keep it professional and warm."
`;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-md">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-white">Project Documentation & Architecture Hub</h1>
            <p className="text-xs text-slate-400 mt-0.5">Comprehensive guide, folder tree, Docker configs, and API references</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex space-x-2 border-b border-slate-800 pb-2 text-xs font-semibold overflow-x-auto">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-3 py-1.5 rounded-lg transition-all ${
            activeTab === 'overview' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          System Overview
        </button>
        <button
          onClick={() => setActiveTab('structure')}
          className={`px-3 py-1.5 rounded-lg transition-all ${
            activeTab === 'structure' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Folder Structure
        </button>
        <button
          onClick={() => setActiveTab('langgraph')}
          className={`px-3 py-1.5 rounded-lg transition-all ${
            activeTab === 'langgraph' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          LangGraph & RAG Flow
        </button>
        <button
          onClick={() => setActiveTab('docker')}
          className={`px-3 py-1.5 rounded-lg transition-all ${
            activeTab === 'docker' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Docker & Deployment
        </button>
        <button
          onClick={() => setActiveTab('api')}
          className={`px-3 py-1.5 rounded-lg transition-all ${
            activeTab === 'api' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          REST API Reference
        </button>
        <button
          onClick={() => setActiveTab('prompts')}
          className={`px-3 py-1.5 rounded-lg transition-all ${
            activeTab === 'prompts' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Prompt Templates
        </button>
      </div>

      {/* Content Panels */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6 shadow-xl">
        {activeTab === 'overview' && (
          <div className="space-y-4 text-xs text-slate-300 leading-relaxed">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Server className="w-4 h-4 text-indigo-400" />
              AI Powered Student Academic Intelligence System Overview
            </h3>
            <p>
              This full-stack AI system is designed to streamline college academic tracking, backlog identification, student ranking, and automated email reminders for supplementary examinations.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                <h4 className="font-bold text-white text-xs text-indigo-300">1. Admin Capabilities</h4>
                <ul className="list-disc list-inside space-y-1 text-[11px] text-slate-400">
                  <li>Bulk import student records via CSV parsing</li>
                  <li>Upload College Regulation, Exam Schedule & Placement PDFs</li>
                  <li>Automatic separation of Backlog vs. Clear students</li>
                  <li>CGPA Ranking Engine (CGPA DESC → Attendance → Credits)</li>
                  <li>Export department reports to CSV</li>
                </ul>
              </div>

              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                <h4 className="font-bold text-white text-xs text-cyan-300">2. Student Capabilities</h4>
                <ul className="list-disc list-inside space-y-1 text-[11px] text-slate-400">
                  <li>View CGPA, Rank, Enrolled Subjects & Backlog status</li>
                  <li>Countdown timer for upcoming supplementary exams</li>
                  <li>Campus placement eligibility breakdown (AR23 policy)</li>
                  <li>RAG AI Chatbot with cited document sources</li>
                  <li>Live step-by-step LangGraph execution trace</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'structure' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <FolderTree className="w-4 h-4 text-indigo-400" />
                Complete Application Directory Tree
              </h3>
              <button
                onClick={() => copyToClipboard(folderStructureText, 'tree')}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] rounded-md flex items-center gap-1 cursor-pointer"
              >
                {copiedSection === 'tree' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>Copy Tree</span>
              </button>
            </div>
            <pre className="bg-slate-950 border border-slate-800 p-4 rounded-xl text-[11px] font-mono text-cyan-300 overflow-x-auto leading-relaxed">
              {folderStructureText}
            </pre>
          </div>
        )}

        {activeTab === 'langgraph' && (
          <div className="space-y-4 text-xs text-slate-300">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Cpu className="w-4 h-4 text-cyan-400" />
              LangGraph Agentic Flow & RAG Architecture
            </h3>
            <p>
              The system implements an 8-Agent LangGraph workflow execution engine:
            </p>
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 font-mono text-[11px] text-indigo-200 space-y-1">
              <div>START → Authenticate User → Intent Classification</div>
              <div className="pl-6">├── Need Database? → SQL Agent (Query student DB table)</div>
              <div className="pl-6">├── Need College Docs? → RAG Retriever (FAISS/ChromaDB Vector match)</div>
              <div className="pl-6">└── LLM Synthesis (Gemini 3.6 Flash) → Response → END</div>
            </div>
          </div>
        )}

        {activeTab === 'docker' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Terminal className="w-4 h-4 text-emerald-400" />
                Dockerfile & Docker Compose Setup
              </h3>
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-slate-300">1. Production Dockerfile</h4>
              <pre className="bg-slate-950 border border-slate-800 p-3.5 rounded-xl text-[11px] font-mono text-slate-300 overflow-x-auto">
                {dockerfileText}
              </pre>

              <h4 className="text-xs font-semibold text-slate-300 mt-4">2. docker-compose.yml</h4>
              <pre className="bg-slate-950 border border-slate-800 p-3.5 rounded-xl text-[11px] font-mono text-slate-300 overflow-x-auto">
                {dockerComposeText}
              </pre>
            </div>
          </div>
        )}

        {activeTab === 'api' && (
          <div className="space-y-4 text-xs text-slate-300">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Code className="w-4 h-4 text-amber-400" />
              REST API Endpoint Reference
            </h3>

            <div className="space-y-2 font-mono text-[11px]">
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-emerald-400 font-bold">GET</span> /api/students
                </div>
                <span className="text-slate-500">Fetch all student records with calculated ranks & backlogs</span>
              </div>

              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-indigo-400 font-bold">POST</span> /api/students/bulk-import
                </div>
                <span className="text-slate-500">Bulk import CSV students into system</span>
              </div>

              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-indigo-400 font-bold">POST</span> /api/documents/upload
                </div>
                <span className="text-slate-500">Index PDF/TXT college regulation document for RAG</span>
              </div>

              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-indigo-400 font-bold">POST</span> /api/agent/chat
                </div>
                <span className="text-slate-500">Execute LangGraph RAG Agent flow and return query response</span>
              </div>

              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-indigo-400 font-bold">POST</span> /api/emails/send-reminders
                </div>
                <span className="text-slate-500">Trigger 20-day backlog email scanner agent</span>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'prompts' && (
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Shield className="w-4 h-4 text-purple-400" />
              LangChain System Prompt Templates
            </h3>
            <pre className="bg-slate-950 border border-slate-800 p-4 rounded-xl text-[11px] font-mono text-purple-200 overflow-x-auto leading-relaxed whitespace-pre-wrap">
              {promptTemplatesText}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};
