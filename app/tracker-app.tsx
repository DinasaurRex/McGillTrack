'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import {
  BarChart3,
  BookOpen,
  CalendarDays,
  Check,
  Clock3,
  Download,
  GraduationCap,
  LinkIcon,
  ListChecks,
  Plus,
  RotateCcw,
  ShoppingCart,
  Trash2,
  Upload,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { supabase, supabaseConfigured } from '@/lib/supabase';
import {
  NativeSelect,
  NativeSelectOption,
} from '@/components/ui/native-select';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent } from '@/components/ui/tabs';
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
  email?: string;
  section?: string;
  teams?: string;
  extension?: string;
  weeklyPonderation?: string;
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

type OfficeHourBlock = {
  id: string;
  courseId: string;
  day: string;
  start: string;
  end: string;
  teacher: string;
  office: string;
  notes: string;
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

type WebsiteEntry = {
  id: string;
  label: string;
  url: string;
  courseId: string;
};

type ShoppingItem = {
  id: string;
  item: string;
  courseId: string;
  done: boolean;
};

type HomeworkItem = {
  id: string;
  task: string;
  courseId: string;
  done: boolean;
};

type TodoItem = {
  id: string;
  task: string;
  done: boolean;
};

type TrackerTab =
  | 'overview'
  | 'assignments'
  | 'courses'
  | 'grades'
  | 'schedule'
  | 'office-hours'
  | 'lists'
  | 'notes'
  | 'hours';

const trackerTabs: { value: TrackerTab; label: string; href: string }[] = [
  { value: 'overview', label: 'Overview', href: '/' },
  { value: 'assignments', label: 'Assignments', href: '/assignments' },
  { value: 'courses', label: 'Courses', href: '/courses' },
  { value: 'grades', label: 'Grades', href: '/grades' },
  { value: 'schedule', label: 'Schedule', href: '/schedule' },
  { value: 'office-hours', label: 'Office Hours', href: '/office-hours' },
  { value: 'lists', label: 'Lists', href: '/lists' },
  { value: 'notes', label: 'Notes', href: '/notes' },
  { value: 'hours', label: 'Hours', href: '/hours' },
];

const tabFromPathname = (pathname: string): TrackerTab =>
  trackerTabs.find((tab) => tab.href === pathname)?.value ?? 'overview';

type TrackerData = {
  courses: Course[];
  assignments: Assignment[];
  schedule: ScheduleBlock[];
  officeHours: OfficeHourBlock[];
  notes: NoteEntry[];
  hours: HourEntry[];
  websites: WebsiteEntry[];
  shopping: ShoppingItem[];
  homework: HomeworkItem[];
  todos: TodoItem[];
};

type CloudStatus =
  | 'local'
  | 'loading'
  | 'saving'
  | 'saved'
  | 'setup'
  | 'offline';

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
const courseColors = ['#dbeafe', '#bfdbfe', '#eff6ff', '#fef3c7', '#e0f2fe'];
const storageKey = 'mcgilltrack-template-v1';
const cloudSaveDelay = 1200;

const cloudErrorMessage = (message: string) =>
  message.includes('tracker_profiles') || message.includes('schema cache')
    ? 'Cloud table missing. Run supabase/tracker_profiles.sql once.'
    : message.toLowerCase().includes('failed to fetch')
      ? 'Cloud connection failed. Local save still works.'
      : message;

const cloudStatusFromError = (message: string): CloudStatus =>
  message.includes('tracker_profiles') || message.includes('schema cache')
    ? 'setup'
    : 'offline';

const withTimeout = async <T,>(
  promise: PromiseLike<T>,
  message = 'Cloud request timed out. Local save still works.',
): Promise<T> => {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const timer = new Promise<never>((_resolve, reject) => {
    timeout = setTimeout(() => reject(new Error(message)), 6000);
  });

  try {
    return await Promise.race([promise, timer]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
};

const makeId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

const todayIso = () => {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  return new Date(now.getTime() - offset * 60000).toISOString().slice(0, 10);
};

const initialTemplateDate = '2026-09-01';

const addDays = (daysToAdd: number, fromDate = todayIso()) => {
  const date = new Date(`${fromDate}T00:00:00`);
  date.setDate(date.getDate() + daysToAdd);
  return date.toISOString().slice(0, 10);
};

const createDefaultData = (baseDate = initialTemplateDate): TrackerData => ({
  courses: [
    {
      id: 'course-1',
      name: 'Course 1',
      code: 'COUR 101',
      room: 'Room A',
      instructor: '',
      email: '',
      section: '',
      teams: '',
      extension: '',
      weeklyPonderation: '',
      credits: 3,
      color: '#dbeafe',
    },
    {
      id: 'course-2',
      name: 'Course 2',
      code: 'COUR 102',
      room: 'Room B',
      instructor: '',
      email: '',
      section: '',
      teams: '',
      extension: '',
      weeklyPonderation: '',
      credits: 3,
      color: '#fef3c7',
    },
    {
      id: 'course-3',
      name: 'Course 3',
      code: 'COUR 103',
      room: 'Room C',
      instructor: '',
      email: '',
      section: '',
      teams: '',
      extension: '',
      weeklyPonderation: '',
      credits: 3,
      color: '#dbeafe',
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
      dueDate: addDays(3, baseDate),
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
      dueDate: addDays(8, baseDate),
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
  officeHours: [
    {
      id: 'office-1',
      courseId: 'course-1',
      day: 'Tuesday',
      start: '11:00',
      end: '12:00',
      teacher: 'Instructor',
      office: 'Office A',
      notes: '',
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
  websites: [
    {
      id: 'website-1',
      label: 'Course portal',
      url: 'https://example.com',
      courseId: 'course-1',
    },
  ],
  shopping: [
    {
      id: 'shopping-1',
      item: 'Notebook',
      courseId: 'course-1',
      done: false,
    },
  ],
  homework: [
    {
      id: 'homework-1',
      task: 'Review lecture notes',
      courseId: 'course-1',
      done: false,
    },
  ],
  todos: [
    {
      id: 'todo-1',
      task: 'Check upcoming deadlines',
      done: false,
    },
  ],
});

const defaultData = createDefaultData();

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

const blankOfficeHour = (courseId: string): OfficeHourBlock => ({
  id: makeId(),
  courseId,
  day: 'Monday',
  start: '10:00',
  end: '11:00',
  teacher: '',
  office: '',
  notes: '',
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

const blankWebsite = (courseId: string): WebsiteEntry => ({
  id: makeId(),
  label: '',
  url: '',
  courseId,
});

const blankShoppingItem = (courseId: string): ShoppingItem => ({
  id: makeId(),
  item: '',
  courseId,
  done: false,
});

const blankHomeworkItem = (courseId: string): HomeworkItem => ({
  id: makeId(),
  task: '',
  courseId,
  done: false,
});

const blankTodoItem = (): TodoItem => ({
  id: makeId(),
  task: '',
  done: false,
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

const normalizeData = (incoming: Partial<TrackerData>): TrackerData => ({
  courses: incoming.courses ?? defaultData.courses,
  assignments: incoming.assignments ?? defaultData.assignments,
  schedule: incoming.schedule ?? defaultData.schedule,
  officeHours: incoming.officeHours ?? defaultData.officeHours,
  notes: incoming.notes ?? defaultData.notes,
  hours: incoming.hours ?? defaultData.hours,
  websites: incoming.websites ?? defaultData.websites,
  shopping: incoming.shopping ?? defaultData.shopping,
  homework: incoming.homework ?? defaultData.homework,
  todos: incoming.todos ?? defaultData.todos,
});

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-1.5 text-xs font-semibold uppercase text-blue-950/65">
      {label}
      {children}
    </label>
  );
}

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`h-9 min-w-0 border-2 border-blue-200 bg-white px-3 text-sm shadow-[3px_3px_0_#fef3c7] outline-none transition focus:border-blue-500 ${props.className ?? ''}`}
    />
  );
}

function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`min-h-24 min-w-0 resize-y border-2 border-blue-200 bg-white px-3 py-2 text-sm shadow-[3px_3px_0_#fef3c7] outline-none transition focus:border-blue-500 ${props.className ?? ''}`}
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
      <div className="grid size-10 place-items-center border-2 border-blue-300 bg-blue-100 text-blue-950/70">
        {icon}
      </div>
      <div>
        <p className="text-xs font-semibold uppercase text-blue-950/60">
          {label}
        </p>
        <p className="mt-1 text-2xl font-black text-blue-950">{value}</p>
      </div>
    </div>
  );
}

export default function Home() {
  const pathname = usePathname();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [data, setData] = useState<TrackerData>(defaultData);
  const dataRef = useRef(defaultData);
  const cloudSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cloudLoaded = useRef(false);
  const syncingUserId = useRef<string | null>(null);
  const [activeCourse, setActiveCourse] = useState(defaultData.courses[0].id);
  const activeTab = tabFromPathname(pathname);
  const [storageReady, setStorageReady] = useState(false);
  const [dateLabel, setDateLabel] = useState('Today');
  const [user, setUser] = useState<User | null>(null);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authMessage, setAuthMessage] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [cloudStatus, setCloudStatus] = useState<CloudStatus>('local');
  const [courseDraft, setCourseDraft] = useState<Course>({
    id: makeId(),
    name: '',
    code: '',
    room: '',
    instructor: '',
    email: '',
    section: '',
    teams: '',
    extension: '',
    weeklyPonderation: '',
    credits: 3,
    color: courseColors[0],
  });
  const [assignmentDraft, setAssignmentDraft] = useState<Assignment>(
    blankAssignment(defaultData.courses[0].id),
  );
  const [scheduleDraft, setScheduleDraft] = useState<ScheduleBlock>(
    blankSchedule(defaultData.courses[0].id),
  );
  const [officeHourDraft, setOfficeHourDraft] = useState<OfficeHourBlock>(
    blankOfficeHour(defaultData.courses[0].id),
  );
  const [noteDraft, setNoteDraft] = useState<NoteEntry>(
    blankNote(defaultData.courses[0].id),
  );
  const [hourDraft, setHourDraft] = useState<HourEntry>(blankHour());
  const [websiteDraft, setWebsiteDraft] = useState<WebsiteEntry>(
    blankWebsite(defaultData.courses[0].id),
  );
  const [shoppingDraft, setShoppingDraft] = useState<ShoppingItem>(
    blankShoppingItem(defaultData.courses[0].id),
  );
  const [homeworkDraft, setHomeworkDraft] = useState<HomeworkItem>(
    blankHomeworkItem(defaultData.courses[0].id),
  );
  const [todoDraft, setTodoDraft] = useState<TodoItem>(blankTodoItem());

  useEffect(() => {
    queueMicrotask(() => {
      let hydrated = false;
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        try {
          const parsed = normalizeData(
            JSON.parse(saved) as Partial<TrackerData>,
          );
          hydrated = true;
          setData(parsed);
          setActiveCourse(parsed.courses[0]?.id ?? '');
          setAssignmentDraft(blankAssignment(parsed.courses[0]?.id ?? ''));
          setScheduleDraft(blankSchedule(parsed.courses[0]?.id ?? ''));
          setOfficeHourDraft(blankOfficeHour(parsed.courses[0]?.id ?? ''));
          setNoteDraft(blankNote(parsed.courses[0]?.id ?? ''));
          setWebsiteDraft(blankWebsite(parsed.courses[0]?.id ?? ''));
          setShoppingDraft(blankShoppingItem(parsed.courses[0]?.id ?? ''));
          setHomeworkDraft(blankHomeworkItem(parsed.courses[0]?.id ?? ''));
          setTodoDraft(blankTodoItem());
        } catch {
          localStorage.removeItem(storageKey);
        }
      }
      if (!hydrated) {
        const currentDefaults = createDefaultData(todayIso());
        const firstCourseId = currentDefaults.courses[0]?.id ?? '';
        setData(currentDefaults);
        setActiveCourse(firstCourseId);
        setAssignmentDraft(blankAssignment(firstCourseId));
        setScheduleDraft(blankSchedule(firstCourseId));
        setOfficeHourDraft(blankOfficeHour(firstCourseId));
        setNoteDraft(blankNote(firstCourseId));
        setWebsiteDraft(blankWebsite(firstCourseId));
        setShoppingDraft(blankShoppingItem(firstCourseId));
        setHomeworkDraft(blankHomeworkItem(firstCourseId));
        setTodoDraft(blankTodoItem());
      }
      setDateLabel(
        new Date().toLocaleDateString(undefined, {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
        }),
      );
      setStorageReady(true);
    });
  }, []);

  useEffect(() => {
    if (!storageReady) return;
    localStorage.setItem(storageKey, JSON.stringify(data));
  }, [data, storageReady]);

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  const saveCloudData = useCallback(
    async (currentUser = user, trackerData = dataRef.current) => {
      if (!supabase || !currentUser) return false;
      setCloudStatus('saving');
      setAuthMessage('');

      try {
        const { error } = await withTimeout(
          supabase.from('tracker_profiles').upsert(
            {
              user_id: currentUser.id,
              data: trackerData,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'user_id' },
          ),
        );

        if (error) {
          setCloudStatus(cloudStatusFromError(error.message));
          setAuthMessage(cloudErrorMessage(error.message));
          return false;
        }

        setCloudStatus('saved');
        return true;
      } catch (error) {
        setCloudStatus('offline');
        setAuthMessage(
          cloudErrorMessage(
            error instanceof Error ? error.message : 'Cloud save failed.',
          ),
        );
        return false;
      }
    },
    [user],
  );

  const loadCloudData = useCallback(
    async (currentUser = user) => {
      if (!supabase || !currentUser) return;
      if (syncingUserId.current === currentUser.id) return;

      syncingUserId.current = currentUser.id;
      setCloudStatus('loading');
      setAuthMessage('');

      try {
        const { data: row, error } = await withTimeout(
          supabase
            .from('tracker_profiles')
            .select('data')
            .eq('user_id', currentUser.id)
            .maybeSingle(),
        );

        if (error) {
          setCloudStatus(cloudStatusFromError(error.message));
          setAuthMessage(cloudErrorMessage(error.message));
          return;
        }

        cloudLoaded.current = true;

        if (!row?.data) {
          await saveCloudData(currentUser, dataRef.current);
          return;
        }

        const parsed = normalizeData(row.data as Partial<TrackerData>);
        setData(parsed);
        setActiveCourse(parsed.courses[0]?.id ?? '');
        setAssignmentDraft(blankAssignment(parsed.courses[0]?.id ?? ''));
        setScheduleDraft(blankSchedule(parsed.courses[0]?.id ?? ''));
        setOfficeHourDraft(blankOfficeHour(parsed.courses[0]?.id ?? ''));
        setNoteDraft(blankNote(parsed.courses[0]?.id ?? ''));
        setWebsiteDraft(blankWebsite(parsed.courses[0]?.id ?? ''));
        setShoppingDraft(blankShoppingItem(parsed.courses[0]?.id ?? ''));
        setHomeworkDraft(blankHomeworkItem(parsed.courses[0]?.id ?? ''));
        setTodoDraft(blankTodoItem());
        setCloudStatus('saved');
      } catch (error) {
        setCloudStatus('offline');
        setAuthMessage(
          cloudErrorMessage(
            error instanceof Error ? error.message : 'Cloud load failed.',
          ),
        );
      } finally {
        syncingUserId.current = null;
      }
    },
    [saveCloudData, user],
  );

  useEffect(() => {
    if (!supabase || !user || !cloudLoaded.current || !storageReady) return;
    if (cloudSaveTimer.current) clearTimeout(cloudSaveTimer.current);

    cloudSaveTimer.current = setTimeout(() => {
      void saveCloudData(user, data);
    }, cloudSaveDelay);

    return () => {
      if (cloudSaveTimer.current) clearTimeout(cloudSaveTimer.current);
    };
  }, [data, saveCloudData, storageReady, user]);

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
  const totalCredits = data.courses.reduce(
    (sum, course) => sum + course.credits,
    0,
  );
  const completionRate =
    assignmentMetrics.total > 0
      ? assignmentMetrics.done / assignmentMetrics.total
      : 0;
  const cloudStatusLabel = !supabaseConfigured
    ? 'setup'
    : user
      ? cloudStatus
      : cloudStatus === 'offline'
        ? 'offline'
        : 'local';

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

  const updateWebsite = <K extends keyof WebsiteEntry>(
    id: string,
    key: K,
    value: WebsiteEntry[K],
  ) => {
    setData((current) => ({
      ...current,
      websites: current.websites.map((website) =>
        website.id === id ? { ...website, [key]: value } : website,
      ),
    }));
  };

  const updateShopping = <K extends keyof ShoppingItem>(
    id: string,
    key: K,
    value: ShoppingItem[K],
  ) => {
    setData((current) => ({
      ...current,
      shopping: current.shopping.map((item) =>
        item.id === id ? { ...item, [key]: value } : item,
      ),
    }));
  };

  const updateHomework = <K extends keyof HomeworkItem>(
    id: string,
    key: K,
    value: HomeworkItem[K],
  ) => {
    setData((current) => ({
      ...current,
      homework: current.homework.map((item) =>
        item.id === id ? { ...item, [key]: value } : item,
      ),
    }));
  };

  const updateTodo = <K extends keyof TodoItem>(
    id: string,
    key: K,
    value: TodoItem[K],
  ) => {
    setData((current) => ({
      ...current,
      todos: current.todos.map((item) =>
        item.id === id ? { ...item, [key]: value } : item,
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
      email: '',
      section: '',
      teams: '',
      extension: '',
      weeklyPonderation: '',
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

  const addOfficeHour = () => {
    setData((current) => ({
      ...current,
      officeHours: [
        ...current.officeHours,
        { ...officeHourDraft, id: makeId() },
      ],
    }));
    setOfficeHourDraft(blankOfficeHour(officeHourDraft.courseId));
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

  const addWebsite = () => {
    if (!websiteDraft.label.trim() && !websiteDraft.url.trim()) return;
    setData((current) => ({
      ...current,
      websites: [{ ...websiteDraft, id: makeId() }, ...current.websites],
    }));
    setWebsiteDraft(blankWebsite(websiteDraft.courseId));
  };

  const addShoppingItem = () => {
    if (!shoppingDraft.item.trim()) return;
    setData((current) => ({
      ...current,
      shopping: [{ ...shoppingDraft, id: makeId() }, ...current.shopping],
    }));
    setShoppingDraft(blankShoppingItem(shoppingDraft.courseId));
  };

  const addHomeworkItem = () => {
    if (!homeworkDraft.task.trim()) return;
    setData((current) => ({
      ...current,
      homework: [{ ...homeworkDraft, id: makeId() }, ...current.homework],
    }));
    setHomeworkDraft(blankHomeworkItem(homeworkDraft.courseId));
  };

  const addTodoItem = () => {
    if (!todoDraft.task.trim()) return;
    setData((current) => ({
      ...current,
      todos: [{ ...todoDraft, id: makeId() }, ...current.todos],
    }));
    setTodoDraft(blankTodoItem());
  };

  const removeItem = (collection: keyof TrackerData, id: string) => {
    setData((current) => ({
      ...current,
      [collection]: current[collection].filter((item) => item.id !== id),
    }));
  };

  const resetTemplate = () => {
    const currentDefaults = createDefaultData(todayIso());
    setData(currentDefaults);
    setActiveCourse(currentDefaults.courses[0]?.id ?? '');
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
        const parsed = normalizeData(
          JSON.parse(contents) as Partial<TrackerData>,
        );
        setData(parsed);
      } catch {
        alert('That file could not be imported.');
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  const handleAuth = async (mode: 'sign-in' | 'sign-up') => {
    if (!supabase) {
      setAuthMessage('Supabase is not configured.');
      return;
    }
    if (!authEmail.trim() || !authPassword) {
      setAuthMessage('Enter an email and password.');
      return;
    }

    setAuthBusy(true);
    setAuthMessage(
      mode === 'sign-in' ? 'Signing in...' : 'Creating account...',
    );

    try {
      const credentials = {
        email: authEmail.trim(),
        password: authPassword,
      };
      const { data: authData, error } = await withTimeout(
        mode === 'sign-in'
          ? supabase.auth.signInWithPassword(credentials)
          : supabase.auth.signUp(credentials),
        'Auth request timed out.',
      );

      if (error) {
        setAuthMessage(error.message);
        return;
      }

      const currentUser = authData.user;
      if (currentUser) {
        setUser(currentUser);
        cloudLoaded.current = false;
        setAuthPassword('');
        await loadCloudData(currentUser);
      }

      setAuthMessage(
        mode === 'sign-up'
          ? 'Account created. Check email if needed.'
          : 'Signed in.',
      );
    } catch (error) {
      setAuthMessage(
        error instanceof Error ? error.message : 'Auth request failed.',
      );
    } finally {
      setAuthBusy(false);
    }
  };

  const signOut = async () => {
    if (!supabase) return;
    setAuthBusy(true);
    setAuthMessage('');
    cloudLoaded.current = false;
    setUser(null);
    setCloudStatus('local');

    try {
      await withTimeout(supabase.auth.signOut(), 'Sign out timed out.');
    } catch (error) {
      setAuthMessage(
        error instanceof Error ? error.message : 'Sign out failed.',
      );
    } finally {
      setAuthBusy(false);
    }
  };

  return (
    <main className="min-h-screen bg-[var(--background)] text-blue-950">
      <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-5 px-4 py-4 sm:px-6 lg:px-8">
        <header className="pixel-panel grid gap-5 p-4 xl:grid-cols-[1fr_auto_auto] xl:items-center">
          <div className="flex min-w-0 items-center gap-4">
            <div className="grid size-12 shrink-0 place-items-center border-2 border-blue-300 bg-blue-100 shadow-[4px_4px_0_#dbeafe]">
              <BookOpen className="size-6" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase text-blue-950/70">
                {dateLabel}
              </p>
              <h1 className="text-3xl font-black tracking-normal sm:text-4xl">
                McGillTrack
              </h1>
            </div>
          </div>
          <div className="flex flex-wrap justify-start gap-2 xl:justify-end">
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
          <div className="grid min-h-[112px] w-full max-w-[420px] gap-2 border-2 border-blue-300 bg-white/75 p-3 shadow-[3px_3px_0_#bfdbfe] xl:w-[420px]">
            <div className="flex items-center justify-between gap-3">
              <p className="truncate text-xs font-black uppercase text-blue-950">
                {user?.email ?? 'Cloud Account'}
              </p>
              <span className="min-w-20 border border-blue-300 bg-blue-50 px-2 py-0.5 text-center text-[11px] font-black uppercase text-blue-950/70">
                {cloudStatusLabel}
              </span>
            </div>
            {supabaseConfigured && user ? (
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  type="button"
                  variant="outline"
                  onClick={() => void loadCloudData()}
                  disabled={authBusy || cloudStatus === 'loading'}
                >
                  Load
                </Button>
                <Button
                  size="sm"
                  type="button"
                  variant="outline"
                  onClick={() => void saveCloudData()}
                  disabled={authBusy || cloudStatus === 'saving'}
                >
                  Save
                </Button>
                <Button
                  size="sm"
                  type="button"
                  variant="secondary"
                  onClick={() => void signOut()}
                  disabled={authBusy}
                >
                  Sign out
                </Button>
              </div>
            ) : supabaseConfigured ? (
              <form
                className="grid gap-2 sm:grid-cols-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  void handleAuth('sign-in');
                }}
              >
                <TextInput
                  aria-label="Email"
                  type="email"
                  placeholder="email"
                  value={authEmail}
                  onChange={(event) => setAuthEmail(event.target.value)}
                  autoComplete="email"
                />
                <TextInput
                  aria-label="Password"
                  type="password"
                  placeholder="password"
                  value={authPassword}
                  onChange={(event) => setAuthPassword(event.target.value)}
                  autoComplete="current-password"
                />
                <Button size="sm" type="submit" disabled={authBusy}>
                  {authBusy ? 'Working...' : 'Sign in'}
                </Button>
                <Button
                  size="sm"
                  type="button"
                  variant="outline"
                  onClick={() => void handleAuth('sign-up')}
                  disabled={authBusy}
                >
                  Sign up
                </Button>
              </form>
            ) : (
              <p className="text-xs font-bold text-blue-950/70">
                Add Supabase env vars.
              </p>
            )}
            <p className="min-h-4 text-xs font-bold text-blue-950/70">
              {authMessage || (user ? 'Signed in.' : 'Local save is on.')}
            </p>
          </div>
        </header>

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
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
          <MiniStat
            label="Credits"
            value={String(totalCredits)}
            icon={<BookOpen className="size-5" />}
          />
        </section>

        <Tabs value={activeTab} className="gap-4">
          <div className="overflow-x-auto">
            <nav className="pixel-tabs inline-flex h-auto min-w-max items-center justify-center rounded-lg bg-blue-100 p-1 text-muted-foreground">
              {trackerTabs.map((tab) => (
                <Link
                  key={tab.value}
                  href={tab.href}
                  data-slot="tabs-trigger"
                  data-active={activeTab === tab.value ? '' : undefined}
                  aria-current={activeTab === tab.value ? 'page' : undefined}
                  className="relative inline-flex items-center justify-center gap-1.5 border border-transparent px-1.5 py-0.5 text-sm font-medium whitespace-nowrap text-foreground/60 transition-all hover:text-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1 focus-visible:outline-ring data-active:text-foreground"
                >
                  {tab.label}
                </Link>
              ))}
            </nav>
          </div>

          <TabsContent
            value="overview"
            className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]"
          >
            <section className="pixel-panel p-4">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-black">Assignment Board</h2>
                  <p className="text-sm text-blue-950/65">
                    Live counts, due dates, and progress from your tracker rows.
                  </p>
                </div>
                <div className="text-right text-sm font-bold text-blue-950/70">
                  {percent(completionRate)}
                </div>
              </div>
              <Progress
                value={completionRate * 100}
                className="mb-5 h-3 border border-blue-300 bg-blue-50"
              />
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {statuses.map((status) => (
                  <div
                    key={status}
                    className="border-2 border-blue-200 bg-white p-3"
                  >
                    <p className="text-xs font-bold uppercase text-blue-950/70">
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
                <div className="border-2 border-blue-200 bg-blue-50 p-3">
                  <p className="text-xs font-bold uppercase text-blue-950/70">
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
                          ? 'border-blue-400 bg-blue-100'
                          : 'border-blue-200 bg-white'
                      }`}
                      onClick={() => setActiveCourse(course.id)}
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className="size-4 border-2 border-blue-400"
                          style={{ background: course.color }}
                        />
                        <span className="font-black">{course.name}</span>
                      </div>
                      <span className="text-sm text-blue-950/65">
                        {course.code || 'No code'} - {course.room || 'No room'}
                      </span>
                      <Progress
                        value={
                          courseAssignments.length > 0
                            ? (done / courseAssignments.length) * 100
                            : 0
                        }
                        className="h-2 bg-blue-50"
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
              <Field label="Email">
                <TextInput
                  type="email"
                  value={courseDraft.email ?? ''}
                  onChange={(event) =>
                    setCourseDraft({
                      ...courseDraft,
                      email: event.target.value,
                    })
                  }
                  placeholder="teacher@email.com"
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Section">
                  <TextInput
                    value={courseDraft.section ?? ''}
                    onChange={(event) =>
                      setCourseDraft({
                        ...courseDraft,
                        section: event.target.value,
                      })
                    }
                    placeholder="001"
                  />
                </Field>
                <Field label="Extension">
                  <TextInput
                    value={courseDraft.extension ?? ''}
                    onChange={(event) =>
                      setCourseDraft({
                        ...courseDraft,
                        extension: event.target.value,
                      })
                    }
                    placeholder="Ext."
                  />
                </Field>
              </div>
              <Field label="Teams">
                <TextInput
                  value={courseDraft.teams ?? ''}
                  onChange={(event) =>
                    setCourseDraft({
                      ...courseDraft,
                      teams: event.target.value,
                    })
                  }
                  placeholder="Teams channel"
                />
              </Field>
              <Field label="Weekly">
                <TextInput
                  value={courseDraft.weeklyPonderation ?? ''}
                  onChange={(event) =>
                    setCourseDraft({
                      ...courseDraft,
                      weeklyPonderation: event.target.value,
                    })
                  }
                  placeholder="Lecture / lab split"
                />
              </Field>
              <div className="flex flex-wrap gap-2">
                {courseColors.map((color) => (
                  <button
                    key={color}
                    aria-label={`Use color ${color}`}
                    className={`size-8 border-2 ${
                      courseDraft.color === color
                        ? 'border-blue-700'
                        : 'border-blue-200'
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

            <section className="pixel-panel overflow-x-auto p-4">
              <Table className="min-w-[1280px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Course</TableHead>
                    <TableHead>Color</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Room</TableHead>
                    <TableHead>Instructor</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Ext.</TableHead>
                    <TableHead>Section</TableHead>
                    <TableHead>Teams</TableHead>
                    <TableHead>Weekly</TableHead>
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
                        <div className="flex w-44 flex-wrap gap-1.5">
                          {courseColors.map((color) => (
                            <button
                              key={`${course.id}-${color}`}
                              type="button"
                              aria-label={`Set ${course.name || 'course'} color`}
                              className={`size-7 border-2 ${
                                course.color === color
                                  ? 'border-blue-500'
                                  : 'border-blue-200'
                              }`}
                              style={{ background: color }}
                              onClick={() =>
                                updateCourse(course.id, 'color', color)
                              }
                            />
                          ))}
                        </div>
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
                          type="email"
                          value={course.email ?? ''}
                          onChange={(event) =>
                            updateCourse(course.id, 'email', event.target.value)
                          }
                          className="w-52"
                        />
                      </TableCell>
                      <TableCell>
                        <TextInput
                          value={course.extension ?? ''}
                          onChange={(event) =>
                            updateCourse(
                              course.id,
                              'extension',
                              event.target.value,
                            )
                          }
                          className="w-24"
                        />
                      </TableCell>
                      <TableCell>
                        <TextInput
                          value={course.section ?? ''}
                          onChange={(event) =>
                            updateCourse(
                              course.id,
                              'section',
                              event.target.value,
                            )
                          }
                          className="w-28"
                        />
                      </TableCell>
                      <TableCell>
                        <TextInput
                          value={course.teams ?? ''}
                          onChange={(event) =>
                            updateCourse(course.id, 'teams', event.target.value)
                          }
                          className="w-44"
                        />
                      </TableCell>
                      <TableCell>
                        <TextInput
                          value={course.weeklyPonderation ?? ''}
                          onChange={(event) =>
                            updateCourse(
                              course.id,
                              'weeklyPonderation',
                              event.target.value,
                            )
                          }
                          className="w-40"
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
              <div className="grid gap-2 border-2 border-blue-200 bg-white p-3">
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

            <section className="pixel-panel overflow-x-auto p-4">
              <h2 className="mb-4 text-xl font-black">Weekly Schedule</h2>
              <div className="grid min-w-[760px] grid-cols-5 gap-3">
                {days.map((day) => (
                  <div key={day} className="grid content-start gap-2">
                    <div className="border-2 border-blue-300 bg-amber-50 p-2 text-center text-sm font-black">
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
                            className="group border-2 border-blue-200 bg-white p-2"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <p className="font-black">
                                  {course?.name ?? 'Course'}
                                </p>
                                <p className="text-xs text-blue-950/65">
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
            value="office-hours"
            className="grid gap-4 xl:grid-cols-[360px_1fr]"
          >
            <section className="pixel-panel grid gap-3 p-4">
              <h2 className="text-xl font-black">Add Office Hours</h2>
              <Field label="Course">
                <CourseSelect
                  courses={data.courses}
                  value={officeHourDraft.courseId}
                  onChange={(value) =>
                    setOfficeHourDraft({
                      ...officeHourDraft,
                      courseId: value,
                      teacher: courseById.get(value)?.instructor || '',
                    })
                  }
                />
              </Field>
              <Field label="Teacher">
                <TextInput
                  value={officeHourDraft.teacher}
                  onChange={(event) =>
                    setOfficeHourDraft({
                      ...officeHourDraft,
                      teacher: event.target.value,
                    })
                  }
                  placeholder="Instructor or TA"
                />
              </Field>
              <Field label="Office">
                <TextInput
                  value={officeHourDraft.office}
                  onChange={(event) =>
                    setOfficeHourDraft({
                      ...officeHourDraft,
                      office: event.target.value,
                    })
                  }
                  placeholder="Office, building, or Zoom link"
                />
              </Field>
              <Field label="Day">
                <NativeSelect
                  value={officeHourDraft.day}
                  onChange={(event) =>
                    setOfficeHourDraft({
                      ...officeHourDraft,
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
                    value={officeHourDraft.start}
                    onChange={(event) =>
                      setOfficeHourDraft({
                        ...officeHourDraft,
                        start: event.target.value,
                      })
                    }
                  />
                </Field>
                <Field label="End">
                  <TextInput
                    type="time"
                    value={officeHourDraft.end}
                    onChange={(event) =>
                      setOfficeHourDraft({
                        ...officeHourDraft,
                        end: event.target.value,
                      })
                    }
                  />
                </Field>
              </div>
              <Field label="Notes">
                <TextInput
                  value={officeHourDraft.notes}
                  onChange={(event) =>
                    setOfficeHourDraft({
                      ...officeHourDraft,
                      notes: event.target.value,
                    })
                  }
                  placeholder="Drop-in, appointment, online"
                />
              </Field>
              <Button onClick={addOfficeHour}>
                <Plus data-icon="inline-start" />
                Add office hours
              </Button>
            </section>

            <section className="pixel-panel overflow-x-auto p-4">
              <h2 className="mb-4 text-xl font-black">Office Hours</h2>
              <div className="grid min-w-[760px] grid-cols-5 gap-3">
                {days.map((day) => (
                  <div key={day} className="grid content-start gap-2">
                    <div className="border-2 border-blue-300 bg-amber-50 p-2 text-center text-sm font-black">
                      {day}
                    </div>
                    {data.officeHours
                      .filter((block) => block.day === day)
                      .sort((a, b) => a.start.localeCompare(b.start))
                      .map((block) => {
                        const course = courseById.get(block.courseId);
                        return (
                          <div
                            key={block.id}
                            className="group border-2 border-blue-200 bg-white p-2"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="grid gap-1">
                                <p className="font-black">
                                  {course?.name ?? 'Course'}
                                </p>
                                <p className="text-xs text-blue-950/65">
                                  {block.start} - {block.end}
                                </p>
                                <p className="text-xs font-semibold">
                                  {block.teacher ||
                                    course?.instructor ||
                                    'Teacher'}
                                </p>
                                <p className="text-xs font-semibold text-blue-950/70">
                                  {block.office || 'Office'}
                                </p>
                                {block.notes ? (
                                  <p className="text-xs text-blue-950/65">
                                    {block.notes}
                                  </p>
                                ) : null}
                              </div>
                              <button
                                aria-label="Delete office hours"
                                className="opacity-0 transition group-hover:opacity-100"
                                onClick={() =>
                                  removeItem('officeHours', block.id)
                                }
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

          <TabsContent value="lists" className="grid gap-4 xl:grid-cols-2">
            <section className="pixel-panel grid gap-4 p-4">
              <div className="flex items-center gap-3">
                <LinkIcon className="size-5 text-blue-950/70" />
                <h2 className="text-xl font-black">Important Websites</h2>
              </div>
              <div className="grid gap-3 lg:grid-cols-[1fr_1fr_1fr_auto]">
                <Field label="Course">
                  <CourseSelect
                    courses={data.courses}
                    value={websiteDraft.courseId}
                    onChange={(value) =>
                      setWebsiteDraft({ ...websiteDraft, courseId: value })
                    }
                  />
                </Field>
                <Field label="Website">
                  <TextInput
                    value={websiteDraft.label}
                    onChange={(event) =>
                      setWebsiteDraft({
                        ...websiteDraft,
                        label: event.target.value,
                      })
                    }
                    placeholder="Course portal"
                  />
                </Field>
                <Field label="URL">
                  <TextInput
                    value={websiteDraft.url}
                    onChange={(event) =>
                      setWebsiteDraft({
                        ...websiteDraft,
                        url: event.target.value,
                      })
                    }
                    placeholder="https://..."
                  />
                </Field>
                <Button className="self-end" onClick={addWebsite}>
                  <Plus data-icon="inline-start" />
                  Add
                </Button>
              </div>
              <div className="grid gap-2">
                {data.websites.map((website) => (
                  <div
                    key={website.id}
                    className="grid gap-2 border-2 border-blue-200 bg-white p-3 lg:grid-cols-[1fr_1.1fr_auto]"
                  >
                    <div className="grid gap-1">
                      <TextInput
                        value={website.label}
                        onChange={(event) =>
                          updateWebsite(website.id, 'label', event.target.value)
                        }
                        aria-label="Website label"
                      />
                      <p className="text-xs font-semibold text-blue-950/65">
                        {courseById.get(website.courseId)?.name ?? 'Course'}
                      </p>
                    </div>
                    <TextInput
                      value={website.url}
                      onChange={(event) =>
                        updateWebsite(website.id, 'url', event.target.value)
                      }
                      aria-label="Website URL"
                    />
                    <div className="flex items-center gap-2">
                      {website.url ? (
                        <a
                          className="inline-flex h-7 items-center justify-center border border-blue-200 bg-white px-2.5 text-sm font-medium hover:bg-blue-50"
                          href={website.url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Open
                        </a>
                      ) : null}
                      <Button
                        variant="destructive"
                        size="icon"
                        aria-label="Delete website"
                        onClick={() => removeItem('websites', website.id)}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="pixel-panel grid gap-4 p-4">
              <div className="flex items-center gap-3">
                <ShoppingCart className="size-5 text-amber-600" />
                <h2 className="text-xl font-black">Shopping List</h2>
              </div>
              <div className="grid gap-3 lg:grid-cols-[1fr_1fr_auto]">
                <Field label="Course">
                  <CourseSelect
                    courses={data.courses}
                    value={shoppingDraft.courseId}
                    onChange={(value) =>
                      setShoppingDraft({ ...shoppingDraft, courseId: value })
                    }
                  />
                </Field>
                <Field label="Item">
                  <TextInput
                    value={shoppingDraft.item}
                    onChange={(event) =>
                      setShoppingDraft({
                        ...shoppingDraft,
                        item: event.target.value,
                      })
                    }
                    placeholder="Notebook"
                  />
                </Field>
                <Button className="self-end" onClick={addShoppingItem}>
                  <Plus data-icon="inline-start" />
                  Add
                </Button>
              </div>
              <div className="grid gap-2">
                {data.shopping.map((item) => (
                  <div
                    key={item.id}
                    className="grid gap-2 border-2 border-blue-200 bg-white p-3 lg:grid-cols-[auto_1fr_auto]"
                  >
                    <input
                      className="mt-2 size-4"
                      type="checkbox"
                      checked={item.done}
                      onChange={(event) =>
                        updateShopping(item.id, 'done', event.target.checked)
                      }
                      aria-label="Mark shopping item done"
                    />
                    <div className="grid gap-1">
                      <TextInput
                        value={item.item}
                        onChange={(event) =>
                          updateShopping(item.id, 'item', event.target.value)
                        }
                        aria-label="Shopping item"
                      />
                      <p className="text-xs font-semibold text-blue-950/65">
                        {courseById.get(item.courseId)?.name ?? 'Course'}
                      </p>
                    </div>
                    <Button
                      variant="destructive"
                      size="icon"
                      aria-label="Delete shopping item"
                      onClick={() => removeItem('shopping', item.id)}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                ))}
              </div>
            </section>

            <section className="pixel-panel grid gap-4 p-4">
              <div className="flex items-center gap-3">
                <BookOpen className="size-5 text-blue-950/70" />
                <h2 className="text-xl font-black">Homework List</h2>
              </div>
              <div className="grid gap-3 lg:grid-cols-[1fr_1fr_auto]">
                <Field label="Course">
                  <CourseSelect
                    courses={data.courses}
                    value={homeworkDraft.courseId}
                    onChange={(value) =>
                      setHomeworkDraft({ ...homeworkDraft, courseId: value })
                    }
                  />
                </Field>
                <Field label="Task">
                  <TextInput
                    value={homeworkDraft.task}
                    onChange={(event) =>
                      setHomeworkDraft({
                        ...homeworkDraft,
                        task: event.target.value,
                      })
                    }
                    placeholder="Problem set"
                  />
                </Field>
                <Button className="self-end" onClick={addHomeworkItem}>
                  <Plus data-icon="inline-start" />
                  Add
                </Button>
              </div>
              <div className="grid gap-2">
                {data.homework.map((item) => (
                  <div
                    key={item.id}
                    className="grid gap-2 border-2 border-blue-200 bg-white p-3 lg:grid-cols-[auto_1fr_auto]"
                  >
                    <input
                      className="mt-2 size-4"
                      type="checkbox"
                      checked={item.done}
                      onChange={(event) =>
                        updateHomework(item.id, 'done', event.target.checked)
                      }
                      aria-label="Mark homework done"
                    />
                    <div className="grid gap-1">
                      <TextInput
                        value={item.task}
                        onChange={(event) =>
                          updateHomework(item.id, 'task', event.target.value)
                        }
                        aria-label="Homework task"
                      />
                      <p className="text-xs font-semibold text-blue-950/65">
                        {courseById.get(item.courseId)?.name ?? 'Course'}
                      </p>
                    </div>
                    <Button
                      variant="destructive"
                      size="icon"
                      aria-label="Delete homework"
                      onClick={() => removeItem('homework', item.id)}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                ))}
              </div>
            </section>

            <section className="pixel-panel grid gap-4 p-4">
              <div className="flex items-center gap-3">
                <ListChecks className="size-5 text-amber-600" />
                <h2 className="text-xl font-black">To Do List</h2>
              </div>
              <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
                <Field label="Task">
                  <TextInput
                    value={todoDraft.task}
                    onChange={(event) =>
                      setTodoDraft({ ...todoDraft, task: event.target.value })
                    }
                    placeholder="Check upcoming deadlines"
                  />
                </Field>
                <Button className="self-end" onClick={addTodoItem}>
                  <Plus data-icon="inline-start" />
                  Add
                </Button>
              </div>
              <div className="grid gap-2">
                {data.todos.map((item) => (
                  <div
                    key={item.id}
                    className="grid gap-2 border-2 border-blue-200 bg-white p-3 lg:grid-cols-[auto_1fr_auto]"
                  >
                    <input
                      className="mt-2 size-4"
                      type="checkbox"
                      checked={item.done}
                      onChange={(event) =>
                        updateTodo(item.id, 'done', event.target.checked)
                      }
                      aria-label="Mark task done"
                    />
                    <TextInput
                      value={item.task}
                      onChange={(event) =>
                        updateTodo(item.id, 'task', event.target.value)
                      }
                      aria-label="To do task"
                    />
                    <Button
                      variant="destructive"
                      size="icon"
                      aria-label="Delete task"
                      onClick={() => removeItem('todos', item.id)}
                    >
                      <Trash2 />
                    </Button>
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
                        <p className="text-xs font-bold uppercase text-blue-950/70">
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
                    <p className="whitespace-pre-wrap text-sm leading-6 text-blue-950/75">
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
                <span className="border-2 border-blue-300 bg-amber-50 px-3 py-1 text-sm font-black">
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
              className={overdue ? 'bg-orange-50' : ''}
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
                className={`font-black ${overdue ? 'text-orange-700' : ''}`}
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
    <div className="border-2 border-blue-200 bg-white p-3">
      <p className="text-xs font-bold uppercase text-blue-950/70">{label}</p>
      <p className="mt-1 text-2xl font-black">{value}</p>
    </div>
  );
}
