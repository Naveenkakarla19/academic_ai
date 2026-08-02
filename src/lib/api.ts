import { Student, DocumentRecord, EmailLog, EmailQueueItem, EmailQueueStatus, SystemStats, DepartmentStat, ChatMessage } from '../types';

export async function fetchStudents(): Promise<Student[]> {
  const res = await fetch('/api/students');
  const data = await res.json();
  return data.students || [];
}

export async function fetchStudentById(id: string): Promise<Student | null> {
  const res = await fetch(`/api/students/${id}`);
  const data = await res.json();
  return data.student || null;
}

export async function bulkImportStudents(
  students: Partial<Student>[],
  replaceExisting: boolean = true
): Promise<{ message: string; count: number; totalStudents: number }> {
  const res = await fetch('/api/students/bulk-import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ students, replaceExisting }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to import students');
  return data;
}

export async function clearAllStudents(): Promise<{ message: string; totalStudents: number }> {
  const res = await fetch('/api/students/clear', { method: 'DELETE' });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to clear students');
  return data;
}

export async function resetInitialStudents(): Promise<{ message: string; totalStudents: number }> {
  const res = await fetch('/api/students/reset', { method: 'POST' });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to reset students');
  return data;
}

export async function fetchDocuments(): Promise<{ documents: DocumentRecord[]; totalChunks: number }> {
  const res = await fetch('/api/documents');
  const data = await res.json();
  return { documents: data.documents || [], totalChunks: data.totalChunks || 0 };
}

export async function uploadDocument(doc: { title: string; category: string; content: string; filename?: string }) {
  const res = await fetch('/api/documents/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(doc),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to upload document');
  return data;
}

export async function fetchAnalytics(): Promise<{ stats: SystemStats; departmentStats: DepartmentStat[] }> {
  const res = await fetch('/api/analytics/stats');
  const data = await res.json();
  return { stats: data.stats, departmentStats: data.departmentStats || [] };
}

export async function fetchEmailLogs(): Promise<EmailLog[]> {
  const res = await fetch('/api/emails/history');
  const data = await res.json();
  return data.emails || [];
}

export async function fetchEmailQueueStatus(): Promise<{ summary: EmailQueueStatus; queue: EmailQueueItem[]; logs: EmailLog[] }> {
  const res = await fetch('/api/emails/queue-status');
  const data = await res.json();
  return {
    summary: data.summary,
    queue: data.queue || [],
    logs: data.logs || [],
  };
}

export async function clearEmailQueue(): Promise<{ message: string; summary: EmailQueueStatus }> {
  const res = await fetch('/api/emails/queue-clear', { method: 'POST' });
  const data = await res.json();
  return data;
}

export async function triggerEmailReminders(accessToken?: string): Promise<{ message: string; sentEmails: EmailLog[] }> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }
  const res = await fetch('/api/emails/send-reminders', {
    method: 'POST',
    headers,
    body: JSON.stringify({ accessToken }),
  });
  const data = await res.json();
  return data;
}

export async function sendSingleEmail(payload: {
  studentQuery: string;
  studentEmail?: string;
  subject?: string;
  message?: string;
  accessToken?: string;
}): Promise<{ message: string; sentEmail: EmailLog }> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (payload.accessToken) {
    headers['Authorization'] = `Bearer ${payload.accessToken}`;
  }
  const res = await fetch('/api/emails/send-single', {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to send email');
  return data;
}

export async function sendAgentQuery(query: string, studentId: string, role: 'admin' | 'student' = 'student'): Promise<ChatMessage> {
  const res = await fetch('/api/agent/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, studentId, role }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Agent failed to respond');

  return {
    id: `msg-${Date.now()}`,
    sender: 'bot',
    text: data.response,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    agentSteps: data.agentSteps,
    sqlQuery: data.sqlQuery,
    sqlResult: data.sqlResult,
    sources: data.sources,
  };
}

export async function fetchSystemDocs(): Promise<{ schemaDDL: string }> {
  const res = await fetch('/api/system/docs');
  const data = await res.json();
  return data;
}

export async function syncExamScheduleWithBacklogs(schedules: { subjectCode: string; examDate: string; subjectName: string }[]) {
  const res = await fetch('/api/exam-schedule/sync-backlogs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ schedules }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to sync exam schedule');
  return data;
}
