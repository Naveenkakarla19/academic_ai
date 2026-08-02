import React, { useState } from 'react';
import { Calendar, Clock, Plus, Trash2, Send, RefreshCw, CheckCircle2, AlertCircle, FileText, Download, Sparkles, Building2, MapPin, Search, Upload } from 'lucide-react';
import { uploadDocument, syncExamScheduleWithBacklogs, sendAgentQuery } from '../lib/api';

export interface ExamSlot {
  id: string;
  date: string;
  session: 'FN (09:30 AM - 12:30 PM)' | 'AN (02:00 PM - 05:00 PM)';
  subjectCode: string;
  subjectName: string;
  department: 'CSE' | 'ECE' | 'EEE' | 'MECH' | 'IT' | 'CIVIL' | 'ALL';
  hall: string;
  maxMarks: number;
}

const PRESET_SCHEDULES: Record<string, { title: string; slots: ExamSlot[] }> = {
  august_supp: {
    title: 'August 2026 Supplementary Examinations Schedule',
    slots: [
      {
        id: 'slot-1',
        date: '2026-08-21',
        session: 'FN (09:30 AM - 12:30 PM)',
        subjectCode: 'CS302',
        subjectName: 'Data Structures & Algorithms',
        department: 'CSE',
        hall: 'Main Block Hall A-101',
        maxMarks: 100,
      },
      {
        id: 'slot-2',
        date: '2026-08-21',
        session: 'AN (02:00 PM - 05:00 PM)',
        subjectCode: 'ME201',
        subjectName: 'Thermodynamics II',
        department: 'MECH',
        hall: 'Mechanical Block M-204',
        maxMarks: 100,
      },
      {
        id: 'slot-3',
        date: '2026-08-21',
        session: 'FN (09:30 AM - 12:30 PM)',
        subjectCode: 'EC101',
        subjectName: 'Basic Electronics Engineering',
        department: 'ECE',
        hall: 'ECE Lab Complex E-12',
        maxMarks: 100,
      },
      {
        id: 'slot-4',
        date: '2026-08-25',
        session: 'FN (09:30 AM - 12:30 PM)',
        subjectCode: 'CS401',
        subjectName: 'Database Management Systems',
        department: 'CSE',
        hall: 'Computer Center CC-3',
        maxMarks: 100,
      },
      {
        id: 'slot-5',
        date: '2026-08-28',
        session: 'AN (02:00 PM - 05:00 PM)',
        subjectCode: 'ME304',
        subjectName: 'Fluid Mechanics & Machinery',
        department: 'MECH',
        hall: 'Mechanical Block M-208',
        maxMarks: 100,
      },
      {
        id: 'slot-6',
        date: '2026-09-02',
        session: 'FN (09:30 AM - 12:30 PM)',
        subjectCode: 'EE202',
        subjectName: 'Electrical Circuits & Networks',
        department: 'EEE',
        hall: 'Electrical Block Power Lab',
        maxMarks: 100,
      },
    ],
  },
  nov_midterm: {
    title: 'November 2026 Mid-Semester Examination Schedule',
    slots: [
      {
        id: 'slot-mid-1',
        date: '2026-11-10',
        session: 'FN (09:30 AM - 12:30 PM)',
        subjectCode: 'CS501',
        subjectName: 'Compiler Design',
        department: 'CSE',
        hall: 'Academic Block B-301',
        maxMarks: 50,
      },
      {
        id: 'slot-mid-2',
        date: '2026-11-12',
        session: 'AN (02:00 PM - 05:00 PM)',
        subjectCode: 'EC305',
        subjectName: 'VLSI Design',
        department: 'ECE',
        hall: 'VLSI Design Center',
        maxMarks: 50,
      },
      {
        id: 'slot-mid-3',
        date: '2026-11-15',
        session: 'FN (09:30 AM - 12:30 PM)',
        subjectCode: 'IT402',
        subjectName: 'Cloud Computing Architecture',
        department: 'IT',
        hall: 'IT Block Lab 1',
        maxMarks: 50,
      },
    ],
  },
  quick_test: {
    title: 'Sprint Testing Schedule (Next 3 Days)',
    slots: [
      {
        id: 'slot-qt-1',
        date: '2026-08-05',
        session: 'FN (09:30 AM - 12:30 PM)',
        subjectCode: 'CS302',
        subjectName: 'Data Structures & Algorithms',
        department: 'CSE',
        hall: 'Exam Center Hall-1',
        maxMarks: 100,
      },
      {
        id: 'slot-qt-2',
        date: '2026-08-06',
        session: 'AN (02:00 PM - 05:00 PM)',
        subjectCode: 'ME201',
        subjectName: 'Thermodynamics II',
        department: 'MECH',
        hall: 'Exam Center Hall-2',
        maxMarks: 100,
      },
    ],
  },
};

interface ExamScheduleDesignerProps {
  onRefreshData?: () => void;
}

export const ExamScheduleDesigner: React.FC<ExamScheduleDesignerProps> = ({ onRefreshData }) => {
  const [scheduleTitle, setScheduleTitle] = useState('Official Examination Schedule - August 2026');
  const [slots, setSlots] = useState<ExamSlot[]>(PRESET_SCHEDULES.august_supp.slots);
  const [deptFilter, setDeptFilter] = useState<string>('ALL');
  const [sessionFilter, setSessionFilter] = useState<string>('ALL');

  // Statuses
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Test Bench Chatbot
  const [testQuery, setTestQuery] = useState('');
  const [testAnswer, setTestAnswer] = useState<string | null>(null);
  const [isTestLoading, setIsTestLoading] = useState(false);

  // Add new exam slot row
  const handleAddSlot = () => {
    const newSlot: ExamSlot = {
      id: `slot-custom-${Date.now()}`,
      date: '2026-08-25',
      session: 'FN (09:30 AM - 12:30 PM)',
      subjectCode: 'NEW101',
      subjectName: 'New Examination Paper',
      department: 'CSE',
      hall: 'Exam Hall 101',
      maxMarks: 100,
    };
    setSlots((prev) => [...prev, newSlot]);
  };

  // Update row
  const handleUpdateSlot = (id: string, field: keyof ExamSlot, value: any) => {
    setSlots((prev) =>
      prev.map((s) => (s.id === id ? { ...s, [field]: value } : s))
    );
  };

  // Remove row
  const handleRemoveSlot = (id: string) => {
    setSlots((prev) => prev.filter((s) => s.id !== id));
  };

  // Load Preset
  const handleLoadPreset = (presetKey: string) => {
    const p = PRESET_SCHEDULES[presetKey];
    if (p) {
      setScheduleTitle(p.title);
      setSlots(p.slots);
      setStatusMsg(`Loaded preset: "${p.title}" with ${p.slots.length} exam slots.`);
      setTimeout(() => setStatusMsg(null), 3000);
    }
  };

  // Upload Schedule PDF or File directly
  const handleUploadScheduleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsPublishing(true);
    setStatusMsg(`Reading exam schedule file ${file.name}...`);

    try {
      const cleanTitle = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
      setScheduleTitle(cleanTitle);

      let extractedText = '';
      if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        const arrayBuffer = await file.arrayBuffer();
        const decoder = new TextDecoder('utf-8', { fatal: false });
        const rawText = decoder.decode(arrayBuffer);

        const textMatches: string[] = [];
        const streamRegex = /\(([^()]{2,})\)/g;
        let match;
        while ((match = streamRegex.exec(rawText)) !== null) {
          const cleaned = match[1].replace(/\\([()\\])/g, '$1').trim();
          if (cleaned.length > 1 && (/\w{3,}/.test(cleaned) || /\d/.test(cleaned))) {
            textMatches.push(cleaned);
          }
        }

        extractedText = textMatches.join(' ');
        if (extractedText.length < 40) {
          extractedText = rawText
            .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        }

        if (!extractedText || extractedText.length < 20) {
          extractedText = `OFFICIAL EXAMINATION SCHEDULE: ${cleanTitle}\nFile: ${file.name}\n\nSupplementary Exam Schedule and Instructions for Students.`;
        }
      } else {
        extractedText = await file.text();
      }

      // Automatically index into RAG Store
      const uploadRes = await uploadDocument({
        title: cleanTitle,
        category: 'Exam Schedule',
        content: extractedText,
        filename: file.name,
      });

      // Automatically sync student backlogs and send emails
      const schedulePayload = slots.map((s) => ({
        subjectCode: s.subjectCode,
        subjectName: s.subjectName,
        examDate: s.date,
      }));
      await syncExamScheduleWithBacklogs(schedulePayload);

      setStatusMsg(uploadRes.message || `Uploaded & indexed timetable "${file.name}"! Updated student backlog subjects and sent email notifications to affected students!`);
      if (onRefreshData) onRefreshData();
    } catch (err: any) {
      setStatusMsg(`Error uploading schedule file: ${err.message}`);
    } finally {
      setIsPublishing(false);
    }
  };

  // Publish to RAG Vector Knowledge Base
  const handlePublishToRAG = async () => {
    if (slots.length === 0) {
      alert('Please add at least one exam slot to publish.');
      return;
    }

    setIsPublishing(true);
    setStatusMsg('Compiling schedule document, syncing student backlogs & sending email reminders...');

    try {
      let docText = `OFFICIAL EXAMINATION SCHEDULE: ${scheduleTitle.toUpperCase()}\n\n`;
      docText += `EXAM TIMINGS:\n- Forenoon Session (FN): 09:30 AM to 12:30 PM\n- Afternoon Session (AN): 02:00 PM to 05:00 PM\n\n`;
      docText += `DETAILED TIMETABLE:\n`;

      slots.forEach((s, idx) => {
        docText += `${idx + 1}. Date: ${s.date} | Session: ${s.session} | Code: ${s.subjectCode} | Subject: ${s.subjectName} | Department: ${s.department} | Hall: ${s.hall} | Max Marks: ${s.maxMarks}\n`;
      });

      docText += `\nINSTRUCTIONS & REGULATIONS:\n- Hall tickets will be issued 5 days prior to the examination date from the Controller of Examinations.\n- Students must clear all college dues prior to downloading hall tickets.\n- Electronic gadgets, programmable calculators, and smartwatches are strictly banned inside examination halls.\n- Formal uniform or clean professional attire is mandatory during examination sessions.\n`;

      const uploadRes = await uploadDocument({
        title: scheduleTitle,
        category: 'Exam Schedule',
        content: docText,
        filename: `${scheduleTitle.replace(/\s+/g, '_')}.txt`,
      });

      // Automatically sync backlogs and send emails
      const schedulePayload = slots.map((s) => ({
        subjectCode: s.subjectCode,
        subjectName: s.subjectName,
        examDate: s.date,
      }));
      await syncExamScheduleWithBacklogs(schedulePayload);

      setStatusMsg(uploadRes.message || 'Success! Timetable published, student backlogs updated with subject names/dates, and backlog email reminders sent!');
      if (onRefreshData) onRefreshData();
    } catch (err: any) {
      setStatusMsg(`Error publishing schedule: ${err.message}`);
    } finally {
      setIsPublishing(false);
    }
  };

  // Sync with Student Backlogs
  const handleSyncStudentBacklogs = async () => {
    setIsSyncing(true);
    setStatusMsg('Synchronizing exam dates with student backlog records...');

    try {
      const schedulePayload = slots.map((s) => ({
        subjectCode: s.subjectCode,
        subjectName: s.subjectName,
        examDate: s.date,
      }));

      await syncExamScheduleWithBacklogs(schedulePayload);
      setStatusMsg('Successfully synchronized student backlog countdown timers and exam dates!');
      if (onRefreshData) onRefreshData();
    } catch (err: any) {
      setStatusMsg(`Sync Error: ${err.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  // Run Test Bench RAG Query
  const handleRunTestQuery = async (queryText?: string) => {
    const q = queryText || testQuery;
    if (!q.trim()) return;

    setIsTestLoading(true);
    setTestAnswer(null);

    try {
      const res = await sendAgentQuery(q, '21CSE102', 'admin');
      setTestAnswer(res.text);
    } catch (err: any) {
      setTestAnswer(`Error testing query: ${err.message}`);
    } finally {
      setIsTestLoading(false);
    }
  };

  // Filter slots
  const filteredSlots = slots.filter((s) => {
    const matchesDept = deptFilter === 'ALL' || s.department === deptFilter || s.department === 'ALL';
    const matchesSession =
      sessionFilter === 'ALL' ||
      (sessionFilter === 'FN' && s.session.includes('FN')) ||
      (sessionFilter === 'AN' && s.session.includes('AN'));
    return matchesDept && matchesSession;
  });

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-slate-800 rounded-2xl p-6 text-slate-100 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="px-2.5 py-1 text-xs font-semibold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 rounded-full flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> Exam Timetable Designer & RAG Test Bench
              </span>
              <span className="text-xs text-slate-400">Raghu Engineering College Exam Cell</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white mt-1">
              Design & Test Examination Schedules
            </h1>
            <p className="text-sm text-slate-400 mt-1 max-w-2xl">
              Construct customized timetables, index them into the AI RAG Knowledge Base in real time, and synchronize student backlog countdowns for testing.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center space-x-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl font-medium text-xs shadow-md transition-all cursor-pointer">
              <Upload className="w-4 h-4 text-cyan-400" />
              <span>Upload Schedule PDF/File</span>
              <input
                type="file"
                accept=".pdf,.txt,.csv,.md,.doc,.docx"
                onChange={handleUploadScheduleFile}
                className="hidden"
              />
            </label>

            <button
              onClick={handlePublishToRAG}
              disabled={isPublishing}
              className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-medium text-xs shadow-md shadow-indigo-600/20 transition-all cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isPublishing ? 'animate-spin' : ''}`} />
              <span>{isPublishing ? 'Indexing...' : 'Publish to RAG Index'}</span>
            </button>

            <button
              onClick={handleSyncStudentBacklogs}
              disabled={isSyncing}
              className="flex items-center space-x-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl font-medium text-xs shadow-md shadow-cyan-600/20 transition-all cursor-pointer disabled:opacity-50"
            >
              <Calendar className="w-4 h-4" />
              <span>{isSyncing ? 'Syncing...' : 'Sync Backlog Dates'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Preset Schedule Loaders & Title Editor */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div className="flex-1">
            <label className="text-xs font-semibold text-slate-400 block mb-1">
              Examination Schedule Document Title
            </label>
            <input
              type="text"
              value={scheduleTitle}
              onChange={(e) => setScheduleTitle(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 font-semibold"
              placeholder="Title for this schedule..."
            />
          </div>

          <div>
            <span className="text-xs font-semibold text-slate-400 block mb-1">
              Load Pre-configured Test Templates:
            </span>
            <div className="flex flex-wrap gap-2 text-xs">
              <button
                onClick={() => handleLoadPreset('august_supp')}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-indigo-300 border border-indigo-500/30 rounded-lg transition-all"
              >
                August Supp Schedule
              </button>
              <button
                onClick={() => handleLoadPreset('nov_midterm')}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-500/30 rounded-lg transition-all"
              >
                November Mid-Terms
              </button>
              <button
                onClick={() => handleLoadPreset('quick_test')}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 rounded-lg transition-all"
              >
                3-Day Sprint Test
              </button>
            </div>
          </div>
        </div>

        {/* Status Notification */}
        {statusMsg && (
          <div className="bg-indigo-950/60 border border-indigo-500/40 p-3 rounded-xl text-xs text-indigo-200 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-indigo-400 flex-shrink-0" />
              <span>{statusMsg}</span>
            </div>
            <button
              onClick={() => setStatusMsg(null)}
              className="text-indigo-400 hover:text-white ml-2 text-xs font-bold"
            >
              ✕
            </button>
          </div>
        )}

        {/* Controls Bar & Filters */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
          <div className="flex items-center space-x-2 text-xs">
            <span className="text-slate-400 font-medium">Filter View:</span>
            <select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 text-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none"
            >
              <option value="ALL">All Departments</option>
              <option value="CSE">CSE</option>
              <option value="ECE">ECE</option>
              <option value="EEE">EEE</option>
              <option value="MECH">MECH</option>
              <option value="IT">IT</option>
            </select>

            <select
              value={sessionFilter}
              onChange={(e) => setSessionFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 text-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none"
            >
              <option value="ALL">All Sessions</option>
              <option value="FN">Forenoon (FN)</option>
              <option value="AN">Afternoon (AN)</option>
            </select>
          </div>

          <button
            onClick={handleAddSlot}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 hover:bg-indigo-600/50 rounded-xl text-xs font-semibold transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Exam Slot</span>
          </button>
        </div>

        {/* Exam Schedule Table Editor */}
        <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-900 text-slate-400 font-semibold border-b border-slate-800">
              <tr>
                <th className="p-3">Exam Date</th>
                <th className="p-3">Session & Time</th>
                <th className="p-3">Subject Code</th>
                <th className="p-3">Subject Name</th>
                <th className="p-3">Dept</th>
                <th className="p-3">Exam Hall / Room</th>
                <th className="p-3">Max Marks</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredSlots.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-500 italic">
                    No exam slots match the selected filters. Click "Add Exam Slot" to create one.
                  </td>
                </tr>
              ) : (
                filteredSlots.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-900/50 transition-colors">
                    <td className="p-2.5">
                      <input
                        type="date"
                        value={s.date}
                        onChange={(e) => handleUpdateSlot(s.id, 'date', e.target.value)}
                        className="bg-slate-900 border border-slate-800 rounded-md px-2 py-1 text-slate-200 focus:outline-none focus:border-indigo-500"
                      />
                    </td>

                    <td className="p-2.5">
                      <select
                        value={s.session}
                        onChange={(e) => handleUpdateSlot(s.id, 'session', e.target.value as any)}
                        className="bg-slate-900 border border-slate-800 rounded-md px-2 py-1 text-slate-200 focus:outline-none"
                      >
                        <option value="FN (09:30 AM - 12:30 PM)">FN (09:30 AM - 12:30 PM)</option>
                        <option value="AN (02:00 PM - 05:00 PM)">AN (02:00 PM - 05:00 PM)</option>
                      </select>
                    </td>

                    <td className="p-2.5">
                      <input
                        type="text"
                        value={s.subjectCode}
                        onChange={(e) => handleUpdateSlot(s.id, 'subjectCode', e.target.value)}
                        className="bg-slate-900 border border-slate-800 rounded-md px-2 py-1 text-indigo-300 font-mono font-bold focus:outline-none w-24"
                      />
                    </td>

                    <td className="p-2.5">
                      <input
                        type="text"
                        value={s.subjectName}
                        onChange={(e) => handleUpdateSlot(s.id, 'subjectName', e.target.value)}
                        className="bg-slate-900 border border-slate-800 rounded-md px-2 py-1 text-slate-200 focus:outline-none w-full min-w-[160px]"
                      />
                    </td>

                    <td className="p-2.5">
                      <select
                        value={s.department}
                        onChange={(e) => handleUpdateSlot(s.id, 'department', e.target.value as any)}
                        className="bg-slate-900 border border-slate-800 rounded-md px-2 py-1 text-slate-200 focus:outline-none font-semibold text-[11px]"
                      >
                        <option value="CSE">CSE</option>
                        <option value="ECE">ECE</option>
                        <option value="EEE">EEE</option>
                        <option value="MECH">MECH</option>
                        <option value="IT">IT</option>
                        <option value="CIVIL">CIVIL</option>
                        <option value="ALL">ALL</option>
                      </select>
                    </td>

                    <td className="p-2.5">
                      <input
                        type="text"
                        value={s.hall}
                        onChange={(e) => handleUpdateSlot(s.id, 'hall', e.target.value)}
                        className="bg-slate-900 border border-slate-800 rounded-md px-2 py-1 text-slate-300 focus:outline-none w-36"
                      />
                    </td>

                    <td className="p-2.5">
                      <input
                        type="number"
                        value={s.maxMarks}
                        onChange={(e) => handleUpdateSlot(s.id, 'maxMarks', parseInt(e.target.value, 10) || 100)}
                        className="bg-slate-900 border border-slate-800 rounded-md px-2 py-1 text-slate-300 focus:outline-none w-16"
                      />
                    </td>

                    <td className="p-2.5 text-right">
                      <button
                        onClick={() => handleRemoveSlot(s.id)}
                        className="text-slate-500 hover:text-red-400 p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
                        title="Delete exam slot"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* RAG Query Testing Bench Simulator */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div>
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-cyan-400" />
              AI RAG Query Test Bench
            </h3>
            <p className="text-xs text-slate-400">
              Instantly test how the AI Academic Intelligence agent answers questions based on your published schedule.
            </p>
          </div>
        </div>

        {/* Sample Quick Test Buttons */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-slate-500">Quick Test Prompts:</span>
          <button
            onClick={() => handleRunTestQuery('When is the CS302 exam scheduled?')}
            className="px-2.5 py-1 bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 rounded-lg transition-all"
          >
            "When is CS302 exam?"
          </button>
          <button
            onClick={() => handleRunTestQuery('Which exams are held on August 21 in the Forenoon session?')}
            className="px-2.5 py-1 bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 rounded-lg transition-all"
          >
            "August 21 FN exams?"
          </button>
          <button
            onClick={() => handleRunTestQuery('Where is the Thermodynamics exam being conducted?')}
            className="px-2.5 py-1 bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 rounded-lg transition-all"
          >
            "Thermodynamics room/hall?"
          </button>
        </div>

        {/* Search Bar Input */}
        <div className="flex items-center space-x-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
            <input
              type="text"
              value={testQuery}
              onChange={(e) => setTestQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleRunTestQuery()}
              placeholder="Type your test query about the exam schedule..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
            />
          </div>
          <button
            onClick={() => handleRunTestQuery()}
            disabled={isTestLoading}
            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-medium rounded-xl text-xs flex items-center space-x-1.5 transition-all cursor-pointer disabled:opacity-50"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{isTestLoading ? 'Testing...' : 'Test AI'}</span>
          </button>
        </div>

        {/* AI Answer Box */}
        {testAnswer && (
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-cyan-400">
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" /> AI Response Test Output:
              </span>
              <button onClick={() => setTestAnswer(null)} className="text-slate-500 hover:text-slate-300">
                Dismiss
              </button>
            </div>
            <div className="text-xs text-slate-200 whitespace-pre-wrap leading-relaxed font-sans">
              {testAnswer}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
