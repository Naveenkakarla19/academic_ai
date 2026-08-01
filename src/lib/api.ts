import { Student, DocumentRecord, EmailLog, SystemStats, DepartmentStat, ChatMessage } from '../types';

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

export async function bulkImportStudents(students: Partial<Student>[]): Promise<{ message: string; count: number }> {
  const res = await fetch('/api/students/bulk-import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ students }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to import students');
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

export async function triggerEmailReminders(): Promise<{ message: string; sentEmails: EmailLog[] }> {
  const res = await fetch('/api/emails/send-reminders', { method: 'POST' });
  const data = await res.json();
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
