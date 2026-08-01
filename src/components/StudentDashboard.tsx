import React, { useState } from 'react';
import { Student, ChatMessage } from '../types';
import { sendAgentQuery } from '../lib/api';
import { AgentGraphVisualizer } from './AgentGraphVisualizer';
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
  BookOpen,
  ChevronDown,
  ChevronUp,
  Clock,
  Briefcase,
  HelpCircle,
} from 'lucide-react';

interface StudentDashboardProps {
  student: Student;
  onRefreshData: () => void;
}

export const StudentDashboard: React.FC<StudentDashboardProps> = ({
  student,
}) => {
  const [query, setQuery] = useState('');
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'bot',
      text: `Hello ${student.name}! I am your AI Academic Intelligence Assistant powered by LangGraph RAG. Ask me anything about your backlogs, rank, upcoming exam dates, academic regulations, or placement eligibility.`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [loading, setLoading] = useState(false);
  const [activeTraceMsgId, setActiveTraceMsgId] = useState<string | null>(null);

  const sampleQuestions = [
    'Do I have backlogs?',
    'When is my next exam?',
    'What subjects are pending?',
    'Am I eligible for placements?',
    'Explain my academic regulations.',
    'Summarize exam schedule.',
  ];

  const handleSend = async (textToSend?: string) => {
    const promptText = textToSend || query;
    if (!promptText.trim()) return;

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
      const responseMsg = await sendAgentQuery(promptText, student.studentId, 'student');
      setChatHistory((prev) => [...prev, responseMsg]);
      setActiveTraceMsgId(responseMsg.id);
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
      {/* Student Profile Overview Header */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 relative z-10">
          <div className="flex items-start space-x-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white text-xl font-bold shadow-lg shadow-cyan-500/20">
              {student.name.charAt(0)}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-2xl font-extrabold text-white">{student.name}</h1>
                <span className="px-2.5 py-0.5 text-[11px] font-mono font-semibold bg-slate-800 text-cyan-300 border border-slate-700 rounded-md">
                  {student.studentId}
                </span>
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

                    {/* Sources Citation */}
                    {msg.sources && msg.sources.length > 0 && (
                      <div className="bg-slate-950/80 border border-slate-800 p-2.5 rounded-xl text-[11px] text-slate-400 space-y-1">
                        <span className="font-semibold text-cyan-400 flex items-center gap-1 text-[10px] uppercase tracking-wider">
                          <BookOpen className="w-3 h-3" /> Retrieved Document Sources
                        </span>
                        {msg.sources.map((src, i) => (
                          <div key={i} className="line-clamp-1 text-[10px] text-slate-300">
                            • <strong>{src.documentTitle}</strong> ({src.category})
                          </div>
                        ))}
                      </div>
                    )}

                    {/* LangGraph Trace Toggle */}
                    {msg.agentSteps && msg.agentSteps.length > 0 && (
                      <div>
                        <button
                          onClick={() => setActiveTraceMsgId(activeTraceMsgId === msg.id ? null : msg.id)}
                          className="text-[10px] text-cyan-400 hover:text-cyan-300 font-semibold flex items-center gap-1 cursor-pointer"
                        >
                          {activeTraceMsgId === msg.id ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                          <span>{activeTraceMsgId === msg.id ? 'Hide Graph Trace' : 'View LangGraph Node Execution Trace'}</span>
                        </button>

                        {activeTraceMsgId === msg.id && (
                          <div className="mt-2">
                            <AgentGraphVisualizer agentSteps={msg.agentSteps} />
                          </div>
                        )}
                      </div>
                    )}

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
