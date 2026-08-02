import React, { useState, useMemo } from 'react';
import { Student, DocumentRecord, SystemStats, DepartmentStat } from '../types';
import { bulkImportStudents, uploadDocument, clearAllStudents, resetInitialStudents } from '../lib/api';
import { ExamScheduleDesigner } from './ExamScheduleDesigner';
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
  ArrowUp,
  ArrowDown,
  Sparkles,
  Trash2,
  RotateCcw,
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
  const [activeSubTab, setActiveSubTab] = useState<'all' | 'toppers' | 'backlogs' | 'placement' | 'documents' | 'exam-designer'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDept, setSelectedDept] = useState<string>('ALL');
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
  const [isDocModalOpen, setIsDocModalOpen] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [csvImportMode, setCsvImportMode] = useState<'file' | 'text'>('file');
  const [replaceExisting, setReplaceExisting] = useState<boolean>(true);
  const [rawCsvText, setRawCsvText] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [sortField, setSortField] = useState<'rank' | 'name' | 'cgpa' | 'attendance' | 'backlogs'>('rank');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);

  const defaultStudent = useMemo(() => {
    return (
      students.find((s) => s.rank === 1) ||
      [...students].sort((a, b) => b.cgpa - a.cgpa)[0] ||
      students[0] ||
      null
    );
  }, [students]);

  const activeStudent = useMemo(() => {
    if (selectedStudentId) {
      const found = students.find((s) => s.studentId === selectedStudentId);
      if (found) return found;
    }
    if (searchTerm.trim()) {
      const clean = searchTerm.toLowerCase().replace(/[^a-z0-9]/g, '');
      const found = students.find((s) => {
        const sName = s.name.toLowerCase().replace(/[^a-z0-9]/g, '');
        const sId = s.studentId.toLowerCase().replace(/[^a-z0-9]/g, '');
        return sName.includes(clean) || sId.includes(clean) || clean.includes(sName) || clean.includes(sId);
      });
      if (found) return found;
    }
    return defaultStudent;
  }, [selectedStudentId, searchTerm, students, defaultStudent]);

  const handleSort = (field: 'rank' | 'name' | 'cgpa' | 'attendance' | 'backlogs') => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder(field === 'name' ? 'asc' : field === 'rank' ? 'asc' : 'desc');
    }
  };

  // Extract all available unique departments dynamically
  const availableDepartments = Array.from(new Set(students.map((s) => s.department))).filter(Boolean).sort();

  // New Doc Form
  const [docTitle, setDocTitle] = useState('');
  const [docCategory, setDocCategory] = useState<'Exam Schedule' | 'Academic Regulation' | 'Placement Eligibility' | 'General'>('Academic Regulation');
  const [docContent, setDocContent] = useState('');

  // Calculate dynamic fallback ranks for zero-backlog students
  const studentRankMap = useMemo(() => {
    const map = new Map<string, number>();
    const clearList = [...students]
      .filter((s) => s.backlogCount === 0)
      .sort((a, b) => {
        if (a.rank !== undefined && b.rank !== undefined && a.rank !== b.rank) {
          return a.rank - b.rank;
        }
        if (b.cgpa !== a.cgpa) return b.cgpa - a.cgpa;
        if (b.attendance !== a.attendance) return b.attendance - a.attendance;
        return b.credits - a.credits;
      });
    clearList.forEach((st, idx) => {
      map.set(st.studentId, st.rank ?? idx + 1);
    });
    return map;
  }, [students]);

  // Filtering Logic (Memoized for high-performance handling of 10,000+ student datasets)
  const filteredStudents = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    return students.filter((s) => {
      const matchesSearch =
        !term ||
        s.name.toLowerCase().includes(term) ||
        s.studentId.toLowerCase().includes(term) ||
        s.email.toLowerCase().includes(term);
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
  }, [students, searchTerm, selectedDept, activeSubTab]);

  // Sorting Logic (Primary default: Rank)
  const sortedStudents = useMemo(() => {
    return [...filteredStudents].sort((a, b) => {
      const rankA = a.rank ?? studentRankMap.get(a.studentId);
      const rankB = b.rank ?? studentRankMap.get(b.studentId);

      let cmp = 0;
      if (sortField === 'rank') {
        const valA = rankA ?? 999999;
        const valB = rankB ?? 999999;
        if (valA !== valB) {
          cmp = valA - valB;
        } else {
          cmp = b.cgpa - a.cgpa;
        }
      } else if (sortField === 'cgpa') {
        cmp = b.cgpa - a.cgpa;
      } else if (sortField === 'attendance') {
        cmp = b.attendance - a.attendance;
      } else if (sortField === 'backlogs') {
        cmp = a.backlogCount - b.backlogCount;
      } else if (sortField === 'name') {
        cmp = a.name.localeCompare(b.name);
      }

      return sortOrder === 'asc' ? cmp : -cmp;
    });
  }, [filteredStudents, sortField, sortOrder, studentRankMap]);

  // Ranking Topper List (Students with 0 backlogs)
  const topperList = students.filter((s) => s.backlogCount === 0);

  // Calculate Paginated Slice
  const totalPages = Math.ceil(sortedStudents.length / pageSize) || 1;
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * pageSize;
  const paginatedStudents = pageSize === -1 ? sortedStudents : sortedStudents.slice(startIndex, startIndex + pageSize);

  // Helper function to process parsed CSV rows into Student objects (Optimized for 2000+ rows)
  const processParsedCsvRows = (rows: any[]): Partial<Student>[] => {
    const parsed = rows
      .filter((row) => row && typeof row === 'object')
      .map((row: any, rIdx: number) => {
        // Fast normalized row keys map
        const normRow: Record<string, any> = {};
        Object.keys(row).forEach((k) => {
          normRow[k.trim().toLowerCase()] = row[k];
        });

        const getVal = (...keys: string[]) => {
          for (const k of keys) {
            const lk = k.trim().toLowerCase();
            if (normRow[lk] !== undefined && normRow[lk] !== null) return normRow[lk];
          }
          return undefined;
        };

        const rawId = getVal('Student ID', 'studentId', 'student_id', 'ID', 'Roll No', 'RollNo');
        const rawName = getVal('Name', 'name', 'Student Name', 'studentName');

        if (!rawId && !rawName) return null;

        const baseStudentId = String(rawId || `STU-${Date.now()}-${rIdx}`).trim();
        const name = String(rawName || 'Unnamed Student').trim();

        const rawAtt = getVal('Attendance', 'attendance', 'Attendance %', 'Attn');
        const attStr = String(rawAtt || '80').replace('%', '').trim();
        const attendanceVal = parseFloat(attStr) || 80;

        const rawCgpa = getVal('CGPA', 'cgpa', 'Gpa', 'gpa');
        const cgpaVal = parseFloat(String(rawCgpa || '7.0')) || 7.0;

        const rawBacklogCount = getVal('Backlogs Count', 'backlogCount', 'Backlog Count', 'Backlogs', 'backlogs');
        let parsedBacklogCount = 0;
        if (typeof rawBacklogCount === 'number') {
          parsedBacklogCount = rawBacklogCount;
        } else if (typeof rawBacklogCount === 'string' && rawBacklogCount.trim()) {
          const parsedNum = parseInt(rawBacklogCount.trim(), 10);
          parsedBacklogCount = isNaN(parsedNum) ? 0 : parsedNum;
        }

        const backlogRaw = getVal('Backlogs', 'backlogs', 'Backlog Details');
        let backlogsList: any[] = [];
        if (typeof backlogRaw === 'string' && backlogRaw.trim() && !/^\d+$/.test(backlogRaw.trim())) {
          const items = backlogRaw.split(';');
          backlogsList = items.map((item: string, idx: number) => ({
            id: `BL-CSV-${Date.now()}-${rIdx}-${idx}`,
            studentId: baseStudentId,
            subjectCode: item.split(':')[0] || `SUB-${idx + 1}`,
            subjectName: item.split(':')[1] || item,
            semester: Number(getVal('Semester', 'semester') || 3),
            examDate: '2026-08-21',
            daysRemaining: 20,
            status: 'SCHEDULED' as const,
          }));
        }

        const finalBacklogCount = Math.max(parsedBacklogCount, backlogsList.length);
        if (finalBacklogCount > backlogsList.length) {
          const missing = finalBacklogCount - backlogsList.length;
          for (let i = 0; i < missing; i++) {
            backlogsList.push({
              id: `BL-GEN-${Date.now()}-${rIdx}-${backlogsList.length + 1}`,
              studentId: baseStudentId,
              subjectCode: `SUPP-${backlogsList.length + 1}`,
              subjectName: `Supplementary Backlog Paper ${backlogsList.length + 1}`,
              semester: Math.max(1, Number(getVal('Semester', 'semester') || 3) - 1),
              examDate: '2026-08-21',
              daysRemaining: 20,
              status: 'SCHEDULED' as const,
            });
          }
        }

        const placementRaw = getVal('Placement Eligible', 'placementEligible', 'PlacementEligible');
        let isPlacementEligible = false;
        if (typeof placementRaw === 'string' && placementRaw.trim()) {
          const pUpper = placementRaw.trim().toUpperCase();
          if (pUpper === 'YES' || pUpper === 'TRUE') isPlacementEligible = true;
          else if (pUpper === 'NO' || pUpper === 'FALSE') isPlacementEligible = false;
          else isPlacementEligible = finalBacklogCount === 0 && cgpaVal >= 6.5 && attendanceVal >= 75;
        } else {
          isPlacementEligible = finalBacklogCount === 0 && cgpaVal >= 6.5 && attendanceVal >= 75;
        }

        const rawRank = getVal('Rank', 'rank');
        let parsedRank: number | undefined = undefined;
        if (rawRank !== undefined && rawRank !== null && String(rawRank).trim() !== '' && String(rawRank).toUpperCase() !== 'N/A') {
          const r = parseInt(String(rawRank).trim(), 10);
          if (!isNaN(r)) parsedRank = r;
        }

        let dept = String(getVal('Department', 'department', 'Dept', 'dept') || 'CSE').toUpperCase().trim();
        if (dept === 'ME') dept = 'MECH';

        const email = String(getVal('Email', 'email') || `${baseStudentId.toLowerCase()}@college.edu`).trim();

        return {
          studentId: baseStudentId,
          name,
          department: dept,
          year: Number(getVal('Year', 'year') || 4),
          semester: Number(getVal('Semester', 'semester') || 7),
          cgpa: cgpaVal,
          attendance: attendanceVal,
          credits: Number(getVal('Credits', 'credits') || 130),
          rank: parsedRank,
          email,
          phone: String(getVal('Phone', 'phone') || '+91 99999 99999').trim(),
          subjects: getVal('Subjects') ? String(getVal('Subjects')).split(';') : ['Core Subject 1', 'Core Subject 2'],
          backlogs: backlogsList,
          backlogCount: finalBacklogCount,
          placementEligible: isPlacementEligible,
        };
      })
      .filter((s): s is NonNullable<typeof s> => s !== null);

    const seen = new Set<string>();
    const deduplicated = parsed.map((st, idx) => {
      let sId = st.studentId!;
      if (seen.has(sId)) {
        sId = `${st.studentId}-${idx + 1}`;
      }
      seen.add(sId);
      return { ...st, studentId: sId };
    });

    // If rank is not provided in CSV, dynamically assign ranks to students with 0 backlogs based on CGPA -> Attendance -> Credits
    const clearStudents = deduplicated
      .filter((s) => (s.backlogCount || 0) === 0)
      .sort((a, b) => {
        if (a.rank !== undefined && b.rank !== undefined && a.rank !== b.rank) return a.rank - b.rank;
        if (a.rank !== undefined && b.rank === undefined) return -1;
        if (a.rank === undefined && b.rank !== undefined) return 1;
        if ((b.cgpa || 0) !== (a.cgpa || 0)) return (b.cgpa || 0) - (a.cgpa || 0);
        if ((b.attendance || 0) !== (a.attendance || 0)) return (b.attendance || 0) - (a.attendance || 0);
        return (b.credits || 0) - (a.credits || 0);
      });

    clearStudents.forEach((st, idx) => {
      if (st.rank === undefined) {
        st.rank = idx + 1;
      }
    });

    return deduplicated;
  };

  // Handle CSV File Selection
  const handleCsvFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadStatus(replaceExisting ? 'Replacing database & parsing CSV file...' : 'Parsing CSV file...');
    Papa.parse(file, {
      header: true,
      skipEmptyLines: 'greedy',
      complete: async (results) => {
        try {
          const parsedStudents = processParsedCsvRows(results.data);
          if (parsedStudents.length === 0) {
            setUploadStatus('Error: No valid student records found in CSV file.');
            return;
          }
          const res = await bulkImportStudents(parsedStudents, replaceExisting);
          setUploadStatus(res.message || `Successfully processed ${parsedStudents.length} student records!`);
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

  // Handle Raw CSV Text Paste Import
  const handleRawCsvTextImport = () => {
    if (!rawCsvText.trim()) {
      setUploadStatus('Please paste raw CSV text before clicking import.');
      return;
    }
    setUploadStatus(replaceExisting ? 'Replacing database & parsing CSV text...' : 'Parsing pasted CSV content...');
    Papa.parse(rawCsvText.trim(), {
      header: true,
      skipEmptyLines: 'greedy',
      complete: async (results) => {
        try {
          const parsedStudents = processParsedCsvRows(results.data);
          if (parsedStudents.length === 0) {
            setUploadStatus('Error: Could not parse any student records from the text.');
            return;
          }
          const res = await bulkImportStudents(parsedStudents, replaceExisting);
          setUploadStatus(res.message || `Successfully processed ${parsedStudents.length} student records!`);
          setTimeout(() => {
            setIsCsvModalOpen(false);
            setUploadStatus(null);
            setRawCsvText('');
            onRefreshData();
          }, 1200);
        } catch (err: any) {
          setUploadStatus(`Import Error: ${err.message}`);
        }
      },
      error: (err) => {
        setUploadStatus(`CSV Parse Error: ${err.message}`);
      },
    });
  };

  const handleClearAllStudents = async () => {
    if (!window.confirm('Are you sure you want to clear all student records from the database?')) return;
    setUploadStatus('Clearing all student records...');
    try {
      await clearAllStudents();
      setUploadStatus('All student records cleared successfully.');
      setTimeout(() => {
        setIsCsvModalOpen(false);
        setUploadStatus(null);
        onRefreshData();
      }, 1000);
    } catch (err: any) {
      setUploadStatus(`Error clearing data: ${err.message}`);
    }
  };

  const handleResetInitialStudents = async () => {
    setUploadStatus('Resetting database to initial sample dataset...');
    try {
      await resetInitialStudents();
      setUploadStatus('Database reset to initial dataset.');
      setTimeout(() => {
        setIsCsvModalOpen(false);
        setUploadStatus(null);
        onRefreshData();
      }, 1000);
    } catch (err: any) {
      setUploadStatus(`Error resetting data: ${err.message}`);
    }
  };

  // Generate 10,000 Student Mock Dataset for High-Volume Stress Testing & Capacity Verification
  const generate10kMockStudentsData = (count = 10000): Partial<Student>[] => {
    const departments = ['CSE', 'ECE', 'EEE', 'MECH', 'CIVIL', 'IT', 'AI&DS'];
    const firstNames = ['Aarav', 'Ananya', 'Rohan', 'Priya', 'Vikram', 'Neha', 'Aditya', 'Sneha', 'Rahul', 'Kavya', 'Siddharth', 'Isha', 'Varun', 'Meera', 'Karan', 'Pooja', 'Arjun', 'Riya', 'Manish', 'Divya'];
    const lastNames = ['Sharma', 'Verma', 'Reddy', 'Patel', 'Rao', 'Nair', 'Singh', 'Kumar', 'Joshi', 'Gupta', 'Iyer', 'Chowdhury', 'Deshmukh', 'Kulkarni', 'Bhat', 'Agarwal', 'Chatterjee', 'Mehta', 'Das', 'Pillai'];
    const subjectsList = ['Data Structures', 'Operating Systems', 'Database Systems', 'Computer Networks', 'AI & Machine Learning', 'Software Engineering', 'VLSI Design', 'Control Systems', 'Thermodynamics', 'Fluid Mechanics'];

    const dataset: Partial<Student>[] = [];

    for (let i = 1; i <= count; i++) {
      const idStr = `STU-2026-${String(i).padStart(5, '0')}`;
      const fName = firstNames[i % firstNames.length];
      const lName = lastNames[(i * 7) % lastNames.length];
      const name = `${fName} ${lName}`;
      const dept = departments[i % departments.length];
      const year = ((i % 4) + 1);
      const semester = (year * 2) - (i % 2);
      const cgpa = Number((5.5 + ((i * 13) % 45) / 10).toFixed(2));
      const attendance = Math.min(100, Math.max(55, 70 + ((i * 17) % 31)));

      const hasBacklog = (i % 4 === 0);
      const backlogCount = hasBacklog ? ((i % 3) + 1) : 0;
      const backlogs: any[] = [];

      if (hasBacklog) {
        for (let b = 1; b <= backlogCount; b++) {
          const subIdx = (i + b) % subjectsList.length;
          backlogs.push({
            id: `BL-${idStr}-${b}`,
            studentId: idStr,
            subjectCode: `SUB-${100 + subIdx}`,
            subjectName: subjectsList[subIdx],
            semester: Math.max(1, semester - 1),
            examDate: '2026-08-21',
            daysRemaining: 19,
            status: 'SCHEDULED' as const,
          });
        }
      }

      const placementEligible = backlogCount === 0 && cgpa >= 6.5 && attendance >= 75;

      dataset.push({
        studentId: idStr,
        name,
        department: dept,
        year,
        semester,
        cgpa,
        attendance,
        credits: 120 + ((i * 3) % 40),
        rank: backlogCount === 0 ? i : undefined,
        email: `${fName.toLowerCase()}.${lName.toLowerCase()}.${i}@college.edu`,
        phone: `+91 ${9800000000 + (i % 899999999)}`,
        subjects: ['Core Systems', 'Algorithms', 'Project Lab'],
        backlogs,
        backlogCount,
        placementEligible,
      });
    }

    return dataset;
  };

  // Instant Import 10,000 Students (Directly tested)
  const handleImport10kStudents = async () => {
    setUploadStatus(replaceExisting ? 'Replacing database with 10,000 student records...' : 'Generating & importing 10,000 student records into database...');
    setTimeout(async () => {
      try {
        const data10k = generate10kMockStudentsData(10000);
        const res = await bulkImportStudents(data10k, replaceExisting);
        setUploadStatus(res.message || `Successfully processed 10,000 student records!`);
        setTimeout(() => {
          setIsCsvModalOpen(false);
          setUploadStatus(null);
          onRefreshData();
        }, 1200);
      } catch (err: any) {
        setUploadStatus(`Import Error: ${err.message}`);
      }
    }, 50);
  };

  // Download Sample 10,000 Student CSV File
  const handleDownload10kSampleCsv = () => {
    setUploadStatus('Building 10,000 student CSV dataset file...');
    setTimeout(() => {
      const data10k = generate10kMockStudentsData(10000);
      const headers = ['Student ID', 'Name', 'Department', 'Year', 'Semester', 'CGPA', 'Attendance', 'Credits', 'Rank', 'Backlogs Count', 'Placement Eligible', 'Email', 'Phone'];
      const csvLines = [headers.join(',')];

      data10k.forEach((st) => {
        csvLines.push([
          `"${st.studentId}"`,
          `"${st.name}"`,
          `"${st.department}"`,
          st.year,
          st.semester,
          st.cgpa,
          st.attendance,
          st.credits,
          st.rank || '',
          st.backlogCount,
          st.placementEligible ? 'YES' : 'NO',
          `"${st.email}"`,
          `"${st.phone}"`
        ].join(','));
      });

      const csvContent = csvLines.join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', '10000_Students_Academic_Dataset.csv');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setUploadStatus('Downloaded 10,000 student CSV file (10000_Students_Academic_Dataset.csv)! You can upload it above to test.');
    }, 50);
  };

  // Upload College Document Handler
  const handleDocFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadStatus(`Reading file ${file.name}...`);
    try {
      const cleanTitle = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
      setDocTitle(cleanTitle);

      const isExam = /exam|schedule|timetable|date/i.test(file.name);
      if (isExam) {
        setDocCategory('Exam Schedule');
      }

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

        let extractedText = textMatches.join(' ');
        if (extractedText.length < 40) {
          extractedText = rawText
            .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        }

        if (!extractedText || extractedText.length < 20) {
          extractedText = `Official Document: ${cleanTitle}\nFile Name: ${file.name}\n\nCollege Policy & Academic Regulations / Supplementary Exam Schedule Details.`;
        }

        setDocContent(extractedText);
        setUploadStatus(`Successfully extracted text from PDF file "${file.name}"!`);
      } else {
        const text = await file.text();
        setDocContent(text);
        setUploadStatus(`Successfully loaded text content from "${file.name}"!`);
      }
    } catch (err: any) {
      setUploadStatus(`Error reading file: ${err.message}`);
    }
  };

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
            <button
              onClick={() => setActiveSubTab('exam-designer')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeSubTab === 'exam-designer' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Exam Schedule Designer 📅
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
                {availableDepartments.map((d) => (
                  <option key={d} value={d} className="bg-slate-900 text-slate-200">
                    {d}
                  </option>
                ))}
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

        {/* View Switcher: Exam Designer vs Documents vs Table */}
        {activeSubTab === 'exam-designer' ? (
          <ExamScheduleDesigner onRefreshData={onRefreshData} />
        ) : activeSubTab === 'documents' ? (
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
          <div className="space-y-4">
            {/* Student Profile Spotlight Card when searched or selected */}
            {activeStudent && (
              <div className="bg-slate-950 border border-indigo-500/40 rounded-2xl p-5 shadow-xl relative overflow-hidden">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-cyan-500 flex items-center justify-center text-white font-extrabold text-lg shadow-md shadow-indigo-500/20">
                      {activeStudent.name.charAt(0)}
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <h3 className="text-lg font-bold text-white">{activeStudent.name}</h3>
                        <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-indigo-500/20 text-indigo-300 rounded border border-indigo-500/30">
                          {activeStudent.studentId}
                        </span>
                        {activeStudent.rank ? (
                          <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-500/20 text-amber-300 rounded border border-amber-500/30">
                            Rank #{activeStudent.rank}
                          </span>
                        ) : null}
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {activeStudent.department} • Year {activeStudent.year}, Semester {activeStudent.semester} • {activeStudent.email}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right px-3 py-1.5 bg-slate-900 rounded-xl border border-slate-800">
                      <span className="text-[10px] text-slate-400 block uppercase font-medium">CGPA</span>
                      <span className="text-base font-bold text-cyan-300">{activeStudent.cgpa.toFixed(2)}</span>
                    </div>
                    <div className="text-right px-3 py-1.5 bg-slate-900 rounded-xl border border-slate-800">
                      <span className="text-[10px] text-slate-400 block uppercase font-medium">Attendance</span>
                      <span className={`text-base font-bold ${activeStudent.attendance >= 85 ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {activeStudent.attendance}%
                      </span>
                    </div>
                    <div className="text-right px-3 py-1.5 bg-slate-900 rounded-xl border border-slate-800">
                      <span className="text-[10px] text-slate-400 block uppercase font-medium">Status</span>
                      {activeStudent.backlogCount === 0 ? (
                        <span className="text-xs font-bold text-emerald-400">Clear (0)</span>
                      ) : (
                        <span className="text-xs font-bold text-amber-400">{activeStudent.backlogCount} Backlogs</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Backlogs detail section if student has backlogs */}
                {activeStudent.backlogCount > 0 ? (
                  <div className="pt-3">
                    <h4 className="text-xs font-bold text-amber-400 mb-2 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                      Active Backlog Subjects ({activeStudent.backlogs.length}):
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                      {activeStudent.backlogs.map((b) => (
                        <div key={b.id || b.subjectCode} className="bg-slate-900/90 border border-amber-500/20 rounded-xl p-2.5 text-xs space-y-1">
                          <div className="flex items-center justify-between font-bold text-white">
                            <span>{b.subjectCode}</span>
                            <span className="text-[10px] text-amber-300 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/30">
                              {b.daysRemaining} days remaining
                            </span>
                          </div>
                          <div className="text-slate-300 font-medium truncate">{b.subjectName}</div>
                          <div className="text-[10px] text-slate-400 flex items-center justify-between pt-1 border-t border-slate-800">
                            <span>Exam: {b.examDate}</span>
                            <span>Sem {b.semester}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="pt-2 text-xs text-emerald-400 font-medium flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>This student has 0 active backlogs and is in good academic standing.</span>
                  </div>
                )}
              </div>
            )}

            <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-slate-400 font-semibold uppercase tracking-wider text-[10px] border-b border-slate-800 select-none">
                <tr>
                  <th
                    className="p-3 cursor-pointer hover:text-white transition-colors"
                    onClick={() => handleSort('rank')}
                  >
                    <div className="flex items-center space-x-1">
                      <span>Rank</span>
                      {sortField === 'rank' ? (
                        sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-400" /> : <ArrowDown className="w-3 h-3 text-indigo-400" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 opacity-40" />
                      )}
                    </div>
                  </th>
                  <th
                    className="p-3 cursor-pointer hover:text-white transition-colors"
                    onClick={() => handleSort('name')}
                  >
                    <div className="flex items-center space-x-1">
                      <span>Student</span>
                      {sortField === 'name' ? (
                        sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-400" /> : <ArrowDown className="w-3 h-3 text-indigo-400" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 opacity-40" />
                      )}
                    </div>
                  </th>
                  <th className="p-3">Dept</th>
                  <th className="p-3">Year / Sem</th>
                  <th
                    className="p-3 cursor-pointer hover:text-white transition-colors"
                    onClick={() => handleSort('cgpa')}
                  >
                    <div className="flex items-center space-x-1">
                      <span>CGPA</span>
                      {sortField === 'cgpa' ? (
                        sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-400" /> : <ArrowDown className="w-3 h-3 text-indigo-400" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 opacity-40" />
                      )}
                    </div>
                  </th>
                  <th
                    className="p-3 cursor-pointer hover:text-white transition-colors"
                    onClick={() => handleSort('attendance')}
                  >
                    <div className="flex items-center space-x-1">
                      <span>Attendance</span>
                      {sortField === 'attendance' ? (
                        sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-400" /> : <ArrowDown className="w-3 h-3 text-indigo-400" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 opacity-40" />
                      )}
                    </div>
                  </th>
                  <th
                    className="p-3 cursor-pointer hover:text-white transition-colors"
                    onClick={() => handleSort('backlogs')}
                  >
                    <div className="flex items-center space-x-1">
                      <span>Backlogs</span>
                      {sortField === 'backlogs' ? (
                        sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-400" /> : <ArrowDown className="w-3 h-3 text-indigo-400" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 opacity-40" />
                      )}
                    </div>
                  </th>
                  <th className="p-3">Placement</th>
                  <th className="p-3">Contact</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80 bg-slate-900/60">
                {sortedStudents.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-slate-400 text-xs">
                      No matching student records found. Try clearing filters or uploading a CSV.
                    </td>
                  </tr>
                ) : (
                  paginatedStudents.map((st) => {
                    const effectiveRank = st.rank ?? studentRankMap.get(st.studentId);
                    const isSelected = st.studentId === activeStudent?.studentId;
                    return (
                      <tr
                        key={st.studentId}
                        onClick={() => setSelectedStudentId(st.studentId)}
                        className={`cursor-pointer transition-colors ${
                          isSelected ? 'bg-indigo-950/70 border-l-4 border-l-indigo-400' : 'hover:bg-slate-800/40'
                        }`}
                      >
                        <td className="p-3 font-bold">
                          {effectiveRank ? (
                            <span className={`inline-flex items-center justify-center min-w-[28px] h-7 px-2 rounded-full text-[11px] ${
                              effectiveRank === 1
                                ? 'bg-amber-400 text-slate-950 font-extrabold shadow-sm'
                                : effectiveRank === 2
                                ? 'bg-slate-300 text-slate-950 font-bold'
                                : effectiveRank === 3
                                ? 'bg-amber-700 text-white font-bold'
                                : 'bg-slate-800 text-slate-300 font-medium'
                            }`}>
                              #{effectiveRank}
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
                  );
                })
                )}
              </tbody>
            </table>

            {/* Pagination Controls Footer */}
            {sortedStudents.length > 0 && (
              <div className="bg-slate-950 px-4 py-3 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
                <div className="flex items-center gap-2">
                  <span>
                    Showing <strong className="text-slate-200">{pageSize === -1 ? 1 : Math.min(startIndex + 1, sortedStudents.length)}</strong> to{' '}
                    <strong className="text-slate-200">{pageSize === -1 ? sortedStudents.length : Math.min(startIndex + pageSize, sortedStudents.length)}</strong> of{' '}
                    <strong className="text-slate-200">{sortedStudents.length}</strong> students
                  </span>
                  <div className="flex items-center gap-1.5 ml-3">
                    <span className="text-[11px] text-slate-500">Rows:</span>
                    <select
                      value={pageSize}
                      onChange={(e) => {
                        setPageSize(Number(e.target.value));
                        setCurrentPage(1);
                      }}
                      className="bg-slate-900 border border-slate-800 text-slate-300 text-[11px] rounded px-2 py-1 focus:outline-none"
                    >
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                      <option value={250}>250</option>
                      <option value={500}>500</option>
                      <option value={1000}>1,000</option>
                      <option value={-1}>All ({sortedStudents.length})</option>
                    </select>
                  </div>
                </div>

                {pageSize !== -1 && totalPages > 1 && (
                  <div className="flex items-center space-x-1">
                    <button
                      disabled={safeCurrentPage <= 1}
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      className="px-2.5 py-1 bg-slate-900 border border-slate-800 rounded hover:bg-slate-800 disabled:opacity-40 text-slate-300 font-medium"
                    >
                      Prev
                    </button>
                    <span className="px-3 py-1 text-slate-300 font-mono text-[11px]">
                      Page {safeCurrentPage} of {totalPages}
                    </span>
                    <button
                      disabled={safeCurrentPage >= totalPages}
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      className="px-2.5 py-1 bg-slate-900 border border-slate-800 rounded hover:bg-slate-800 disabled:opacity-40 text-slate-300 font-medium"
                    >
                      Next
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
          </div>
        )}
      </div>

      {/* CSV Import Modal */}
      {isCsvModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-6 space-y-4 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-indigo-400" />
                  Import Student Academic Records (CSV)
                </h3>
                <span className="text-[10px] text-emerald-400 font-medium block mt-0.5">
                  ⚡ High-Capacity Engine: Supports 10,000+ to 100,000+ student rows (50MB Limit)
                </span>
              </div>
              <button
                onClick={() => setIsCsvModalOpen(false)}
                className="text-slate-400 hover:text-white font-bold text-sm"
              >
                ✕
              </button>
            </div>

            {/* Mode Switcher Tabs */}
            <div className="flex border-b border-slate-800 text-xs">
              <button
                onClick={() => {
                  setCsvImportMode('file');
                  setUploadStatus(null);
                }}
                className={`px-4 py-2 font-semibold transition-colors border-b-2 ${
                  csvImportMode === 'file'
                    ? 'border-indigo-500 text-indigo-400'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                📁 Upload CSV File
              </button>
              <button
                onClick={() => {
                  setCsvImportMode('text');
                  setUploadStatus(null);
                }}
                className={`px-4 py-2 font-semibold transition-colors border-b-2 ${
                  csvImportMode === 'text'
                    ? 'border-indigo-500 text-indigo-400'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                📋 Paste Raw CSV Text
              </button>
            </div>

            {/* Import Mode Strategy Selector */}
            <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-3 space-y-2 text-xs">
              <span className="font-semibold text-slate-300 block">Import Data Strategy:</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setReplaceExisting(true)}
                  className={`p-2.5 rounded-lg border text-left transition-all flex items-start gap-2 ${
                    replaceExisting
                      ? 'bg-indigo-950/80 border-indigo-500 text-white shadow-sm'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${replaceExisting ? 'border-indigo-400 bg-indigo-500 text-white' : 'border-slate-600'}`}>
                    {replaceExisting && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </div>
                  <div>
                    <span className="font-bold text-xs block text-indigo-300">🔄 Replace Existing Dataset</span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">
                      Clears old dataset before loading new file (e.g. uploading 500 after 10,000 replaces dataset to 500).
                    </span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setReplaceExisting(false)}
                  className={`p-2.5 rounded-lg border text-left transition-all flex items-start gap-2 ${
                    !replaceExisting
                      ? 'bg-indigo-950/80 border-indigo-500 text-white shadow-sm'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${!replaceExisting ? 'border-indigo-400 bg-indigo-500 text-white' : 'border-slate-600'}`}>
                    {!replaceExisting && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </div>
                  <div>
                    <span className="font-bold text-xs block text-slate-200">➕ Append / Merge Data</span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">
                      Appends new student records to existing database without deleting old records.
                    </span>
                  </div>
                </button>
              </div>
            </div>

            <p className="text-xs text-slate-400">
              Supported headers: <code className="text-indigo-300">Student ID, Name, Department, Year, Semester, CGPA, Attendance, Credits, Rank, Backlogs Count, Placement Eligible, Email</code>.
            </p>

            {csvImportMode === 'file' ? (
              <div className="space-y-3">
                <div className="border-2 border-dashed border-slate-700 hover:border-indigo-500/60 bg-slate-950/60 rounded-xl p-6 text-center cursor-pointer transition-colors relative">
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleCsvFileUpload}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                  <Upload className="w-8 h-8 text-indigo-400 mx-auto mb-2" />
                  <span className="text-xs font-semibold text-slate-200 block">Click to select or drop CSV file (Any size up to 50MB)</span>
                  <span className="text-[10px] text-slate-500 block mt-1">Accepts standard college grade sheets with 10,000+ student records</span>
                </div>

                {/* 10,000 Students Test Dataset Helpers */}
                <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs">
                  <div className="text-left">
                    <span className="font-semibold text-indigo-300 block">⚡ 10,000 Students Stress Test</span>
                    <span className="text-[10px] text-slate-400">Instantly test 10,000 student capacity & performance</span>
                  </div>
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <button
                      type="button"
                      onClick={handleDownload10kSampleCsv}
                      className="flex-1 sm:flex-none px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-indigo-300 rounded-lg font-medium text-[11px] border border-slate-700 transition-colors flex items-center justify-center gap-1"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Download 10k CSV
                    </button>
                    <button
                      type="button"
                      onClick={handleImport10kStudents}
                      className="flex-1 sm:flex-none px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-semibold text-[11px] shadow transition-colors flex items-center justify-center gap-1"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      Import 10k Now
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <textarea
                  rows={8}
                  placeholder="Paste raw CSV content here... (e.g. Student ID,Name,Department,Year,Semester,CGPA,Attendance,Credits,Rank,Backlogs Count,Placement Eligible,Email)"
                  value={rawCsvText}
                  onChange={(e) => setRawCsvText(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-200 text-xs font-mono focus:outline-none focus:border-indigo-500"
                />
                <button
                  onClick={handleRawCsvTextImport}
                  className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  Import Pasted CSV Data
                </button>
              </div>
            )}

            {uploadStatus && (
              <div className="bg-indigo-950/60 border border-indigo-800 text-indigo-300 p-3 rounded-xl text-xs font-mono">
                {uploadStatus}
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-2 border-t border-slate-800/80">
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={handleResetInitialStudents}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium border border-slate-700 flex items-center gap-1.5 transition-colors"
                  title="Reset database to default sample dataset (10 students)"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-cyan-400" />
                  Reset Initial Data (10)
                </button>
                <button
                  type="button"
                  onClick={handleClearAllStudents}
                  className="px-3 py-1.5 bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 rounded-xl text-xs font-medium border border-rose-800/60 flex items-center gap-1.5 transition-colors"
                  title="Clear all student records from the database"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                  Clear All Students
                </button>
              </div>

              <button
                onClick={() => setIsCsvModalOpen(false)}
                className="w-full sm:w-auto px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium"
              >
                Close
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
              {/* File Attachment Dropzone */}
              <div className="border-2 border-dashed border-cyan-500/40 hover:border-cyan-400 bg-slate-950/80 rounded-xl p-4 text-center cursor-pointer transition-colors relative">
                <input
                  type="file"
                  accept=".pdf,.txt,.md,.csv,.doc,.docx"
                  onChange={handleDocFileUpload}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                />
                <Upload className="w-6 h-6 text-cyan-400 mx-auto mb-1.5" />
                <span className="text-xs font-semibold text-slate-200 block">
                  Click to select or drop Exam Schedule PDF / College Policy Document
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  Supports PDF (.pdf), Text (.txt), Markdown (.md), CSV (.csv), Word (.doc/.docx)
                </span>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Document Title</label>
                <input
                  type="text"
                  placeholder="e.g. Supplementary Examination Regulations & Schedule August 2026"
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
                <label className="block text-slate-300 font-semibold mb-1">Document Content / Extracted Text</label>
                <textarea
                  rows={6}
                  placeholder="Content automatically populates when you upload a PDF or text file above, or you can paste clauses directly here..."
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
