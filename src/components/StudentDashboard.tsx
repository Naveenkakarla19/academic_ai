import React, { useState } from 'react';
import { Student, ChatMessage } from '../types';
import { sendAgentQuery } from '../lib/api';
import {
  GraduationCap,
  Award,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Send,
  Bot,
  User,
  Sparkles,
  Clock,
  Briefcase,
  HelpCircle,
  Search,
} from 'lucide-react';

interface StudentDashboardProps {
  student: Student;
  students?: Student[];
  onSelectStudent?: (student: Student) => void;
  onRefreshData: () => void;
}

export const StudentDashboard: React.FC<StudentDashboardProps> = ({
  student,
  students = [],
  onSelectStudent,
}) => {
  const [query, setQuery] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'bot',
      text: `Hello ${student.name}! I am your AI Academic Intelligence Assistant. Ask me anything about your CGPA, rank, backlogs, exam timetables, or type any student name (e.g., 'k.naveen') to inspect their profile.`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [loading, setLoading] = useState(false);

  // Update chat history whenever active student changes
  React.useEffect(() => {
    setChatHistory([
      {
        id: `welcome-${student.studentId}`,
        sender: 'bot',
        text: `Loaded Academic Profile for ${student.name} (${student.studentId}). Ask me anything about your CGPA, rank, backlogs, upcoming exams, or type any student name (e.g. 'k.naveen').`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
  }, [student.studentId]);

  const handleSearchSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) return;
    const clean = searchQuery.toLowerCase().replace(/[^a-z0-9]/g, '');
    const match = students.find((s) => {
      const sNameClean = s.name.toLowerCase().replace(/[^a-z0-9]/g, '');
      const sIdClean = s.studentId.toLowerCase().replace(/[^a-z0-9]/g, '');
      return sNameClean.includes(clean) || sIdClean.includes(clean) || clean.includes(sNameClean) || clean.includes(sIdClean);
    });
    if (match && onSelectStudent) {
      onSelectStudent(match);
    }
  };

  const sampleQuestions = [
    'Tell me about K. Naveen',
    'Do I have backlogs?',
    'When is my next exam?',
    'Am I eligible for placements?',
    'Explain my academic regulations.',
    'Who are top rankers in college?',
  ];

  const handleSend = async (textToSend?: string) => {
    const promptText = textToSend || query;
    if (!promptText.trim()) return;

    // Check if query refers to another student by name or student ID
    const promptClean = promptText.toLowerCase().replace(/[^a-z0-9]/g, '');
    const matchedStudent = students.find((s) => {
      const sNameClean = s.name.toLowerCase().replace(/[^a-z0-9]/g, '');
      const sIdClean = s.studentId.toLowerCase().replace(/[^a-z0-9]/g, '');
      const digitsOnly = s.studentId.replace(/\D/g, '');
      return (
        (sNameClean.length >= 3 && promptClean.includes(sNameClean)) ||
        (sIdClean.length >= 3 && promptClean.includes(sIdClean)) ||
        (digitsOnly.length >= 4 && promptClean.includes(digitsOnly))
      );
    });

    if (matchedStudent && onSelectStudent && matchedStudent.studentId !== student.studentId) {
      onSelectStudent(matchedStudent);
    }

    const activeStudentId = matchedStudent ? matchedStudent.studentId : student.studentId;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: promptText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setChatHistory((prev) => [...prev, userMsg]);
    setQuery('');
    setLoading(true);

    try {
      const responseMsg = await sendAgentQuery(promptText, activeStudentId, 'student');
      setChatHistory((prev) => [...prev, responseMsg]);
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        sender: 'bot',
        text: `Sorry, an error occurred while processing your query: ${err.message}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setChatHistory((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Student Search Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl">
        <form onSubmit={handleSearchSubmit} className="relative flex items-center gap-3">
          <Search className="w-5 h-5 text-cyan-400 flex-shrink-0 ml-1" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search student by name or ID (e.g., k.naveen, 23981A42E7, Aarav Sharma)..."
            className="flex-1 bg-transparent text-sm text-white placeholder-slate-400 focus:outline-none"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="text-xs text-slate-400 hover:text-slate-200 px-2 py-1"
            >
              Clear
            </button>
          )}
          <button
            type="submit"
            className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-bold rounded-xl shadow-md transition-all"
          >
            Search Profile
          </button>
        </form>

        {/* Real-time search dropdown suggestions */}
        {searchQuery.trim().length > 0 && (
          <div className="mt-3 border-t border-slate-800/80 pt-3 space-y-1.5 max-h-56 overflow-y-auto">
            {students
              .filter((s) => {
                const q = searchQuery.toLowerCase().replace(/[^a-z0-9]/g, '');
                const sName = s.name.toLowerCase().replace(/[^a-z0-9]/g, '');
                const sId = s.studentId.toLowerCase().replace(/[^a-z0-9]/g, '');
                return sName.includes(q) || sId.includes(q);
              })
              .map((s) => (
                <div
                  key={s.studentId}
                  onClick={() => {
                    if (onSelectStudent) onSelectStudent(s);
                    setSearchQuery('');
                  }}
                  className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer text-xs transition-colors border ${
                    s.studentId === student.studentId
                      ? 'bg-cyan-950/40 border-cyan-500/40 text-cyan-200'
                      : 'bg-slate-950/60 border-slate-800/80 hover:bg-slate-800/80 text-slate-300'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <span className="w-7 h-7 rounded-lg bg-cyan-600/30 text-cyan-300 font-bold flex items-center justify-center text-xs">
                      {s.name.charAt(0)}
                    </span>
                    <div>
                      <span className="font-bold text-white block">{s.name}</span>
                      <span className="text-[11px] text-slate-400 font-mono">{s.studentId} • {s.department} Year {s.year}</span>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <span className="text-slate-300 font-semibold">CGPA: {s.cgpa.toFixed(2)}</span>
                    {s.backlogCount > 0 ? (
                      <span className="px-2.5 py-0.5 text-[10px] font-semibold bg-amber-500/20 text-amber-300 rounded-md border border-amber-500/30">
                        {s.backlogCount} Backlog
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 rounded-md border border-emerald-500/30">
                        Clear
                      </span>
                    )}
                  </div>
                </div>
              ))}
            {students.filter((s) => {
              const q = searchQuery.toLowerCase().replace(/[^a-z0-9]/g, '');
              const sName = s.name.toLowerCase().replace(/[^a-z0-9]/g, '');
              const sId = s.studentId.toLowerCase().replace(/[^a-z0-9]/g, '');
              return sName.includes(q) || sId.includes(q);
            }).length === 0 && (
              <p className="text-xs text-slate-400 italic text-center py-2">
                No matching student found for &quot;{searchQuery}&quot;.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Student Profile Overview Header */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 relative z-10">
          <div className="flex items-start space-x-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white text-xl font-bold shadow-lg shadow-cyan-500/20">
              {student.name.charAt(0)}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-extrabold text-white">{student.name}</h1>
                <span className="px-2.5 py-0.5 text-[11px] font-mono font-semibold bg-slate-800 text-cyan-300 border border-slate-700 rounded-md">
                  {student.studentId}
                </span>

                {students.length > 0 && onSelectStudent && (
                  <select
                    value={student.studentId}
                    onChange={(e) => {
                      const sel = students.find((s) => s.studentId === e.target.value);
                      if (sel) onSelectStudent(sel);
                    }}
                    className="bg-slate-950 text-cyan-300 text-xs border border-cyan-500/40 font-semibold rounded-lg px-2.5 py-1 focus:outline-none focus:border-cyan-400 cursor-pointer shadow-sm hover:border-cyan-400 transition-colors"
                  >
                    {students.map((s) => (
                      <option key={s.studentId} value={s.studentId} className="bg-slate-900 text-slate-100 font-sans">
                        Switch View: {s.name} ({s.studentId}) {s.backlogCount > 0 ? `• ${s.backlogCount} Backlog` : '• Clear'}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Department of <strong className="text-slate-200">{student.department}</strong> • Year {student.year}, Semester {student.semester}
              </p>
              <p className="text-xs text-slate-400">{student.email} • {student.phone}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Rank Card */}
            <div className="bg-slate-950/80 border border-slate-800 px-4 py-2.5 rounded-xl text-center min-w-[100px]">
              <span className="text-[10px] text-slate-400 uppercase font-semibold block">Overall Rank</span>
              {student.rank ? (
                <span className="text-xl font-black text-amber-400">#{student.rank}</span>
              ) : (
                <span className="text-xs text-slate-500 font-medium">N/A (Backlogs)</span>
              )}
            </div>

            {/* CGPA Card */}
            <div className="bg-slate-950/80 border border-slate-800 px-4 py-2.5 rounded-xl text-center min-w-[100px]">
              <span className="text-[10px] text-slate-400 uppercase font-semibold block">CGPA</span>
              <span className="text-xl font-black text-cyan-300">{student.cgpa.toFixed(2)}</span>
            </div>

            {/* Backlog Status */}
            <div className="bg-slate-950/80 border border-slate-800 px-4 py-2.5 rounded-xl text-center min-w-[110px]">
              <span className="text-[10px] text-slate-400 uppercase font-semibold block">Backlogs</span>
              {student.backlogCount === 0 ? (
                <span className="text-sm font-bold text-emerald-400 flex items-center justify-center gap-1 mt-1">
                  <CheckCircle2 className="w-4 h-4" /> Clear
                </span>
              ) : (
                <span className="text-sm font-bold text-amber-400 flex items-center justify-center gap-1 mt-1">
                  <AlertTriangle className="w-4 h-4" /> {student.backlogCount} Pending
                </span>
              )}
            </div>

            {/* Placement Eligibility */}
            <div className="bg-slate-950/80 border border-slate-800 px-4 py-2.5 rounded-xl text-center min-w-[120px]">
              <span className="text-[10px] text-slate-400 uppercase font-semibold block">Placement</span>
              {student.placementEligible ? (
                <span className="text-xs font-bold text-purple-300 bg-purple-500/20 border border-purple-500/30 px-2 py-0.5 rounded-full inline-block mt-1">
                  Tier-1 Eligible
                </span>
              ) : (
                <span className="text-xs font-bold text-rose-400 bg-rose-500/20 border border-rose-500/30 px-2 py-0.5 rounded-full inline-block mt-1">
                  Ineligible
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid: Left Academic Status / Right RAG AI Chatbot */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (5 Cols): Backlogs & Exams & Rules */}
        <div className="lg:col-span-5 space-y-6">
          {/* Active Backlogs & Supplementary Exams Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-lg">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                Active Backlogs & Exam Timetable
              </h3>
              <span className="text-xs text-slate-400">{student.backlogs.length} Total</span>
            </div>

            {student.backlogs.length === 0 ? (
              <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-6 text-center space-y-2">
                <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
                <h4 className="text-sm font-semibold text-white">No Standing Backlogs!</h4>
                <p className="text-xs text-slate-400">
                  Congratulations, you have cleared all your enrolled subjects. Your CGPA is active for college ranking.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {student.backlogs.map((bl) => (
                  <div key={bl.id} className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="px-2 py-0.5 text-[10px] font-mono font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-md">
                          {bl.subjectCode}
                        </span>
                        <h4 className="text-sm font-bold text-white mt-1">{bl.subjectName}</h4>
                        <p className="text-xs text-slate-400">Semester {bl.semester} Subject</p>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-bold text-amber-400 flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" /> {bl.daysRemaining} Days
                        </span>
                        <span className="text-[10px] text-slate-500 block">Exam: {bl.examDate}</span>
                      </div>
                    </div>

                    <div className="bg-amber-950/30 border border-amber-800/40 p-2 rounded-lg text-[11px] text-amber-200/80 flex items-center gap-2">
                      <Sparkles className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                      <span>AI Email reminder agent sent a personalized preparation checklist.</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Placement Criteria Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3 shadow-lg">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-purple-400" />
              Campus Placement Eligibility Rules (AR23)
            </h3>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between p-2.5 bg-slate-950 rounded-xl border border-slate-800">
                <span className="text-slate-300">CGPA Cutoff (Min 6.50)</span>
                <span className={`font-bold ${student.cgpa >= 6.5 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {student.cgpa >= 6.5 ? `PASSED (${student.cgpa.toFixed(2)})` : `FAILED (${student.cgpa.toFixed(2)})`}
                </span>
              </div>

              <div className="flex items-center justify-between p-2.5 bg-slate-950 rounded-xl border border-slate-800">
                <span className="text-slate-300">Standing Backlogs (Max 0 Allowed)</span>
                <span className={`font-bold ${student.backlogCount === 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {student.backlogCount === 0 ? 'PASSED (0 Backlogs)' : `FAILED (${student.backlogCount} Pending)`}
                </span>
              </div>

              <div className="flex items-center justify-between p-2.5 bg-slate-950 rounded-xl border border-slate-800">
                <span className="text-slate-300">Attendance Cutoff (Min 75%)</span>
                <span className={`font-bold ${student.attendance >= 75 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {student.attendance >= 75 ? `PASSED (${student.attendance}%)` : `FAILED (${student.attendance}%)`}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column (7 Cols): AI RAG Chatbot */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl flex flex-col h-[650px]">
            {/* Chatbot Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-500 to-indigo-600 flex items-center justify-center text-white shadow-md">
                  <Bot className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    RAG Academic Intelligence Chatbot
                  </h3>
                  <p className="text-[11px] text-slate-400">Powered by LangGraph Flow + FAISS/ChromaDB Vector Store</p>
                </div>
              </div>
              <span className="px-2 py-1 text-[10px] font-bold uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full">
                Live Gemini RAG
              </span>
            </div>

            {/* Prompt Suggestion Chips */}
            <div className="flex space-x-1.5 overflow-x-auto py-1 scrollbar-none border-b border-slate-800/80">
              {sampleQuestions.map((q, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSend(q)}
                  disabled={loading}
                  className="px-2.5 py-1 text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg whitespace-nowrap transition-colors flex-shrink-0 border border-slate-700/60 cursor-pointer"
                >
                  {q}
                </button>
              ))}
            </div>

            {/* Chat Messages Log */}
            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              {chatHistory.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex items-start space-x-3 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {msg.sender === 'bot' && (
                    <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white flex-shrink-0 text-xs">
                      <Bot className="w-4 h-4" />
                    </div>
                  )}

                  <div className={`max-w-[85%] space-y-2 ${msg.sender === 'user' ? 'text-right' : 'text-left'}`}>
                    <div
                      className={`inline-block p-3.5 rounded-2xl text-xs leading-relaxed ${
                        msg.sender === 'user'
                          ? 'bg-indigo-600 text-white font-medium shadow-md'
                          : 'bg-slate-950 text-slate-200 border border-slate-800 shadow-md whitespace-pre-wrap'
                      }`}
                    >
                      {msg.text}
                    </div>

                    <span className="text-[10px] text-slate-500 block">{msg.timestamp}</span>
                  </div>

                  {msg.sender === 'user' && (
                    <div className="w-8 h-8 rounded-lg bg-cyan-600 flex items-center justify-center text-white flex-shrink-0 text-xs">
                      <User className="w-4 h-4" />
                    </div>
                  )}
                </div>
              ))}

              {loading && (
                <div className="flex items-center space-x-2 text-xs text-indigo-400">
                  <Bot className="w-4 h-4 animate-bounce" />
                  <span>LangGraph RAG Agent executing SQL & ChromaDB query...</span>
                </div>
              )}
            </div>

            {/* Input Box */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="flex items-center space-x-2 pt-2 border-t border-slate-800"
            >
              <input
                type="text"
                placeholder="Ask about backlogs, exam schedule, regulations, or placement eligibility..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                disabled={loading}
                className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
              />
              <button
                type="submit"
                disabled={loading || !query.trim()}
                className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-md shadow-indigo-600/20 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Ask AI</span>
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
