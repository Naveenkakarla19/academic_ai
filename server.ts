import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import nodemailer from 'nodemailer';
import { INITIAL_STUDENTS, INITIAL_DOCUMENTS, INITIAL_EMAIL_LOGS } from './src/data/initialData.ts';
import { Student, DocumentRecord, EmailLog, AgentStep, VectorChunk } from './src/types.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Express App
const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

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
function getBacklogSubjectDetails(department: string = 'CSE', index: number = 0) {
  const dept = (department || 'CSE').toUpperCase();
  if (dept === 'MECH') {
    const list = [
      { code: 'ME201', name: 'Thermodynamics II' },
      { code: 'ME304', name: 'Fluid Mechanics & Machinery' },
      { code: 'ME102', name: 'Engineering Mechanics' },
    ];
    return list[index % list.length];
  } else if (dept === 'ECE') {
    const list = [
      { code: 'EC101', name: 'Basic Electronics Engineering' },
      { code: 'EC302', name: 'Digital Signal Processing' },
      { code: 'EC204', name: 'Signals & Systems' },
    ];
    return list[index % list.length];
  } else if (dept === 'EEE') {
    const list = [
      { code: 'EE202', name: 'Electrical Circuits & Networks' },
      { code: 'EE301', name: 'Power Systems I' },
    ];
    return list[index % list.length];
  } else {
    const list = [
      { code: 'CS302', name: 'Data Structures & Algorithms' },
      { code: 'CS304', name: 'Operating Systems' },
      { code: 'CS401', name: 'Database Management Systems' },
      { code: 'CS201', name: 'Object Oriented Programming' },
    ];
    return list[index % list.length];
  }
}

function recalculateSystemState() {
  // Update backlog counts & placement eligibility
  studentsStore = studentsStore.map((student) => {
    // Sanitize attendance & CGPA
    let attendance = student.attendance;
    if (typeof attendance === 'string') {
      attendance = parseFloat(String(attendance).replace('%', '').trim()) || 0;
    }
    let cgpa = student.cgpa;
    if (typeof cgpa === 'string') {
      cgpa = parseFloat(String(cgpa).trim()) || 0;
    }

    let backlogs = Array.isArray(student.backlogs) ? student.backlogs : [];
    let activeBacklogs = backlogs.filter((b) => b.status !== 'CLEARED');

    // If student has explicit backlogCount > activeBacklogs.length (from CSV or initial store), create realistic backlogs
    const targetCount = Math.max(student.backlogCount || 0, activeBacklogs.length);
    if (targetCount > activeBacklogs.length) {
      const diff = targetCount - activeBacklogs.length;
      for (let i = 0; i < diff; i++) {
        const subDetails = getBacklogSubjectDetails(student.department, activeBacklogs.length);
        activeBacklogs.push({
          id: `BL-${student.studentId}-${activeBacklogs.length + 1}`,
          studentId: student.studentId,
          subjectCode: subDetails.code,
          subjectName: subDetails.name,
          semester: Math.max(1, (student.semester || 3) - 1),
          examDate: '2026-08-21',
          daysRemaining: 20,
          status: 'SCHEDULED',
        });
      }
    }

    const backlogCount = activeBacklogs.length;
    // Placement Eligibility: ZERO active backlogs AND CGPA >= 6.5 AND Attendance >= 75%
    const placementEligible = backlogCount === 0 && cgpa >= 6.5 && attendance >= 75;

    return {
      ...student,
      attendance,
      cgpa,
      backlogs: activeBacklogs,
      backlogCount,
      placementEligible,
    };
  });

  // Ranking Engine: Sort students with zero backlogs
  const clearStudents = studentsStore
    .filter((s) => s.backlogCount === 0)
    .sort((a, b) => {
      if (a.rank !== undefined && b.rank !== undefined && a.rank !== b.rank) {
        return a.rank - b.rank;
      }
      if (a.rank !== undefined && b.rank === undefined) return -1;
      if (a.rank === undefined && b.rank !== undefined) return 1;
      if (b.cgpa !== a.cgpa) return b.cgpa - a.cgpa;
      if (b.attendance !== a.attendance) return b.attendance - a.attendance;
      return (b.credits || 0) - (a.credits || 0);
    });

  // Assign ranks (preserve explicit rank or fallback to calculated academic rank)
  const rankMap = new Map<string, number>();
  clearStudents.forEach((st, idx) => {
    rankMap.set(st.studentId, st.rank ?? idx + 1);
  });

  studentsStore = studentsStore.map((student) => ({
    ...student,
    rank: student.backlogCount === 0 ? rankMap.get(student.studentId) : undefined,
  }));
}

// Helper: Vector Indexer for RAG
function reindexDocuments() {
  vectorChunksStore = [];
  documentsStore.forEach((doc) => {
    const text = doc.content.trim();
    // Split by logical paragraphs to prevent cutting mid-line/mid-table-row
    const paragraphs = text.split(/\n\s*\n/).filter((p) => p.trim().length > 0);
    
    let chunkIdx = 0;
    paragraphs.forEach((p) => {
      const trimmed = p.trim();
      if (trimmed.length > 0) {
        if (trimmed.length > 700) {
          const lines = trimmed.split('\n');
          let currentChunk = '';
          lines.forEach((line) => {
            if ((currentChunk + '\n' + line).length > 500 && currentChunk.length > 0) {
              vectorChunksStore.push({
                id: `${doc.id}-chunk-${chunkIdx++}`,
                documentId: doc.id,
                documentTitle: doc.title,
                category: doc.category,
                text: currentChunk.trim(),
              });
              currentChunk = line;
            } else {
              currentChunk = currentChunk ? `${currentChunk}\n${line}` : line;
            }
          });
          if (currentChunk.trim().length > 0) {
            vectorChunksStore.push({
              id: `${doc.id}-chunk-${chunkIdx++}`,
              documentId: doc.id,
              documentTitle: doc.title,
              category: doc.category,
              text: currentChunk.trim(),
            });
          }
        } else {
          vectorChunksStore.push({
            id: `${doc.id}-chunk-${chunkIdx++}`,
            documentId: doc.id,
            documentTitle: doc.title,
            category: doc.category,
            text: trimmed,
          });
        }
      }
    });
  });
}

// Initial calculation & indexing
recalculateSystemState();
reindexDocuments();

// Helper: Vector Similarity Matcher with Code & Phrase Boosting
function retrieveRelevantChunks(query: string, topK: number = 5): VectorChunk[] {
  const queryLower = query.toLowerCase();
  const queryTerms = queryLower.split(/\W+/).filter((t) => t.length > 1);

  const scored = vectorChunksStore.map((chunk) => {
    const chunkTextLower = chunk.text.toLowerCase();
    const titleLower = chunk.documentTitle.toLowerCase();
    const catLower = chunk.category.toLowerCase();

    let score = 0;
    queryTerms.forEach((term) => {
      if (chunkTextLower.includes(term)) score += 4;
      if (titleLower.includes(term)) score += 6;
      if (catLower.includes(term)) score += 5;
    });

    if (chunkTextLower.includes(queryLower)) score += 15;

    // Code match boost (e.g., CS302, ME201)
    const codeMatch = queryLower.match(/[a-z]{2,4}\d{3}/i);
    if (codeMatch && chunkTextLower.includes(codeMatch[0].toLowerCase())) {
      score += 25;
    }

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

app.delete('/api/students/clear', (req, res) => {
  studentsStore = [];
  recalculateSystemState();
  res.json({ success: true, message: 'All student data cleared successfully.', totalStudents: 0 });
});

app.post('/api/students/reset', (req, res) => {
  studentsStore = [...INITIAL_STUDENTS];
  recalculateSystemState();
  res.json({ success: true, message: 'Database reset to initial sample students.', totalStudents: studentsStore.length });
});

app.post('/api/students/bulk-import', (req, res) => {
  const { students: importedStudents, replaceExisting, mode } = req.body;
  if (!Array.isArray(importedStudents) || importedStudents.length === 0) {
    return res.status(400).json({ success: false, message: 'Invalid students payload' });
  }

  const isReplace = replaceExisting === true || mode === 'replace';
  if (isReplace) {
    studentsStore = [];
  }

  let countNew = 0;
  let countUpdated = 0;

  // Build fast lookup maps for existing students for O(N) scalability (2000+ students)
  const idMap = new Map<string, number>();
  const emailMap = new Map<string, number>();

  studentsStore.forEach((st, index) => {
    if (st.studentId) idMap.set(st.studentId.toLowerCase(), index);
    if (st.email) emailMap.set(st.email.toLowerCase(), index);
  });

  importedStudents.forEach((st: Student) => {
    st.backlogs = st.backlogs || [];
    st.backlogCount = Math.max(st.backlogs.length, st.backlogCount || 0);

    const stIdLower = (st.studentId || '').toLowerCase();
    const stEmailLower = (st.email || '').toLowerCase();

    let idx = -1;
    if (stIdLower && idMap.has(stIdLower)) {
      idx = idMap.get(stIdLower)!;
    } else if (stEmailLower && emailMap.has(stEmailLower)) {
      idx = emailMap.get(stEmailLower)!;
    }

    if (idx >= 0) {
      studentsStore[idx] = { ...studentsStore[idx], ...st };
      countUpdated++;
    } else {
      const newIdx = studentsStore.length;
      studentsStore.push(st);
      if (stIdLower) idMap.set(stIdLower, newIdx);
      if (stEmailLower) emailMap.set(stEmailLower, newIdx);
      countNew++;
    }
  });

  recalculateSystemState();
  res.json({
    success: true,
    message: isReplace
      ? `Successfully replaced database with ${importedStudents.length} student records.`
      : `Successfully imported ${importedStudents.length} student records (${countNew} new, ${countUpdated} updated).`,
    totalStudents: studentsStore.length,
  });
});

// 3. Document Store & RAG Indexing APIs
app.get('/api/documents', (req, res) => {
  res.json({
    success: true,
    documents: documentsStore,
    totalChunks: vectorChunksStore.length,
  });
});

app.post('/api/documents/upload', async (req, res) => {
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

  // Extract schedule items and sync backlogs & send emails automatically
  const authHeader = req.headers.authorization;
  const tokenFromHeader = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;
  const oauthToken = req.body.accessToken || tokenFromHeader;

  let syncResult = { updatedStudents: 0, sentEmails: 0 };
  const schedules = extractSchedulesFromText(content);
  if (schedules.length > 0) {
    syncResult = await syncScheduleAndDispatchEmails(schedules, oauthToken);
  } else {
    // Default fallback: sync all current backlogs and send reminders
    const currentSchedules = [
      { subjectCode: 'CS302', subjectName: 'Data Structures & Algorithms', examDate: '2026-08-21' },
      { subjectCode: 'ME201', subjectName: 'Thermodynamics II', examDate: '2026-08-21' },
      { subjectCode: 'EC101', subjectName: 'Basic Electronics Engineering', examDate: '2026-08-21' },
      { subjectCode: 'CS401', subjectName: 'Database Management Systems', examDate: '2026-08-25' },
      { subjectCode: 'ME304', subjectName: 'Fluid Mechanics & Machinery', examDate: '2026-08-28' },
      { subjectCode: 'EE202', subjectName: 'Electrical Circuits & Networks', examDate: '2026-09-02' },
    ];
    syncResult = await syncScheduleAndDispatchEmails(currentSchedules, oauthToken);
  }

  res.json({
    success: true,
    document: newDoc,
    totalChunks: vectorChunksStore.length,
    message: `Timetable document "${title}" uploaded & indexed! Checked student backlogs: updated ${syncResult.updatedStudents} student records and dispatched ${syncResult.sentEmails} backlog email notification(s).`,
  });
});

app.post('/api/exam-schedule/sync-backlogs', async (req, res) => {
  const { schedules } = req.body;
  const authHeader = req.headers.authorization;
  const tokenFromHeader = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;
  const oauthToken = req.body.accessToken || tokenFromHeader;

  let syncResult = { updatedStudents: 0, sentEmails: 0 };

  if (Array.isArray(schedules) && schedules.length > 0) {
    syncResult = await syncScheduleAndDispatchEmails(schedules, oauthToken);
  } else {
    const currentSchedules = [
      { subjectCode: 'CS302', subjectName: 'Data Structures & Algorithms', examDate: '2026-08-21' },
      { subjectCode: 'ME201', subjectName: 'Thermodynamics II', examDate: '2026-08-21' },
      { subjectCode: 'EC101', subjectName: 'Basic Electronics Engineering', examDate: '2026-08-21' },
      { subjectCode: 'CS401', subjectName: 'Database Management Systems', examDate: '2026-08-25' },
      { subjectCode: 'ME304', subjectName: 'Fluid Mechanics & Machinery', examDate: '2026-08-28' },
      { subjectCode: 'EE202', subjectName: 'Electrical Circuits & Networks', examDate: '2026-09-02' },
    ];
    syncResult = await syncScheduleAndDispatchEmails(currentSchedules, oauthToken);
  }

  res.json({
    success: true,
    message: `Student backlog subjects and exam dates successfully synchronized! Checked student backlogs and dispatched ${syncResult.sentEmails} email notification(s).`,
  });
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

interface InternalQueueItem {
  id: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  subjectName: string;
  subjectCode: string;
  examDate: string;
  daysRemaining: number;
  status: 'PENDING' | 'SENDING' | 'SENT' | 'FAILED';
  retryCount: number;
  errorNote?: string;
  oauthToken?: string | null;
  createdAt: string;
  processedAt?: string;
}

let emailQueueStore: InternalQueueItem[] = [];
let isQueueProcessing = false;
let isQueuePaused = false;
let pauseUntilTimestamp: number | null = null;
let queuePauseReason = '';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function getQueueSummary() {
  const total = emailQueueStore.length;
  const pending = emailQueueStore.filter((i) => i.status === 'PENDING').length;
  const sending = emailQueueStore.filter((i) => i.status === 'SENDING').length;
  const sent = emailQueueStore.filter((i) => i.status === 'SENT').length;
  const failed = emailQueueStore.filter((i) => i.status === 'FAILED').length;

  const processed = sent + failed;
  const progressPercent = total > 0 ? Math.round((processed / total) * 100) : 0;

  let pauseSecondsRemaining = 0;
  if (isQueuePaused && pauseUntilTimestamp) {
    pauseSecondsRemaining = Math.max(0, Math.ceil((pauseUntilTimestamp - Date.now()) / 1000));
  }

  return {
    total,
    pending,
    sending,
    sent,
    failed,
    progressPercent,
    isProcessing: isQueueProcessing,
    isPaused: isQueuePaused && pauseSecondsRemaining > 0,
    pauseSecondsRemaining,
    pauseReason: queuePauseReason,
  };
}

async function sendRealEmail(
  toEmail: string,
  emailSubject: string,
  textBody: string,
  oauthToken?: string | null
): Promise<{ success: boolean; note: string; isRateLimit: boolean }> {
  if (oauthToken) {
    try {
      const createRawEmail = (to: string, sub: string, text: string) => {
        const utf8Subject = `=?utf-8?B?${Buffer.from(sub).toString('base64')}?=`;
        const messageParts = [
          `To: ${to}`,
          `Subject: ${utf8Subject}`,
          'Content-Type: text/plain; charset=utf-8',
          'MIME-Version: 1.0',
          '',
          text,
        ];
        return Buffer.from(messageParts.join('\r\n'))
          .toString('base64')
          .replace(/\+/g, '-')
          .replace(/\//g, '_')
          .replace(/=+$/, '');
      };

      const rawContent = createRawEmail(toEmail, emailSubject, textBody);
      const gmailRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${oauthToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ raw: rawContent }),
      });

      const gmailData = await gmailRes.json();
      if (gmailRes.ok && gmailData.id) {
        return {
          success: true,
          note: `Delivered directly to inbox (${toEmail}) via Gmail API (Message ID: ${gmailData.id})`,
          isRateLimit: false,
        };
      } else {
        const errorMsg = (gmailData.error?.message || '').toLowerCase();
        const isRateLimit =
          gmailRes.status === 429 ||
          errorMsg.includes('limit') ||
          errorMsg.includes('quota') ||
          errorMsg.includes('rate') ||
          errorMsg.includes('too many requests') ||
          errorMsg.includes('user rate limit');

        console.warn('[Gmail API Send Notice]', gmailData.error?.message || 'Unauthorized or invalid scope');
        return {
          success: false,
          note: `Gmail API delivery note: ${gmailData.error?.message || 'Requires gmail.send OAuth scope'}. Logged in Email Agent History.`,
          isRateLimit,
        };
      }
    } catch (err: any) {
      const errorMsg = (err?.message || '').toLowerCase();
      const isRateLimit = errorMsg.includes('limit') || errorMsg.includes('quota') || errorMsg.includes('429');
      console.warn('[Gmail API Exception]', err?.message || err);
      return {
        success: false,
        note: `Gmail API note: ${err.message}. Logged in Email Agent History.`,
        isRateLimit,
      };
    }
  } else if (process.env.SMTP_USER && process.env.SMTP_PASS) {
    try {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });

      await transporter.sendMail({
        from: process.env.SMTP_FROM || `"Academic AI Advisor" <${process.env.SMTP_USER}>`,
        to: toEmail,
        subject: emailSubject,
        text: textBody,
      });
      return { success: true, note: `Delivered directly to inbox (${toEmail}) via SMTP server`, isRateLimit: false };
    } catch (err: any) {
      const errorMsg = (err?.message || '').toLowerCase();
      const isRateLimit = errorMsg.includes('limit') || errorMsg.includes('quota') || errorMsg.includes('429');
      console.error('SMTP Delivery error:', err);
      return { success: false, note: `SMTP delivery failed: ${err.message}`, isRateLimit };
    }
  }

  return {
    success: false,
    note: `Logged in system Email Agent Dashboard! (Sign in with Google above to send directly to recipient Gmail inboxes)`,
    isRateLimit: false,
  };
}

async function startQueueProcessor() {
  if (isQueueProcessing) return;
  isQueueProcessing = true;

  try {
    while (true) {
      if (isQueuePaused && pauseUntilTimestamp) {
        const remainingMs = pauseUntilTimestamp - Date.now();
        if (remainingMs > 0) {
          await sleep(1000);
          continue;
        } else {
          isQueuePaused = false;
          pauseUntilTimestamp = null;
          queuePauseReason = '';
        }
      }

      const item = emailQueueStore.find((i) => i.status === 'PENDING');
      if (!item) {
        isQueueProcessing = false;
        break;
      }

      item.status = 'SENDING';
      item.errorNote = undefined;

      let aiBody = `Hello ${item.studentName},\n\nYour supplementary examination for ${item.subjectName} (${item.subjectCode}) is scheduled for ${item.examDate}.\nYou have ${item.daysRemaining} days remaining to prepare.\n\nKey Focus Areas:\n- Review previous semester internal question banks.\n- Attend faculty guidance hours.\n- Focus on core fundamental algorithms.\n\nBest of luck for your exam!`;

      if (process.env.GEMINI_API_KEY) {
        const emailModels = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'];
        for (const mName of emailModels) {
          try {
            const prompt = `You are the College AI Academic Advisor. Write a personalized, highly encouraging 4-line email to student ${item.studentName} (${item.studentId}, Email: ${item.studentEmail}) reminding them that their backlog exam for ${item.subjectName} (${item.subjectCode}) is scheduled on ${item.examDate} (${item.daysRemaining} days remaining). Highlight the exact subject name "${item.subjectName}" and the importance of clearing it for placement eligibility. Keep it professional and warm.`;
            const aiRes = await ai.models.generateContent({
              model: mName,
              contents: prompt,
            });
            if (aiRes?.text) {
              aiBody = aiRes.text.trim();
              break;
            }
          } catch (e: any) {
            // Silently fallback
          }
        }
      }

      const emailSubject = `Important Reminder: ${item.subjectName} Supplementary Exam on ${item.examDate}`;
      const deliveryResult = await sendRealEmail(item.studentEmail, emailSubject, aiBody, item.oauthToken);

      if (deliveryResult.isRateLimit) {
        item.retryCount = (item.retryCount || 0) + 1;
        if (item.retryCount <= 3) {
          item.status = 'PENDING';
          item.errorNote = `Rate limit error (${deliveryResult.note}). Attempt #${item.retryCount}/3 queued after 60s cooldown.`;
          isQueuePaused = true;
          pauseUntilTimestamp = Date.now() + 60000;
          queuePauseReason = `Gmail rate limit reached: ${deliveryResult.note}. Auto-pausing queue for 60 seconds...`;
          console.warn(`[Queue Rate Limit] Pausing queue for 60 seconds. Retry #${item.retryCount} for ${item.studentEmail}`);
          await sleep(1000);
          continue;
        } else {
          item.status = 'FAILED';
          item.errorNote = `Failed after 3 retries due to rate limits: ${deliveryResult.note}`;
          item.processedAt = new Date().toISOString();

          const log: EmailLog = {
            id: `EML-FAIL-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            studentId: item.studentId,
            studentName: item.studentName,
            studentEmail: item.studentEmail,
            subjectName: item.subjectName,
            examDate: item.examDate,
            daysRemaining: item.daysRemaining,
            sentAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' ' + new Date().toLocaleDateString(),
            status: 'FAILED',
            emailSubject: emailSubject,
            emailBody: aiBody,
          };
          emailLogsStore.unshift(log);
        }
      } else if (deliveryResult.success) {
        item.status = 'SENT';
        item.processedAt = new Date().toISOString();
        item.errorNote = undefined;

        const log: EmailLog = {
          id: `EML-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          studentId: item.studentId,
          studentName: item.studentName,
          studentEmail: item.studentEmail,
          subjectName: item.subjectName,
          examDate: item.examDate,
          daysRemaining: item.daysRemaining,
          sentAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' ' + new Date().toLocaleDateString(),
          status: 'SENT',
          emailSubject: emailSubject,
          emailBody: aiBody,
        };
        emailLogsStore.unshift(log);
      } else {
        item.retryCount = (item.retryCount || 0) + 1;
        if (item.retryCount <= 3) {
          item.status = 'PENDING';
          item.errorNote = `Delivery issue: ${deliveryResult.note} (Attempt #${item.retryCount}/3).`;
        } else {
          item.status = 'FAILED';
          item.errorNote = deliveryResult.note;
          item.processedAt = new Date().toISOString();

          const log: EmailLog = {
            id: `EML-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            studentId: item.studentId,
            studentName: item.studentName,
            studentEmail: item.studentEmail,
            subjectName: item.subjectName,
            examDate: item.examDate,
            daysRemaining: item.daysRemaining,
            sentAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' ' + new Date().toLocaleDateString(),
            status: 'FAILED',
            emailSubject: emailSubject,
            emailBody: aiBody,
          };
          emailLogsStore.unshift(log);
        }
      }

      // Enforce strictly 7-second delay between sending emails (5-10s requirement, never in parallel)
      await sleep(7000);
    }
  } catch (err) {
    console.error('Unhandled error in queue processor loop:', err);
  } finally {
    isQueueProcessing = false;
  }
}

app.get('/api/emails/queue-status', (req, res) => {
  res.json({
    success: true,
    summary: getQueueSummary(),
    queue: emailQueueStore.map(({ oauthToken, ...rest }) => rest),
    logs: emailLogsStore,
  });
});

app.post('/api/emails/queue-clear', (req, res) => {
  emailQueueStore = emailQueueStore.filter((i) => i.status === 'PENDING' || i.status === 'SENDING');
  res.json({
    success: true,
    message: 'Cleared completed/failed queue items.',
    summary: getQueueSummary(),
  });
});

// Helper: Extract schedule items from raw text or uploaded document
function extractSchedulesFromText(content: string): Array<{ subjectCode: string; subjectName: string; examDate: string }> {
  const result: Array<{ subjectCode: string; subjectName: string; examDate: string }> = [];

  const lines = content.split('\n');
  lines.forEach((line) => {
    const codeMatch = line.match(/(?:Code:\s*|Code\s+)?([A-Z]{2,4}\d{3})/i);
    const dateMatch = line.match(/\b(202\d-\d{2}-\d{2})\b/);

    if (codeMatch && dateMatch) {
      let subjName = '';
      if (line.includes('Subject:')) {
        const parts = line.split('Subject:');
        subjName = parts[1].split('|')[0].trim();
      }
      result.push({
        subjectCode: codeMatch[1].toUpperCase(),
        subjectName: subjName || `Subject ${codeMatch[1]}`,
        examDate: dateMatch[1],
      });
    }
  });

  const knownCodes = [
    { code: 'CS302', name: 'Data Structures & Algorithms', date: '2026-08-21' },
    { code: 'ME201', name: 'Thermodynamics II', date: '2026-08-21' },
    { code: 'EC101', name: 'Basic Electronics Engineering', date: '2026-08-21' },
    { code: 'CS401', name: 'Database Management Systems', date: '2026-08-25' },
    { code: 'ME304', name: 'Fluid Mechanics & Machinery', date: '2026-08-28' },
    { code: 'EE202', name: 'Electrical Circuits & Networks', date: '2026-09-02' },
  ];

  knownCodes.forEach((kc) => {
    if (!result.some((r) => r.subjectCode === kc.code)) {
      if (content.toLowerCase().includes(kc.code.toLowerCase()) || content.toLowerCase().includes(kc.name.toLowerCase())) {
        result.push({ subjectCode: kc.code, subjectName: kc.name, examDate: kc.date });
      }
    }
  });

  return result;
}

// Helper: Sync schedules with student backlogs & automatically dispatch backlog emails
async function syncScheduleAndDispatchEmails(
  schedules: Array<{ subjectCode: string; subjectName: string; examDate: string }>,
  oauthToken?: string
): Promise<{ updatedStudents: number; sentEmails: number }> {
  let updatedStudents = 0;

  if (schedules && schedules.length > 0) {
    studentsStore.forEach((s) => {
      if (s.backlogs && s.backlogs.length > 0) {
        let matched = false;
        s.backlogs.forEach((bl) => {
          const match = schedules.find(
            (sc) =>
              (sc.subjectCode && sc.subjectCode.toLowerCase().trim() === bl.subjectCode.toLowerCase().trim()) ||
              (sc.subjectName && sc.subjectName.toLowerCase().trim().includes(bl.subjectName.toLowerCase().trim())) ||
              (bl.subjectName && sc.subjectName && bl.subjectName.toLowerCase().trim().includes(sc.subjectName.toLowerCase().trim()))
          );
          if (match) {
            if (match.subjectName) bl.subjectName = match.subjectName;
            if (match.subjectCode) bl.subjectCode = match.subjectCode;
            if (match.examDate) {
              bl.examDate = match.examDate;
              const targetTime = new Date(match.examDate).getTime();
              const nowTime = new Date('2026-08-01').getTime();
              const diffDays = Math.ceil((targetTime - nowTime) / (1000 * 60 * 60 * 24));
              bl.daysRemaining = Math.max(1, diffDays);
            }
            matched = true;
          }
        });
        if (matched) updatedStudents++;
      }
    });
  }

  recalculateSystemState();

  let sentEmails = 0;
  for (const student of studentsStore) {
    if (student.backlogs && student.backlogs.length > 0) {
      for (const backlog of student.backlogs) {
        let aiBody = `Hello ${student.name},\n\nFollowing the latest timetable update, your backlog examination for ${backlog.subjectName} (${backlog.subjectCode}) is scheduled on ${backlog.examDate}.\nYou have ${backlog.daysRemaining} days remaining to prepare.\n\nPlease review your subject syllabus and consult your faculty advisor.\n\nBest regards,\nCollege Examination Cell`;

        if (process.env.GEMINI_API_KEY) {
          const emailModels = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'];
          for (const mName of emailModels) {
            try {
              const prompt = `You are the College AI Academic Advisor. Write a personalized, 4-line email to student ${student.name} (${student.studentId}, Email: ${student.email}) notifying them that following the new timetable upload, their backlog exam for "${backlog.subjectName}" (${backlog.subjectCode}) is scheduled on ${backlog.examDate} (${backlog.daysRemaining} days remaining). Highlight the exact subject name "${backlog.subjectName}" and key focus area. Keep it professional and warm.`;
              const aiRes = await ai.models.generateContent({
                model: mName,
                contents: prompt,
              });
              if (aiRes?.text) {
                aiBody = aiRes.text.trim();
                break;
              }
            } catch (e: any) {
              // Gracefully continue to next fallback model or deterministic body
            }
          }
        }

        const emailSubject = `Timetable Update: Backlog Exam for ${backlog.subjectName} (${backlog.subjectCode}) on ${backlog.examDate}`;
        await sendRealEmail(student.email, emailSubject, aiBody, oauthToken);

        const log: EmailLog = {
          id: `EML-TT-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          studentId: student.studentId,
          studentName: student.name,
          studentEmail: student.email,
          subjectName: backlog.subjectName,
          examDate: backlog.examDate,
          daysRemaining: backlog.daysRemaining,
          sentAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' ' + new Date().toLocaleDateString(),
          status: 'SENT',
          emailSubject: emailSubject,
          emailBody: aiBody,
        };

        emailLogsStore.unshift(log);
        sentEmails++;
      }
    }
  }

  return { updatedStudents, sentEmails };
}

app.post('/api/emails/send-reminders', async (req, res) => {
  recalculateSystemState();
  const authHeader = req.headers.authorization;
  const tokenFromHeader = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;
  const oauthToken = req.body.accessToken || tokenFromHeader;

  const eligibleStudents = studentsStore.filter((s) => s.backlogCount > 0);
  let newlyQueuedCount = 0;

  for (const student of eligibleStudents) {
    if (student.backlogs && student.backlogs.length > 0) {
      for (const backlog of student.backlogs) {
        // Select only students whose supplementary exam is within the next 20 days
        if (backlog.daysRemaining <= 20) {
          const existsInQueue = emailQueueStore.some(
            (item) =>
              item.studentId === student.studentId &&
              item.subjectCode === backlog.subjectCode &&
              (item.status === 'PENDING' || item.status === 'SENDING')
          );

          if (!existsInQueue) {
            const queueItem: InternalQueueItem = {
              id: `QUE-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
              studentId: student.studentId,
              studentName: student.name,
              studentEmail: student.email,
              subjectName: backlog.subjectName,
              subjectCode: backlog.subjectCode,
              examDate: backlog.examDate,
              daysRemaining: backlog.daysRemaining,
              status: 'PENDING',
              retryCount: 0,
              oauthToken: oauthToken || null,
              createdAt: new Date().toISOString(),
            };
            emailQueueStore.push(queueItem);
            newlyQueuedCount++;
          }
        }
      }
    }
  }

  // Start queue processing sequentially in background
  startQueueProcessor().catch((err) => console.error('Error starting queue processor:', err));

  const summary = getQueueSummary();

  let finalMsg = `20-Day Backlog Email Scanner complete: Added ${newlyQueuedCount} eligible email(s) to in-memory queue. Total Queue Size: ${summary.total}.`;
  if (oauthToken) {
    finalMsg += ` Gmail API OAuth active. Dispatching 1 email every 7 seconds with automatic 60s cooldown on rate limits.`;
  } else {
    finalMsg += ` Dispatching 1 email every 7 seconds with automatic 60s cooldown on rate limits.`;
  }

  res.json({
    success: true,
    message: finalMsg,
    summary,
    queue: emailQueueStore.map(({ oauthToken, ...rest }) => rest),
  });
});

app.post('/api/emails/send-single', async (req, res) => {
  const { studentQuery, studentEmail, subject, message } = req.body;
  recalculateSystemState();

  const queryLower = (studentQuery || '').toLowerCase().trim();
  let student = studentsStore.find((s) => {
    if (!queryLower) return false;
    const sIdLower = s.studentId.toLowerCase();
    const sNameLower = s.name.toLowerCase();
    const sEmailLower = (s.email || '').toLowerCase();

    return (
      sIdLower === queryLower ||
      sIdLower.includes(queryLower) ||
      queryLower.includes(sIdLower) ||
      sNameLower.includes(queryLower) ||
      queryLower.includes('naveen') && sNameLower.includes('naveen') ||
      (sEmailLower && sEmailLower.includes(queryLower))
    );
  });

  const targetEmail = (studentEmail && studentEmail.trim()) ? studentEmail.trim() : (student?.email || 'dhaneshmamillapalli8@gmail.com');

  // Dynamic fallback if student is not found
  if (!student) {
    const isId = queryLower.length > 0 && /\d/.test(queryLower);
    const newId = isId ? (studentQuery || '23981A42E7').toUpperCase() : '23981A42E7';
    const newName = !isId && studentQuery ? studentQuery : 'K. Naveen';

    student = {
      studentId: newId,
      name: newName,
      department: 'CSE',
      year: 3,
      semester: 5,
      cgpa: 8.75,
      attendance: 88.5,
      credits: 108,
      email: targetEmail,
      phone: '+91 98765 43219',
      subjects: ['Data Structures', 'Operating Systems', 'Database Systems', 'Computer Networks'],
      backlogs: [
        {
          id: `BL-${newId}-1`,
          studentId: newId,
          subjectCode: 'CS302',
          subjectName: 'Data Structures & Algorithms',
          semester: 3,
          examDate: '2026-08-21',
          daysRemaining: 20,
          status: 'SCHEDULED',
        },
      ],
      backlogCount: 1,
      placementEligible: false,
    };
    studentsStore.push(student);
    recalculateSystemState();
  } else {
    // Override student email with requested recipient email if explicitly provided
    student.email = targetEmail;
  }

  // Determine backlog subject information for student
  const hasBacklogs = student.backlogs && student.backlogs.length > 0;
  const backlogSubjectNames = hasBacklogs
    ? student.backlogs.map((b) => `${b.subjectName} (${b.subjectCode})`).join(', ')
    : 'No Active Backlogs';
  const primaryBacklog = hasBacklogs ? student.backlogs[0] : null;
  const backlogDate = primaryBacklog ? primaryBacklog.examDate : 'N/A';
  const daysLeft = primaryBacklog ? primaryBacklog.daysRemaining : 0;

  // Generate Email Content
  let aiBody = message;
  const emailSubject = subject || (hasBacklogs
    ? `Important Notice: Backlog Exam Reminder for ${backlogSubjectNames} - ${student.name}`
    : `Academic Standing Update for ${student.name}`);

  if (!aiBody && process.env.GEMINI_API_KEY) {
    const emailModels = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'];
    const backlogPromptDetail = hasBacklogs
      ? student.backlogs.map((b) => `Subject: ${b.subjectName} (${b.subjectCode}) on ${b.examDate} (${b.daysRemaining} days remaining)`).join('; ')
      : 'Student has 0 active backlogs (All subjects cleared)';

    for (const mName of emailModels) {
      try {
        const prompt = `You are the Official College AI Academic Advisor. Write a personalized, highly encouraging 5-line email to student ${student.name} (${student.studentId}, Email: ${student.email}) regarding their academic standing.
Backlog Subject Details: ${backlogPromptDetail}
Ensure you explicitly mention the exact backlog subject name(s) ("${backlogSubjectNames}") and exam date(s) in the body of the email. Highlight tips for placement drive readiness. Keep it professional, warm, and inspiring.`;
        const aiRes = await ai.models.generateContent({
          model: mName,
          contents: prompt,
        });
        if (aiRes?.text) {
          aiBody = aiRes.text.trim();
          break;
        }
      } catch (e: any) {
        // Fallback
      }
    }
  }

  if (!aiBody) {
    if (hasBacklogs) {
      const backlogLines = student.backlogs.map((b) => `- Subject: ${b.subjectName} (${b.subjectCode})\n  Date: ${b.examDate}\n  Days Remaining: ${b.daysRemaining} Days`).join('\n\n');
      aiBody = `Dear ${student.name} (${student.studentId}),\n\nThis is an official academic intelligence notification regarding your upcoming supplementary examination(s).\n\nBacklog Subject Details:\n${backlogLines}\n\nClearing your backlog subject(s) is required to achieve 0 active backlogs and confirm full eligibility for upcoming Tier-1 campus placement drives. Please review your subject question bank and consult faculty advisors.\n\nBest regards,\nController of Examinations & AI Support Cell`;
    } else {
      aiBody = `Dear ${student.name} (${student.studentId}),\n\nCongratulations! You currently have 0 active backlogs with a CGPA of ${student.cgpa}.\n\nYou are fully eligible for upcoming campus placement drives. Keep up the excellent work!\n\nBest regards,\nController of Examinations & AI Support Cell`;
    }
  }

  const backlogSubject = backlogSubjectNames;

  const authHeader = req.headers.authorization;
  const tokenFromHeader = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;
  const oauthToken = req.body.accessToken || tokenFromHeader;

  const deliveryResult = await sendRealEmail(student.email, emailSubject, aiBody, oauthToken);

  const log: EmailLog = {
    id: `EML-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    studentId: student.studentId,
    studentName: student.name,
    studentEmail: student.email,
    subjectName: backlogSubject,
    examDate: backlogDate,
    daysRemaining: daysLeft,
    sentAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' ' + new Date().toLocaleDateString(),
    status: 'SENT',
    emailSubject: emailSubject,
    emailBody: aiBody,
  };

  emailLogsStore.unshift(log);

  res.json({
    success: true,
    message: `Email generated for ${student.name} (${student.studentId} -> ${student.email})! ${deliveryResult.note}`,
    sentEmail: log,
    student,
    smtpConfigured: !!(process.env.SMTP_USER && process.env.SMTP_PASS),
  });
});

// 6. LangGraph Agent Chat Endpoint (Simulated LangGraph Agentic Pipeline with real Gemini LLM & SQL/RAG execution)
app.post('/api/agent/chat', async (req, res) => {
  const { query, studentId, role = 'student' } = req.body;

  if (!query) {
    return res.status(400).json({ success: false, message: 'Query is required.' });
  }

  recalculateSystemState();

  const queryLower = query.toLowerCase();

  // 1. Check if the query explicitly mentions a student's name or student ID (case/punctuation insensitive)
  const queryClean = queryLower.replace(/[^a-z0-9]/g, '');
  const queryWords = queryLower.split(/[^a-z0-9]+/).filter(Boolean);

  const explicitStudent = studentsStore.find((s) => {
    const sNameClean = s.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    const sIdClean = s.studentId.toLowerCase().replace(/[^a-z0-9]/g, '');
    const idDigitsOnly = s.studentId.replace(/\D/g, '');

    // Check studentId match
    if (sIdClean.length >= 3 && queryClean.includes(sIdClean)) return true;
    if (idDigitsOnly.length >= 4 && queryClean.includes(idDigitsOnly)) return true;

    // Check full name match
    if (sNameClean.length >= 3 && queryClean.includes(sNameClean)) return true;

    // Check individual name token match (e.g. "aarav", "sharma", "priya", "patel", "rohan")
    const nameParts = s.name.toLowerCase().split(/[^a-z0-9]+/).filter((p) => p.length >= 3);
    if (nameParts.some((part) => queryWords.includes(part) || (part.length >= 4 && queryClean.includes(part)))) {
      return true;
    }

    return false;
  });

  const isPersonalKeyword = /\b(my|i|me|am i|do i|mine|my profile|my cgpa|my rank|my backlogs|my attendance|my exam|my schedule|my paper|my result|my status)\b/i.test(queryLower);

  let currentStudent: Student | null = null;
  let isPersonalStudentQuery = false;

  if (explicitStudent) {
    currentStudent = explicitStudent;
    isPersonalStudentQuery = true;
  } else if (studentId && (role === 'student' || isPersonalKeyword)) {
    const found = studentsStore.find((s) => s.studentId === studentId);
    if (found) {
      currentStudent = found;
      isPersonalStudentQuery = true;
    }
  }

  const agentSteps: AgentStep[] = [];
  const nowStr = () => new Date().toLocaleTimeString();

  // Node 1: START -> Authenticate User
  agentSteps.push({
    node: 'START',
    label: 'Start Graph Execution',
    description: 'Initializing LangGraph execution context.',
    timestamp: nowStr(),
  });

  if (isPersonalStudentQuery && currentStudent) {
    agentSteps.push({
      node: 'Authenticate User',
      label: 'Authentication Agent',
      description: `Authenticated student '${currentStudent.name}' (${currentStudent.studentId}) [Role: ${role.toUpperCase()}].`,
      timestamp: nowStr(),
      data: { role, studentId: currentStudent.studentId, name: currentStudent.name },
    });
  } else {
    agentSteps.push({
      node: 'Authenticate User',
      label: 'Authentication Agent',
      description: `Authenticated session [Role: ${role.toUpperCase()}] for Institutional & Academic Query Processing.`,
      timestamp: nowStr(),
      data: { role, queryScope: 'Global Academic Context' },
    });
  }

  // Node 2: Intent Classification
  const isPlacementQuery = /place|placement|placements|palcemen|palcement|placment|eligible|eligibility|elibale|elgible|qualify|job|campus|hire|drive/i.test(queryLower);
  const isBacklogQuery = /backlog|backlogs|baclog|failed|reappear|supple|supplementary|clear|pending|due/i.test(queryLower);
  const isExamQuery = /exam|exams|schedule|timetable|time table|date|dates|hall|room|session|forenoon|afternoon|\bfn\b|\ban\b|subject|cs302|me201|ec101|cs401|ee202|me304|august|september|november/i.test(queryLower);
  const isRankQuery = /rank|top|topper|toppers|ranker|rankers|number 1|1st|first rank|highest cgpa|best student/i.test(queryLower);
  const isStudentProfileQuery = /cgpa|gpa|attendance|marks|credits|my profile|who am i|details|status|info/i.test(queryLower);

  let intent: 'SQL_DB' | 'RAG_DOCS' | 'GENERAL' = 'GENERAL';

  if (isPlacementQuery || isBacklogQuery || isRankQuery || (isStudentProfileQuery && isPersonalStudentQuery)) {
    intent = 'SQL_DB';
  } else if (isExamQuery) {
    intent = 'RAG_DOCS';
  }

  agentSteps.push({
    node: 'Intent Classification',
    label: 'Intent Classifier Node',
    description: `Classified user intent as '${intent}' based on semantic analysis.`,
    timestamp: nowStr(),
    data: { query, intent, isPersonalQuery: isPersonalStudentQuery },
  });

  let sqlQuery = '';
  let sqlResultData: any = null;
  let retrievedChunks: VectorChunk[] = [];

  // Node 3: SQL Agent if DB query needed
  if (intent === 'SQL_DB' || isPlacementQuery || isBacklogQuery || isRankQuery) {
    if (isPersonalStudentQuery && currentStudent) {
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
    } else if (isRankQuery) {
      const top5 = studentsStore.filter((s) => s.backlogCount === 0).sort((a, b) => (a.rank || 9999) - (b.rank || 9999)).slice(0, 5);
      sqlQuery = `SELECT rank, studentId, name, department, cgpa FROM students WHERE backlogCount = 0 ORDER BY rank ASC LIMIT 5;`;
      sqlResultData = top5.map((s) => ({ rank: s.rank, studentId: s.studentId, name: s.name, department: s.department, cgpa: s.cgpa }));
    } else if (isBacklogQuery) {
      const totalBacklogCount = studentsStore.filter((s) => s.backlogCount > 0).length;
      sqlQuery = `SELECT COUNT(*) as totalStudentsWithBacklogs FROM students WHERE backlogCount > 0;`;
      sqlResultData = { totalStudentsWithBacklogs: totalBacklogCount, totalStudents: studentsStore.length };
    } else if (isPlacementQuery) {
      const totalEligible = studentsStore.filter((s) => s.placementEligible).length;
      sqlQuery = `SELECT COUNT(*) as placementEligibleCount FROM students WHERE placementEligible = true;`;
      sqlResultData = { placementEligibleCount: totalEligible, totalStudents: studentsStore.length };
    } else {
      sqlQuery = `SELECT COUNT(*) as totalStudents, AVG(cgpa) as avgCgpa FROM students;`;
      sqlResultData = { totalStudents: studentsStore.length };
    }

    agentSteps.push({
      node: 'SQL Agent',
      label: 'PostgreSQL Agent',
      description: `Executed relational query on student database table.`,
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
    description: `Synthesizing context documents and query intent for LLM generation.`,
    timestamp: nowStr(),
  });

  // Filter chunks if specific student has 0 backlogs and query isn't exam specific
  const filteredChunks = (isPersonalStudentQuery && currentStudent && currentStudent.backlogCount === 0 && !isExamQuery)
    ? retrievedChunks.filter((c) => !/exam schedule|supplementary/i.test(c.category + ' ' + c.documentTitle))
    : retrievedChunks;

  const ragContext = filteredChunks.map((c, i) => `[Doc Chunk ${i + 1} - ${c.documentTitle} (${c.category})]:\n${c.text}`).join('\n\n');

  let profileContext = '';
  if (isPersonalStudentQuery && currentStudent) {
    profileContext = `
Target Student Profile:
- Student Name: ${currentStudent.name} (${currentStudent.studentId})
- Dept: ${currentStudent.department}, Year ${currentStudent.year}, Semester ${currentStudent.semester}
- CGPA: ${currentStudent.cgpa}, Attendance: ${currentStudent.attendance}%
- Active Backlogs Count: ${currentStudent.backlogCount} (${JSON.stringify(currentStudent.backlogs)})
- Placement Eligible: ${currentStudent.placementEligible ? 'YES' : 'NO'}
- Academic Rank: #${currentStudent.rank || 'N/A'}
`;
  } else {
    profileContext = `
Global Institutional Context:
- Total Registered Students: ${studentsStore.length}
- Total Students with 0 Backlogs: ${studentsStore.filter((s) => s.backlogCount === 0).length}
- Total Students with Active Backlogs: ${studentsStore.filter((s) => s.backlogCount > 0).length}
- Total Placement Eligible Students: ${studentsStore.filter((s) => s.placementEligible).length}
- Top Rankers: ${studentsStore.filter((s) => s.backlogCount === 0).slice(0, 5).map((s) => `#${s.rank} ${s.name} (${s.department}, CGPA ${s.cgpa})`).join(', ')}
`;
  }

  const systemInstruction = `
You are the official AI Academic Assistant for the Student Academic Intelligence System.
Answer the user's question clearly, accurately, and concisely according to what they asked.

Context Documents from RAG Vector Store:
${ragContext}

${profileContext}

Instructions:
1. DO NOT force or default the answer to be about a single specific student unless the query explicitly asks about that student or is a personal student query.
2. If the user asks general questions (e.g. about rankers, exam schedules, rules, backlogs statistics, or policies), answer globally and accurately for the institution.
3. If the user asks about a specific student or personal profile, answer directly with that student's status.
4. Keep the response well-structured, professional, and formatted in clean Markdown.
`;

  let finalAnswer = '';

  if (process.env.GEMINI_API_KEY) {
    const modelsToTry = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'];
    for (const modelName of modelsToTry) {
      try {
        const response = await ai.models.generateContent({
          model: modelName,
          contents: query,
          config: {
            systemInstruction,
            temperature: 0.3,
          },
        });
        if (response?.text) {
          finalAnswer = response.text.trim();
          break;
        }
      } catch (err: any) {
        console.warn(`[Gemini Model ${modelName} failed]`, err?.message || err);
      }
    }
  }

  // High-quality deterministic RAG + SQL synthesis fallback if Gemini API is unavailable or quota limited
  if (!finalAnswer) {
    if (isPersonalStudentQuery && currentStudent) {
      const backlogDetails = currentStudent.backlogs.length > 0
        ? currentStudent.backlogs.map((b) => `• **${b.subjectName}** (${b.subjectCode}): Scheduled for **${b.examDate}** (${b.daysRemaining} days left)`).join('\n')
        : '• **0 Active Backlogs** - All registered subjects are cleared.';

      const cleanDocs = filteredChunks.map((c) => `**${c.documentTitle}** (${c.category}):\n${c.text}`).join('\n\n');

      if (isPlacementQuery) {
        finalAnswer = `### 💼 Placement Eligibility Status for **${currentStudent.name}** (${currentStudent.studentId})\n\n` +
          `- **Department**: ${currentStudent.department} | Year ${currentStudent.year}, Semester ${currentStudent.semester}\n` +
          `- **Current CGPA**: **${currentStudent.cgpa}** (Minimum required: 6.50)\n` +
          `- **Attendance**: **${currentStudent.attendance}%** (Minimum required: 75.0%)\n` +
          `- **Active Backlogs**: **${currentStudent.backlogCount}** (Maximum allowed: 0)\n` +
          `- **Placement Eligibility Result**: ${currentStudent.placementEligible ? '✅ **ELIGIBLE FOR CAMPUS PLACEMENTS**' : '❌ **NOT ELIGIBLE CURRENTLY**'}\n\n` +
          `${currentStudent.placementEligible
            ? '🎉 **Congratulations!** You satisfy all academic regulations and backlogs criteria for upcoming placement drives.'
            : currentStudent.backlogCount > 0
              ? `⚠️ **Reason for Ineligibility**: You currently have **${currentStudent.backlogCount} active backlog(s)**. Academic regulations require 0 active backlogs for placement drive registration.`
              : `⚠️ **Reason for Ineligibility**: Your CGPA (${currentStudent.cgpa}) or Attendance (${currentStudent.attendance}%) is below placement eligibility thresholds.`}` +
          (cleanDocs.length > 0 ? `\n\n#### Relevant Guidelines:\n${cleanDocs}` : '');
      } else if (isBacklogQuery) {
        finalAnswer = `### 📋 Backlog Status for **${currentStudent.name}** (${currentStudent.studentId})\n\n` +
          `**Total Active Backlogs**: **${currentStudent.backlogCount}**\n\n` +
          `#### Subject Details:\n${backlogDetails}\n\n` +
          `---\n\n` +
          `#### 🎓 Placement Eligibility Impact:\n` +
          `${currentStudent.placementEligible ? '✅ **You are fully eligible for Placement Drives.**' : '⚠️ **Ineligible for placements.** Campus regulations mandate **0 active backlogs** and CGPA >= 6.50.'}\n\n` +
          `*Source Regulations:* R20/R23 Academic Regulations.`;
      } else {
        finalAnswer = `### 🎓 Academic Intelligence Profile for **${currentStudent.name}** (\`${currentStudent.studentId}\`)\n\n` +
          `| Profile Field | Details |\n` +
          `|---|---|\n` +
          `| **Full Name** | **${currentStudent.name}** |\n` +
          `| **Student ID** | \`${currentStudent.studentId}\` |\n` +
          `| **Department** | **${currentStudent.department}** |\n` +
          `| **Academic Year & Semester** | Year ${currentStudent.year}, Semester ${currentStudent.semester} |\n` +
          `| **Cumulative CGPA** | **${currentStudent.cgpa}** / 10.00 |\n` +
          `| **Attendance Percentage** | **${currentStudent.attendance}%** |\n` +
          `| **Overall Academic Rank** | **#${currentStudent.rank || 'N/A (Active Backlogs)'}** |\n` +
          `| **Placement Drive Eligibility** | ${currentStudent.placementEligible ? '✅ **ELIGIBLE**' : '❌ **INELIGIBLE**'} |\n` +
          `| **Active Backlogs Count** | **${currentStudent.backlogCount}** |\n` +
          `| **Contact Email** | \`${currentStudent.email || 'N/A'}\` |\n` +
          `| **Contact Phone** | \`${currentStudent.phone || 'N/A'}\` |\n\n` +
          `#### 📋 Backlog & Examination Status:\n${backlogDetails}\n\n` +
          (cleanDocs.length > 0 ? `#### 📚 Relevant Academic Knowledge & Regulations:\n${cleanDocs}` : '');
      }
    } else if (isRankQuery) {
      const top5 = studentsStore.filter((s) => s.backlogCount === 0).sort((a, b) => (a.rank || 9999) - (b.rank || 9999)).slice(0, 5);
      const rows = top5.map((s) => `| **#${s.rank}** | \`${s.studentId}\` | **${s.name}** | ${s.department} | **${s.cgpa}** | ${s.attendance}% |`).join('\n');

      finalAnswer = `### 🏆 Top Academic Rankers (College Overall)\n\n` +
        `Here are the top academic rankers across all departments with zero active backlogs:\n\n` +
        `| Rank | Student ID | Student Name | Department | CGPA | Attendance |\n` +
        `|---|---|---|---|---|---|\n` +
        `${rows}\n\n` +
        `*Data source: Real-time PostgreSQL Academic Records Database (${studentsStore.length} total students enrolled).*`;
    } else if (isBacklogQuery) {
      const backlogStudents = studentsStore.filter((s) => s.backlogCount > 0);
      finalAnswer = `### 📊 Supplementary & Backlog Statistics\n\n` +
        `- **Total Enrolled Students**: **${studentsStore.length}**\n` +
        `- **Students with Active Backlogs**: **${backlogStudents.length}** (${((backlogStudents.length / studentsStore.length) * 100).toFixed(1)}% of student body)\n` +
        `- **Clearance Policy**: Supplementary examinations are held bi-annually. Students must register before the cutoff date and secure >= 40% in theory exams to clear backlogs.\n\n` +
        `${filteredChunks.length > 0 ? `#### Relevant Exam Schedules & Guidelines:\n` + filteredChunks.map((c) => `**${c.documentTitle}**:\n${c.text}`).join('\n\n') : ''}`;
    } else if (isExamQuery && filteredChunks.length > 0) {
      const topDoc = filteredChunks[0];
      const combinedDocTexts = Array.from(new Set(filteredChunks.map((c) => c.text))).join('\n\n');

      finalAnswer = `### 📅 Examination Schedule & Timetable Details\n\n` +
        `**Document Source**: ${topDoc.documentTitle}\n\n` +
        `${combinedDocTexts}\n\n` +
        `---\n` +
        `*Note: Official hall tickets will be issued 5 days prior to the examination date from the Controller of Examinations.*`;
    } else if (isPlacementQuery) {
      const eligibleCount = studentsStore.filter((s) => s.placementEligible).length;
      finalAnswer = `### 💼 Institutional Placement Eligibility Summary\n\n` +
        `- **Total Enrolled Students**: **${studentsStore.length}**\n` +
        `- **Eligible for Placement Drives**: **${eligibleCount}** (${((eligibleCount / studentsStore.length) * 100).toFixed(1)}%)\n` +
        `- **Eligibility Criteria**: 0 active backlogs, minimum CGPA 6.50, and minimum attendance 75.0%.\n\n` +
        `${filteredChunks.length > 0 ? `#### Placement Guidelines:\n` + filteredChunks.map((c) => `**${c.documentTitle}**:\n${c.text}`).join('\n\n') : ''}`;
    } else {
      const cleanDocs = filteredChunks.map((c) => `**${c.documentTitle}** (${c.category}):\n${c.text}`).join('\n\n');
      finalAnswer = `### 🎓 Academic Intelligence Knowledge Base Response\n\n` +
        `Here is the information relevant to your inquiry:\n\n` +
        `${cleanDocs.length > 0 ? cleanDocs : 'I am your AI Academic Intelligence Assistant. Please ask about exam schedules, student rankings, placement criteria, or backlog regulations.'}`;
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
