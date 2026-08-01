import React, { useState } from 'react';
import { Student, DocumentRecord, SystemStats, DepartmentStat } from '../types';
import { bulkImportStudents, uploadDocument } from '../lib/api';
import Papa from 'papaparse';
import {
  Users,
  CheckCircle2,
  AlertTriangle,
  Award,
  Upload,
  FileSpreadsheet,
  FileText,
  Search,
  Download,
  Filter,
  BarChart3,
  Building2,
  BookOpen,
  ArrowUpDown,
  Sparkles,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
} from 'recharts';

interface AdminDashboardProps {
  students: Student[];
  documents: DocumentRecord[];
  stats: SystemStats | null;
  departmentStats: DepartmentStat[];
  onRefreshData: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  students,
  documents,
  stats,
  departmentStats,
  onRefreshData,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'all' | 'toppers' | 'backlogs' | 'placement' | 'documents'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDept, setSelectedDept] = useState<string>('ALL');
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
  const [isDocModalOpen, setIsDocModalOpen] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);

  // New Doc Form
  const [docTitle, setDocTitle] = useState('');
  const [docCategory, setDocCategory] = useState<'Exam Schedule' | 'Academic Regulation' | 'Placement Eligibility' | 'General'>('Academic Regulation');
  const [docContent, setDocContent] = useState('');

  // Filtering Logic
  const filteredStudents = students.filter((s) => {
    const matchesSearch =
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.studentId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDept = selectedDept === 'ALL' || s.department === selectedDept;

    if (activeSubTab === 'toppers') {
      return matchesSearch && matchesDept && s.backlogCount === 0;
    }
    if (activeSubTab === 'backlogs') {
      return matchesSearch && matchesDept && s.backlogCount > 0;
    }
    if (activeSubTab === 'placement') {
      return matchesSearch && matchesDept && s.placementEligible;
    }

    return matchesSearch && matchesDept;
  });

  // Ranking Topper List (Sorted by CGPA -> Attendance -> Credits)
  const topperList = students
    .filter((s) => s.backlogCount === 0)
    .sort((a, b) => {
      if (b.cgpa !== a.cgpa) return b.cgpa - a.cgpa;
      if (b.attendance !== a.attendance) return b.attendance - a.attendance;
      return b.credits - a.credits;
    });

  // Handle CSV File Selection
  const handleCsvFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadStatus('Parsing CSV file...');
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const parsedStudents: Partial<Student>[] = results.data.map((row: any) => {
            const backlogRaw = row.Backlogs || row.backlogs || '';
            let backlogsList = [];
            if (typeof backlogRaw === 'string' && backlogRaw.trim()) {
              const items = backlogRaw.split(';');
              backlogsList = items.map((item: string, idx: number) => ({
                id: `BL-CSV-${Date.now()}-${idx}`,
                studentId: row['Student ID'] || row.studentId || 'UNKNOWN',
                subjectCode: item.split(':')[0] || 'SUB101',
                subjectName: item.split(':')[1] || item,
                semester: Number(row.Semester || row.semester || 3),
                examDate: '2026-08-21',
                daysRemaining: 20,
                status: 'SCHEDULED' as const,
              }));
            }

            return {
              studentId: row['Student ID'] || row.studentId || `STU-${Date.now()}`,
              name: row.Name || row.name || 'Unnamed Student',
              department: (row.Department || row.department || 'CSE').toUpperCase(),
              year: Number(row.Year || row.year || 4),
              semester: Number(row.Semester || row.semester || 7),
              cgpa: Number(row.CGPA || row.cgpa || 7.0),
              attendance: Number(row.Attendance || row.attendance || 80),
              credits: Number(row.Credits || row.credits || 130),
              email: row.Email || row.email || 'student@college.edu',
              phone: row.Phone || row.phone || '+91 99999 99999',
              subjects: row.Subjects ? row.Subjects.split(';') : ['Core Subject 1', 'Core Subject 2'],
              backlogs: backlogsList,
              backlogCount: backlogsList.length,
            };
          });

          await bulkImportStudents(parsedStudents);
          setUploadStatus(`Successfully imported ${parsedStudents.length} student records!`);
          setTimeout(() => {
            setIsCsvModalOpen(false);
            setUploadStatus(null);
            onRefreshData();
          }, 1200);
        } catch (err: any) {
          setUploadStatus(`Upload Error: ${err.message}`);
        }
      },
      error: (err) => {
        setUploadStatus(`CSV Parse Error: ${err.message}`);
      },
    });
  };

  // Upload College Document Handler
  const handleDocumentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docTitle || !docContent) return;

    try {
      setUploadStatus('Indexing document into vector store...');
      await uploadDocument({
        title: docTitle,
        category: docCategory,
        content: docContent,
      });
      setUploadStatus('Document successfully indexed and chunked!');
      setTimeout(() => {
        setIsDocModalOpen(false);
        setDocTitle('');
        setDocContent('');
        setUploadStatus(null);
        onRefreshData();
      }, 1000);
    } catch (err: any) {
      setUploadStatus(`Error: ${err.message}`);
    }
  };

  // Export Data to CSV
  const handleExportCsv = () => {
    const dataToExport = filteredStudents.map((s) => ({
      'Student ID': s.studentId,
      Name: s.name,
      Department: s.department,
      Year: s.year,
      Semester: s.semester,
      CGPA: s.cgpa,
      Attendance: `${s.attendance}%`,
      Credits: s.credits,
      Rank: s.rank || 'N/A',
      'Backlogs Count': s.backlogCount,
      'Placement Eligible': s.placementEligible ? 'YES' : 'NO',
      Email: s.email,
    }));

    const csvStr = Papa.unparse(dataToExport);
    const blob = new Blob([csvStr], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Academic_Intelligence_Export_${activeSubTab}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const chartColors = ['#6366f1', '#06b6d4', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6'];

  return (
    <div className="space-y-6">
      {/* Top Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-slate-800 rounded-2xl p-6 text-slate-100 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="px-2.5 py-1 text-xs font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-full">
                Admin Control Hub
              </span>
              <span className="text-xs text-slate-400">AR23 Regulation Rules Active</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white mt-1">
              Raghu Engineering College Academic Intelligence & Backlog Command
            </h1>
            <p className="text-sm text-slate-400 mt-1 max-w-2xl">
              Automatic backlog detection, CGPA ranking engine, placement eligibility verifier, and document RAG indexer.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setIsCsvModalOpen(true)}
              className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-medium text-xs shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Import Student CSV</span>
            </button>

            <button
              onClick={() => setIsDocModalOpen(true)}
              className="flex items-center space-x-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded-xl font-medium text-xs transition-all cursor-pointer"
            >
              <Upload className="w-4 h-4 text-cyan-400" />
              <span>Upload College Policy / PDF</span>
            </button>

            <button
              onClick={handleExportCsv}
              className="flex items-center space-x-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded-xl font-medium text-xs transition-all cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Export Report</span>
            </button>
          </div>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium">Total Students</span>
            <Users className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-bold text-white">{stats?.totalStudents || 0}</span>
            <p className="text-[10px] text-slate-400 mt-0.5">Enrolled across all depts</p>
          </div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium">Clear (0 Backlogs)</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-bold text-emerald-400">{stats?.clearStudentsCount || 0}</span>
            <p className="text-[10px] text-slate-400 mt-0.5">{stats?.passPercentage}% Pass Rate</p>
          </div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium">Students w/ Backlogs</span>
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-bold text-amber-400">{stats?.backlogStudentsCount || 0}</span>
            <p className="text-[10px] text-amber-500/80 mt-0.5">Exam Reminders Active</p>
          </div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium">Average CGPA</span>
            <Award className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-bold text-cyan-300">{stats?.avgCgpa || '0.00'}</span>
            <p className="text-[10px] text-slate-400 mt-0.5">College Average</p>
          </div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium">Placement Eligible</span>
            <Sparkles className="w-4 h-4 text-purple-400" />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-bold text-purple-300">{stats?.eligiblePlacementPercentage}%</span>
            <p className="text-[10px] text-slate-400 mt-0.5">Tier-1 & 2 Eligible</p>
          </div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium">RAG Document Chunks</span>
            <BookOpen className="w-4 h-4 text-blue-400" />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-bold text-blue-300">{stats?.totalVectorChunks || 0}</span>
            <p className="text-[10px] text-slate-400 mt-0.5">{stats?.totalDocumentsIndexed || 0} Documents</p>
          </div>
        </div>
      </div>

      {/* Visual Analytics Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-indigo-400" />
                Department CGPA & Attendance Comparison
              </h3>
              <p className="text-xs text-slate-400">Average CGPA and Attendance % per department</p>
            </div>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={departmentStats} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="department" stroke="#94a3b8" fontSize={11} />
                <YAxis stroke="#94a3b8" fontSize={11} domain={[0, 10]} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '0.75rem', fontSize: '12px' }}
                  itemStyle={{ color: '#e2e8f0' }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                <Bar dataKey="avgCgpa" name="Avg CGPA (10)" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Building2 className="w-4 h-4 text-cyan-400" />
                Clear vs Backlog Student Count by Dept
              </h3>
              <p className="text-xs text-slate-400">Distribution of students with 0 backlogs vs active backlogs</p>
            </div>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={departmentStats} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="department" stroke="#94a3b8" fontSize={11} />
                <YAxis stroke="#94a3b8" fontSize={11} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '0.75rem', fontSize: '12px' }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                <Bar dataKey="noBacklogCount" name="No Backlogs" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="backlogCount" name="Has Backlogs" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Main Student Records Section with Filters */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
        {/* Navigation Sub-Tabs & Filters */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-800">
          <div className="flex items-center space-x-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-medium">
            <button
              onClick={() => setActiveSubTab('all')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeSubTab === 'all' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All Records ({students.length})
            </button>
            <button
              onClick={() => setActiveSubTab('toppers')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeSubTab === 'toppers' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Toppers Ranking ({topperList.length})
            </button>
            <button
              onClick={() => setActiveSubTab('backlogs')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeSubTab === 'backlogs' ? 'bg-amber-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Backlog List ({students.filter((s) => s.backlogCount > 0).length})
            </button>
            <button
              onClick={() => setActiveSubTab('placement')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeSubTab === 'placement' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Placement Eligible ({students.filter((s) => s.placementEligible).length})
            </button>
            <button
              onClick={() => setActiveSubTab('documents')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeSubTab === 'documents' ? 'bg-cyan-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Vector Documents ({documents.length})
            </button>
          </div>

          <div className="flex items-center space-x-3 text-xs">
            {/* Dept Selector */}
            <div className="flex items-center space-x-1.5 bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-slate-300">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={selectedDept}
                onChange={(e) => setSelectedDept(e.target.value)}
                className="bg-transparent text-slate-200 focus:outline-none"
              >
                <option value="ALL">All Departments</option>
                <option value="CSE">CSE</option>
                <option value="ECE">ECE</option>
                <option value="EEE">EEE</option>
                <option value="MECH">MECH</option>
                <option value="IT">IT</option>
              </select>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search name, ID, email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-slate-200 focus:outline-none focus:border-indigo-500 w-48 sm:w-60"
              />
            </div>
          </div>
        </div>

        {/* View Switcher: Documents vs Table */}
        {activeSubTab === 'documents' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
            {documents.map((doc) => (
              <div key={doc.id} className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="px-2 py-0.5 text-[10px] font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 rounded-md">
                      {doc.category}
                    </span>
                    <h4 className="text-sm font-semibold text-white mt-1.5 line-clamp-1">{doc.title}</h4>
                    <p className="text-[11px] text-slate-400">{doc.filename} • {doc.fileSize}</p>
                  </div>
                  <BookOpen className="w-5 h-5 text-slate-500 flex-shrink-0" />
                </div>
                <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800 text-[11px] text-slate-300 font-mono line-clamp-3">
                  {doc.content}
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800/60">
                  <span>Indexed {doc.uploadDate}</span>
                  <span className="text-indigo-400 font-medium">{doc.chunkCount} RAG Vector Chunks</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-slate-400 font-semibold uppercase tracking-wider text-[10px] border-b border-slate-800">
                <tr>
                  <th className="p-3">Rank</th>
                  <th className="p-3">Student</th>
                  <th className="p-3">Dept</th>
                  <th className="p-3">Year / Sem</th>
                  <th className="p-3">
                    <div className="flex items-center space-x-1 cursor-pointer">
                      <span>CGPA</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                  <th className="p-3">Attendance</th>
                  <th className="p-3">Backlogs</th>
                  <th className="p-3">Placement</th>
                  <th className="p-3">Contact</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80 bg-slate-900/60">
                {filteredStudents.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-slate-400 text-xs">
                      No matching student records found. Try clearing filters or uploading a CSV.
                    </td>
                  </tr>
                ) : (
                  filteredStudents.map((st) => (
                    <tr key={st.studentId} className="hover:bg-slate-800/40 transition-colors">
                      <td className="p-3 font-bold">
                        {st.rank ? (
                          <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-[11px] ${
                            st.rank === 1
                              ? 'bg-amber-400 text-slate-950 font-extrabold'
                              : st.rank === 2
                              ? 'bg-slate-300 text-slate-950 font-bold'
                              : st.rank === 3
                              ? 'bg-amber-700 text-white'
                              : 'bg-slate-800 text-slate-300'
                          }`}>
                            #{st.rank}
                          </span>
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </td>
                      <td className="p-3">
                        <div className="font-semibold text-white">{st.name}</div>
                        <div className="text-[11px] text-slate-400 font-mono">{st.studentId}</div>
                      </td>
                      <td className="p-3 font-medium text-slate-200">{st.department}</td>
                      <td className="p-3 text-slate-300">Y{st.year} / S{st.semester}</td>
                      <td className="p-3 font-bold text-cyan-300 text-sm">{st.cgpa.toFixed(2)}</td>
                      <td className="p-3">
                        <span className={`font-semibold ${st.attendance >= 85 ? 'text-emerald-400' : st.attendance >= 75 ? 'text-slate-200' : 'text-rose-400'}`}>
                          {st.attendance}%
                        </span>
                      </td>
                      <td className="p-3">
                        {st.backlogCount === 0 ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            Clear (0)
                          </span>
                        ) : (
                          <div className="space-y-0.5">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                              {st.backlogCount} Pending
                            </span>
                            <div className="text-[10px] text-amber-500/80 line-clamp-1">
                              {st.backlogs.map((b) => b.subjectCode).join(', ')}
                            </div>
                          </div>
                        )}
                      </td>
                      <td className="p-3">
                        {st.placementEligible ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-500/10 text-purple-300 border border-purple-500/20">
                            Eligible
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                            Ineligible
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-[11px] text-slate-400">
                        <div>{st.email}</div>
                        <div className="font-mono">{st.phone}</div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CSV Import Modal */}
      {isCsvModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-indigo-400" />
                Import Student Academic Records (CSV)
              </h3>
              <button
                onClick={() => setIsCsvModalOpen(false)}
                className="text-slate-400 hover:text-white font-bold text-sm"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Upload a CSV file containing headers: <code className="text-indigo-300">Student ID, Name, Department, Year, Semester, CGPA, Attendance, Credits, Email, Phone, Backlogs</code>.
            </p>

            <div className="border-2 border-dashed border-slate-700 hover:border-indigo-500/60 bg-slate-950/60 rounded-xl p-6 text-center cursor-pointer transition-colors relative">
              <input
                type="file"
                accept=".csv"
                onChange={handleCsvFileUpload}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
              <Upload className="w-8 h-8 text-indigo-400 mx-auto mb-2" />
              <span className="text-xs font-semibold text-slate-200 block">Click to select or drop CSV file</span>
              <span className="text-[10px] text-slate-500 block mt-1">Accepts standard college grade sheets</span>
            </div>

            {uploadStatus && (
              <div className="bg-indigo-950/60 border border-indigo-800 text-indigo-300 p-3 rounded-xl text-xs font-mono">
                {uploadStatus}
              </div>
            )}

            <div className="flex justify-end space-x-2 pt-2">
              <button
                onClick={() => setIsCsvModalOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* College Policy Document Upload Modal */}
      {isDocModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-cyan-400" />
                Upload College Regulations & Schedules for RAG
              </h3>
              <button onClick={() => setIsDocModalOpen(false)} className="text-slate-400 hover:text-white font-bold text-sm">
                ✕
              </button>
            </div>

            <form onSubmit={handleDocumentSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Document Title</label>
                <input
                  type="text"
                  placeholder="e.g. Midterm Supplementary Exam Schedule August 2026"
                  value={docTitle}
                  onChange={(e) => setDocTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-cyan-500"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Category</label>
                <select
                  value={docCategory}
                  onChange={(e: any) => setDocCategory(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-cyan-500"
                >
                  <option value="Academic Regulation">Academic Regulation</option>
                  <option value="Exam Schedule">Exam Schedule</option>
                  <option value="Placement Eligibility">Placement Eligibility</option>
                  <option value="General">General</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Document Content / Text</label>
                <textarea
                  rows={6}
                  placeholder="Paste rules, exam schedules, or regulation clauses here..."
                  value={docContent}
                  onChange={(e) => setDocContent(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-cyan-500 font-mono text-xs"
                  required
                />
              </div>

              {uploadStatus && (
                <div className="bg-cyan-950/60 border border-cyan-800 text-cyan-300 p-3 rounded-xl text-xs font-mono">
                  {uploadStatus}
                </div>
              )}

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsDocModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-semibold shadow-md shadow-cyan-600/20"
                >
                  Index Document into RAG Vector Store
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
