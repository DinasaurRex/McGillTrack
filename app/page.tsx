'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BarChart3,
  BookOpen,
  CalendarDays,
  Check,
  Clock3,
  Download,
  GraduationCap,
  Plus,
  RotateCcw,
  Trash2,
  Upload,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  NativeSelect,
  NativeSelectOption,
} from '@/components/ui/native-select';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

type Status = 'Not Started' | 'In Progress' | 'Done';
type Priority = 'Low' | 'Medium' | 'High' | 'Super High';
type AssignmentType =
  | 'Lab/Case Study'
  | 'Quiz'
  | 'Project'
  | 'Essay'
  | 'Assignment'
  | 'Reading'
  | 'Homework'
  | 'Test'
  | 'Final';

type Course = {
  id: string;
  name: string;
  code: string;
  room: string;
  instructor: string;
  credits: number;
  color: string;
};

type Assignment = {
  id: string;
  courseId: string;
  title: string;
  type: AssignmentType;
  status: Status;
  priority: Priority;
  week: string;
  dueDate: string;
  weight: number;
  submitted: boolean;
  graded: boolean;
  score: number;
  maxScore: number;
  submission: string;
  partner: string;
  notes: string;
};

type ScheduleBlock = {
  id: string;
  courseId: string;
  day: string;
  start: string;
  end: string;
  location: string;
};

type NoteEntry = {
  id: string;
  courseId: string;
  title: string;
  body: string;
  pinned: boolean;
};

type HourEntry = {
  id: string;
  event: string;
  project: string;
  date: string;
  start: string;
  end: string;
  notes: string;
};

type TrackerData = {
  courses: Course[];
  assignments: Assignment[];
  schedule: ScheduleBlock[];
  notes: NoteEntry[];
  hours: HourEntry[];
};

type ModelContextTool = {
  name: string;
  title?: string;
  description: string;
  inputSchema: object;
  annotations?: {
    readOnlyHint?: boolean;
    untrustedContentHint?: boolean;
  };
  execute(input: unknown): unknown;
};

declare global {
  interface Document {
    modelContext?: {
      registerTool: (
        tool: ModelContextTool,
        options?: { signal?: AbortSignal },
      ) => void | Promise<void>;
    };
  }
}

const statuses: Status[] = ['Not Started', 'In Progress', 'Done'];
const priorities: Priority[] = ['Low', 'Medium', 'High', 'Super High'];
const assignmentTypes: AssignmentType[] = [
  'Lab/Case Study',
  'Quiz',
  'Project',
  'Essay',
  'Assignment',
  'Reading',
  'Homework',
  'Test',
  'Final',
];
const weeks = [
  'Week 1',
  'Week 2',
  'Week 3',
  'Week 4',
  'Week 5',
  'Week 6',
  'Week 7',
  'Week 8',
  'Week 9',
  'Week 10',
  'Week 11',
  'Week 12',
  'Week 13',
  'Week 14',
  'Finals Week',
];
const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const courseColors = ['#d9c7ff', '#cdb4db', '#ffc8dd', '#bde0fe', '#caffbf'];
const storageKey = 'mcgilltrack-template-v1';

const makeId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

const todayIso = () => {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  return new Date(now.getTime() - offset * 60000).toISOString().slice(0, 10);
};

const addDays = (daysToAdd: number) => {
  const date = new Date(`${todayIso()}T00:00:00`);
  date.setDate(date.getDate() + daysToAdd);
  return date.toISOString().slice(0, 10);
};

const defaultData: TrackerData = {
  courses: [
    {
      id: 'course-1',
      name: 'Course 1',
      code: 'COUR 101',
      room: 'Room A',
      instructor: '',
      credits: 3,
      color: '#d9c7ff',
    },
    {
      id: 'course-2',
      name: 'Course 2',
      code: 'COUR 102',
      room: 'Room B',
      instructor: '',
      credits: 3,
      color: '#cdb4db',
    },
    {
      id: 'course-3',
      name: 'Course 3',
      code: 'COUR 103',
      room: 'Room C',
      instructor: '',
      credits: 3,
      color: '#bde0fe',
    },
  ],
  assignments: [
    {
      id: 'assignment-1',
      courseId: 'course-1',
      title: 'Sample quiz',
      type: 'Quiz',
      status: 'In Progress',
      priority: 'Medium',
      week: 'Week 1',
      dueDate: addDays(3),
      weight: 5,
      submitted: false,
      graded: false,
      score: 0,
      maxScore: 10,
      submission: 'Course portal',
      partner: '',
      notes: '',
    },
    {
      id: 'assignment-2',
      courseId: 'course-2',
      title: 'Reading checkpoint',
      type: 'Reading',
      status: 'Not Started',
      priority: 'Low',
      week: 'Week 2',
      dueDate: addDays(8),
      weight: 0,
      submitted: false,
      graded: false,
      score: 0,
      maxScore: 10,
      submission: 'No submission needed',
      partner: '',
      notes: '',
    },
  ],
  schedule: [
    {
      id: 'schedule-1',
      courseId: 'course-1',
      day: 'Monday',
      start: '09:00',
      end: '10:30',
      location: 'Room A',
    },
    {
      id: 'schedule-2',
      courseId: 'course-2',
      day: 'Wednesday',
      start: '13:00',
      end: '14:30',
      location: 'Room B',
    },
  ],
  notes: [
    {
      id: 'note-1',
      courseId: 'course-1',
      title: 'Office hours',
      body: 'Add instructor availability, helpful links, or study reminders.',
      pinned: true,
    },
  ],
  hours: [
    {
      id: 'hour-1',
      event: 'Sample event',
      project: 'Project 1',
      date: todayIso(),
      start: '10:00',
      end: '12:00',
      notes: '',
    },
  ],
};

const blankAssignment = (courseId: string): Assignment => ({
  id: makeId(),
  courseId,
  title: '',
  type: 'Assignment',
  status: 'Not Started',
  priority: 'Medium',
  week: 'Week 1',
  dueDate: todayIso(),
  weight: 0,
  submitted: false,
  graded: false,
  score: 0,
  maxScore: 100,
  submission: '',
  partner: '',
  notes: '',
});

const blankSchedule = (courseId: string): ScheduleBlock => ({
  id: makeId(),
  courseId,
  day: 'Monday',
  start: '09:00',
  end: '10:00',
  location: '',
});

const blankNote = (courseId: string): NoteEntry => ({
  id: makeId(),
  courseId,
  title: '',
  body: '',
  pinned: false,
});

const blankHour = (): HourEntry => ({
  id: makeId(),
  event: '',
  project: '',
  date: todayIso(),
  start: '09:00',
  end: '10:00',
  notes: '',
});

const numberValue = (value: string) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const daysLeft = (dueDate: string) => {
  if (!dueDate) return null;
  const due = new Date(`${dueDate}T00:00:00`).getTime();
  const today = new Date(`${todayIso()}T00:00:00`).getTime();
  return Math.ceil((due - today) / 86400000);
};

const hoursBetween = (start: string, end: string) => {
  if (!start || !end) return 0;
  const [startHour, startMinute] = start.split(':').map(Number);
  const [endHour, endMinute] = end.split(':').map(Number);
  let minutes = endHour * 60 + endMinute - (startHour * 60 + startMinute);
  if (minutes < 0) minutes += 24 * 60;
  return minutes / 60;
};

const percent = (value: number) => `${Math.round(value * 100)}%`;
const oneDecimal = (value: number) => (Math.round(value * 10) / 10).toFixed(1);

const readStoredData = () => {
  if (typeof window === 'undefined') return defaultData;
  const saved = window.localStorage.getItem(storageKey);
  if (!saved) return defaultData;
  try {
    return JSON.parse(saved) as TrackerData;
  } catch {
    window.localStorage.removeItem(storageKey);
    return defaultData;
  }
};

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-1.5 text-xs font-semibold uppercase text-violet-950/65">
      {label}
      {children}
    </label>
  );
}

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`h-9 min-w-0 border-2 border-violet-200 bg-white px-3 text-sm shadow-[3px_3px_0_#e9ddff] outline-none transition focus:border-violet-500 ${props.className ?? ''}`}
    />
  );
}

function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`min-h-24 min-w-0 resize-y border-2 border-violet-200 bg-white px-3 py-2 text-sm shadow-[3px_3px_0_#e9ddff] outline-none transition focus:border-violet-500 ${props.className ?? ''}`}
    />
  );
}

function MiniStat({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="pixel-panel flex min-h-24 items-center gap-4 p-4">
      <div className="grid size-10 place-items-center border-2 border-violet-300 bg-violet-100 text-violet-700">
        {icon}
      </div>
      <div>
        <p className="text-xs font-semibold uppercase text-violet-950/60">
          {label}
        </p>
        <p className="mt-1 text-2xl font-black text-violet-950">{value}</p>
      </div>
    </div>
  );
}

export default function Home() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [data, setData] = useState<TrackerData>(readStoredData);
  const [activeCourse, setActiveCourse] = useState(data.courses[0]?.id ?? '');
  const [courseDraft, setCourseDraft] = useState<Course>({
    id: makeId(),
    name: '',
    code: '',
    room: '',
    instructor: '',
    credits: 3,
    color: courseColors[0],
  });
  const [assignmentDraft, setAssignmentDraft] = useState<Assignment>(
    blankAssignment(defaultData.courses[0].id),
  );
  const [scheduleDraft, setScheduleDraft] = useState<ScheduleBlock>(
    blankSchedule(defaultData.courses[0].id),
  );
  const [noteDraft, setNoteDraft] = useState<NoteEntry>(
    blankNote(defaultData.courses[0].id),
  );
  const [hourDraft, setHourDraft] = useState<HourEntry>(blankHour());

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(data));
  }, [data]);

  const courseById = useMemo(
    () => new Map(data.courses.map((course) => [course.id, course])),
    [data.courses],
  );

  const assignmentMetrics = useMemo(() => {
    const total = data.assignments.length;
    const done = data.assignments.filter(
      (assignment) => assignment.status === 'Done' || assignment.submitted,
    ).length;
    const overdue = data.assignments.filter((assignment) => {
      const left = daysLeft(assignment.dueDate);
      return (
        left !== null &&
        left < 0 &&
        assignment.status !== 'Done' &&
        !assignment.submitted
      );
    }).length;
    const dueThisWeek = data.assignments.filter(
      (assignment) =>
        assignment.week === currentWeek(data.assignments) &&
        assignment.status !== 'Done' &&
        !assignment.submitted,
    ).length;
    return { total, done, overdue, dueThisWeek };
  }, [data.assignments]);

  const gradedAssignments = data.assignments.filter(
    (assignment) =>
      assignment.graded && assignment.maxScore > 0 && assignment.weight > 0,
  );
  const weightedEarned = gradedAssignments.reduce(
    (sum, assignment) =>
      sum + (assignment.score / assignment.maxScore) * assignment.weight,
    0,
  );
  const weightedPossible = gradedAssignments.reduce(
    (sum, assignment) => sum + assignment.weight,
    0,
  );
  const currentGrade =
    weightedPossible > 0 ? weightedEarned / weightedPossible : 0;
  const totalHours = data.hours.reduce(
    (sum, hour) => sum + hoursBetween(hour.start, hour.end),
    0,
  );
  const completionRate =
    assignmentMetrics.total > 0
      ? assignmentMetrics.done / assignmentMetrics.total
      : 0;

  const updateAssignment = <K extends keyof Assignment>(
    id: string,
    key: K,
    value: Assignment[K],
  ) => {
    setData((current) => ({
      ...current,
      assignments: current.assignments.map((assignment) =>
        assignment.id === id ? { ...assignment, [key]: value } : assignment,
      ),
    }));
  };

  const updateCourse = <K extends keyof Course>(
    id: string,
    key: K,
    value: Course[K],
  ) => {
    setData((current) => ({
      ...current,
      courses: current.courses.map((course) =>
        course.id === id ? { ...course, [key]: value } : course,
      ),
    }));
  };

  const addAssignment = () => {
    if (!assignmentDraft.title.trim()) return;
    setData((current) => ({
      ...current,
      assignments: [
        { ...assignmentDraft, id: makeId() },
        ...current.assignments,
      ],
    }));
    setAssignmentDraft(blankAssignment(assignmentDraft.courseId));
  };

  const addCourse = () => {
    if (!courseDraft.name.trim()) return;
    const course = { ...courseDraft, id: makeId() };
    setData((current) => ({
      ...current,
      courses: [...current.courses, course],
    }));
    setActiveCourse(course.id);
    setCourseDraft({
      id: makeId(),
      name: '',
      code: '',
      room: '',
      instructor: '',
      credits: 3,
      color: courseColors[data.courses.length % courseColors.length],
    });
  };

  const addSchedule = () => {
    setData((current) => ({
      ...current,
      schedule: [...current.schedule, { ...scheduleDraft, id: makeId() }],
    }));
    setScheduleDraft(blankSchedule(scheduleDraft.courseId));
  };

  const addNote = () => {
    if (!noteDraft.title.trim() && !noteDraft.body.trim()) return;
    setData((current) => ({
      ...current,
      notes: [{ ...noteDraft, id: makeId() }, ...current.notes],
    }));
    setNoteDraft(blankNote(noteDraft.courseId));
  };

  const addHour = () => {
    if (!hourDraft.event.trim()) return;
    setData((current) => ({
      ...current,
      hours: [{ ...hourDraft, id: makeId() }, ...current.hours],
    }));
    setHourDraft(blankHour());
  };

  const removeItem = (collection: keyof TrackerData, id: string) => {
    setData((current) => ({
      ...current,
      [collection]: current[collection].filter((item) => item.id !== id),
    }));
  };

  const resetTemplate = () => {
    setData(defaultData);
    setActiveCourse(defaultData.courses[0].id);
  };

  const exportData = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'mcgilltrack-data.json';
    link.click();
    URL.revokeObjectURL(url);
  };

  const importData = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const contents = typeof reader.result === 'string' ? reader.result : '';
        const parsed = JSON.parse(contents) as TrackerData;
        setData(parsed);
      } catch {
        alert('That file could not be imported.');
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  useEffect(() => {
    const context = document.modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    const reportError = (error: unknown) => console.error(error);

    try {
      void Promise.resolve(
        context.registerTool(
          {
            name: 'add_tracker_assignment',
            title: 'Add tracker assignment',
            description:
              'Add one assignment to the McGillTrack assignment list using the same local tracker data as the visible form.',
            inputSchema: {
              type: 'object',
              properties: {
                courseId: { type: 'string' },
                title: { type: 'string' },
                type: { type: 'string', enum: assignmentTypes },
                dueDate: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
                priority: { type: 'string', enum: priorities },
                week: { type: 'string', enum: weeks },
                weight: { type: 'number', minimum: 0 },
              },
              required: ['courseId', 'title', 'dueDate'],
              additionalProperties: false,
            },
            annotations: {
              readOnlyHint: false,
              untrustedContentHint: false,
            },
            execute(input) {
              const payload = input as Partial<Assignment>;
              if (
                !payload ||
                typeof payload !== 'object' ||
                !payload.courseId ||
                !payload.title ||
                !payload.dueDate
              ) {
                throw new Error('courseId, title, and dueDate are required.');
              }
              const course = data.courses.find(
                (item) => item.id === payload.courseId,
              );
              if (!course) throw new Error('Course not found.');
              const item: Assignment = {
                ...blankAssignment(course.id),
                title: String(payload.title),
                type: assignmentTypes.includes(payload.type as AssignmentType)
                  ? (payload.type as AssignmentType)
                  : 'Assignment',
                dueDate: String(payload.dueDate),
                priority: priorities.includes(payload.priority as Priority)
                  ? (payload.priority as Priority)
                  : 'Medium',
                week: weeks.includes(String(payload.week))
                  ? String(payload.week)
                  : 'Week 1',
                weight:
                  typeof payload.weight === 'number' &&
                  Number.isFinite(payload.weight)
                    ? payload.weight
                    : 0,
              };
              setData((current) => ({
                ...current,
                assignments: [item, ...current.assignments],
              }));
              return {
                id: item.id,
                course: course.name,
                title: item.title,
                added: true,
              };
            },
          },
          { signal: lifecycle.signal },
        ),
      ).catch(reportError);
    } catch (error) {
      reportError(error);
    }

    return () => lifecycle.abort();
  }, [data.courses]);

  return (
    <main className="min-h-screen bg-[var(--background)] text-violet-950">
      <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-5 px-4 py-4 sm:px-6 lg:px-8">
        <header className="pixel-panel grid gap-5 p-4 md:grid-cols-[1fr_auto] md:items-center">
          <div className="flex min-w-0 items-center gap-4">
            <div className="grid size-12 shrink-0 place-items-center border-2 border-violet-400 bg-violet-200 shadow-[4px_4px_0_#7c3aed]">
              <BookOpen className="size-6" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase text-violet-800">
                {new Date().toLocaleDateString(undefined, {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                })}
              </p>
              <h1 className="text-3xl font-black tracking-normal sm:text-4xl">
                McGillTrack
              </h1>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={exportData}>
              <Download data-icon="inline-start" />
              Export
            </Button>
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload data-icon="inline-start" />
              Import
            </Button>
            <Button variant="secondary" onClick={resetTemplate}>
              <RotateCcw data-icon="inline-start" />
              Reset
            </Button>
            <input
              ref={fileInputRef}
              className="hidden"
              type="file"
              accept="application/json"
              onChange={importData}
            />
          </div>
        </header>

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <MiniStat
            label="Assignments"
            value={`${assignmentMetrics.done}/${assignmentMetrics.total}`}
            icon={<ClipboardIcon />}
          />
          <MiniStat
            label="Overdue"
            value={String(assignmentMetrics.overdue)}
            icon={<CalendarDays className="size-5" />}
          />
          <MiniStat
            label="Current Grade"
            value={weightedPossible > 0 ? percent(currentGrade) : '-'}
            icon={<GraduationCap className="size-5" />}
          />
          <MiniStat
            label="Hours"
            value={oneDecimal(totalHours)}
            icon={<Clock3 className="size-5" />}
          />
        </section>

        <Tabs defaultValue="overview" className="gap-4">
          <div className="overflow-x-auto">
            <TabsList className="pixel-tabs h-auto min-w-max bg-violet-100 p-1">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="assignments">Assignments</TabsTrigger>
              <TabsTrigger value="courses">Courses</TabsTrigger>
              <TabsTrigger value="grades">Grades</TabsTrigger>
              <TabsTrigger value="schedule">Schedule</TabsTrigger>
              <TabsTrigger value="notes">Notes</TabsTrigger>
              <TabsTrigger value="hours">Hours</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent
            value="overview"
            className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]"
          >
            <section className="pixel-panel p-4">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-black">Assignment Board</h2>
                  <p className="text-sm text-violet-950/65">
                    Live counts, due dates, and progress from your tracker rows.
                  </p>
                </div>
                <div className="text-right text-sm font-bold text-violet-700">
                  {percent(completionRate)}
                </div>
              </div>
              <Progress
                value={completionRate * 100}
                className="mb-5 h-3 border border-violet-300 bg-violet-100"
              />
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {statuses.map((status) => (
                  <div
                    key={status}
                    className="border-2 border-violet-200 bg-white p-3"
                  >
                    <p className="text-xs font-bold uppercase text-violet-700">
                      {status}
                    </p>
                    <p className="mt-2 text-3xl font-black">
                      {
                        data.assignments.filter(
                          (assignment) => assignment.status === status,
                        ).length
                      }
                    </p>
                  </div>
                ))}
                <div className="border-2 border-fuchsia-200 bg-fuchsia-50 p-3">
                  <p className="text-xs font-bold uppercase text-fuchsia-700">
                    Due This Week
                  </p>
                  <p className="mt-2 text-3xl font-black">
                    {assignmentMetrics.dueThisWeek}
                  </p>
                </div>
              </div>
            </section>

            <section className="pixel-panel p-4">
              <h2 className="mb-4 text-xl font-black">Courses</h2>
              <div className="grid gap-3">
                {data.courses.map((course) => {
                  const courseAssignments = data.assignments.filter(
                    (assignment) => assignment.courseId === course.id,
                  );
                  const done = courseAssignments.filter(
                    (assignment) => assignment.status === 'Done',
                  ).length;
                  return (
                    <button
                      key={course.id}
                      className={`grid gap-2 border-2 p-3 text-left transition hover:-translate-y-0.5 ${
                        activeCourse === course.id
                          ? 'border-violet-500 bg-violet-100'
                          : 'border-violet-200 bg-white'
                      }`}
                      onClick={() => setActiveCourse(course.id)}
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className="size-4 border-2 border-violet-400"
                          style={{ background: course.color }}
                        />
                        <span className="font-black">{course.name}</span>
                      </div>
                      <span className="text-sm text-violet-950/65">
                        {course.code || 'No code'} - {course.room || 'No room'}
                      </span>
                      <Progress
                        value={
                          courseAssignments.length > 0
                            ? (done / courseAssignments.length) * 100
                            : 0
                        }
                        className="h-2 bg-violet-50"
                      />
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="pixel-panel p-4 lg:col-span-2">
              <h2 className="mb-4 text-xl font-black">Upcoming</h2>
              <AssignmentTable
                assignments={[...data.assignments]
                  .filter((assignment) => assignment.status !== 'Done')
                  .sort(
                    (a, b) =>
                      new Date(a.dueDate).getTime() -
                      new Date(b.dueDate).getTime(),
                  )
                  .slice(0, 6)}
                courseById={courseById}
                updateAssignment={updateAssignment}
                removeAssignment={(id) => removeItem('assignments', id)}
              />
            </section>
          </TabsContent>

          <TabsContent value="assignments" className="grid gap-4">
            <section className="pixel-panel grid gap-3 p-4 xl:grid-cols-[1fr_1fr_0.8fr_0.8fr_0.7fr_auto]">
              <Field label="Course">
                <CourseSelect
                  courses={data.courses}
                  value={assignmentDraft.courseId}
                  onChange={(value) =>
                    setAssignmentDraft({ ...assignmentDraft, courseId: value })
                  }
                />
              </Field>
              <Field label="Assignment">
                <TextInput
                  value={assignmentDraft.title}
                  onChange={(event) =>
                    setAssignmentDraft({
                      ...assignmentDraft,
                      title: event.target.value,
                    })
                  }
                  placeholder="Problem set, essay, quiz"
                />
              </Field>
              <Field label="Type">
                <NativeSelect
                  value={assignmentDraft.type}
                  onChange={(event) =>
                    setAssignmentDraft({
                      ...assignmentDraft,
                      type: event.target.value as AssignmentType,
                    })
                  }
                >
                  {assignmentTypes.map((type) => (
                    <NativeSelectOption key={type} value={type}>
                      {type}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
              <Field label="Due Date">
                <TextInput
                  type="date"
                  value={assignmentDraft.dueDate}
                  onChange={(event) =>
                    setAssignmentDraft({
                      ...assignmentDraft,
                      dueDate: event.target.value,
                    })
                  }
                />
              </Field>
              <Field label="Weight">
                <TextInput
                  type="number"
                  min="0"
                  value={assignmentDraft.weight}
                  onChange={(event) =>
                    setAssignmentDraft({
                      ...assignmentDraft,
                      weight: numberValue(event.target.value),
                    })
                  }
                />
              </Field>
              <div className="flex items-end">
                <Button onClick={addAssignment} className="h-9 w-full">
                  <Plus data-icon="inline-start" />
                  Add
                </Button>
              </div>
            </section>
            <section className="pixel-panel p-4">
              <AssignmentTable
                assignments={data.assignments}
                courseById={courseById}
                updateAssignment={updateAssignment}
                removeAssignment={(id) => removeItem('assignments', id)}
              />
            </section>
          </TabsContent>

          <TabsContent
            value="courses"
            className="grid gap-4 xl:grid-cols-[360px_1fr]"
          >
            <section className="pixel-panel grid gap-3 p-4">
              <h2 className="text-xl font-black">Add Course</h2>
              <Field label="Name">
                <TextInput
                  value={courseDraft.name}
                  onChange={(event) =>
                    setCourseDraft({ ...courseDraft, name: event.target.value })
                  }
                  placeholder="Course name"
                />
              </Field>
              <Field label="Code">
                <TextInput
                  value={courseDraft.code}
                  onChange={(event) =>
                    setCourseDraft({ ...courseDraft, code: event.target.value })
                  }
                  placeholder="COUR 101"
                />
              </Field>
              <Field label="Room">
                <TextInput
                  value={courseDraft.room}
                  onChange={(event) =>
                    setCourseDraft({ ...courseDraft, room: event.target.value })
                  }
                  placeholder="Room"
                />
              </Field>
              <Field label="Instructor">
                <TextInput
                  value={courseDraft.instructor}
                  onChange={(event) =>
                    setCourseDraft({
                      ...courseDraft,
                      instructor: event.target.value,
                    })
                  }
                  placeholder="Name"
                />
              </Field>
              <div className="flex flex-wrap gap-2">
                {courseColors.map((color) => (
                  <button
                    key={color}
                    aria-label={`Use color ${color}`}
                    className={`size-8 border-2 ${
                      courseDraft.color === color
                        ? 'border-violet-700'
                        : 'border-violet-200'
                    }`}
                    style={{ background: color }}
                    onClick={() => setCourseDraft({ ...courseDraft, color })}
                  />
                ))}
              </div>
              <Button onClick={addCourse}>
                <Plus data-icon="inline-start" />
                Add course
              </Button>
            </section>

            <section className="pixel-panel p-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Course</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Room</TableHead>
                    <TableHead>Instructor</TableHead>
                    <TableHead>Credits</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.courses.map((course) => (
                    <TableRow key={course.id}>
                      <TableCell>
                        <TextInput
                          value={course.name}
                          onChange={(event) =>
                            updateCourse(course.id, 'name', event.target.value)
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <TextInput
                          value={course.code}
                          onChange={(event) =>
                            updateCourse(course.id, 'code', event.target.value)
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <TextInput
                          value={course.room}
                          onChange={(event) =>
                            updateCourse(course.id, 'room', event.target.value)
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <TextInput
                          value={course.instructor}
                          onChange={(event) =>
                            updateCourse(
                              course.id,
                              'instructor',
                              event.target.value,
                            )
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <TextInput
                          type="number"
                          value={course.credits}
                          onChange={(event) =>
                            updateCourse(
                              course.id,
                              'credits',
                              numberValue(event.target.value),
                            )
                          }
                          className="w-20"
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="destructive"
                          size="icon"
                          aria-label={`Delete ${course.name}`}
                          onClick={() => removeItem('courses', course.id)}
                        >
                          <Trash2 />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </section>
          </TabsContent>

          <TabsContent
            value="grades"
            className="grid gap-4 lg:grid-cols-[1fr_360px]"
          >
            <section className="pixel-panel p-4">
              <h2 className="mb-4 text-xl font-black">Gradebook</h2>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Assignment</TableHead>
                    <TableHead>Course</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Max</TableHead>
                    <TableHead>Weight</TableHead>
                    <TableHead>Counts</TableHead>
                    <TableHead>Weighted</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.assignments.map((assignment) => {
                    const weighted =
                      assignment.graded && assignment.maxScore > 0
                        ? (assignment.score / assignment.maxScore) *
                          assignment.weight
                        : 0;
                    return (
                      <TableRow key={assignment.id}>
                        <TableCell className="min-w-52 font-semibold">
                          {assignment.title || 'Untitled'}
                        </TableCell>
                        <TableCell>
                          {courseById.get(assignment.courseId)?.name ?? '-'}
                        </TableCell>
                        <TableCell>
                          <TextInput
                            type="number"
                            value={assignment.score}
                            onChange={(event) =>
                              updateAssignment(
                                assignment.id,
                                'score',
                                numberValue(event.target.value),
                              )
                            }
                            className="w-24"
                          />
                        </TableCell>
                        <TableCell>
                          <TextInput
                            type="number"
                            value={assignment.maxScore}
                            onChange={(event) =>
                              updateAssignment(
                                assignment.id,
                                'maxScore',
                                numberValue(event.target.value),
                              )
                            }
                            className="w-24"
                          />
                        </TableCell>
                        <TableCell>
                          <TextInput
                            type="number"
                            value={assignment.weight}
                            onChange={(event) =>
                              updateAssignment(
                                assignment.id,
                                'weight',
                                numberValue(event.target.value),
                              )
                            }
                            className="w-24"
                          />
                        </TableCell>
                        <TableCell>
                          <label className="flex items-center gap-2 text-sm font-semibold">
                            <input
                              type="checkbox"
                              checked={assignment.graded}
                              onChange={(event) =>
                                updateAssignment(
                                  assignment.id,
                                  'graded',
                                  event.target.checked,
                                )
                              }
                            />
                            Graded
                          </label>
                        </TableCell>
                        <TableCell className="font-black">
                          {oneDecimal(weighted)} pts
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </section>

            <aside className="pixel-panel grid content-start gap-4 p-4">
              <h2 className="text-xl font-black">Grade Summary</h2>
              <MiniGrade
                label="Weight received"
                value={`${oneDecimal(weightedPossible)}%`}
              />
              <MiniGrade
                label="Weighted points"
                value={`${oneDecimal(weightedEarned)}%`}
              />
              <MiniGrade
                label="Current average"
                value={weightedPossible > 0 ? percent(currentGrade) : '-'}
              />
              <div className="grid gap-2 border-2 border-violet-200 bg-white p-3">
                {data.courses.map((course) => {
                  const entries = data.assignments.filter(
                    (assignment) =>
                      assignment.courseId === course.id &&
                      assignment.graded &&
                      assignment.weight > 0 &&
                      assignment.maxScore > 0,
                  );
                  const possible = entries.reduce(
                    (sum, assignment) => sum + assignment.weight,
                    0,
                  );
                  const earned = entries.reduce(
                    (sum, assignment) =>
                      sum +
                      (assignment.score / assignment.maxScore) *
                        assignment.weight,
                    0,
                  );
                  return (
                    <div key={course.id} className="grid gap-1">
                      <div className="flex items-center justify-between gap-3 text-sm font-bold">
                        <span>{course.name}</span>
                        <span>
                          {possible > 0 ? percent(earned / possible) : '-'}
                        </span>
                      </div>
                      <Progress
                        value={possible > 0 ? (earned / possible) * 100 : 0}
                        className="h-2"
                      />
                    </div>
                  );
                })}
              </div>
            </aside>
          </TabsContent>

          <TabsContent
            value="schedule"
            className="grid gap-4 xl:grid-cols-[360px_1fr]"
          >
            <section className="pixel-panel grid gap-3 p-4">
              <h2 className="text-xl font-black">Add Block</h2>
              <Field label="Course">
                <CourseSelect
                  courses={data.courses}
                  value={scheduleDraft.courseId}
                  onChange={(value) =>
                    setScheduleDraft({ ...scheduleDraft, courseId: value })
                  }
                />
              </Field>
              <Field label="Day">
                <NativeSelect
                  value={scheduleDraft.day}
                  onChange={(event) =>
                    setScheduleDraft({
                      ...scheduleDraft,
                      day: event.target.value,
                    })
                  }
                >
                  {days.map((day) => (
                    <NativeSelectOption key={day} value={day}>
                      {day}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Start">
                  <TextInput
                    type="time"
                    value={scheduleDraft.start}
                    onChange={(event) =>
                      setScheduleDraft({
                        ...scheduleDraft,
                        start: event.target.value,
                      })
                    }
                  />
                </Field>
                <Field label="End">
                  <TextInput
                    type="time"
                    value={scheduleDraft.end}
                    onChange={(event) =>
                      setScheduleDraft({
                        ...scheduleDraft,
                        end: event.target.value,
                      })
                    }
                  />
                </Field>
              </div>
              <Field label="Location">
                <TextInput
                  value={scheduleDraft.location}
                  onChange={(event) =>
                    setScheduleDraft({
                      ...scheduleDraft,
                      location: event.target.value,
                    })
                  }
                  placeholder="Room"
                />
              </Field>
              <Button onClick={addSchedule}>
                <Plus data-icon="inline-start" />
                Add block
              </Button>
            </section>

            <section className="pixel-panel overflow-hidden p-4">
              <h2 className="mb-4 text-xl font-black">Weekly Schedule</h2>
              <div className="grid min-w-[760px] grid-cols-5 gap-3">
                {days.map((day) => (
                  <div key={day} className="grid content-start gap-2">
                    <div className="border-2 border-violet-300 bg-violet-100 p-2 text-center text-sm font-black">
                      {day}
                    </div>
                    {data.schedule
                      .filter((block) => block.day === day)
                      .sort((a, b) => a.start.localeCompare(b.start))
                      .map((block) => {
                        const course = courseById.get(block.courseId);
                        return (
                          <div
                            key={block.id}
                            className="group border-2 border-violet-200 bg-white p-2"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <p className="font-black">
                                  {course?.name ?? 'Course'}
                                </p>
                                <p className="text-xs text-violet-950/65">
                                  {block.start} - {block.end}
                                </p>
                                <p className="text-xs font-semibold">
                                  {block.location || course?.room || 'Location'}
                                </p>
                              </div>
                              <button
                                aria-label="Delete schedule block"
                                className="opacity-0 transition group-hover:opacity-100"
                                onClick={() => removeItem('schedule', block.id)}
                              >
                                <Trash2 className="size-4" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                ))}
              </div>
            </section>
          </TabsContent>

          <TabsContent
            value="notes"
            className="grid gap-4 lg:grid-cols-[360px_1fr]"
          >
            <section className="pixel-panel grid gap-3 p-4">
              <h2 className="text-xl font-black">New Note</h2>
              <Field label="Course">
                <CourseSelect
                  courses={data.courses}
                  value={noteDraft.courseId}
                  onChange={(value) =>
                    setNoteDraft({ ...noteDraft, courseId: value })
                  }
                />
              </Field>
              <Field label="Title">
                <TextInput
                  value={noteDraft.title}
                  onChange={(event) =>
                    setNoteDraft({ ...noteDraft, title: event.target.value })
                  }
                />
              </Field>
              <Field label="Note">
                <TextArea
                  value={noteDraft.body}
                  onChange={(event) =>
                    setNoteDraft({ ...noteDraft, body: event.target.value })
                  }
                />
              </Field>
              <label className="flex items-center gap-2 text-sm font-semibold">
                <input
                  type="checkbox"
                  checked={noteDraft.pinned}
                  onChange={(event) =>
                    setNoteDraft({ ...noteDraft, pinned: event.target.checked })
                  }
                />
                Pin note
              </label>
              <Button onClick={addNote}>
                <Plus data-icon="inline-start" />
                Add note
              </Button>
            </section>
            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {[...data.notes]
                .sort((a, b) => Number(b.pinned) - Number(a.pinned))
                .map((note) => (
                  <article key={note.id} className="pixel-panel grid gap-3 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-bold uppercase text-violet-700">
                          {courseById.get(note.courseId)?.name ?? 'General'}
                        </p>
                        <h3 className="text-lg font-black">
                          {note.title || 'Untitled note'}
                        </h3>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Delete note"
                        onClick={() => removeItem('notes', note.id)}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                    <p className="whitespace-pre-wrap text-sm leading-6 text-violet-950/75">
                      {note.body || 'No note text yet.'}
                    </p>
                  </article>
                ))}
            </section>
          </TabsContent>

          <TabsContent
            value="hours"
            className="grid gap-4 lg:grid-cols-[360px_1fr]"
          >
            <section className="pixel-panel grid gap-3 p-4">
              <h2 className="text-xl font-black">Log Hours</h2>
              <Field label="Event">
                <TextInput
                  value={hourDraft.event}
                  onChange={(event) =>
                    setHourDraft({ ...hourDraft, event: event.target.value })
                  }
                  placeholder="Event"
                />
              </Field>
              <Field label="Project">
                <TextInput
                  value={hourDraft.project}
                  onChange={(event) =>
                    setHourDraft({ ...hourDraft, project: event.target.value })
                  }
                  placeholder="Project"
                />
              </Field>
              <Field label="Date">
                <TextInput
                  type="date"
                  value={hourDraft.date}
                  onChange={(event) =>
                    setHourDraft({ ...hourDraft, date: event.target.value })
                  }
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Start">
                  <TextInput
                    type="time"
                    value={hourDraft.start}
                    onChange={(event) =>
                      setHourDraft({ ...hourDraft, start: event.target.value })
                    }
                  />
                </Field>
                <Field label="End">
                  <TextInput
                    type="time"
                    value={hourDraft.end}
                    onChange={(event) =>
                      setHourDraft({ ...hourDraft, end: event.target.value })
                    }
                  />
                </Field>
              </div>
              <Field label="Notes">
                <TextArea
                  value={hourDraft.notes}
                  onChange={(event) =>
                    setHourDraft({ ...hourDraft, notes: event.target.value })
                  }
                />
              </Field>
              <Button onClick={addHour}>
                <Plus data-icon="inline-start" />
                Add hours
              </Button>
            </section>
            <section className="pixel-panel p-4">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-black">Hours Tracker</h2>
                <span className="border-2 border-violet-300 bg-violet-100 px-3 py-1 text-sm font-black">
                  {oneDecimal(totalHours)} total
                </span>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Event</TableHead>
                    <TableHead>Project</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Hours</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.hours.map((hour) => (
                    <TableRow key={hour.id}>
                      <TableCell className="font-semibold">
                        {hour.event}
                      </TableCell>
                      <TableCell>{hour.project || '-'}</TableCell>
                      <TableCell>{hour.date}</TableCell>
                      <TableCell>
                        {hour.start} - {hour.end}
                      </TableCell>
                      <TableCell className="font-black">
                        {oneDecimal(hoursBetween(hour.start, hour.end))}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="destructive"
                          size="icon"
                          aria-label="Delete hours entry"
                          onClick={() => removeItem('hours', hour.id)}
                        >
                          <Trash2 />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </section>
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
}

function ClipboardIcon() {
  return <BarChart3 className="size-5" />;
}

function currentWeek(assignments: Assignment[]) {
  const upcoming = assignments
    .filter((assignment) => {
      const left = daysLeft(assignment.dueDate);
      return left !== null && left >= 0;
    })
    .sort(
      (a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime(),
    )[0];
  return upcoming?.week ?? 'Week 1';
}

function CourseSelect({
  courses,
  value,
  onChange,
}: {
  courses: Course[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <NativeSelect
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="w-full"
    >
      {courses.map((course) => (
        <NativeSelectOption key={course.id} value={course.id}>
          {course.name}
        </NativeSelectOption>
      ))}
    </NativeSelect>
  );
}

function AssignmentTable({
  assignments,
  courseById,
  updateAssignment,
  removeAssignment,
}: {
  assignments: Assignment[];
  courseById: Map<string, Course>;
  updateAssignment: <K extends keyof Assignment>(
    id: string,
    key: K,
    value: Assignment[K],
  ) => void;
  removeAssignment: (id: string) => void;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Course</TableHead>
          <TableHead>Assignment</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Priority</TableHead>
          <TableHead>Week</TableHead>
          <TableHead>Due</TableHead>
          <TableHead>Left</TableHead>
          <TableHead>Done</TableHead>
          <TableHead />
        </TableRow>
      </TableHeader>
      <TableBody>
        {assignments.map((assignment) => {
          const left = daysLeft(assignment.dueDate);
          const overdue =
            left !== null &&
            left < 0 &&
            assignment.status !== 'Done' &&
            !assignment.submitted;
          return (
            <TableRow
              key={assignment.id}
              className={overdue ? 'bg-fuchsia-50' : ''}
            >
              <TableCell>
                {courseById.get(assignment.courseId)?.name ?? 'Course'}
              </TableCell>
              <TableCell className="min-w-56">
                <TextInput
                  value={assignment.title}
                  onChange={(event) =>
                    updateAssignment(assignment.id, 'title', event.target.value)
                  }
                  className="w-full"
                />
              </TableCell>
              <TableCell>
                <NativeSelect
                  value={assignment.type}
                  onChange={(event) =>
                    updateAssignment(
                      assignment.id,
                      'type',
                      event.target.value as AssignmentType,
                    )
                  }
                  className="w-36"
                >
                  {assignmentTypes.map((type) => (
                    <NativeSelectOption key={type} value={type}>
                      {type}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </TableCell>
              <TableCell>
                <NativeSelect
                  value={assignment.status}
                  onChange={(event) =>
                    updateAssignment(
                      assignment.id,
                      'status',
                      event.target.value as Status,
                    )
                  }
                  className="w-36"
                >
                  {statuses.map((status) => (
                    <NativeSelectOption key={status} value={status}>
                      {status}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </TableCell>
              <TableCell>
                <NativeSelect
                  value={assignment.priority}
                  onChange={(event) =>
                    updateAssignment(
                      assignment.id,
                      'priority',
                      event.target.value as Priority,
                    )
                  }
                  className="w-32"
                >
                  {priorities.map((priority) => (
                    <NativeSelectOption key={priority} value={priority}>
                      {priority}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </TableCell>
              <TableCell>
                <NativeSelect
                  value={assignment.week}
                  onChange={(event) =>
                    updateAssignment(assignment.id, 'week', event.target.value)
                  }
                  className="w-32"
                >
                  {weeks.map((week) => (
                    <NativeSelectOption key={week} value={week}>
                      {week}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </TableCell>
              <TableCell>
                <TextInput
                  type="date"
                  value={assignment.dueDate}
                  onChange={(event) =>
                    updateAssignment(
                      assignment.id,
                      'dueDate',
                      event.target.value,
                    )
                  }
                  className="w-40"
                />
              </TableCell>
              <TableCell
                className={`font-black ${overdue ? 'text-fuchsia-700' : ''}`}
              >
                {left === null
                  ? '-'
                  : left < 0
                    ? `${Math.abs(left)} late`
                    : `${left} days`}
              </TableCell>
              <TableCell>
                <label className="flex items-center gap-2 text-sm font-semibold">
                  <input
                    type="checkbox"
                    checked={
                      assignment.submitted || assignment.status === 'Done'
                    }
                    onChange={(event) => {
                      updateAssignment(
                        assignment.id,
                        'submitted',
                        event.target.checked,
                      );
                      updateAssignment(
                        assignment.id,
                        'status',
                        event.target.checked ? 'Done' : 'In Progress',
                      );
                    }}
                  />
                  <Check className="size-4" />
                </label>
              </TableCell>
              <TableCell>
                <Button
                  variant="destructive"
                  size="icon"
                  aria-label={`Delete ${assignment.title || 'assignment'}`}
                  onClick={() => removeAssignment(assignment.id)}
                >
                  <Trash2 />
                </Button>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

function MiniGrade({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-2 border-violet-200 bg-white p-3">
      <p className="text-xs font-bold uppercase text-violet-700">{label}</p>
      <p className="mt-1 text-2xl font-black">{value}</p>
    </div>
  );
}
