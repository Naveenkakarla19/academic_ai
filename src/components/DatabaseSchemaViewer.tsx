import React, { useState, useEffect } from 'react';
import { fetchSystemDocs } from '../lib/api';
import { Database, Table, Key, Code, ArrowRight, Layers } from 'lucide-react';

export const DatabaseSchemaViewer: React.FC = () => {
  const [ddlCode, setDdlCode] = useState('');
  const [activeTable, setActiveTable] = useState<string>('students');

  useEffect(() => {
    fetchSystemDocs().then((res) => setDdlCode(res.schemaDDL));
  }, []);

  const tables = [
    {
      name: 'students',
      pk: 'student_id',
      fields: ['student_id', 'name', 'department', 'year', 'semester', 'cgpa', 'attendance', 'credits', 'email', 'phone', 'backlog_count', 'placement_eligible'],
      desc: 'Stores core student academic profile records and status.',
    },
    {
      name: 'backlogs',
      pk: 'id',
      fk: 'student_id → students(student_id)',
      fields: ['id', 'student_id', 'subject_code', 'subject_name', 'semester', 'exam_date', 'status'],
      desc: 'Tracks active pending backlogs & supplementary exam dates.',
    },
    {
      name: 'rankings',
      pk: 'id',
      fk: 'student_id → students(student_id)',
      fields: ['id', 'student_id', 'department', 'cgpa', 'attendance', 'credits', 'overall_rank', 'department_rank'],
      desc: 'Stores computed ranks for students with 0 backlogs.',
    },
    {
      name: 'documents',
      pk: 'doc_id',
      fields: ['doc_id', 'title', 'category', 'filename', 'file_size', 'content', 'chunk_count'],
      desc: 'Stores ingested college regulations, exam schedules, & placement policies.',
    },
    {
      name: 'subjects',
      pk: 'subject_code',
      fields: ['subject_code', 'subject_name', 'department', 'semester', 'credits'],
      desc: 'Curriculum subject database.',
    },
    {
      name: 'emails',
      pk: 'id',
      fk: 'student_id → students(student_id)',
      fields: ['id', 'student_id', 'subject_name', 'exam_date', 'days_remaining', 'email_subject', 'email_body', 'status'],
      desc: 'Audit history log of automated backlog exam emails.',
    },
    {
      name: 'chat_history',
      pk: 'id',
      fk: 'student_id → students(student_id)',
      fields: ['id', 'student_id', 'sender', 'message', 'agent_steps'],
      desc: 'RAG AI chatbot query history and LangGraph traces.',
    },
    {
      name: 'admins',
      pk: 'admin_id',
      fields: ['admin_id', 'name', 'email', 'password_hash'],
      desc: 'Admin credentials and authentication.',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-md">
            <Database className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-white">PostgreSQL Database Schema & ER Diagram</h1>
            <p className="text-xs text-slate-400 mt-0.5">Relational schema design supporting rankings, backlogs, and RAG search</p>
          </div>
        </div>
      </div>

      {/* ER Diagram Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Table Selector (4 Cols) */}
        <div className="lg:col-span-4 space-y-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 px-1">Schema Tables</h3>
          <div className="space-y-1.5">
            {tables.map((tbl) => (
              <button
                key={tbl.name}
                onClick={() => setActiveTable(tbl.name)}
                className={`w-full text-left p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                  activeTable === tbl.name
                    ? 'bg-indigo-600/20 border-indigo-500/50 text-indigo-200'
                    : 'bg-slate-900/80 border-slate-800 text-slate-300 hover:bg-slate-800/60'
                }`}
              >
                <div className="flex items-center space-x-2">
                  <Table className="w-4 h-4 text-indigo-400" />
                  <span className="font-mono text-xs font-bold">{tbl.name}</span>
                </div>
                <span className="text-[10px] text-slate-500">{tbl.fields.length} cols</span>
              </button>
            ))}
          </div>
        </div>

        {/* Selected Table Details & ER Relational Mapping (8 Cols) */}
        <div className="lg:col-span-8 space-y-6">
          {(() => {
            const current = tables.find((t) => t.name === activeTable) || tables[0];
            return (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div>
                    <h3 className="text-base font-mono font-bold text-white flex items-center gap-2">
                      <Layers className="w-4 h-4 text-cyan-400" />
                      TABLE: {current.name}
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">{current.desc}</p>
                  </div>
                  <span className="px-2.5 py-1 text-[10px] font-mono bg-slate-800 text-slate-300 border border-slate-700 rounded-lg">
                    PK: {current.pk}
                  </span>
                </div>

                {current.fk && (
                  <div className="bg-indigo-950/40 border border-indigo-800/60 p-2.5 rounded-xl text-xs text-indigo-300 flex items-center gap-2">
                    <Key className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                    <span>Foreign Key: <code className="font-mono font-bold text-white">{current.fk}</code></span>
                  </div>
                )}

                <div className="space-y-1.5">
                  <h4 className="text-xs font-semibold text-slate-400">Column Definitions:</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {current.fields.map((f) => (
                      <div
                        key={f}
                        className={`p-2.5 rounded-xl border text-xs font-mono flex items-center space-x-1.5 ${
                          f === current.pk
                            ? 'bg-amber-950/30 border-amber-800/60 text-amber-300 font-bold'
                            : 'bg-slate-950 border-slate-800 text-slate-300'
                        }`}
                      >
                        {f === current.pk ? <Key className="w-3.5 h-3.5 text-amber-400" /> : <div className="w-2 h-2 rounded-full bg-slate-700" />}
                        <span className="truncate">{f}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* DDL SQL Script Viewer */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3 shadow-xl">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <Code className="w-4 h-4 text-indigo-400" />
              PostgreSQL DDL SQL Creation Script
            </h3>
            <pre className="bg-slate-950 border border-slate-800/80 p-4 rounded-xl text-[11px] font-mono text-cyan-300/90 overflow-x-auto max-h-80 leading-relaxed">
              {ddlCode}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};
