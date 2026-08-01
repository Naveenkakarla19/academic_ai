export interface Student {
  studentId: string;
  name: string;
  department: 'CSE' | 'ECE' | 'EEE' | 'MECH' | 'IT' | 'CIVIL';
  year: number;
  semester: number;
  cgpa: number;
  attendance: number; // percentage, e.g., 88.5
  credits: number;
  email: string;
  phone: string;
  subjects: string[]; // List of all enrolled subjects
  backlogs: Backlog[]; // List of active backlogs
  backlogCount: number;
  rank?: number; // Rank among students with 0 backlogs
  placementEligible: boolean;
}

export interface Backlog {
  id: string;
  studentId: string;
  subjectCode: string;
  subjectName: string;
  semester: number;
  examDate: string; // YYYY-MM-DD
  daysRemaining: number;
  status: 'PENDING' | 'SCHEDULED' | 'CLEARED';
}

export interface DocumentRecord {
  id: string;
  title: string;
  category: 'Exam Schedule' | 'Academic Regulation' | 'Placement Eligibility' | 'General';
  filename: string;
  fileSize: string;
  uploadDate: string;
  chunkCount: number;
  content: string;
}

export interface VectorChunk {
  id: string;
  documentId: string;
  documentTitle: string;
  category: string;
  text: string;
  embedding?: number[];
}

export interface AgentStep {
  node: 'START' | 'Authenticate User' | 'Intent Classification' | 'SQL Agent' | 'RAG Retriever' | 'Ranking Agent' | 'Email Agent' | 'LLM Synthesis' | 'END';
  label: string;
  description: string;
  timestamp: string;
  data?: any;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'bot' | 'system';
  text: string;
  timestamp: string;
  agentSteps?: AgentStep[];
  sources?: { documentTitle: string; category: string; textSnippet: string }[];
  sqlQuery?: string;
  sqlResult?: any;
}

export interface EmailLog {
  id: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  subjectName: string;
  examDate: string;
  daysRemaining: number;
  sentAt: string;
  status: 'SENT' | 'FAILED' | 'QUEUED';
  emailSubject: string;
  emailBody: string;
}

export interface DepartmentStat {
  department: string;
  totalStudents: number;
  noBacklogCount: number;
  backlogCount: number;
  avgCgpa: number;
  avgAttendance: number;
  eligiblePlacementsCount: number;
}

export interface SystemStats {
  totalStudents: number;
  clearStudentsCount: number;
  backlogStudentsCount: number;
  avgCgpa: number;
  passPercentage: number;
  eligiblePlacementPercentage: number;
  totalDocumentsIndexed: number;
  totalVectorChunks: number;
  totalEmailsSent: number;
}

export interface UserSession {
  role: 'admin' | 'student';
  studentId?: string;
  studentName?: string;
  email: string;
}
