import React, { useState, useEffect } from 'react';
import { UserSession, Student, DocumentRecord, EmailLog, SystemStats, DepartmentStat } from './types';
import { fetchStudents, fetchDocuments, fetchAnalytics, fetchEmailLogs } from './lib/api';
import { Navbar } from './components/Navbar';
import { AdminDashboard } from './components/AdminDashboard';
import { StudentDashboard } from './components/StudentDashboard';
import { AgentGraphVisualizer } from './components/AgentGraphVisualizer';
import { EmailReminderCenter } from './components/EmailReminderCenter';
import { DatabaseSchemaViewer } from './components/DatabaseSchemaViewer';
import { DocumentationHub } from './components/DocumentationHub';

export default function App() {
  const [session, setSession] = useState<UserSession>({
    role: 'admin',
    email: 'admin@college.edu',
  });

  const [activeTab, setActiveTab] = useState<string>('admin-overview');
  const [students, setStudents] = useState<Student[]>([]);
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [emailLogs, setEmailLogs] = useState<EmailLog[]>([]);
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [departmentStats, setDepartmentStats] = useState<DepartmentStat[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Sync Data Function
  const refreshData = async () => {
    try {
      const [stList, docData, analytics, emails] = await Promise.all([
        fetchStudents(),
        fetchDocuments(),
        fetchAnalytics(),
        fetchEmailLogs(),
      ]);

      setStudents(stList);
      setDocuments(docData.documents);
      setStats(analytics.stats);
      setDepartmentStats(analytics.departmentStats);
      setEmailLogs(emails);
    } catch (err) {
      console.error('Error fetching system state:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshData();
  }, []);

  const handleSessionChange = (newSession: UserSession) => {
    setSession(newSession);
    if (newSession.role === 'student') {
      setActiveTab('student-portal');
    } else {
      setActiveTab('admin-overview');
    }
  };

  const currentStudent =
    students.find((s) => s.studentId === session.studentId) || students[0];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-indigo-500 selection:text-white flex flex-col">
      {/* Top Navbar */}
      <Navbar
        session={session}
        students={students}
        onSessionChange={handleSessionChange}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      {/* Main App Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-64 space-y-3">
            <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs font-semibold text-indigo-400">Loading Academic Intelligence Engine...</span>
          </div>
        ) : (
          <>
            {activeTab === 'admin-overview' && (
              <AdminDashboard
                students={students}
                documents={documents}
                stats={stats}
                departmentStats={departmentStats}
                onRefreshData={refreshData}
              />
            )}

            {(activeTab === 'student-portal' || activeTab === 'student-rag') && currentStudent && (
              <StudentDashboard student={currentStudent} onRefreshData={refreshData} />
            )}

            {activeTab === 'emails' && (
              <EmailReminderCenter emailLogs={emailLogs} onRefreshData={refreshData} />
            )}

            {activeTab === 'langgraph' && (
              <div className="space-y-6">
                <AgentGraphVisualizer />
                {currentStudent && <StudentDashboard student={currentStudent} onRefreshData={refreshData} />}
              </div>
            )}

            {activeTab === 'schema' && <DatabaseSchemaViewer />}

            {activeTab === 'docs' && <DocumentationHub />}
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-slate-900 border-t border-slate-800 text-xs text-slate-400 py-4 text-center">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>AI Powered Student Academic Intelligence System © 2026</span>
          <span className="text-[11px] font-mono text-indigo-400">LangGraph • Gemini 3.6 Flash • Express Server</span>
        </div>
      </footer>
    </div>
  );
}
