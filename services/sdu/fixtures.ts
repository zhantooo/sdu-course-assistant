/**
 * Fixture data for the mock SDU backend, in SDU wire format.
 *
 * Everything here is fictional — people, rooms, and numbers are invented for
 * local development. Course codes follow a DEPT NNN pattern; the department
 * code is the course prefix.
 */
import type { SduSection } from "./contracts";

export const MOCK_TERM = { code: "2026-FALL", name: "Fall 2026" } as const;

const FENS = "Faculty of Engineering and Natural Sciences";
const BUSINESS = "SDU Business School";
const HUMANITIES = "Faculty of Education and Humanities";
const LAW_SOCIAL = "Faculty of Law and Social Sciences";

export const MOCK_DEPARTMENTS = [
  { department_code: "CSS", name: "Computer Science", faculty: FENS },
  { department_code: "INF", name: "Information Systems", faculty: FENS },
  { department_code: "MAT", name: "Mathematics", faculty: FENS },
  { department_code: "PHY", name: "Physics", faculty: FENS },
  { department_code: "ECN", name: "Economics", faculty: BUSINESS },
  { department_code: "MGT", name: "Management", faculty: BUSINESS },
  { department_code: "FIN", name: "Finance and Accounting", faculty: BUSINESS },
  { department_code: "ENG", name: "Foreign Languages", faculty: HUMANITIES },
  { department_code: "KAZ", name: "Kazakh Language and Literature", faculty: HUMANITIES },
  { department_code: "HIS", name: "History", faculty: LAW_SOCIAL },
  { department_code: "PHL", name: "Philosophy", faculty: LAW_SOCIAL },
];

// ─── Catalog ───────────────────────────────────────────────────────────────

type Slot = [
  day: "MON" | "TUE" | "WED" | "THU" | "FRI",
  start: string,
  end: string,
  type: "LECTURE" | "PRACTICE" | "LAB",
  room: string,
];

interface SectionSeed {
  n: string;
  instructor: [id: string, name: string];
  cap: number;
  avail: number;
  wl?: number;
  slots: Slot[];
}

interface CourseSeed {
  code: string;
  title: string;
  level: number;
  credits: number;
  description: string;
  prereqs: string[][];
  sections: SectionSeed[];
}

const I = {
  zhakupov: ["INS-101", "Dr. Askar Zhakupov"],
  bekova: ["INS-102", "Dr. Aizhan Bekova"],
  yilmaz: ["INS-103", "Dr. Emre Yilmaz"],
  tokhtarov: ["INS-104", "Dr. Ruslan Tokhtarov"],
  iskakova: ["INS-105", "Prof. Madina Iskakova"],
  seitkali: ["INS-106", "Dr. Daniyar Seitkali"],
  nurpeisova: ["INS-107", "Dr. Alua Nurpeisova"],
  omarov: ["INS-108", "Assoc. Prof. Timur Omarov"],
  kaya: ["INS-109", "Dr. Mehmet Kaya"],
  kassymov: ["INS-110", "Dr. Yerlan Kassymov"],
  rakhimova: ["INS-111", "Dr. Saule Rakhimova"],
  abdrakhmanova: ["INS-112", "Dr. Gulnara Abdrakhmanova"],
  temirbekov: ["INS-201", "Dr. Nurlan Temirbekov"],
  mukhametova: ["INS-202", "Dr. Zhanar Mukhametova"],
  serikbayeva: ["INS-301", "Aigul Serikbayeva"],
  zhumabek: ["INS-302", "Serik Zhumabek"],
  collins: ["INS-303", "Sarah Collins"],
  bekmukhanbet: ["INS-401", "Dr. Dana Bekmukhanbet"],
  suleimenov: ["INS-402", "Dr. Arman Suleimenov"],
  petrenko: ["INS-403", "Dr. Olga Petrenko"],
  sadykov: ["INS-501", "Dr. Bakhyt Sadykov"],
  amanov: ["INS-502", "Dr. Kairat Amanov"],
} satisfies Record<string, [string, string]>;

const COURSES: CourseSeed[] = [
  {
    code: "CSS 105",
    title: "Fundamentals of Programming",
    level: 100,
    credits: 5,
    description: "Problem solving with Python: control flow, functions, collections, and testing.",
    prereqs: [],
    sections: [
      { n: "01", instructor: I.zhakupov, cap: 60, avail: 14, slots: [["MON", "09:00", "10:50", "LECTURE", "A-201"], ["WED", "09:00", "09:50", "PRACTICE", "E-Lab 1"]] },
      { n: "02", instructor: I.bekova, cap: 60, avail: 0, wl: 7, slots: [["TUE", "13:00", "14:50", "LECTURE", "A-201"], ["THU", "13:00", "13:50", "PRACTICE", "E-Lab 1"]] },
    ],
  },
  {
    code: "CSS 106",
    title: "Object-Oriented Programming",
    level: 100,
    credits: 5,
    description: "Classes, interfaces, inheritance and design principles in Java.",
    prereqs: [["CSS 105"]],
    sections: [
      { n: "01", instructor: I.yilmaz, cap: 50, avail: 22, slots: [["TUE", "09:00", "10:50", "LECTURE", "B-105"], ["THU", "11:00", "11:50", "LAB", "E-Lab 2"]] },
    ],
  },
  {
    code: "CSS 216",
    title: "Computer Architecture",
    level: 200,
    credits: 5,
    description: "Digital logic, instruction sets, pipelining, memory hierarchy and I/O.",
    prereqs: [["CSS 105"]],
    sections: [
      { n: "01", instructor: I.tokhtarov, cap: 45, avail: 9, slots: [["MON", "13:00", "14:50", "LECTURE", "C-304"], ["WED", "15:00", "15:50", "PRACTICE", "C-304"]] },
    ],
  },
  {
    code: "CSS 225",
    title: "Data Structures and Algorithms",
    level: 200,
    credits: 6,
    description: "Lists, trees, heaps, hashing, graphs; asymptotic analysis and algorithm design.",
    prereqs: [["CSS 106"], ["MAT 151"]],
    sections: [
      { n: "01", instructor: I.iskakova, cap: 50, avail: 3, slots: [["TUE", "10:00", "11:50", "LECTURE", "A-301"], ["THU", "10:00", "11:50", "LAB", "E-Lab 3"]] },
      { n: "02", instructor: I.yilmaz, cap: 50, avail: 18, slots: [["WED", "13:00", "14:50", "LECTURE", "A-301"], ["FRI", "09:00", "10:50", "LAB", "E-Lab 3"]] },
    ],
  },
  {
    code: "CSS 232",
    title: "Database Management Systems",
    level: 200,
    credits: 5,
    description: "Relational modelling, SQL, normalisation, transactions and indexing.",
    prereqs: [["CSS 106"]],
    sections: [
      { n: "01", instructor: I.seitkali, cap: 45, avail: 27, slots: [["MON", "11:00", "12:50", "LECTURE", "B-210"], ["WED", "11:00", "11:50", "LAB", "E-Lab 2"]] },
    ],
  },
  {
    code: "CSS 242",
    title: "Web Development",
    level: 200,
    credits: 5,
    description: "HTTP, HTML/CSS, TypeScript, and building full-stack web applications.",
    prereqs: [["CSS 106"]],
    sections: [
      { n: "01", instructor: I.nurpeisova, cap: 40, avail: 0, wl: 12, slots: [["TUE", "15:00", "16:50", "LECTURE", "B-105"], ["THU", "15:00", "15:50", "LAB", "E-Lab 4"]] },
      { n: "02", instructor: I.nurpeisova, cap: 40, avail: 6, slots: [["FRI", "13:00", "14:50", "LECTURE", "B-105"], ["FRI", "15:00", "15:50", "LAB", "E-Lab 4"]] },
    ],
  },
  {
    code: "CSS 311",
    title: "Operating Systems",
    level: 300,
    credits: 6,
    description: "Processes, scheduling, concurrency, virtual memory and file systems.",
    prereqs: [["CSS 225"], ["CSS 216"]],
    sections: [
      { n: "01", instructor: I.tokhtarov, cap: 40, avail: 11, slots: [["MON", "10:00", "11:50", "LECTURE", "C-201"], ["WED", "10:00", "11:50", "LAB", "E-Lab 3"]] },
      { n: "02", instructor: I.omarov, cap: 40, avail: 0, wl: 4, slots: [["TUE", "13:00", "14:50", "LECTURE", "C-201"], ["THU", "13:00", "14:50", "LAB", "E-Lab 3"]] },
    ],
  },
  {
    code: "CSS 322",
    title: "Software Engineering",
    level: 300,
    credits: 5,
    description: "Requirements, architecture, testing, and team delivery with agile practices.",
    prereqs: [["CSS 225"]],
    sections: [
      { n: "01", instructor: I.kaya, cap: 45, avail: 16, slots: [["TUE", "10:00", "11:50", "LECTURE", "D-110"], ["FRI", "11:00", "11:50", "PRACTICE", "D-110"]] },
      { n: "02", instructor: I.kaya, cap: 45, avail: 25, slots: [["THU", "16:00", "17:50", "LECTURE", "D-110"], ["FRI", "16:00", "16:50", "PRACTICE", "D-110"]] },
    ],
  },
  {
    code: "CSS 342",
    title: "Computer Networks",
    level: 300,
    credits: 5,
    description: "Layered protocols, TCP/IP, routing, and network programming.",
    prereqs: [["CSS 216"]],
    sections: [
      { n: "01", instructor: I.kassymov, cap: 40, avail: 4, slots: [["MON", "14:00", "15:50", "LECTURE", "C-304"], ["WED", "14:00", "15:50", "LAB", "E-Lab 5"]] },
    ],
  },
  {
    code: "CSS 358",
    title: "Machine Learning",
    level: 300,
    credits: 6,
    description: "Supervised and unsupervised learning, model evaluation, and neural networks.",
    prereqs: [["MAT 250"], ["MAT 201"], ["CSS 225"]],
    sections: [
      { n: "01", instructor: I.iskakova, cap: 35, avail: 2, slots: [["MON", "15:00", "16:50", "LECTURE", "A-305"], ["THU", "09:00", "10:50", "LAB", "E-Lab 5"]] },
      { n: "02", instructor: I.rakhimova, cap: 35, avail: 13, slots: [["WED", "16:00", "17:50", "LECTURE", "A-305"], ["FRI", "10:00", "11:50", "LAB", "E-Lab 5"]] },
    ],
  },
  {
    code: "CSS 361",
    title: "Mobile Application Development",
    level: 300,
    credits: 5,
    description: "Native and cross-platform mobile apps: UI, state, storage, and publishing.",
    prereqs: [["CSS 242", "CSS 322"]],
    sections: [
      { n: "01", instructor: I.nurpeisova, cap: 30, avail: 8, slots: [["THU", "14:00", "15:50", "LECTURE", "B-210"], ["FRI", "14:00", "14:50", "LAB", "E-Lab 4"]] },
    ],
  },
  {
    code: "CSS 405",
    title: "Information Security",
    level: 400,
    credits: 5,
    description: "Cryptography, authentication, secure coding and network defence.",
    prereqs: [["CSS 342"]],
    sections: [
      { n: "01", instructor: I.kassymov, cap: 35, avail: 20, slots: [["TUE", "16:00", "17:50", "LECTURE", "C-201"], ["THU", "17:00", "17:50", "PRACTICE", "C-201"]] },
    ],
  },
  {
    code: "CSS 410",
    title: "Cloud Computing",
    level: 400,
    credits: 5,
    description: "Virtualisation, containers, distributed storage and cloud-native design.",
    prereqs: [["CSS 311"], ["CSS 342"]],
    sections: [
      { n: "01", instructor: I.omarov, cap: 30, avail: 12, slots: [["WED", "17:00", "18:50", "LECTURE", "C-201"], ["FRI", "17:00", "17:50", "LAB", "E-Lab 5"]] },
    ],
  },
  {
    code: "CSS 470",
    title: "Capstone Project I",
    level: 400,
    credits: 6,
    description: "Team capstone: scoping, design review and first delivery milestone.",
    prereqs: [["CSS 322"]],
    sections: [
      { n: "01", instructor: I.kaya, cap: 30, avail: 30, slots: [["MON", "17:00", "18:50", "LECTURE", "D-110"]] },
    ],
  },
  {
    code: "INF 230",
    title: "Information Systems Analysis",
    level: 200,
    credits: 5,
    description: "Business process modelling, requirements elicitation and UML.",
    prereqs: [],
    sections: [
      { n: "01", instructor: I.abdrakhmanova, cap: 50, avail: 19, slots: [["MON", "09:00", "10:50", "LECTURE", "F-212"], ["WED", "10:00", "10:50", "PRACTICE", "F-212"]] },
    ],
  },
  {
    code: "INF 301",
    title: "Business Intelligence",
    level: 300,
    credits: 5,
    description: "Data warehousing, ETL, dashboards and decision support.",
    prereqs: [["CSS 232"]],
    sections: [
      { n: "01", instructor: I.abdrakhmanova, cap: 40, avail: 1, slots: [["TUE", "11:00", "12:50", "LECTURE", "F-212"], ["THU", "12:00", "12:50", "LAB", "E-Lab 2"]] },
    ],
  },
  {
    code: "MAT 201",
    title: "Linear Algebra",
    level: 200,
    credits: 5,
    description: "Vector spaces, linear maps, eigenvalues and matrix decompositions.",
    prereqs: [["MAT 101"]],
    sections: [
      { n: "01", instructor: I.temirbekov, cap: 60, avail: 21, slots: [["MON", "08:00", "09:50", "LECTURE", "A-101"], ["WED", "08:00", "08:50", "PRACTICE", "A-101"]] },
      { n: "02", instructor: I.temirbekov, cap: 60, avail: 35, slots: [["TUE", "08:00", "09:50", "LECTURE", "A-101"], ["THU", "08:00", "08:50", "PRACTICE", "A-101"]] },
    ],
  },
  {
    code: "MAT 250",
    title: "Probability and Statistics",
    level: 200,
    credits: 5,
    description: "Random variables, distributions, estimation and hypothesis testing.",
    prereqs: [["MAT 102"]],
    sections: [
      { n: "01", instructor: I.mukhametova, cap: 60, avail: 7, slots: [["TUE", "09:00", "10:50", "LECTURE", "A-102"], ["THU", "09:00", "09:50", "PRACTICE", "A-102"]] },
    ],
  },
  {
    code: "KAZ 201",
    title: "Professional Kazakh",
    level: 200,
    credits: 5,
    description: "Kazakh for academic and professional communication in your field.",
    prereqs: [["KAZ 101"]],
    sections: [
      { n: "01", instructor: I.serikbayeva, cap: 25, avail: 5, slots: [["MON", "12:00", "12:50", "PRACTICE", "H-104"], ["WED", "12:00", "12:50", "PRACTICE", "H-104"]] },
      { n: "02", instructor: I.serikbayeva, cap: 25, avail: 0, wl: 3, slots: [["TUE", "12:00", "12:50", "PRACTICE", "H-104"], ["THU", "12:00", "12:50", "PRACTICE", "H-104"]] },
      { n: "03", instructor: I.zhumabek, cap: 25, avail: 17, slots: [["FRI", "12:00", "13:50", "PRACTICE", "H-106"]] },
    ],
  },
  {
    code: "ENG 201",
    title: "Academic Writing",
    level: 200,
    credits: 5,
    description: "Argumentative essays, research papers and citation practice.",
    prereqs: [["ENG 102"]],
    sections: [
      { n: "01", instructor: I.collins, cap: 20, avail: 3, slots: [["MON", "16:00", "16:50", "PRACTICE", "H-210"], ["WED", "16:00", "16:50", "PRACTICE", "H-210"]] },
      { n: "02", instructor: I.collins, cap: 20, avail: 9, slots: [["TUE", "17:00", "17:50", "PRACTICE", "H-210"], ["THU", "18:00", "18:50", "PRACTICE", "H-210"]] },
    ],
  },
  {
    code: "ECN 201",
    title: "Microeconomics",
    level: 200,
    credits: 5,
    description: "Consumer and producer theory, market structures and welfare.",
    prereqs: [],
    sections: [
      { n: "01", instructor: I.petrenko, cap: 70, avail: 29, slots: [["MON", "15:00", "16:50", "LECTURE", "G-110"], ["WED", "15:00", "15:50", "PRACTICE", "G-110"]] },
    ],
  },
  {
    code: "MGT 210",
    title: "Principles of Management",
    level: 200,
    credits: 5,
    description: "Planning, organising, leading and controlling in modern organisations.",
    prereqs: [],
    sections: [
      { n: "01", instructor: I.bekmukhanbet, cap: 70, avail: 33, slots: [["WED", "13:00", "14:50", "LECTURE", "G-110"], ["FRI", "13:00", "13:50", "PRACTICE", "G-110"]] },
    ],
  },
  {
    code: "FIN 301",
    title: "Corporate Finance",
    level: 300,
    credits: 5,
    description: "Valuation, capital budgeting, capital structure and risk.",
    prereqs: [["ECN 201"]],
    sections: [
      { n: "01", instructor: I.suleimenov, cap: 50, avail: 10, slots: [["TUE", "14:00", "15:50", "LECTURE", "G-205"], ["THU", "14:00", "14:50", "PRACTICE", "G-205"]] },
    ],
  },
  {
    code: "PHL 101",
    title: "Philosophy",
    level: 100,
    credits: 5,
    description: "Major traditions of philosophical thought and critical reasoning.",
    prereqs: [],
    sections: [
      { n: "01", instructor: I.sadykov, cap: 80, avail: 40, slots: [["THU", "17:00", "18:50", "LECTURE", "G-301"]] },
    ],
  },
  {
    code: "HIS 101",
    title: "Modern History of Kazakhstan",
    level: 100,
    credits: 5,
    description: "Kazakhstan from the 18th century to independence and the present day.",
    prereqs: [],
    sections: [
      { n: "01", instructor: I.amanov, cap: 80, avail: 12, slots: [["FRI", "08:00", "09:50", "LECTURE", "G-301"]] },
    ],
  },
];

export function buildMockSections(): SduSection[] {
  return COURSES.flatMap((course) =>
    course.sections.map((s) => ({
      section_id: `F26-${course.code.replace(" ", "")}-${s.n}`,
      course_code: course.code,
      course_title: course.title,
      course_description: course.description,
      department_code: course.code.split(" ")[0],
      course_level: course.level,
      credits: course.credits,
      section_number: s.n,
      instructor_id: s.instructor[0],
      instructor_name: s.instructor[1],
      total_capacity: s.cap,
      available_seats: s.avail,
      waitlist_count: s.wl ?? 0,
      classroom: s.slots[0][4],
      time_slots: s.slots.map(([day, start_time, end_time, type, classroom]) => ({
        day,
        start_time,
        end_time,
        type,
        classroom,
      })),
      prerequisites: course.prereqs,
    })),
  );
}

// ─── Students ──────────────────────────────────────────────────────────────

type Row = [code: string, title: string, credits: number, term: string, grade: string | null, status?: "FAILED" | "WITHDRAWN"];

export const GRADE_POINTS: Record<string, number> = {
  A: 4.0, "A-": 3.67, "B+": 3.33, B: 3.0, "B-": 2.67, "C+": 2.33,
  C: 2.0, "C-": 1.67, "D+": 1.33, D: 1.0, F: 0,
};

export interface MockStudent {
  profile: {
    student_id: string;
    full_name: string;
    email: string;
    faculty: string;
    department_code: string;
    program_code: string;
    program_name: string;
    study_year: number;
    required_credits: number;
    academic_status: "ACTIVE" | "PROBATION" | "SUSPENDED" | "GRADUATED";
    advisor: { staff_id: string; full_name: string; email: string } | null;
  };
  transcript: Row[];
}

export const MOCK_STUDENTS: MockStudent[] = [
  {
    profile: {
      student_id: "230107021",
      full_name: "Aigerim Tulegenova",
      email: "230107021@stu.sdu.edu.kz",
      faculty: FENS,
      department_code: "CSS",
      program_code: "6B06102",
      program_name: "Computer Science (BSc)",
      study_year: 3,
      required_credits: 240,
      academic_status: "ACTIVE",
      advisor: { staff_id: "STF-2041", full_name: "Dr. Daniyar Seitkali", email: "d.seitkali@sdu.edu.kz" },
    },
    transcript: [
      ["CSS 105", "Fundamentals of Programming", 5, "2024-FALL", "A"],
      ["MAT 101", "Calculus I", 5, "2024-FALL", "B+"],
      ["ENG 101", "Academic English I", 5, "2024-FALL", "A-"],
      ["KAZ 101", "Kazakh Language I", 5, "2024-FALL", "A"],
      ["HIS 101", "Modern History of Kazakhstan", 5, "2024-FALL", "B+"],
      ["PHY 101", "Physics I", 5, "2024-FALL", "B"],
      ["CSS 106", "Object-Oriented Programming", 5, "2025-SPRING", "A-"],
      ["MAT 102", "Calculus II", 5, "2025-SPRING", "B"],
      ["MAT 151", "Discrete Mathematics", 5, "2025-SPRING", "A-"],
      ["ENG 102", "Academic English II", 5, "2025-SPRING", "B+"],
      ["PHL 101", "Philosophy", 5, "2025-SPRING", "A-"],
      ["ECN 201", "Microeconomics", 5, "2025-SPRING", "B"],
      ["CSS 225", "Data Structures and Algorithms", 6, "2025-FALL", "B+"],
      ["CSS 216", "Computer Architecture", 5, "2025-FALL", "A-"],
      ["MAT 201", "Linear Algebra", 5, "2025-FALL", "B"],
      ["CSS 232", "Database Management Systems", 5, "2025-FALL", "A"],
      ["INF 230", "Information Systems Analysis", 5, "2025-FALL", "B+"],
      ["CSS 242", "Web Development", 5, "2026-SPRING", "A"],
      ["MAT 250", "Probability and Statistics", 5, "2026-SPRING", "C+"],
      ["CSS 322", "Software Engineering", 5, "2026-SPRING", "F", "FAILED"],
      ["ENG 201", "Academic Writing", 5, "2026-SPRING", "B+"],
    ],
  },
  {
    profile: {
      student_id: "240103118",
      full_name: "Nursultan Abenov",
      email: "240103118@stu.sdu.edu.kz",
      faculty: FENS,
      department_code: "INF",
      program_code: "6B06101",
      program_name: "Information Systems (BSc)",
      study_year: 2,
      required_credits: 240,
      academic_status: "ACTIVE",
      advisor: { staff_id: "STF-2077", full_name: "Dr. Gulnara Abdrakhmanova", email: "g.abdrakhmanova@sdu.edu.kz" },
    },
    transcript: [
      ["CSS 105", "Fundamentals of Programming", 5, "2025-FALL", "B-"],
      ["MAT 101", "Calculus I", 5, "2025-FALL", "C+"],
      ["ENG 101", "Academic English I", 5, "2025-FALL", "B"],
      ["KAZ 101", "Kazakh Language I", 5, "2025-FALL", "A-"],
      ["HIS 101", "Modern History of Kazakhstan", 5, "2025-FALL", "B+"],
      ["INF 110", "Introduction to Information Systems", 5, "2025-FALL", "B"],
      ["CSS 106", "Object-Oriented Programming", 5, "2026-SPRING", "C"],
      ["MAT 151", "Discrete Mathematics", 5, "2026-SPRING", "B-"],
      ["ENG 102", "Academic English II", 5, "2026-SPRING", "B"],
      ["ECN 201", "Microeconomics", 5, "2026-SPRING", "C+"],
      ["PHL 101", "Philosophy", 5, "2026-SPRING", "B"],
      ["MAT 102", "Calculus II", 5, "2026-SPRING", null, "WITHDRAWN"],
    ],
  },
];

export function buildMockTranscript(student: MockStudent) {
  const rows = student.transcript.map(([code, title, credits, term, grade, status]) => ({
    course_code: code,
    course_title: title,
    credits,
    term_code: term,
    letter_grade: grade,
    grade_points: grade === null ? null : GRADE_POINTS[grade],
    status: status ?? ("PASSED" as const),
  }));

  // Standard credit-weighted GPA over graded attempts (F counts, W does not).
  const graded = rows.filter((r) => r.grade_points !== null);
  const qualityPoints = graded.reduce((sum, r) => sum + r.grade_points! * r.credits, 0);
  const gradedCredits = graded.reduce((sum, r) => sum + r.credits, 0);
  const gpa = gradedCredits === 0 ? 0 : Math.round((qualityPoints / gradedCredits) * 100) / 100;
  const completed = rows.filter((r) => r.status === "PASSED").reduce((sum, r) => sum + r.credits, 0);

  return { rows, gpa, completed };
}
