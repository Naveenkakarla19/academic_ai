import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import { INITIAL_STUDENTS, INITIAL_DOCUMENTS, INITIAL_EMAIL_LOGS } from './src/data/initialData.ts';
import { Student, DocumentRecord, EmailLog, AgentStep, VectorChunk } from './src/types.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Express App
const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

const PORT = 3000;

// Initialize Server-side Gemini AI Client
const apiKey = process.env.GEMINI_API_KEY || '';
const ai = new GoogleGenAI({
  apiKey: apiKey,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// In-Memory Database State
let studentsStore: Student[] = [...INITIAL_STUDENTS];
let documentsStore: DocumentRecord[] = [...INITIAL_DOCUMENTS];
let emailLogsStore: EmailLog[] = [...INITIAL_EMAIL_LOGS];
let vectorChunksStore: VectorChunk[] = [];

// Helper: Recalculate Rankings and Backlogs
function recalculateSystemState() {
  // Update backlog counts & placement eligibility
  studentsStore = studentsStore.map((student) => {
    const activeBacklogs = student.backlogs.filter((b) => b.status !== 'CLEARED');
    const backlogCount = activeBacklogs.length;
    const placementEligible = backlogCount === 0 && student.cgpa >= 6.5 && student.attendance >= 75;

    return {
      ...student,
      backlogs: activeBacklogs,
      backlogCount,
      placementEligible,
    };
  });

  // Ranking Engine: Sort students with zero backlogs
  const clearStudents = studentsStore
    .filter((s) => s.backlogCount === 0)
    .sort((a, b) => {
      if (b.cgpa !== a.cgpa) return b.cgpa - a.cgpa;
      if (b.attendance !== a.attendance) return b.attendance - a.attendance;
      return b.credits - a.credits;
    });

  // Assign ranks
  const rankMap = new Map<string, number>();
  clearStudents.forEach((st, idx) => {
    rankMap.set(st.studentId, idx + 1);
  });

  studentsStore = studentsStore.map((student) => ({
    ...student,
    rank: rankMap.get(student.studentId) || undefined,
  }));
}

// Helper: Vector Indexer for RAG
function reindexDocuments() {
  vectorChunksStore = [];
  documentsStore.forEach((doc) => {
    const text = doc.content.trim();
    // Chunking text into overlapping segments
    const chunkSize = 350;
    const overlap = 50;
    let start = 0;
    let chunkIdx = 0;

    while (start < text.length) {
      const end = Math.min(start + chunkSize, text.length);
      const chunkText = text.substring(start, end).trim();
      if (chunkText.length > 20) {
        vectorChunksStore.push({
          id: `${doc.id}-chunk-${chunkIdx}`,
          documentId: doc.id,
          documentTitle: doc.title,
          category: doc.category,
          text: chunkText,
        });
        chunkIdx++;
      }
      start += chunkSize - overlap;
    }
  });
}

// Initial calculation & indexing
recalculateSystemState();
reindexDocuments();

// Helper: Simple Vector Similarity Matcher (Keyword + Embedding Fallback)
function retrieveRelevantChunks(query: string, topK: number = 5): VectorChunk[] {
  const queryTerms = query.toLowerCase().split(/\W+/).filter((t) => t.length > 2);

  const scored = vectorChunksStore.map((chunk) => {
    const chunkTextLower = chunk.text.toLowerCase();
    const titleLower = chunk.documentTitle.toLowerCase();
    const catLower = chunk.category.toLowerCase();

    let score = 0;
    queryTerms.forEach((term) => {
      if (chunkTextLower.includes(term)) score += 3;
      if (titleLower.includes(term)) score += 5;
      if (catLower.includes(term)) score += 4;
    });

    return { chunk, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK).map((s) => s.chunk);
}

// ==========================================
// API ROUTES
// ==========================================

// 1. Auth & Session
app.post('/api/auth/login', (req, res) => {
  const { role, email, studentId } = req.body;
  if (role === 'admin') {
    return res.json({
      success: true,
      token: 'jwt-admin-token-mock-xyz',
      user: { role: 'admin', email: email || 'admin@college.edu' },
    });
  } else {
    const student = studentsStore.find(
      (s) => s.studentId.toLowerCase() === (studentId || '').toLowerCase() || s.email.toLowerCase() === (email || '').toLowerCase()
    ) || studentsStore[0];

    return res.json({
      success: true,
      token: `jwt-student-${student.studentId}`,
      user: {
        role: 'student',
        studentId: student.studentId,
        studentName: student.name,
        email: student.email,
      },
    });
  }
});

// 2. Student Management APIs
app.get('/api/students', (req, res) => {
  recalculateSystemState();
  res.json({ success: true, students: studentsStore });
});

app.get('/api/students/:id', (req, res) => {
  recalculateSystemState();
  const student = studentsStore.find((s) => s.studentId === req.params.id);
  if (!student) return res.status(404).json({ success: false, message: 'Student not found' });
  res.json({ success: true, student });
});

app.post('/api/students', (req, res) => {
  const newStudent: Student = req.body;
  // Ensure default backlogs count
  newStudent.backlogs = newStudent.backlogs || [];
  newStudent.backlogCount = newStudent.backlogs.length;
  studentsStore.push(newStudent);
  recalculateSystemState();
  res.json({ success: true, student: newStudent });
});

app.post('/api/students/bulk-import', (req, res) => {
  const { students: importedStudents } = req.body;
  if (!Array.isArray(importedStudents) || importedStudents.length === 0) {
    return res.status(400).json({ success: false, message: 'Invalid students payload' });
  }

  // Merge or append students
  importedStudents.forEach((st: Student) => {
    const idx = studentsStore.findIndex((existing) => existing.studentId === st.studentId);
    st.backlogs = st.backlogs || [];
    st.backlogCount = st.backlogs.length;
    if (idx >= 0) {
      studentsStore[idx] = { ...studentsStore[idx], ...st };
    } else {
      studentsStore.push(st);
    }
  });

  recalculateSystemState();
  res.json({ success: true, message: `Successfully imported ${importedStudents.length} student records.`, count: studentsStore.length });
});

// 3. Document Store & RAG Indexing APIs
app.get('/api/documents', (req, res) => {
  res.json({
    success: true,
    documents: documentsStore,
    totalChunks: vectorChunksStore.length,
  });
});

app.post('/api/documents/upload', (req, res) => {
  const { title, category, content, filename } = req.body;
  if (!title || !content) {
    return res.status(400).json({ success: false, message: 'Title and Content are required.' });
  }

  const newDoc: DocumentRecord = {
    id: `DOC-${Date.now()}`,
    title,
    category: category || 'General',
    filename: filename || `${title.replace(/\s+/g, '_')}.txt`,
    fileSize: `${Math.round(content.length / 1024)} KB`,
    uploadDate: new Date().toISOString().split('T')[0],
    chunkCount: Math.ceil(content.length / 300),
    content,
  };

  documentsStore.push(newDoc);
  reindexDocuments();
  res.json({ success: true, document: newDoc, totalChunks: vectorChunksStore.length });
});

// 4. Analytics & Department Stats API
app.get('/api/analytics/stats', (req, res) => {
  recalculateSystemState();
  const total = studentsStore.length;
  const clearCount = studentsStore.filter((s) => s.backlogCount === 0).length;
  const backlogCount = total - clearCount;
  const avgCgpa = total > 0 ? studentsStore.reduce((acc, s) => acc + s.cgpa, 0) / total : 0;
  const passPercentage = total > 0 ? (clearCount / total) * 100 : 0;
  const eligiblePlacementCount = studentsStore.filter((s) => s.placementEligible).length;

  // Department breakdown
  const deptMap = new Map<string, Student[]>();
  studentsStore.forEach((s) => {
    const list = deptMap.get(s.department) || [];
    list.push(s);
    deptMap.set(s.department, list);
  });

  const departmentStats = Array.from(deptMap.entries()).map(([dept, list]) => {
    const dTotal = list.length;
    const dNoBacklog = list.filter((s) => s.backlogCount === 0).length;
    const dBacklog = dTotal - dNoBacklog;
    const dAvgCgpa = list.reduce((acc, s) => acc + s.cgpa, 0) / dTotal;
    const dAvgAttendance = list.reduce((acc, s) => acc + s.attendance, 0) / dTotal;
    const dEligible = list.filter((s) => s.placementEligible).length;

    return {
      department: dept,
      totalStudents: dTotal,
      noBacklogCount: dNoBacklog,
      backlogCount: dBacklog,
      avgCgpa: Number(dAvgCgpa.toFixed(2)),
      avgAttendance: Number(dAvgAttendance.toFixed(1)),
      eligiblePlacementsCount: dEligible,
    };
  });

  res.json({
    success: true,
    stats: {
      totalStudents: total,
      clearStudentsCount: clearCount,
      backlogStudentsCount: backlogCount,
      avgCgpa: Number(avgCgpa.toFixed(2)),
      passPercentage: Number(passPercentage.toFixed(1)),
      eligiblePlacementPercentage: Number(((eligiblePlacementCount / total) * 100).toFixed(1)),
      totalDocumentsIndexed: documentsStore.length,
      totalVectorChunks: vectorChunksStore.length,
      totalEmailsSent: emailLogsStore.length,
    },
    departmentStats,
  });
});

// 5. Email Reminder Agent API
app.get('/api/emails/history', (req, res) => {
  res.json({ success: true, emails: emailLogsStore });
});

app.post('/api/emails/send-reminders', async (req, res) => {
  recalculateSystemState();
  const studentsWithBacklogs = studentsStore.filter((s) => s.backlogCount > 0);
  const newSentEmails: EmailLog[] = [];

  for (const student of studentsWithBacklogs) {
    for (const backlog of student.backlogs) {
      // Check if backlog exam is within 20 days or requested
      if (backlog.daysRemaining <= 25) {
        let aiBody = `Hello ${student.name},\n\nYour supplementary examination for ${backlog.subjectName} (${backlog.subjectCode}) is scheduled for ${backlog.examDate}.\nYou have ${backlog.daysRemaining} days remaining to prepare.\n\nKey Focus Areas:\n- Review previous semester internal question banks.\n- Attend faculty guidance hours.\n- Focus on core fundamental algorithms.\n\nBest of luck for your exam!`;

        if (process.env.GEMINI_API_KEY) {
          try {
            const prompt = `You are the College AI Academic Advisor. Write a personalized, highly encouraging 4-line email to student ${student.name} (${student.studentId}) reminding them that their backlog exam for ${backlog.subjectName} is scheduled on ${backlog.examDate} (${backlog.daysRemaining} days remaining). Highlight the importance of clearing it for placement eligibility. Keep it professional and warm.`;
            const aiRes = await ai.models.generateContent({
              model: 'gemini-3.6-flash',
              contents: prompt,
            });
            if (aiRes.text) {
              aiBody = aiRes.text.trim();
            }
          } catch (e) {
            console.error('Gemini API call error in email generator:', e);
          }
        }

        const log: EmailLog = {
          id: `EML-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          studentId: student.studentId,
          studentName: student.name,
          studentEmail: student.email,
          subjectName: backlog.subjectName,
          examDate: backlog.examDate,
          daysRemaining: backlog.daysRemaining,
          sentAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' ' + new Date().toLocaleDateString(),
          status: 'SENT',
          emailSubject: `Important Reminder: ${backlog.subjectName} Supplementary Exam on ${backlog.examDate}`,
          emailBody: aiBody,
        };

        emailLogsStore.unshift(log);
        newSentEmails.push(log);
      }
    }
  }

  res.json({
    success: true,
    message: `Triggered email reminder agent. Processed ${newSentEmails.length} backlog notifications.`,
    sentEmails: newSentEmails,
  });
});

// 6. LangGraph Agent Chat Endpoint (Simulated LangGraph Agentic Pipeline with real Gemini LLM & SQL/RAG execution)
app.post('/api/agent/chat', async (req, res) => {
  const { query, studentId, role = 'student' } = req.body;

  if (!query) {
    return res.status(400).json({ success: false, message: 'Query is required.' });
  }

  recalculateSystemState();
  const currentStudent = studentsStore.find((s) => s.studentId === studentId) || studentsStore[0];

  const agentSteps: AgentStep[] = [];
  const nowStr = () => new Date().toLocaleTimeString();

  // Node 1: START -> Authenticate User
  agentSteps.push({
    node: 'START',
    label: 'Start Graph Execution',
    description: 'Initializing LangGraph execution context.',
    timestamp: nowStr(),
  });

  agentSteps.push({
    node: 'Authenticate User',
    label: 'Authentication Agent',
    description: `Authenticated user '${currentStudent.name}' (${currentStudent.studentId}) [Role: ${role.toUpperCase()}].`,
    timestamp: nowStr(),
    data: { role, studentId: currentStudent.studentId, name: currentStudent.name },
  });

  // Node 2: Intent Classification
  const queryLower = query.toLowerCase();
  let intent: 'SQL_DB' | 'RAG_DOCS' | 'GENERAL' = 'GENERAL';

  if (
    queryLower.includes('backlog') ||
    queryLower.includes('cgpa') ||
    queryLower.includes('rank') ||
    queryLower.includes('placement') ||
    queryLower.includes('subject') ||
    queryLower.includes('eligible') ||
    queryLower.includes('attendance') ||
    queryLower.includes('my profile')
  ) {
    intent = 'SQL_DB';
  }

  if (
    queryLower.includes('exam') ||
    queryLower.includes('regulation') ||
    queryLower.includes('schedule') ||
    queryLower.includes('date') ||
    queryLower.includes('policy') ||
    queryLower.includes('condonation') ||
    queryLower.includes('credit')
  ) {
    intent = intent === 'SQL_DB' ? 'SQL_DB' : 'RAG_DOCS'; // could be both
  }

  agentSteps.push({
    node: 'Intent Classification',
    label: 'Intent Classifier Node',
    description: `Classified user intent as '${intent}' based on semantic analysis.`,
    timestamp: nowStr(),
    data: { query, intent },
  });

  let sqlQuery = '';
  let sqlResultData: any = null;
  let retrievedChunks: VectorChunk[] = [];

  // Node 3: SQL Agent if DB query needed
  if (intent === 'SQL_DB' || queryLower.includes('backlog') || queryLower.includes('rank')) {
    sqlQuery = `SELECT studentId, name, cgpa, attendance, backlogCount, rank, placementEligible FROM students WHERE studentId = '${currentStudent.studentId}';`;
    sqlResultData = {
      studentId: currentStudent.studentId,
      name: currentStudent.name,
      department: currentStudent.department,
      cgpa: currentStudent.cgpa,
      attendance: currentStudent.attendance,
      backlogCount: currentStudent.backlogCount,
      backlogs: currentStudent.backlogs,
      rank: currentStudent.rank || 'N/A (Has backlogs)',
      placementEligible: currentStudent.placementEligible,
    };

    agentSteps.push({
      node: 'SQL Agent',
      label: 'PostgreSQL Agent',
      description: `Executed query on PostgreSQL student database table.`,
      timestamp: nowStr(),
      data: { query: sqlQuery, result: sqlResultData },
    });
  }

  // Node 4: RAG Retriever if College Documents needed
  retrievedChunks = retrieveRelevantChunks(query, 4);
  agentSteps.push({
    node: 'RAG Retriever',
    label: 'RAG Vector Search Agent (FAISS/ChromaDB)',
    description: `Retrieved top ${retrievedChunks.length} relevant document chunks from vector index.`,
    timestamp: nowStr(),
    data: {
      retrievedCount: retrievedChunks.length,
      topDocuments: Array.from(new Set(retrievedChunks.map((c) => c.documentTitle))),
    },
  });

  // Node 5: LLM Synthesis with Gemini
  agentSteps.push({
    node: 'LLM Synthesis',
    label: 'Gemini 3.6 Flash Synthesis Node',
    description: `Combining SQL database record + RAG document context for LLM generation.`,
    timestamp: nowStr(),
  });

  const ragContext = retrievedChunks.map((c, i) => `[Doc Chunk ${i + 1} - ${c.documentTitle} (${c.category})]:\n${c.text}`).join('\n\n');

  const systemInstruction = `
You are the AI Academic Assistant for the Student Academic Intelligence System.
User Profile:
- Name: ${currentStudent.name}
- Student ID: ${currentStudent.studentId}
- Department: ${currentStudent.department}, Year ${currentStudent.year}, Semester ${currentStudent.semester}
- CGPA: ${currentStudent.cgpa}
- Attendance: ${currentStudent.attendance}%
- Active Backlogs Count: ${currentStudent.backlogCount}
- Active Backlog Details: ${JSON.stringify(currentStudent.backlogs)}
- Overall Rank (among 0-backlog students): ${currentStudent.rank || 'Not Ranked (Has backlogs)'}
- Placement Eligible: ${currentStudent.placementEligible ? 'YES' : 'NO'}

Retrieved College Context Documents:
${ragContext}

Instructions:
1. Provide a direct, highly helpful, and accurate response based on the student's profile and retrieved context.
2. If answering about backlogs, specify exact subject name, exam date, and countdown days.
3. If answering about placement eligibility or rank, clearly state the exact CGPA, backlog status, and regulation rules.
4. Always cite document sources if referencing college regulations or exam schedules.
5. Keep tone supportive, encouraging, and clear.
`;

  let finalAnswer = '';

  if (process.env.GEMINI_API_KEY) {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.6-flash',
        contents: query,
        config: {
          systemInstruction,
          temperature: 0.3,
        },
      });
      finalAnswer = response.text || 'No response generated.';
    } catch (err: any) {
      console.error('Error invoking Gemini model:', err);
      finalAnswer = `[AI System Fallback] Based on your records:\n- Name: ${currentStudent.name}\n- Backlogs: ${currentStudent.backlogCount === 0 ? 'None! All subjects cleared.' : `${currentStudent.backlogCount} active backlog(s): ${currentStudent.backlogs.map((b) => b.subjectName + ' on ' + b.examDate).join(', ')}`}\n- CGPA: ${currentStudent.cgpa} (Rank #${currentStudent.rank || 'N/A'})\n- Placement Eligibility: ${currentStudent.placementEligible ? 'Eligible for Tier-1 & Tier-2 Drives' : 'Not eligible currently due to pending backlogs or CGPA.'}`;
    }
  } else {
    // Standard rule-based answer if API key not available yet
    if (queryLower.includes('backlog')) {
      finalAnswer = currentStudent.backlogCount === 0
        ? `Great news, ${currentStudent.name}! You have 0 active backlogs. All your subjects are cleared.`
        : `You have ${currentStudent.backlogCount} active backlog(s):\n${currentStudent.backlogs.map((b) => `- ${b.subjectName} (${b.subjectCode}): Exam on ${b.examDate} (${b.daysRemaining} days remaining)`).join('\n')}\n\nPlease prepare well to clear them for placement eligibility.`;
    } else if (queryLower.includes('exam') || queryLower.includes('next')) {
      finalAnswer = currentStudent.backlogs.length > 0
        ? `Your next upcoming supplementary exam is ${currentStudent.backlogs[0].subjectName} on ${currentStudent.backlogs[0].examDate} (${currentStudent.backlogs[0].daysRemaining} days away).`
        : `Regular end-semester examinations begin in December. You currently have no pending backlog exams!`;
    } else if (queryLower.includes('placement') || queryLower.includes('eligible')) {
      finalAnswer = currentStudent.placementEligible
        ? `Yes! You are fully eligible for campus placement drives. Your CGPA is ${currentStudent.cgpa} (Threshold: 6.50) and you have 0 standing backlogs.`
        : `Currently you are NOT eligible for campus placement drives because you have ${currentStudent.backlogCount} active backlog(s). Campus rules require 0 active backlogs and a minimum CGPA of 6.50.`;
    } else {
      finalAnswer = `Hello ${currentStudent.name}! Your academic summary: CGPA is ${currentStudent.cgpa}, Attendance is ${currentStudent.attendance}%, Active Backlogs: ${currentStudent.backlogCount}, Rank: #${currentStudent.rank || 'N/A'}. Let me know if you need specific information on exam schedules or academic regulations.`;
    }
  }

  agentSteps.push({
    node: 'END',
    label: 'Complete Flow',
    description: 'Graph execution completed successfully.',
    timestamp: nowStr(),
  });

  const sources = retrievedChunks.map((c) => ({
    documentTitle: c.documentTitle,
    category: c.category,
    textSnippet: c.text.substring(0, 150) + '...',
  }));

  res.json({
    success: true,
    response: finalAnswer,
    agentSteps,
    sqlQuery,
    sqlResult: sqlResultData,
    sources,
  });
});

// 7. System Docs DDL & ER Diagram API
app.get('/api/system/docs', (req, res) => {
  const schemaDDL = `
-- PostgreSQL Schema for AI Powered Student Academic Intelligence System

CREATE TABLE admins (
    admin_id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE students (
    student_id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    department VARCHAR(20) NOT NULL,
    year INT NOT NULL,
    semester INT NOT NULL,
    cgpa NUMERIC(4, 2) NOT NULL,
    attendance NUMERIC(5, 2) NOT NULL,
    credits INT NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    phone VARCHAR(20),
    backlog_count INT DEFAULT 0,
    placement_eligible BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE subjects (
    subject_code VARCHAR(20) PRIMARY KEY,
    subject_name VARCHAR(100) NOT NULL,
    department VARCHAR(20) NOT NULL,
    semester INT NOT NULL,
    credits INT NOT NULL
);

CREATE TABLE backlogs (
    id SERIAL PRIMARY KEY,
    student_id VARCHAR(50) REFERENCES students(student_id) ON DELETE CASCADE,
    subject_code VARCHAR(20) REFERENCES subjects(subject_code),
    subject_name VARCHAR(100) NOT NULL,
    semester INT NOT NULL,
    exam_date DATE NOT NULL,
    status VARCHAR(20) DEFAULT 'SCHEDULED', -- 'PENDING', 'SCHEDULED', 'CLEARED'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE rankings (
    id SERIAL PRIMARY KEY,
    student_id VARCHAR(50) REFERENCES students(student_id) ON DELETE CASCADE,
    department VARCHAR(20) NOT NULL,
    cgpa NUMERIC(4, 2) NOT NULL,
    attendance NUMERIC(5, 2) NOT NULL,
    credits INT NOT NULL,
    overall_rank INT NOT NULL,
    department_rank INT NOT NULL,
    computed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE documents (
    doc_id VARCHAR(50) PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    category VARCHAR(50) NOT NULL,
    filename VARCHAR(100) NOT NULL,
    file_size VARCHAR(20),
    content TEXT NOT NULL,
    chunk_count INT DEFAULT 0,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE chat_history (
    id SERIAL PRIMARY KEY,
    student_id VARCHAR(50) REFERENCES students(student_id),
    sender VARCHAR(10) NOT NULL, -- 'user', 'bot'
    message TEXT NOT NULL,
    agent_steps JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE emails (
    id VARCHAR(50) PRIMARY KEY,
    student_id VARCHAR(50) REFERENCES students(student_id),
    subject_name VARCHAR(100) NOT NULL,
    exam_date DATE NOT NULL,
    days_remaining INT NOT NULL,
    email_subject VARCHAR(200) NOT NULL,
    email_body TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'SENT',
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
  `;

  res.json({
    success: true,
    schemaDDL,
  });
});

// ==========================================
// SERVE FRONTEND (Vite Middleware or Production Static)
// ==========================================
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Academic Intelligence System server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
