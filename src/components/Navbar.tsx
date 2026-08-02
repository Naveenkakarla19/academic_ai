import React from 'react';
import { UserSession, Student } from '../types';
import { GraduationCap, ShieldCheck, UserCheck, Bot, Mail, Database, FileText, Cpu, Eye, EyeOff, Calendar } from 'lucide-react';

interface NavbarProps {
  session: UserSession;
  students: Student[];
  onSessionChange: (newSession: UserSession) => void;
  activeTab: string;
  onTabChange: (tab: string) => void;
  showTechSpecs?: boolean;
  onToggleTechSpecs?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  session,
  students,
  onSessionChange,
  activeTab,
  onTabChange,
  showTechSpecs = true,
  onToggleTechSpecs,
}) => {
  return (
    <header className="bg-slate-900 border-b border-slate-800 text-slate-100 sticky top-0 z-40 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo & Name */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 via-blue-700 to-amber-500 flex items-center justify-center text-white shadow-md shadow-indigo-600/30 ring-1 ring-white/10">
              <GraduationCap className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-extrabold text-base sm:text-lg text-white tracking-tight">Raghu Engineering College</span>
                <span className="px-2 py-0.5 text-[10px] uppercase font-bold tracking-wider bg-amber-500/15 text-amber-300 border border-amber-500/30 rounded-md">
                  AUTONOMOUS
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium">Academic Intelligence & Backlog Command System</p>
            </div>
          </div>

          {/* Role & Persona Switcher */}
          <div className="flex items-center space-x-3">
            <div className="bg-slate-800/80 p-1 rounded-lg border border-slate-700/60 flex items-center text-xs">
              <button
                onClick={() =>
                  onSessionChange({
                    role: 'admin',
                    email: 'admin@college.edu',
                  })
                }
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md transition-all font-medium ${
                  session.role === 'admin'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Admin Portal</span>
              </button>

              <button
                onClick={() => {
                  const defaultStudent =
                    students.find((s) => s.rank === 1) ||
                    [...students].sort((a, b) => b.cgpa - a.cgpa)[0] ||
                    students[0] ||
                    { studentId: '21CSE001', name: 'Aarav Sharma', email: 'aarav.sharma@college.edu' };
                  onSessionChange({
                    role: 'student',
                    studentId: defaultStudent.studentId,
                    studentName: defaultStudent.name,
                    email: defaultStudent.email,
                  });
                }}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md transition-all font-medium ${
                  session.role === 'student'
                    ? 'bg-cyan-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>Student View</span>
              </button>
            </div>

            {/* Student Select Dropdown if student mode */}
            {session.role === 'student' && students.length > 0 && (
              <select
                value={session.studentId || ''}
                onChange={(e) => {
                  const sel = students.find((s) => s.studentId === e.target.value);
                  if (sel) {
                    onSessionChange({
                      role: 'student',
                      studentId: sel.studentId,
                      studentName: sel.name,
                      email: sel.email,
                    });
                  }
                }}
                className="bg-slate-800 text-slate-200 text-xs border border-slate-700 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-cyan-500"
              >
                {students.map((s) => (
                  <option key={s.studentId} value={s.studentId}>
                    {s.name} ({s.studentId}) {s.backlogCount > 0 ? `• ${s.backlogCount} Backlog` : '• Clear'}
                  </option>
                ))}
              </select>
            )}

            {/* Toggle DDL & Tech Specs visibility */}
            {onToggleTechSpecs && (
              <button
                onClick={onToggleTechSpecs}
                title="Toggle DDL, ER Diagram, and Tech Specs in Navbar"
                className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                  showTechSpecs
                    ? 'bg-slate-800/90 text-indigo-300 border-indigo-500/40 hover:bg-slate-800'
                    : 'bg-slate-900 text-slate-400 border-slate-700 hover:text-slate-200'
                }`}
              >
                {showTechSpecs ? <Eye className="w-3.5 h-3.5 text-indigo-400" /> : <EyeOff className="w-3.5 h-3.5 text-slate-500" />}
                <span className="hidden sm:inline">{showTechSpecs ? 'Tech Specs: ON' : 'Tech Specs: OFF'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Sub-Header Navigation Tabs */}
        <div className="flex space-x-1 overflow-x-auto py-2 border-t border-slate-800/80 text-xs scrollbar-none">
          {session.role === 'admin' ? (
            <>
              <button
                onClick={() => onTabChange('admin-overview')}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md font-medium whitespace-nowrap transition-colors ${
                  activeTab === 'admin-overview' ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/40' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Admin Dashboard</span>
              </button>
              <button
                onClick={() => onTabChange('student-portal')}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md font-medium whitespace-nowrap transition-colors ${
                  activeTab === 'student-portal' ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/40' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>Student Portal Preview</span>
              </button>
              <button
                onClick={() => onTabChange('emails')}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md font-medium whitespace-nowrap transition-colors ${
                  activeTab === 'emails' ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/40' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <Mail className="w-3.5 h-3.5" />
                <span>Email Reminder Agent</span>
              </button>
              <button
                onClick={() => onTabChange('exam-designer')}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md font-medium whitespace-nowrap transition-colors ${
                  activeTab === 'exam-designer' ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/40' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <Calendar className="w-3.5 h-3.5 text-cyan-400" />
                <span>Exam Schedule Designer</span>
              </button>
              {showTechSpecs && (
                <>
                  <button
                    onClick={() => onTabChange('langgraph')}
                    className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md font-medium whitespace-nowrap transition-colors ${
                      activeTab === 'langgraph' ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/40' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                    }`}
                  >
                    <Cpu className="w-3.5 h-3.5" />
                    <span>LangGraph Architecture</span>
                  </button>
                  <button
                    onClick={() => onTabChange('schema')}
                    className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md font-medium whitespace-nowrap transition-colors ${
                      activeTab === 'schema' ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/40' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                    }`}
                  >
                    <Database className="w-3.5 h-3.5" />
                    <span>ER Diagram & DDL</span>
                  </button>
                  <button
                    onClick={() => onTabChange('docs')}
                    className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md font-medium whitespace-nowrap transition-colors ${
                      activeTab === 'docs' ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/40' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Project Documentation</span>
                  </button>
                </>
              )}
            </>
          ) : (
            <>
              <button
                onClick={() => onTabChange('student-portal')}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md font-medium whitespace-nowrap transition-colors ${
                  activeTab === 'student-portal' ? 'bg-cyan-600/30 text-cyan-300 border border-cyan-500/40' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>My Academic Dashboard</span>
              </button>
              <button
                onClick={() => onTabChange('student-rag')}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md font-medium whitespace-nowrap transition-colors ${
                  activeTab === 'student-rag' ? 'bg-cyan-600/30 text-cyan-300 border border-cyan-500/40' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <Bot className="w-3.5 h-3.5" />
                <span>AI RAG Academic Chatbot</span>
              </button>
              {showTechSpecs && (
                <>
                  <button
                    onClick={() => onTabChange('langgraph')}
                    className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md font-medium whitespace-nowrap transition-colors ${
                      activeTab === 'langgraph' ? 'bg-cyan-600/30 text-cyan-300 border border-cyan-500/40' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                    }`}
                  >
                    <Cpu className="w-3.5 h-3.5" />
                    <span>LangGraph Flow Inspector</span>
                  </button>
                  <button
                    onClick={() => onTabChange('docs')}
                    className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md font-medium whitespace-nowrap transition-colors ${
                      activeTab === 'docs' ? 'bg-cyan-600/30 text-cyan-300 border border-cyan-500/40' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Documentation & Guides</span>
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </header>
  );
};
