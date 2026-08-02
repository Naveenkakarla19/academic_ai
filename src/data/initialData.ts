import { Student, DocumentRecord, EmailLog } from '../types';

export const INITIAL_STUDENTS: Student[] = [
  {
    studentId: '21CSE001',
    name: 'Aarav Sharma',
    department: 'CSE',
    year: 4,
    semester: 7,
    cgpa: 9.68,
    attendance: 94.5,
    credits: 142,
    email: 'aarav.sharma@college.edu',
    phone: '+91 98765 43210',
    subjects: ['Data Structures', 'Operating Systems', 'Cloud Computing', 'Compiler Design', 'Deep Learning'],
    backlogs: [],
    backlogCount: 0,
    placementEligible: true,
  },
  {
    studentId: '21CSE045',
    name: 'Ananya Reddy',
    department: 'CSE',
    year: 4,
    semester: 7,
    cgpa: 9.52,
    attendance: 96.0,
    credits: 142,
    email: 'ananya.reddy@college.edu',
    phone: '+91 98765 43211',
    subjects: ['Data Structures', 'Operating Systems', 'Cloud Computing', 'Database Systems', 'AI & ML'],
    backlogs: [],
    backlogCount: 0,
    placementEligible: true,
  },
  {
    studentId: '21ECE012',
    name: 'Vikram Verma',
    department: 'ECE',
    year: 4,
    semester: 7,
    cgpa: 9.15,
    attendance: 91.2,
    credits: 140,
    email: 'vikram.v@college.edu',
    phone: '+91 98765 43212',
    subjects: ['Digital Signal Processing', 'VLSI Design', 'Embedded Systems', 'Microcontrollers'],
    backlogs: [],
    backlogCount: 0,
    placementEligible: true,
  },
  {
    studentId: '21CSE102',
    name: 'Karthik Raja',
    department: 'CSE',
    year: 4,
    semester: 7,
    cgpa: 7.42,
    attendance: 82.0,
    credits: 136,
    email: 'karthik.raja@college.edu',
    phone: '+91 98765 43213',
    subjects: ['Data Structures', 'Formal Languages', 'Computer Networks', 'Machine Learning'],
    backlogs: [
      {
        id: 'BL-101',
        studentId: '21CSE102',
        subjectCode: 'CS302',
        subjectName: 'Data Structures & Algorithms',
        semester: 3,
        examDate: '2026-08-21', // 20 days from current time 2026-08-01
        daysRemaining: 20,
        status: 'SCHEDULED',
      },
    ],
    backlogCount: 1,
    placementEligible: false,
  },
  {
    studentId: '21EEE028',
    name: 'Priya Sundaram',
    department: 'EEE',
    year: 4,
    semester: 7,
    cgpa: 8.85,
    attendance: 92.0,
    credits: 138,
    email: 'priya.s@college.edu',
    phone: '+91 98765 43214',
    subjects: ['Power Systems', 'Control Systems', 'Electrical Machines II', 'Renewable Energy'],
    backlogs: [],
    backlogCount: 0,
    placementEligible: true,
  },
  {
    studentId: '22MECH014',
    name: 'Rohan Patel',
    department: 'MECH',
    year: 3,
    semester: 5,
    cgpa: 6.85,
    attendance: 76.5,
    credits: 98,
    email: 'rohan.patel@college.edu',
    phone: '+91 98765 43215',
    subjects: ['Thermodynamics', 'Fluid Mechanics', 'Strength of Materials', 'Heat Transfer'],
    backlogs: [
      {
        id: 'BL-102',
        studentId: '22MECH014',
        subjectCode: 'ME201',
        subjectName: 'Thermodynamics II',
        semester: 3,
        examDate: '2026-08-21', // 20 days away
        daysRemaining: 20,
        status: 'SCHEDULED',
      },
      {
        id: 'BL-103',
        studentId: '22MECH014',
        subjectCode: 'ME304',
        subjectName: 'Fluid Mechanics & Machinery',
        semester: 4,
        examDate: '2026-08-28',
        daysRemaining: 27,
        status: 'SCHEDULED',
      },
    ],
    backlogCount: 2,
    placementEligible: false,
  },
  {
    studentId: '21IT009',
    name: 'Siddharth Roy',
    department: 'IT',
    year: 4,
    semester: 7,
    cgpa: 9.40,
    attendance: 95.0,
    credits: 142,
    email: 'siddharth.roy@college.edu',
    phone: '+91 98765 43216',
    subjects: ['Web Technologies', 'Information Security', 'Cloud Computing', 'Big Data Analytics'],
    backlogs: [],
    backlogCount: 0,
    placementEligible: true,
  },
  {
    studentId: '22CSE088',
    name: 'Meera Nambiar',
    department: 'CSE',
    year: 3,
    semester: 5,
    cgpa: 8.92,
    attendance: 89.0,
    credits: 102,
    email: 'meera.n@college.edu',
    phone: '+91 98765 43217',
    subjects: ['Object Oriented Programming', 'Database Systems', 'Operating Systems', 'Software Engineering'],
    backlogs: [],
    backlogCount: 0,
    placementEligible: true,
  },
  {
    studentId: '23ECE050',
    name: 'Kavya Pillai',
    department: 'ECE',
    year: 2,
    semester: 3,
    cgpa: 7.10,
    attendance: 78.0,
    credits: 62,
    email: 'kavya.p@college.edu',
    phone: '+91 98765 43218',
    subjects: ['Electronic Circuits', 'Signals & Systems', 'Electromagnetic Theory', 'Digital Electronics'],
    backlogs: [
      {
        id: 'BL-104',
        studentId: '23ECE050',
        subjectCode: 'EC101',
        subjectName: 'Basic Electronics Engineering',
        semester: 1,
        examDate: '2026-08-21',
        daysRemaining: 20,
        status: 'SCHEDULED',
      },
    ],
    backlogCount: 1,
    placementEligible: false,
  },
  {
    studentId: '23981A42E7',
    name: 'K. Naveen',
    department: 'CSE',
    year: 3,
    semester: 5,
    cgpa: 8.75,
    attendance: 88.5,
    credits: 108,
    email: 'karlanaveen19@gmail.com',
    phone: '+91 98765 43219',
    subjects: ['Data Structures', 'Operating Systems', 'Database Systems', 'Computer Networks', 'Web Technologies'],
    backlogs: [
      {
        id: 'BL-105',
        studentId: '23981A42E7',
        subjectCode: 'CS302',
        subjectName: 'Data Structures & Algorithms',
        semester: 3,
        examDate: '2026-08-21',
        daysRemaining: 20,
        status: 'SCHEDULED',
      },
    ],
    backlogCount: 1,
    placementEligible: false,
  },
];

export const INITIAL_DOCUMENTS: DocumentRecord[] = [
  {
    id: 'DOC-REG-2026',
    title: 'Academic Regulations AR23 Guidelines',
    category: 'Academic Regulation',
    filename: 'Academic_Regulations_AR23.pdf',
    fileSize: '1.2 MB',
    uploadDate: '2026-01-15',
    chunkCount: 6,
    content: `
ACADEMIC REGULATIONS AR23 - STUDENT EVALUATION & PROMOTION CRITERIA

1. CREDIT REQUIREMENTS AND CGPA COMPUTATION:
- A student must earn a minimum of 160 credits for the award of B.Tech Degree.
- CGPA is computed as sum(Credit * Grade Point) / sum(Credits).
- Minimum CGPA required for passing a degree is 5.0 with no standing backlogs at final semester.

2. ATTENDANCE & CONDONATION RULES:
- Minimum overall attendance required per semester is 75%.
- Condonation of shortage of attendance between 65% and 75% may be granted by the Academic Council on valid medical grounds with a condonation fee.
- Students with attendance below 65% in any semester will be detained and must repeat the semester.

3. BACKLOG & SUPPLEMENTARY EXAMINATIONS:
- A subject is declared as a backlog if the student scores less than 40% in End Semester Examination or less than 40% overall (Internal + External).
- Supplementary examinations are conducted twice a year: once in November/December and once in August/September.
- Students with active backlogs cannot be awarded degree honors or top university ranks.

4. DRESS CODE & DISCIPLINE:
- Formal uniform or clean professional attire is mandatory during mid-terms, practical labs, and placement drives.
    `,
  },
  {
    id: 'DOC-EXAM-2026',
    title: 'Supplementary & Semester Exam Schedule August 2026',
    category: 'Exam Schedule',
    filename: 'Exam_Schedule_August_2026.pdf',
    fileSize: '840 KB',
    uploadDate: '2026-07-20',
    chunkCount: 5,
    content: `
OFFICIAL EXAMINATION SCHEDULE - AUGUST 2026 SUPPLEMENTARY EXAMINATIONS

1. EXAM TIMINGS:
- Forenoon Session (FN): 09:30 AM to 12:30 PM
- Afternoon Session (AN): 02:00 PM to 05:00 PM

2. SUPPLEMENTARY EXAM DATE TABLE:
- August 21, 2026 (FN): CS302 - Data Structures & Algorithms (CSE/IT)
- August 21, 2026 (AN): ME201 - Thermodynamics II (MECH)
- August 21, 2026 (FN): EC101 - Basic Electronics Engineering (ECE)
- August 25, 2026 (FN): CS401 - Database Management Systems (CSE)
- August 28, 2026 (AN): ME304 - Fluid Mechanics & Machinery (MECH)
- September 02, 2026 (FN): EE202 - Electrical Circuits & Networks (EEE)

3. HALL TICKET & EXAM INSTRUCTIONS:
- Hall tickets will be issued starting August 15, 2026 from the Controller of Examinations office.
- Students must clear all college dues prior to downloading hall tickets.
- Electronic gadgets, programmable calculators, and smartwatches are strictly banned inside examination halls.
    `,
  },
  {
    id: 'DOC-PLACE-2026',
    title: 'Campus Placement Eligibility Policy 2026-2027',
    category: 'Placement Eligibility',
    filename: 'Placement_Eligibility_Policy_2026.pdf',
    fileSize: '620 KB',
    uploadDate: '2026-06-10',
    chunkCount: 4,
    content: `
CENTRAL PLACEMENT CELL - CAMPUS DRIVE ELIGIBILITY RULES (2026-2027)

1. TIER-1 COMPLIANCE (MAANG & PRODUCT COMPANIES - Package > 12 LPA):
- Minimum CGPA required: 8.00 and above across all completed semesters.
- Active Backlogs allowed: ZERO (0) standing backlogs.
- History of Backlogs: Maximum 1 cleared backlog allowed.
- Minimum Attendance: 80% throughout the course.

2. TIER-2 COMPLIANCE (SERVICE & IT CONSULTING - Package 5 to 12 LPA):
- Minimum CGPA required: 6.50 and above.
- Active Backlogs allowed: Maximum ZERO (0) standing backlogs at time of drive.
- History of Backlogs: Maximum 2 cleared backlogs.

3. TRAINING & CERTIFICATION MANDATE:
- Minimum 85% attendance required in Campus Recruitment Training (CRT) modules.
- Completion of mandatory Coding/Technical assessments on HackerRank/LeetCode portal.
    `,
  },
];

export const INITIAL_EMAIL_LOGS: EmailLog[] = [
  {
    id: 'EML-001',
    studentId: '21CSE102',
    studentName: 'Karthik Raja',
    studentEmail: 'karthik.raja@college.edu',
    subjectName: 'Data Structures & Algorithms (CS302)',
    examDate: '2026-08-21',
    daysRemaining: 20,
    sentAt: '2026-08-01 09:00 AM',
    status: 'SENT',
    emailSubject: 'URGENT: Supplementary Exam Reminder - Data Structures & Algorithms',
    emailBody: `Dear Karthik Raja,\n\nThis is an automated academic intelligence reminder regarding your upcoming supplementary examination.\n\nExam Details:\n- Subject: Data Structures & Algorithms (CS302)\n- Date: August 21, 2026 (Forenoon Session)\n- Countdown: Exactly 20 Days Remaining\n\nClearing this backlog is essential to restore your placement eligibility for upcoming Tier-1 campus drives. Please access the student portal to review key topics and practice previous question papers.\n\nBest of luck,\nController of Examinations & AI Student Support`,
  },
];
