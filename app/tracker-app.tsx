'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import {
  BarChart3,
  BookOpen,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Download,
  Droplet,
  GraduationCap,
  LinkIcon,
  ListChecks,
  Pause,
  Plus,
  Play,
  RotateCcw,
  ShoppingCart,
  Trash2,
  Upload,
  UserPlus,
  Users,
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
  | 'Midterm'
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
  dueTime?: string;
  weight: number;
  submitted: boolean;
  graded: boolean;
  score: number;
  maxScore: number;
  submission: string;
  partner: string;
  notes: string;
  linkIds: string[];
};

type ScheduleBlock = {
  id: string;
  courseId: string;
  day: string;
  start: string;
  end: string;
  location: string;
  type?: string;
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
  width?: number;
  height?: number;
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

type ComfortImage = {
  id: string;
  src: string;
  fileName: string;
  caption: string;
  width: number;
  height: number;
  addedAt: string;
};

type TrackerTab =
  | 'overview'
  | 'weekly'
  | 'assignments'
  | 'courses'
  | 'grades'
  | 'schedule'
  | 'office-hours'
  | 'lists'
  | 'notes'
  | 'hours'
  | 'import'
  | 'friends'
  | 'focus'
  | 'comfort';

const trackerTabs: { value: TrackerTab; label: string; href: string }[] = [
  { value: 'overview', label: 'Overview', href: '/' },
  { value: 'weekly', label: 'Weekly', href: '/weekly' },
  { value: 'assignments', label: 'Assignments', href: '/assignments' },
  { value: 'courses', label: 'Courses', href: '/courses' },
  { value: 'grades', label: 'Grades', href: '/grades' },
  { value: 'schedule', label: 'Schedule', href: '/schedule' },
  { value: 'office-hours', label: 'Office Hours', href: '/office-hours' },
  { value: 'lists', label: 'Lists', href: '/lists' },
  { value: 'notes', label: 'Notes', href: '/notes' },
  { value: 'hours', label: 'Hours', href: '/hours' },
  { value: 'import', label: 'Import', href: '/import' },
  { value: 'friends', label: 'Friends', href: '/friends' },
  { value: 'focus', label: 'Focus', href: '/focus' },
  { value: 'comfort', label: 'Comfort', href: '/comfort' },
];

const tabFromPathname = (pathname: string): TrackerTab =>
  trackerTabs.find((tab) => tab.href === pathname)?.value ?? 'overview';

type TrackerData = {
  termStartDate: string;
  termEndDate: string;
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

type TrackerCollectionKey = {
  [Key in keyof TrackerData]: TrackerData[Key] extends { id: string }[]
    ? Key
    : never;
}[keyof TrackerData];

type CloudStatus =
  | 'local'
  | 'loading'
  | 'saving'
  | 'saved'
  | 'setup'
  | 'offline';

type ImportedCourse = {
  code: string;
  name: string;
  sections: string[];
  instructor: string;
  credits: number;
  room: string;
};

type ImportedScheduleBlock = {
  courseCode: string;
  section: string;
  day: string;
  start: string;
  end: string;
  location: string;
  type: string;
  instructor: string;
};

type ParsedStudentSchedule = {
  courses: ImportedCourse[];
  schedule: ImportedScheduleBlock[];
};

type ImportDiff = {
  label: string;
  current: string;
  incoming: string;
};

type ScheduleImportResult = {
  data: TrackerData;
  addedCourses: number;
  updatedCourses: number;
  addedBlocks: number;
  replacedBlocks: number;
  skippedBlocks: number;
};

type ExcelCell = {
  v?: unknown;
  w?: string;
  t?: string;
};

type ExcelSheet = Record<string, ExcelCell | string | undefined> & {
  '!ref'?: string;
};

type ExcelWorkbook = {
  Sheets: Record<string, ExcelSheet | undefined>;
};

type ExcelImportResult = {
  data: TrackerData;
  courses: number;
  assignments: number;
  schedule: number;
  hours: number;
};

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
  'Midterm',
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
type FocusMode = 'focus' | 'short-break' | 'long-break';

const focusModeOptions: {
  value: FocusMode;
  label: string;
  minutes: number;
  description: string;
}[] = [
  {
    value: 'focus',
    label: 'Focus',
    minutes: 25,
    description: 'Settle into one task.',
  },
  {
    value: 'short-break',
    label: 'Short Break',
    minutes: 5,
    description: 'Stretch, water, breathe.',
  },
  {
    value: 'long-break',
    label: 'Long Break',
    minutes: 15,
    description: 'A proper reset.',
  },
];
const dayCodeMap: Record<string, string> = {
  M: 'Monday',
  T: 'Tuesday',
  W: 'Wednesday',
  R: 'Thursday',
  F: 'Friday',
};
const weekdayLabels: Record<string, string> = {
  Monday: 'M',
  Tuesday: 'T',
  Wednesday: 'W',
  Thursday: 'T',
  Friday: 'F',
};
const shortMonths = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];
const courseColors = ['#dbeafe', '#fef3c7', '#bfdbfe', '#eff6ff', '#e0f2fe'];
const storageKey = 'mcgilltrack-template-v1';
const comfortStorageKey = 'mcgilltrack-comfort-images-v1';
const comfortMaxImages = 18;
const comfortMaxImageDimension = 1400;
const cloudSaveDelay = 400;
const scheduleTypes = [
  'Lab-Tutorial',
  'Laboratory',
  'Tutorial',
  'Lecture',
  'Seminar',
  'Conference',
  'Lab',
];

const cloudErrorMessage = (message: string) =>
  message.includes('tracker_profiles') ||
  message.includes('tracker_friend') ||
  message.includes('tracker_social') ||
  message.includes('tracker_availability') ||
  message.includes('schema cache')
    ? 'Cloud table missing. Run the Supabase setup SQL once.'
    : message.toLowerCase().includes('failed to fetch')
      ? 'Cloud connection failed. Local save still works.'
      : message;

const cloudStatusFromError = (message: string): CloudStatus =>
  message.includes('tracker_profiles') ||
  message.includes('tracker_friend') ||
  message.includes('tracker_social') ||
  message.includes('tracker_availability') ||
  message.includes('schema cache')
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

const parseIsoDate = (value: string) => {
  if (!value) return null;
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
};

const dateToIso = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const startOfWeekIso = (value: string) => {
  const date = parseIsoDate(value) ?? parseIsoDate(initialTemplateDate);
  if (!date) return initialTemplateDate;
  const day = date.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + mondayOffset);
  return dateToIso(date);
};

const addIsoDays = (value: string, daysToAdd: number) => {
  const date = parseIsoDate(value) ?? parseIsoDate(initialTemplateDate);
  if (!date) return initialTemplateDate;
  date.setDate(date.getDate() + daysToAdd);
  return dateToIso(date);
};

const dayFromIsoDate = (value: string) => {
  const date = parseIsoDate(value);
  if (!date) return null;
  const index = date.getDay() - 1;
  return days[index] ?? null;
};

const formatMonthDay = (value: string) => {
  const date = parseIsoDate(value);
  if (!date) return value;
  return `${shortMonths[date.getMonth()]} ${date.getDate()}`;
};

const formatWeekRange = (weekStart: string) =>
  `${formatMonthDay(weekStart)} - ${formatMonthDay(addIsoDays(weekStart, 4))}`;

const createDefaultData = (baseDate = initialTemplateDate): TrackerData => ({
  termStartDate: baseDate,
  termEndDate: addDays(94, baseDate),
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
      dueTime: '',
      weight: 5,
      submitted: false,
      graded: false,
      score: 0,
      maxScore: 10,
      submission: 'Course portal',
      partner: '',
      notes: '',
      linkIds: [],
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
      dueTime: '',
      weight: 0,
      submitted: false,
      graded: false,
      score: 0,
      maxScore: 10,
      submission: 'No submission needed',
      partner: '',
      notes: '',
      linkIds: [],
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
      date: baseDate,
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
  dueTime: '',
  weight: 0,
  submitted: false,
  graded: false,
  score: 0,
  maxScore: 100,
  submission: '',
  partner: '',
  notes: '',
  linkIds: [],
});

const blankSchedule = (courseId: string): ScheduleBlock => ({
  id: makeId(),
  courseId,
  day: 'Monday',
  start: '09:00',
  end: '10:00',
  location: '',
  type: '',
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

const daysBetweenIso = (startDate: string, endDate: string) => {
  const start = parseIsoDate(startDate);
  const end = parseIsoDate(endDate);
  if (!start || !end) return null;
  return Math.floor((end.getTime() - start.getTime()) / 86400000);
};

const assignmentWeekLabel = (
  dueDate: string,
  termStartDate: string,
  termEndDate: string,
) => {
  if (!dueDate || !termStartDate) return 'Week 1';

  const daysFromStart = daysBetweenIso(termStartDate, dueDate);
  if (daysFromStart === null) return 'Week 1';

  const daysAfterEnd = termEndDate
    ? daysBetweenIso(termEndDate, dueDate)
    : null;
  if (daysAfterEnd !== null && daysAfterEnd > 0) return 'Finals Week';
  if (daysFromStart < 0) return 'Before Classes';

  return `Week ${Math.floor(daysFromStart / 7) + 1}`;
};

const hoursBetween = (start: string, end: string) => {
  if (!start || !end) return 0;
  const [startHour, startMinute] = start.split(':').map(Number);
  const [endHour, endMinute] = end.split(':').map(Number);
  let minutes = endHour * 60 + endMinute - (startHour * 60 + startMinute);
  if (minutes < 0) minutes += 24 * 60;
  return minutes / 60;
};

const scheduleStartHour = 8;
const scheduleEndHour = 18;
const scheduleHourHeight = 56;
const scheduleStartMinutes = scheduleStartHour * 60;
const scheduleEndMinutes = scheduleEndHour * 60;
const scheduleGridHeight =
  (scheduleEndHour - scheduleStartHour) * scheduleHourHeight;
const scheduleHours = Array.from(
  { length: scheduleEndHour - scheduleStartHour + 1 },
  (_, index) => scheduleStartHour + index,
);

const timeToMinutes = (time: string) => {
  const [hours = 0, minutes = 0] = time.split(':').map(Number);
  return hours * 60 + minutes;
};

const minutesToTime = (totalMinutes: number) => {
  const minutesInDay = 24 * 60;
  const normalized =
    ((Math.round(totalMinutes) % minutesInDay) + minutesInDay) % minutesInDay;
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

const formatFocusSeconds = (seconds: number) => {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = safeSeconds % 60;

  return `${String(minutes).padStart(2, '0')}:${String(
    remainingSeconds,
  ).padStart(2, '0')}`;
};

const readComfortImageFile = (file: File) =>
  new Promise<Omit<ComfortImage, 'id' | 'caption' | 'addedAt'>>(
    (resolve, reject) => {
      if (!file.type.startsWith('image/')) {
        reject(new Error(`${file.name} is not an image.`));
        return;
      }

      const reader = new FileReader();
      reader.onerror = () => reject(new Error(`${file.name} could not load.`));
      reader.onload = () => {
        const source = typeof reader.result === 'string' ? reader.result : '';
        const image = document.createElement('img');

        image.onerror = () =>
          reject(new Error(`${file.name} could not be read as an image.`));
        image.onload = () => {
          const naturalWidth = image.naturalWidth || image.width;
          const naturalHeight = image.naturalHeight || image.height;

          if (!naturalWidth || !naturalHeight) {
            reject(new Error(`${file.name} has no readable size.`));
            return;
          }

          const scale = Math.min(
            1,
            comfortMaxImageDimension / Math.max(naturalWidth, naturalHeight),
          );
          const width = Math.max(1, Math.round(naturalWidth * scale));
          const height = Math.max(1, Math.round(naturalHeight * scale));
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const context = canvas.getContext('2d');

          if (!context) {
            reject(new Error(`${file.name} could not be prepared.`));
            return;
          }

          context.drawImage(image, 0, 0, width, height);
          const outputType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
          const src =
            outputType === 'image/png'
              ? canvas.toDataURL(outputType)
              : canvas.toDataURL(outputType, 0.86);

          resolve({
            src,
            fileName: file.name,
            width,
            height,
          });
        };

        image.src = source;
      };
      reader.readAsDataURL(file);
    },
  );

const formatDisplayTime = (time: string) => {
  const [rawHours = '0', rawMinutes = '0'] = time.split(':');
  const hours = Number(rawHours);
  const minutes = Number(rawMinutes);

  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return time;

  const suffix = hours >= 12 ? 'PM' : 'AM';
  const displayHour = hours % 12 || 12;
  return `${displayHour}:${String(minutes).padStart(2, '0')} ${suffix}`;
};

const snapToFiveMinutes = (minutes: number) => Math.round(minutes / 5) * 5;

const clampNumber = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const noteMinWidth = 260;
const noteMaxWidth = 720;
const noteMinHeight = 180;
const noteMaxHeight = 620;
const noteDefaultWidth = 360;
const noteDefaultHeight = 260;
const noteLayoutGap = 16;
const noteBoardFallbackWidth = 1120;

type PackedNoteLayout = {
  note: NoteEntry;
  x: number;
  y: number;
  width: number;
  height: number;
};

const noteRectsOverlap = (
  first: Omit<PackedNoteLayout, 'note'>,
  second: Omit<PackedNoteLayout, 'note'>,
) =>
  first.x < second.x + second.width + noteLayoutGap &&
  first.x + first.width + noteLayoutGap > second.x &&
  first.y < second.y + second.height + noteLayoutGap &&
  first.y + first.height + noteLayoutGap > second.y;

const packNoteLayouts = (notes: NoteEntry[], containerWidth: number) => {
  const availableWidth = Math.max(
    containerWidth || noteBoardFallbackWidth,
    noteMinWidth,
  );
  const placed: PackedNoteLayout[] = [];

  notes.forEach((note) => {
    const width = clampNumber(
      Math.round(note.width ?? noteDefaultWidth),
      noteMinWidth,
      Math.min(noteMaxWidth, availableWidth),
    );
    const height = clampNumber(
      Math.round(note.height ?? noteDefaultHeight),
      noteMinHeight,
      noteMaxHeight,
    );
    const candidateXs = new Set<number>([0]);

    placed.forEach((layout) => {
      candidateXs.add(layout.x);
      const rightEdge = layout.x + layout.width + noteLayoutGap;
      if (rightEdge + width <= availableWidth) candidateXs.add(rightEdge);
    });

    const xPositions = [...candidateXs]
      .filter((x) => x >= 0 && x + width <= availableWidth)
      .sort((first, second) => first - second);

    const candidates = xPositions.length ? xPositions : [0];
    let bestX = candidates[0];
    let bestY = Number.POSITIVE_INFINITY;

    candidates.forEach((x) => {
      let y = 0;
      let blockers = placed.filter((layout) =>
        noteRectsOverlap({ x, y, width, height }, layout),
      );

      while (blockers.length > 0) {
        y = Math.min(
          ...blockers.map((layout) => layout.y + layout.height + noteLayoutGap),
        );
        blockers = placed.filter((layout) =>
          noteRectsOverlap({ x, y, width, height }, layout),
        );
      }

      if (y < bestY || (y === bestY && x < bestX)) {
        bestX = x;
        bestY = y;
      }
    });

    placed.push({ note, x: bestX, y: bestY, width, height });
  });

  return {
    items: placed,
    height: Math.max(
      noteDefaultHeight,
      ...placed.map((layout) => layout.y + layout.height),
    ),
  };
};

const addMinutesToTime = (time: string, minutesToAdd: number) => {
  const total = timeToMinutes(time) + minutesToAdd;
  const hours = Math.floor(total / 60) % 24;
  const minutes = total % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

const calendarBlockMinutes = (
  block: Pick<ScheduleBlock | OfficeHourBlock, 'start' | 'end'>,
) => {
  const start = Math.min(
    scheduleEndMinutes,
    Math.max(scheduleStartMinutes, timeToMinutes(block.start)),
  );
  const rawEnd = timeToMinutes(block.end);
  const end = Math.min(
    scheduleEndMinutes,
    Math.max(start + 15, rawEnd <= start ? start + 60 : rawEnd),
  );

  return { start, end };
};

const formatBlockTimeRange = (
  block: Pick<ScheduleBlock | OfficeHourBlock, 'start' | 'end'>,
) => {
  const { start, end } = calendarBlockMinutes(block);
  return `${formatDisplayTime(minutesToTime(start))} - ${formatDisplayTime(
    minutesToTime(end),
  )}`;
};

type AvailabilityWindow = {
  day: string;
  start: string;
  end: string;
};

type SocialProfile = {
  user_id: string;
  email: string;
  display_name: string;
  share_details: boolean;
  updated_at?: string;
};

type FriendInvite = {
  id: string;
  sender_id: string;
  sender_email: string | null;
  recipient_email: string;
  recipient_id: string | null;
  status: 'pending' | 'accepted' | 'declined';
  created_at: string;
  responded_at: string | null;
};

type Friendship = {
  id: string;
  user_a: string;
  user_b: string;
  created_at: string;
};

type AvailabilityRow = {
  id: string;
  user_id: string;
  day: string;
  start_time: string;
  end_time: string;
  source: string;
  updated_at: string;
};

type FriendTeam = {
  id: string;
  owner_id: string;
  name: string;
  created_at: string;
  updated_at: string;
};

type FriendTeamMember = {
  team_id: string;
  user_id: string;
  role: 'owner' | 'member';
  status: 'active' | 'invited';
  created_at: string;
};

type CommonBreakWindow = AvailabilityWindow & {
  userIds: string[];
};

const buildAvailabilityWindows = (
  schedule: ScheduleBlock[],
  officeHours: OfficeHourBlock[],
  minMinutes = 45,
): AvailabilityWindow[] =>
  days.flatMap((day) => {
    const busyWindows = [...schedule, ...officeHours]
      .filter((block) => block.day === day)
      .map((block) => calendarBlockMinutes(block))
      .sort((first, second) => first.start - second.start);

    const mergedBusy = busyWindows.reduce<{ start: number; end: number }[]>(
      (merged, window) => {
        const previous = merged.at(-1);

        if (!previous || window.start > previous.end) {
          merged.push({ ...window });
          return merged;
        }

        previous.end = Math.max(previous.end, window.end);
        return merged;
      },
      [],
    );

    const freeWindows: AvailabilityWindow[] = [];
    let cursor = scheduleStartMinutes;

    mergedBusy.forEach((window) => {
      if (window.start - cursor >= minMinutes) {
        freeWindows.push({
          day,
          start: minutesToTime(cursor),
          end: minutesToTime(window.start),
        });
      }
      cursor = Math.max(cursor, window.end);
    });

    if (scheduleEndMinutes - cursor >= minMinutes) {
      freeWindows.push({
        day,
        start: minutesToTime(cursor),
        end: minutesToTime(scheduleEndMinutes),
      });
    }

    return freeWindows;
  });

const formatAvailabilityRange = (window: AvailabilityWindow) =>
  `${formatDisplayTime(window.start)} - ${formatDisplayTime(window.end)}`;

const formatAvailabilityDuration = (window: AvailabilityWindow) => {
  const minutes = timeToMinutes(window.end) - timeToMinutes(window.start);
  if (minutes < 60) return `${minutes} min`;

  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours} hr ${remainder} min` : `${hours} hr`;
};

const normalizeDbTime = (time: string) => time.slice(0, 5);

const friendDisplayName = (profile: SocialProfile | undefined, fallback: string) =>
  profile?.display_name?.trim() || profile?.email || fallback;

const friendOtherUserId = (friendship: Friendship, userId: string) =>
  friendship.user_a === userId ? friendship.user_b : friendship.user_a;

const orderedFriendshipPair = (firstId: string, secondId: string) =>
  firstId < secondId
    ? { user_a: firstId, user_b: secondId }
    : { user_a: secondId, user_b: firstId };

const windowsFromRows = (rows: AvailabilityRow[]): AvailabilityWindow[] =>
  rows.map((row) => ({
    day: row.day,
    start: normalizeDbTime(row.start_time),
    end: normalizeDbTime(row.end_time),
  }));

const findCommonBreakWindows = (
  availabilityByUser: Map<string, AvailabilityWindow[]>,
  userIds: string[],
  minMinutes = 45,
): CommonBreakWindow[] => {
  if (!userIds.length) return [];

  return days.flatMap((day) => {
    const windowsByUser = userIds.map((userId) =>
      (availabilityByUser.get(userId) ?? [])
        .filter((window) => window.day === day)
        .sort((first, second) =>
          first.start === second.start
            ? first.end.localeCompare(second.end)
            : first.start.localeCompare(second.start),
        ),
    );

    if (windowsByUser.some((windows) => windows.length === 0)) return [];

    let overlaps = windowsByUser[0].map((window) => ({
      start: timeToMinutes(window.start),
      end: timeToMinutes(window.end),
    }));

    windowsByUser.slice(1).forEach((windows) => {
      overlaps = overlaps.flatMap((overlap) =>
        windows
          .map((window) => ({
            start: Math.max(overlap.start, timeToMinutes(window.start)),
            end: Math.min(overlap.end, timeToMinutes(window.end)),
          }))
          .filter((window) => window.end - window.start >= minMinutes),
      );
    });

    return overlaps
      .filter((window) => window.end - window.start >= minMinutes)
      .map((window) => ({
        day,
        start: minutesToTime(window.start),
        end: minutesToTime(window.end),
        userIds,
      }));
  });
};

const scheduleBlockLayout = (
  block: Pick<ScheduleBlock | OfficeHourBlock, 'start' | 'end'>,
) => {
  const { start, end } = calendarBlockMinutes(block);

  return {
    top: ((start - scheduleStartMinutes) / 60) * scheduleHourHeight,
    height: Math.max(((end - start) / 60) * scheduleHourHeight, 34),
  };
};

const blockContainsTime = (
  block: Pick<ScheduleBlock, 'start' | 'end'>,
  time: string,
) => {
  const { start, end } = calendarBlockMinutes(block);
  const minutes = timeToMinutes(time);
  return minutes >= start - 10 && minutes <= end;
};

const assignmentAttachesToBlock = (
  assignment: Assignment,
  date: string,
  block: ScheduleBlock,
  dayBlocks: ScheduleBlock[],
) => {
  if (assignment.dueDate !== date || assignment.courseId !== block.courseId) {
    return false;
  }

  const courseBlocks = dayBlocks
    .filter((item) => item.courseId === assignment.courseId)
    .sort((first, second) => first.start.localeCompare(second.start));

  if (!assignment.dueTime) return block.id === courseBlocks[0]?.id;

  const timedBlock = courseBlocks.find((item) =>
    blockContainsTime(item, assignment.dueTime ?? ''),
  );

  return block.id === (timedBlock?.id ?? courseBlocks[0]?.id);
};

const formatScheduleHour = (hour: number) => {
  if (hour === 12) return '12 pm';
  if (hour > 12) return `${hour - 12} pm`;
  return `${hour} am`;
};

const formatDueTime = (time?: string) => {
  if (!time) return '';
  return formatDisplayTime(time);
};

const cleanPdfLine = (line: string) =>
  line
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const isPdfNoiseLine = (line: string) =>
  !line ||
  /^\d+\/\d+$/.test(line) ||
  line.startsWith('https://') ||
  line.startsWith('RELEASE:') ||
  line.startsWith('NOTICE:') ||
  line.startsWith('Return to Previous') ||
  line.includes('Student Schedule by Course Section') ||
  /^\d+\/\d+\/\d+/.test(line) ||
  line.includes('Ellucian Company') ||
  line.startsWith('If you are using ') ||
  line.startsWith('please report ') ||
  line.startsWith('help us.');

const parseCourseHeader = (line: string) => {
  const match = cleanPdfLine(line).match(
    /^(.+?)\.?\s*-\s*([A-Z]{3,4})\s+(\d{3})\s*-\s*([A-Z0-9]{3})$/,
  );
  if (!match) return null;

  return {
    name: cleanPdfLine(match[1]).replace(/\.$/, ''),
    code: `${match[2]} ${match[3]}`,
    section: match[4],
  };
};

const pdfFieldLabels = [
  'Associated Term:',
  'CRN',
  ':',
  'Status:',
  'Assigned Instructor:',
  'Grade Mode:',
  'Credits:',
  'Level:',
  'Campus:',
  'Scheduled Meeting Times',
  'Time',
  'Days',
  'Where',
  'Date Range',
  'Schedule Type',
  'Instructors',
];

const isPdfFieldLabel = (line: string) =>
  pdfFieldLabels.some((label) => line === label || line.startsWith(label));

const valueAfterPdfLabel = (lines: string[], label: string) => {
  const index = lines.findIndex((line) => line === label);
  if (index === -1) {
    return (
      lines
        .find((line) => line.startsWith(label))
        ?.replace(label, '')
        .trim() ?? ''
    );
  }

  const value = lines[index + 1]?.startsWith(':')
    ? (lines[index + 2] ?? '').trim()
    : (lines[index + 1] ?? '').trim();

  return isPdfFieldLabel(value) ? '' : value;
};

const parsePdfTime = (hour: string, meridiem: string) => {
  const [rawHours, rawMinutes] = hour.split(':').map(Number);
  const lowerMeridiem = meridiem.toLowerCase();
  const normalizedHours =
    lowerMeridiem === 'pm' && rawHours !== 12
      ? rawHours + 12
      : lowerMeridiem === 'am' && rawHours === 12
        ? 0
        : rawHours;
  return `${String(normalizedHours).padStart(2, '0')}:${String(rawMinutes).padStart(2, '0')}`;
};

const parseMeetingLine = (
  line: string,
  courseCode: string,
  section: string,
) => {
  const typePattern = scheduleTypes.join('|');
  const match = cleanPdfLine(line).match(
    new RegExp(
      `^(\\d{1,2}:\\d{2})\\s*(am|pm)\\s*-\\s*(\\d{1,2}:\\d{2})\\s*(am|pm)?\\s+([MTWRFSU]+)\\s+(.+?)\\s+([A-Z][a-z]{2}\\s+\\d{1,2},\\s+\\d{4}\\s+-\\s+[A-Z][a-z]{2}\\s+\\d{1,2},\\s+\\d{4})\\s+(${typePattern})\\s*(.*)$`,
      'i',
    ),
  );
  if (!match) return [];

  const startMeridiem = match[2];
  const endMeridiem = match[4] || startMeridiem;
  const location = cleanPdfLine(match[6]);
  const type = cleanPdfLine(match[8]);
  const instructor = cleanPdfLine(match[9]).replace(/^TBA$/i, '');

  return match[5]
    .split('')
    .map((dayCode) => dayCodeMap[dayCode])
    .filter(Boolean)
    .map((day) => ({
      courseCode,
      section,
      day,
      start: parsePdfTime(match[1], startMeridiem),
      end: parsePdfTime(match[3], endMeridiem),
      location,
      type,
      instructor,
    }));
};

const parseStudentSchedulePdfText = (text: string): ParsedStudentSchedule => {
  const lines = text
    .split(/\r?\n/)
    .map(cleanPdfLine)
    .filter((line) => !isPdfNoiseLine(line));
  const sectionStarts = lines
    .map((line, index) =>
      line.startsWith('Associated Term:') ? index : undefined,
    )
    .filter((index): index is number => index !== undefined);
  const courses = new Map<string, ImportedCourse>();
  const schedule: ImportedScheduleBlock[] = [];

  sectionStarts.forEach((startIndex, sectionIndex) => {
    let header = null as ReturnType<typeof parseCourseHeader>;
    for (let lookback = 1; lookback <= 4; lookback += 1) {
      const candidate = lines
        .slice(Math.max(0, startIndex - lookback), startIndex)
        .join(' ');
      header = parseCourseHeader(candidate);
      if (header) break;
    }
    if (!header) return;

    const nextStart = sectionStarts[sectionIndex + 1] ?? lines.length;
    const sectionLines = lines.slice(startIndex, nextStart);
    const assignedInstructor = valueAfterPdfLabel(
      sectionLines,
      'Assigned Instructor:',
    );
    const credits = Number(valueAfterPdfLabel(sectionLines, 'Credits:') || 0);

    const meetingBlocks: ImportedScheduleBlock[] = [];
    for (let index = 0; index < sectionLines.length; index += 1) {
      const line = sectionLines[index];
      if (!/^\d{1,2}:\d{2}\s*(am|pm)\s*-/i.test(line)) continue;

      let combined = line;
      let parsed = parseMeetingLine(combined, header.code, header.section);
      let nextIndex = index + 1;
      while (parsed.length === 0 && nextIndex < sectionLines.length) {
        const nextLine = sectionLines[nextIndex];
        if (
          nextLine.startsWith('Associated Term:') ||
          parseCourseHeader(nextLine) ||
          (nextIndex > index + 1 &&
            /^\d{1,2}:\d{2}\s*(am|pm)\s*-/i.test(nextLine))
        ) {
          break;
        }
        combined = `${combined} ${nextLine}`;
        parsed = parseMeetingLine(combined, header.code, header.section);
        nextIndex += 1;
      }

      if (parsed.length > 0) {
        meetingBlocks.push(...parsed);
        index = nextIndex - 1;
      }
    }

    meetingBlocks.forEach((block) => schedule.push(block));

    const existing = courses.get(header.code);
    const room = meetingBlocks.find((block) => block.location)?.location ?? '';
    const instructor =
      cleanPdfLine(assignedInstructor) ||
      meetingBlocks.find((block) => block.instructor)?.instructor ||
      '';

    if (existing) {
      courses.set(header.code, {
        ...existing,
        sections: Array.from(new Set([...existing.sections, header.section])),
        instructor: existing.instructor || instructor,
        credits: Math.max(
          existing.credits,
          Number.isFinite(credits) ? credits : 0,
        ),
        room: existing.room || room,
      });
    } else {
      courses.set(header.code, {
        code: header.code,
        name: header.name,
        sections: [header.section],
        instructor,
        credits: Number.isFinite(credits) ? credits : 0,
        room,
      });
    }
  });

  return {
    courses: Array.from(courses.values()),
    schedule,
  };
};

const extractPdfText = async (file: File) => {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.mjs',
    import.meta.url,
  ).toString();

  const pdf = await pdfjs.getDocument({
    data: new Uint8Array(await file.arrayBuffer()),
  }).promise;
  let text = '';

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    let line = '';

    content.items.forEach((item) => {
      if (!('str' in item)) return;
      const value = item.str.trim();
      if (value) line = `${line}${line ? ' ' : ''}${value}`;
      if ('hasEOL' in item && item.hasEOL) {
        if (line) text = `${text}${line}\n`;
        line = '';
      }
    });

    if (line) text = `${text}${line}\n`;
  }

  return text;
};

const formatDiffs = (diffs: ImportDiff[]) =>
  diffs
    .map(
      (diff) =>
        `- ${diff.label}: ${diff.current || 'blank'} -> ${diff.incoming || 'blank'}`,
    )
    .join('\n');

const meaningfulCourseDiffs = (
  existing: Course,
  incoming: ImportedCourse,
  section: string,
) => {
  const candidates: ImportDiff[] = [
    { label: 'Name', current: existing.name, incoming: incoming.name },
    { label: 'Room', current: existing.room, incoming: incoming.room },
    {
      label: 'Instructor',
      current: existing.instructor,
      incoming: incoming.instructor,
    },
    { label: 'Section', current: existing.section ?? '', incoming: section },
    {
      label: 'Credits',
      current: String(existing.credits || ''),
      incoming: String(incoming.credits || ''),
    },
  ];

  return candidates.filter(
    (diff) =>
      diff.current.trim() &&
      diff.incoming.trim() &&
      diff.current.trim() !== diff.incoming.trim(),
  );
};

const scheduleDiffs = (existing: ScheduleBlock, incoming: ScheduleBlock) => {
  const candidates: ImportDiff[] = [
    {
      label: 'Time',
      current: `${existing.start} - ${existing.end}`,
      incoming: `${incoming.start} - ${incoming.end}`,
    },
    {
      label: 'Room',
      current: existing.location,
      incoming: incoming.location,
    },
    {
      label: 'Type',
      current: existing.type ?? '',
      incoming: incoming.type ?? '',
    },
  ];

  return candidates.filter(
    (diff) =>
      diff.current.trim() !== diff.incoming.trim() &&
      (diff.current.trim() || diff.incoming.trim()),
  );
};

const findScheduleConflictIndex = (
  schedule: ScheduleBlock[],
  incoming: ScheduleBlock,
) =>
  schedule.findIndex((existing) => {
    if (
      existing.courseId !== incoming.courseId ||
      existing.day !== incoming.day
    ) {
      return false;
    }

    const sameTime =
      existing.start === incoming.start && existing.end === incoming.end;
    const sameStart = existing.start === incoming.start;

    return sameTime || sameStart;
  });

const mergeStudentScheduleImport = (
  current: TrackerData,
  parsed: ParsedStudentSchedule,
): ScheduleImportResult => {
  const nextCourses = [...current.courses];
  const nextSchedule = [...current.schedule];
  const courseIdByCode = new Map(
    nextCourses.map((course) => [course.code, course.id]),
  );
  let addedCourses = 0;
  let updatedCourses = 0;
  let addedBlocks = 0;
  let replacedBlocks = 0;
  let skippedBlocks = 0;

  parsed.courses.forEach((importedCourse) => {
    const existingId = courseIdByCode.get(importedCourse.code);
    const section = importedCourse.sections.join(', ');

    if (existingId) {
      const index = nextCourses.findIndex((course) => course.id === existingId);
      const existing = nextCourses[index];
      const diffs = meaningfulCourseDiffs(existing, importedCourse, section);
      const replace =
        diffs.length === 0 ||
        window.confirm(
          `Replace course details for ${existing.code || existing.name}?\n\n${formatDiffs(diffs)}`,
        );

      if (!replace) return;

      nextCourses[index] = {
        ...existing,
        name: importedCourse.name || existing.name,
        code: importedCourse.code,
        room: importedCourse.room || existing.room,
        instructor: importedCourse.instructor || existing.instructor,
        section: section || existing.section,
        credits: importedCourse.credits || existing.credits,
      };
      updatedCourses += 1;
      return;
    }

    const id = makeId();
    courseIdByCode.set(importedCourse.code, id);
    nextCourses.push({
      id,
      name: importedCourse.name,
      code: importedCourse.code,
      room: importedCourse.room,
      instructor: importedCourse.instructor,
      email: '',
      section,
      teams: '',
      extension: '',
      weeklyPonderation: '',
      credits: importedCourse.credits,
      color: courseColors[nextCourses.length % courseColors.length],
    });
    addedCourses += 1;
  });

  parsed.schedule.forEach((block) => {
    const courseId = courseIdByCode.get(block.courseCode);
    if (!courseId) return;

    const incoming: ScheduleBlock = {
      id: makeId(),
      courseId,
      day: block.day,
      start: block.start,
      end: block.end,
      location: block.location,
      type: block.section ? `${block.type} ${block.section}` : block.type,
    };
    const conflictIndex = findScheduleConflictIndex(nextSchedule, incoming);

    if (conflictIndex === -1) {
      nextSchedule.push(incoming);
      addedBlocks += 1;
      return;
    }

    const existing = nextSchedule[conflictIndex];
    const diffs = scheduleDiffs(existing, incoming);
    if (diffs.length === 0) {
      skippedBlocks += 1;
      return;
    }

    const course = nextCourses.find((item) => item.id === courseId);
    const replace = window.confirm(
      `Replace ${course?.code || 'this class'} ${incoming.type || 'meeting'} on ${incoming.day}?\n\n${formatDiffs(diffs)}`,
    );

    if (!replace) {
      skippedBlocks += 1;
      return;
    }

    nextSchedule[conflictIndex] = {
      ...existing,
      start: incoming.start,
      end: incoming.end,
      location: incoming.location,
      type: incoming.type,
    };
    replacedBlocks += 1;
  });

  return {
    data: {
      ...current,
      courses: nextCourses,
      schedule: nextSchedule,
    },
    addedCourses,
    updatedCourses,
    addedBlocks,
    replacedBlocks,
    skippedBlocks,
  };
};

const excelColumnName = (column: number) => {
  let name = '';
  let current = column;

  while (current > 0) {
    const index = (current - 1) % 26;
    name = `${String.fromCharCode(65 + index)}${name}`;
    current = Math.floor((current - index - 1) / 26);
  }

  return name;
};

const excelAddress = (column: number, row: number) =>
  `${excelColumnName(column)}${row}`;

const excelSheet = (workbook: ExcelWorkbook, sheetName: string) =>
  workbook.Sheets[sheetName] ??
  Object.entries(workbook.Sheets).find(
    ([name]) => name.toLowerCase() === sheetName.toLowerCase(),
  )?.[1];

const excelCell = (
  sheet: ExcelSheet | undefined,
  column: number,
  row: number,
) => {
  const cell = sheet?.[excelAddress(column, row)];
  return typeof cell === 'object' && cell !== null ? cell : undefined;
};

const excelRawValue = (
  sheet: ExcelSheet | undefined,
  column: number,
  row: number,
) => excelCell(sheet, column, row)?.v;

const cleanExcelText = (value: unknown) => {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return dateToIso(value);
  if (typeof value === 'string') return value.replace(/\s+/g, ' ').trim();
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value).replace(/\s+/g, ' ').trim();
  }
  return '';
};

const optionalExcelText = (value: unknown) => {
  const text = cleanExcelText(value);
  return /^(n\/a|na|none|null|undefined)$/i.test(text) ? '' : text;
};

const excelText = (
  sheet: ExcelSheet | undefined,
  column: number,
  row: number,
) => {
  const cell = excelCell(sheet, column, row);
  if (!cell) return '';
  return optionalExcelText(cell.v ?? cell.w);
};

const excelNumber = (
  sheet: ExcelSheet | undefined,
  column: number,
  row: number,
) => {
  const raw = excelRawValue(sheet, column, row);
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  const parsed = Number(cleanExcelText(raw).replace(/%$/, ''));
  return Number.isFinite(parsed) ? parsed : 0;
};

const excelBoolean = (
  sheet: ExcelSheet | undefined,
  column: number,
  row: number,
) => {
  const raw = excelRawValue(sheet, column, row);
  if (typeof raw === 'boolean') return raw;
  if (typeof raw === 'number') return raw > 0;
  const text = cleanExcelText(raw).toLowerCase();
  return ['true', 'yes', 'y', 'done', 'submitted', 'graded', '1'].includes(
    text,
  );
};

const excelDateSerialToIso = (serial: number) => {
  const utcDate = new Date(Math.floor(serial - 25569) * 86400000);
  return dateToIso(
    new Date(
      utcDate.getUTCFullYear(),
      utcDate.getUTCMonth(),
      utcDate.getUTCDate(),
    ),
  );
};

const excelValueToIsoDate = (value: unknown) => {
  if (value instanceof Date) return dateToIso(value);
  if (typeof value === 'number' && Number.isFinite(value)) {
    return excelDateSerialToIso(value);
  }

  const text = cleanExcelText(value);
  if (!text) return '';
  const isoMatch = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2].padStart(2, '0')}-${isoMatch[3].padStart(2, '0')}`;
  }

  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? '' : dateToIso(parsed);
};

const excelValueToTime = (value: unknown) => {
  if (value instanceof Date) {
    return minutesToTime(value.getHours() * 60 + value.getMinutes());
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    if (value >= 0 && value < 1) {
      return minutesToTime(Math.round(value * 24 * 60));
    }

    const asText = String(Math.round(value)).padStart(3, '0');
    if (asText.length <= 4) {
      const hours = Number(asText.slice(0, -2));
      const minutes = Number(asText.slice(-2));
      if (hours < 24 && minutes < 60)
        return minutesToTime(hours * 60 + minutes);
    }
  }

  const text = cleanExcelText(value);
  const match = text.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
  if (!match) return '';

  let hours = Number(match[1]);
  const minutes = Number(match[2] ?? 0);
  const meridiem = match[3]?.toLowerCase();
  if (meridiem === 'pm' && hours < 12) hours += 12;
  if (meridiem === 'am' && hours === 12) hours = 0;

  return hours < 24 && minutes < 60 ? minutesToTime(hours * 60 + minutes) : '';
};

const excelValueToOptionalTime = (value: unknown) => {
  if (value instanceof Date) {
    const minutes = value.getHours() * 60 + value.getMinutes();
    return minutes > 0 ? minutesToTime(minutes) : '';
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    const fraction = value - Math.floor(value);
    return fraction > 0 ? minutesToTime(Math.round(fraction * 24 * 60)) : '';
  }

  const text = cleanExcelText(value);
  return /(\d{1,2}:\d{2}|\b(?:am|pm)\b)/i.test(text)
    ? excelValueToTime(text)
    : '';
};

const courseSearchKey = (value: string) =>
  value
    .toLowerCase()
    .replace(/\bintroducion\b/g, 'introduction')
    .replace(/\bintro\b/g, 'introduction')
    .replace(/\bcomputure\b/g, 'computer')
    .replace(/\bcomp\b/g, 'computer')
    .replace(/\bsofeware\b/g, 'software')
    .replace(/\bsyst\b/g, 'systems')
    .replace(/\bsci\b/g, 'science')
    .replace(/\bneuro\b/g, 'neuroscience')
    .replace(/\bstats\b/g, 'statistics')
    .replace(/\bexp\b/g, 'experimental')
    .replace(/\bdesgin\b/g, 'design')
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter((word) => word && !['to', 'for', 'of', 'the', 'and'].includes(word))
    .join(' ');

const findMatchingCourse = (courses: Course[], value: string) => {
  const key = courseSearchKey(value);
  if (!key) return undefined;

  return (
    courses.find(
      (course) =>
        courseSearchKey(course.name) === key ||
        (!!course.code && course.code.toLowerCase() === value.toLowerCase()),
    ) ??
    courses.find((course) => {
      const courseKey = courseSearchKey(course.name);
      return (
        !!courseKey &&
        (key.includes(courseKey) || courseKey.includes(key)) &&
        Math.min(key.length, courseKey.length) > 7
      );
    })
  );
};

const shouldImportSetupCourse = (name: string) =>
  !!name && !/^class\s+\d+$/i.test(name) && !/^(random|n\/a|na)$/i.test(name);

const firstExcelTextInRange = (
  sheet: ExcelSheet | undefined,
  row: number,
  startColumn: number,
  endColumn: number,
  predicate: (value: string) => boolean = Boolean,
) => {
  for (let column = startColumn; column <= endColumn; column += 1) {
    const text = excelText(sheet, column, row);
    if (predicate(text)) return text;
  }

  return '';
};

const readExcelSetupCourses = (workbook: ExcelWorkbook) => {
  const setup = excelSheet(workbook, 'Setup');
  const courses: Course[] = [];

  for (let row = 10; row <= 16; row += 1) {
    const name = excelText(setup, 2, row);
    if (!shouldImportSetupCourse(name)) continue;

    courses.push({
      id: makeId(),
      name,
      code: '',
      room: excelText(setup, 4, row),
      instructor: '',
      email: '',
      section: '',
      teams: '',
      extension: '',
      weeklyPonderation: '',
      credits: 3,
      color: courseColors[courses.length % courseColors.length],
    });
  }

  return courses;
};

const enrichCoursesFromClassOutline = (
  workbook: ExcelWorkbook,
  courses: Course[],
) => {
  const outline = excelSheet(workbook, 'Class Outline');
  if (!outline) return;

  const groupStarts = [2, 9, 16, 23, 30];
  const rowGroups = [
    { title: 2, values: 21, room: 24, contact: 17 },
    { title: 27, values: 45, room: 48, contact: 41 },
  ];

  rowGroups.forEach((rowGroup) => {
    groupStarts.forEach((startColumn) => {
      const title = excelText(outline, startColumn, rowGroup.title);
      const course = findMatchingCourse(courses, title);
      if (!course) return;

      const code = excelText(outline, startColumn, rowGroup.values);
      const credits = excelNumber(outline, startColumn + 4, rowGroup.values);
      const room =
        excelText(outline, startColumn + 4, rowGroup.room) ||
        firstExcelTextInRange(
          outline,
          rowGroup.room,
          startColumn,
          startColumn + 6,
        );
      const email =
        firstExcelTextInRange(
          outline,
          rowGroup.contact - 1,
          startColumn,
          startColumn + 6,
          (value) => value.includes('@'),
        ) ||
        firstExcelTextInRange(
          outline,
          rowGroup.contact,
          startColumn,
          startColumn + 6,
          (value) => value.includes('@'),
        );
      const teams = firstExcelTextInRange(
        outline,
        rowGroup.contact,
        startColumn,
        startColumn + 6,
        (value) =>
          !value.includes('@') && !/^(teams|contact info)$/i.test(value),
      );

      if (code) course.code = code;
      if (credits > 0) course.credits = credits;
      if (room) course.room = room;
      if (email) course.email = email;
      if (teams) course.teams = teams;
    });
  });
};

const normalizeAssignmentType = (value: string): AssignmentType => {
  const match = assignmentTypes.find(
    (type) => type.toLowerCase() === value.toLowerCase(),
  );
  return match ?? 'Assignment';
};

const normalizeAssignmentStatus = (
  value: string,
  submitted: boolean,
): Status => {
  const text = value.toLowerCase();
  if (text.includes('done') || submitted) return 'Done';
  if (text.includes('progress')) return 'In Progress';
  return 'Not Started';
};

const normalizePriority = (value: string): Priority => {
  const match = priorities.find(
    (priority) => priority.toLowerCase() === value.toLowerCase(),
  );
  return match ?? 'Medium';
};

const normalizeWeight = (value: number) => {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return value <= 1 ? Math.round(value * 10000) / 100 : value;
};

const assignmentImportKey = (courseId: string, title: string) =>
  `${courseId}:${title.toLowerCase().replace(/\s+/g, ' ').trim()}`;

const readGradebookScores = (workbook: ExcelWorkbook, courses: Course[]) => {
  const gradebook = excelSheet(workbook, 'Gradebook');
  const scores = new Map<
    string,
    { score: number; maxScore: number; weight: number; graded: boolean }
  >();

  for (let row = 8; row <= 250; row += 1) {
    const subject = excelText(gradebook, 2, row);
    const title = excelText(gradebook, 3, row);
    const course = findMatchingCourse(courses, subject);
    if (!course || !title) continue;

    const percentage = excelNumber(gradebook, 6, row);
    const weight = normalizeWeight(excelNumber(gradebook, 8, row));
    if (percentage <= 0 && weight <= 0) continue;

    scores.set(assignmentImportKey(course.id, title), {
      score:
        percentage > 0
          ? Math.round(
              (percentage <= 1 ? percentage * 100 : percentage) * 100,
            ) / 100
          : 0,
      maxScore: 100,
      weight,
      graded: percentage > 0,
    });
  }

  return scores;
};

const getOrCreateImportedCourse = (courses: Course[], subject: string) => {
  const existing = findMatchingCourse(courses, subject);
  if (existing) return existing;

  const course: Course = {
    id: makeId(),
    name: subject,
    code: '',
    room: '',
    instructor: '',
    email: '',
    section: '',
    teams: '',
    extension: '',
    weeklyPonderation: '',
    credits: 3,
    color: courseColors[courses.length % courseColors.length],
  };
  courses.push(course);
  return course;
};

const readExcelAssignments = (workbook: ExcelWorkbook, courses: Course[]) => {
  const sheet = excelSheet(workbook, 'Assignment Tracker');
  const scores = readGradebookScores(workbook, courses);
  const assignments: Assignment[] = [];

  for (let row = 8; row <= 1000; row += 1) {
    const subject = excelText(sheet, 2, row);
    const title = excelText(sheet, 3, row);
    if (!subject || !title || /^subject$/i.test(subject)) continue;

    const course = getOrCreateImportedCourse(courses, subject);
    const submitted = excelBoolean(sheet, 13, row);
    const graded = excelBoolean(sheet, 14, row);
    const dueValue = excelRawValue(sheet, 10, row);
    const score = scores.get(assignmentImportKey(course.id, title));
    const importedWeight = normalizeWeight(excelNumber(sheet, 7, row));

    assignments.push({
      id: makeId(),
      courseId: course.id,
      title,
      type: normalizeAssignmentType(excelText(sheet, 4, row)),
      status: normalizeAssignmentStatus(excelText(sheet, 5, row), submitted),
      priority: normalizePriority(excelText(sheet, 6, row)),
      week: weeks.includes(excelText(sheet, 9, row))
        ? excelText(sheet, 9, row)
        : 'Week 1',
      dueDate: excelValueToIsoDate(dueValue) || todayIso(),
      dueTime: excelValueToOptionalTime(dueValue),
      weight: importedWeight || score?.weight || 0,
      submitted,
      graded: graded || !!score?.graded,
      score: score?.score ?? 0,
      maxScore: score?.maxScore ?? 100,
      submission: excelText(sheet, 16, row),
      partner: excelText(sheet, 8, row),
      notes: excelText(sheet, 17, row),
      linkIds: [],
    });
  }

  return assignments;
};

const readExcelSchedule = (workbook: ExcelWorkbook, courses: Course[]) => {
  const sheet = excelSheet(workbook, 'Schedule F2026');
  const schedule: ScheduleBlock[] = [];
  if (!sheet) return schedule;

  const dayColumns = [
    { column: 3, day: 'Monday' },
    { column: 4, day: 'Tuesday' },
    { column: 5, day: 'Wednesday' },
    { column: 6, day: 'Thursday' },
    { column: 7, day: 'Friday' },
  ];

  dayColumns.forEach(({ column, day }) => {
    for (let row = 7; row <= 60; row += 1) {
      const text = excelText(sheet, column, row);
      const course = findMatchingCourse(courses, text);
      const start = excelValueToTime(excelRawValue(sheet, 2, row));
      if (!course || !start) continue;

      let location = '';
      let locationRow = row;
      for (
        let nextRow = row + 1;
        nextRow <= Math.min(row + 4, 60);
        nextRow += 1
      ) {
        const nextText = excelText(sheet, column, nextRow);
        if (!nextText) continue;
        if (findMatchingCourse(courses, nextText)) break;
        location = nextText;
        locationRow = nextRow;
        break;
      }

      const end =
        excelValueToTime(excelRawValue(sheet, 2, locationRow + 1)) ||
        addMinutesToTime(start, 60);

      schedule.push({
        id: makeId(),
        courseId: course.id,
        day,
        start,
        end,
        location: location || course.room,
        type: '',
      });
    }
  });

  return schedule;
};

const readExcelHours = (workbook: ExcelWorkbook) => {
  const sheet = excelSheet(workbook, 'Sir Hours Tracker');
  const hours: HourEntry[] = [];

  for (let row = 8; row <= 250; row += 1) {
    const event = excelText(sheet, 2, row);
    const project = excelText(sheet, 3, row);
    const date = excelValueToIsoDate(excelRawValue(sheet, 4, row));
    const start = excelValueToTime(excelRawValue(sheet, 5, row));
    const end = excelValueToTime(excelRawValue(sheet, 6, row));
    if (!event || !date || !start || !end) continue;

    hours.push({
      id: makeId(),
      event,
      project,
      date,
      start,
      end,
      notes: excelText(sheet, 9, row),
    });
  }

  return hours;
};

const parseAnnabelleExcelWorkbook = (
  workbook: ExcelWorkbook,
): ExcelImportResult => {
  const termStartDate = initialTemplateDate;
  const termEndDate = addDays(94, termStartDate);
  const courses = readExcelSetupCourses(workbook);
  enrichCoursesFromClassOutline(workbook, courses);

  const assignments = readExcelAssignments(workbook, courses).map(
    (assignment) => ({
      ...assignment,
      week: assignmentWeekLabel(assignment.dueDate, termStartDate, termEndDate),
    }),
  );
  const schedule = readExcelSchedule(workbook, courses);
  const hours = readExcelHours(workbook);

  return {
    data: {
      termStartDate,
      termEndDate,
      courses,
      assignments,
      schedule,
      officeHours: [],
      notes: [],
      hours,
      websites: [],
      shopping: [],
      homework: [],
      todos: [],
    },
    courses: courses.length,
    assignments: assignments.length,
    schedule: schedule.length,
    hours: hours.length,
  };
};

const percent = (value: number) => `${Math.round(value * 100)}%`;
const oneDecimal = (value: number) => (Math.round(value * 10) / 10).toFixed(1);

const normalizeAssignments = (
  assignments = defaultData.assignments,
): Assignment[] =>
  assignments.map((assignment) => ({
    ...assignment,
    dueTime: assignment.dueTime ?? '',
    linkIds: Array.isArray(assignment.linkIds) ? assignment.linkIds : [],
  }));

const normalizeSchedule = (schedule = defaultData.schedule): ScheduleBlock[] =>
  schedule.map((block) => ({
    ...block,
    type: block.type ?? '',
  }));

const normalizeNotes = (notes = defaultData.notes): NoteEntry[] =>
  notes.map((note) => ({
    ...note,
    width: note.width ?? undefined,
    height: note.height ?? undefined,
  }));

const normalizeData = (incoming: Partial<TrackerData>): TrackerData => {
  const termStartDate = incoming.termStartDate ?? defaultData.termStartDate;
  const termEndDate = incoming.termEndDate ?? defaultData.termEndDate;

  return {
    termStartDate,
    termEndDate,
    courses: incoming.courses ?? defaultData.courses,
    assignments: normalizeAssignments(incoming.assignments).map(
      (assignment) => ({
        ...assignment,
        week: assignmentWeekLabel(
          assignment.dueDate,
          termStartDate,
          termEndDate,
        ),
      }),
    ),
    schedule: normalizeSchedule(incoming.schedule),
    officeHours: incoming.officeHours ?? defaultData.officeHours,
    notes: normalizeNotes(incoming.notes),
    hours: incoming.hours ?? defaultData.hours,
    websites: incoming.websites ?? defaultData.websites,
    shopping: incoming.shopping ?? defaultData.shopping,
    homework: incoming.homework ?? defaultData.homework,
    todos: incoming.todos ?? defaultData.todos,
  };
};

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
      className={`h-10 min-w-0 border-2 border-blue-200 bg-white px-3 text-sm shadow-[3px_3px_0_#fef3c7] outline-none transition focus:border-blue-500 xl:h-9 ${props.className ?? ''}`}
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

function WeekdayToggleGroup({
  value,
  onChange,
}: {
  value: string[];
  onChange: (value: string[]) => void;
}) {
  const toggleDay = (day: string) => {
    if (value.includes(day)) {
      onChange(value.length > 1 ? value.filter((item) => item !== day) : value);
      return;
    }

    onChange(days.filter((item) => item === day || value.includes(item)));
  };

  return (
    <fieldset
      className="flex flex-wrap gap-2 border-0 p-0"
      aria-label="Repeat on"
    >
      {days.map((day) => {
        const selected = value.includes(day);
        return (
          <button
            key={day}
            type="button"
            aria-pressed={selected}
            aria-label={day}
            className={`grid size-9 place-items-center rounded-full border-2 text-sm font-black transition ${
              selected
                ? 'border-blue-400 bg-blue-200 text-blue-950'
                : 'border-blue-200 bg-white text-blue-950/55 hover:bg-blue-50'
            }`}
            onClick={() => toggleDay(day)}
          >
            {weekdayLabels[day]}
          </button>
        );
      })}
    </fieldset>
  );
}

function ColorPickerCube({
  value,
  onChange,
  label,
  selected = false,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  selected?: boolean;
}) {
  return (
    <label
      className={`relative grid size-8 cursor-pointer place-items-center overflow-hidden border-2 shadow-[2px_2px_0_#fef3c7] ${
        selected ? 'border-blue-500' : 'border-blue-300'
      }`}
      style={{ background: value || '#dbeafe' }}
      title={label}
      aria-label={label}
    >
      <Droplet className="pointer-events-none size-4 fill-white text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.45)]" />
      <input
        type="color"
        value={value || '#dbeafe'}
        className="absolute inset-0 cursor-pointer opacity-0"
        aria-label={label}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function CourseColorControls({
  value,
  onChange,
  label,
  size = 'md',
  presetLimit = courseColors.length,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  size?: 'sm' | 'md';
  presetLimit?: number;
}) {
  const swatchSize = size === 'sm' ? 'size-7' : 'size-8';
  const pickerClass = size === 'sm' ? '[&>label]:size-7' : '';
  const visibleColors = courseColors.slice(0, presetLimit);
  const customSelected = !visibleColors.includes(value);

  return (
    <div className={`flex flex-wrap gap-2 ${pickerClass}`}>
      {visibleColors.map((color) => (
        <button
          key={color}
          type="button"
          aria-label={`${label} ${color}`}
          className={`${swatchSize} border-2 ${
            value === color ? 'border-blue-500' : 'border-blue-200'
          }`}
          style={{ background: color }}
          onClick={() => onChange(color)}
        />
      ))}
      <ColorPickerCube
        value={value || '#dbeafe'}
        label={`${label} custom color`}
        selected={customSelected}
        onChange={onChange}
      />
    </div>
  );
}

function StickyNoteCard({
  note,
  courseName,
  onResize,
  onUpdate,
  onDelete,
}: {
  note: NoteEntry;
  courseName: string;
  onResize: (
    id: string,
    width: number,
    height: number,
    snapHeight: number | null,
  ) => void;
  onUpdate: <K extends keyof NoteEntry>(
    id: string,
    key: K,
    value: NoteEntry[K],
  ) => void;
  onDelete: (id: string) => void;
}) {
  const noteRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const element = noteRef.current;
    if (!element || typeof ResizeObserver === 'undefined') return;

    let lastWidth = element.offsetWidth;
    let lastHeight = element.offsetHeight;
    let resizeTimer: ReturnType<typeof setTimeout> | undefined;
    const observer = new ResizeObserver(() => {
      const width = element.offsetWidth;
      const height = element.offsetHeight;
      const widthChanged = Math.abs(width - lastWidth) >= 2;
      const heightChanged = Math.abs(height - lastHeight) >= 2;

      if (!widthChanged && !heightChanged) return;

      const otherHeights = heightChanged
        ? Array.from(document.querySelectorAll<HTMLElement>('[data-note-card]'))
            .filter((card) => card.dataset.noteId !== note.id)
            .map((card) => card.offsetHeight)
        : [];
      const nearestHeight = otherHeights.reduce<number | null>(
        (nearest, candidate) => {
          const currentDistance =
            nearest === null
              ? Number.POSITIVE_INFINITY
              : Math.abs(height - nearest);
          const candidateDistance = Math.abs(height - candidate);
          return candidateDistance < currentDistance ? candidate : nearest;
        },
        null,
      );
      const snapHeight =
        nearestHeight !== null && Math.abs(height - nearestHeight) <= 36
          ? nearestHeight
          : null;

      lastWidth = width;
      lastHeight = snapHeight ?? height;
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        if (snapHeight !== null) element.style.height = `${snapHeight}px`;
        onResize(note.id, width, height, snapHeight);
      }, 120);
    });

    observer.observe(element);

    return () => {
      observer.disconnect();
      if (resizeTimer) clearTimeout(resizeTimer);
    };
  }, [note.id, onResize]);

  return (
    <article
      ref={noteRef}
      data-note-card
      data-note-id={note.id}
      className="pixel-panel grid min-h-[180px] min-w-[260px] resize grid-rows-[auto_1fr] overflow-auto p-4"
      style={{
        width: note.width ?? noteDefaultWidth,
        height: note.height ?? noteDefaultHeight,
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="grid gap-1">
          <p className="text-[13px] font-bold uppercase text-blue-950/70">
            {courseName}
          </p>
          <input
            value={note.title}
            onChange={(event) => onUpdate(note.id, 'title', event.target.value)}
            className="w-full min-w-0 bg-transparent text-xl leading-tight font-black text-blue-950 outline-none placeholder:text-blue-950/35 focus:bg-blue-50/60"
            placeholder="Untitled note"
            aria-label="Note title"
          />
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Delete note"
          onClick={() => onDelete(note.id)}
        >
          <Trash2 />
        </Button>
      </div>
      <textarea
        value={note.body}
        onChange={(event) => onUpdate(note.id, 'body', event.target.value)}
        className="mt-3 min-h-0 w-full resize-none bg-transparent text-base leading-7 whitespace-pre-wrap text-blue-950/75 outline-none placeholder:text-blue-950/35 focus:bg-blue-50/60"
        placeholder="No note text yet."
        aria-label="Note body"
      />
    </article>
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
  const schedulePdfInputRef = useRef<HTMLInputElement>(null);
  const excelInputRef = useRef<HTMLInputElement>(null);
  const comfortImageInputRef = useRef<HTMLInputElement>(null);
  const notesBoardRef = useRef<HTMLElement | null>(null);
  const [data, setData] = useState<TrackerData>(defaultData);
  const dataRef = useRef(defaultData);
  const userRef = useRef<User | null>(null);
  const scheduleResizeRef = useRef<{
    target: 'schedule' | 'officeHours';
    edge: 'start' | 'end';
    id: string;
    startY: number;
    startMinutes: number;
    startEndMinutes: number;
  } | null>(null);
  const cloudSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cloudLoaded = useRef(false);
  const syncingUserId = useRef<string | null>(null);
  const activeTab = tabFromPathname(pathname);
  const [weeklyWeekStart, setWeeklyWeekStart] = useState(
    startOfWeekIso(initialTemplateDate),
  );
  const [weeklyShowClasses, setWeeklyShowClasses] = useState(true);
  const [weeklyShowOfficeHours, setWeeklyShowOfficeHours] = useState(false);
  const [weeklyShowAssignments, setWeeklyShowAssignments] = useState(true);
  const [resizingScheduleBlockId, setResizingScheduleBlockId] = useState('');
  const [notesBoardWidth, setNotesBoardWidth] = useState(
    noteBoardFallbackWidth,
  );
  const [storageReady, setStorageReady] = useState(false);
  const [dateLabel, setDateLabel] = useState('Today');
  const [todayDay, setTodayDay] = useState('Monday');
  const [user, setUser] = useState<User | null>(null);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authMessage, setAuthMessage] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [cloudStatus, setCloudStatus] = useState<CloudStatus>('local');
  const [friendEmailDraft, setFriendEmailDraft] = useState('');
  const [teamNameDraft, setTeamNameDraft] = useState('');
  const [selectedFriendIds, setSelectedFriendIds] = useState<string[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [teamMemberDraft, setTeamMemberDraft] = useState('');
  const [minimumBreakMinutes, setMinimumBreakMinutes] = useState(45);
  const [focusMode, setFocusMode] = useState<FocusMode>('focus');
  const [focusSecondsLeft, setFocusSecondsLeft] = useState(
    focusModeOptions[0].minutes * 60,
  );
  const [focusRunning, setFocusRunning] = useState(false);
  const [focusCourseId, setFocusCourseId] = useState(defaultData.courses[0].id);
  const [focusAssignmentId, setFocusAssignmentId] = useState('');
  const [comfortImages, setComfortImages] = useState<ComfortImage[]>([]);
  const [comfortMessage, setComfortMessage] = useState('');
  const [friendsBusy, setFriendsBusy] = useState(false);
  const [friendsMessage, setFriendsMessage] = useState('');
  const [socialProfiles, setSocialProfiles] = useState<SocialProfile[]>([]);
  const [friendInvites, setFriendInvites] = useState<FriendInvite[]>([]);
  const [friendships, setFriendships] = useState<Friendship[]>([]);
  const [availabilityRows, setAvailabilityRows] = useState<AvailabilityRow[]>(
    [],
  );
  const [friendTeams, setFriendTeams] = useState<FriendTeam[]>([]);
  const [friendTeamMembers, setFriendTeamMembers] = useState<
    FriendTeamMember[]
  >([]);
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
  const [scheduleDraftDays, setScheduleDraftDays] = useState<string[]>([
    'Monday',
  ]);
  const [officeHourDraft, setOfficeHourDraft] = useState<OfficeHourBlock>(
    blankOfficeHour(defaultData.courses[0].id),
  );
  const [officeHourDraftDays, setOfficeHourDraftDays] = useState<string[]>([
    'Monday',
  ]);
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
    if (activeTab !== 'notes') return;

    const element = notesBoardRef.current;
    if (!element) return;

    const updateWidth = () => {
      setNotesBoardWidth(
        Math.max(noteMinWidth, Math.floor(element.clientWidth)),
      );
    };

    updateWidth();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateWidth);
      return () => window.removeEventListener('resize', updateWidth);
    }

    const observer = new ResizeObserver(updateWidth);
    observer.observe(element);

    return () => observer.disconnect();
  }, [activeTab]);

  useEffect(() => {
    if (!focusRunning) return;

    const interval = window.setInterval(() => {
      setFocusSecondsLeft((current) => {
        if (current <= 1) {
          setFocusRunning(false);
          return 0;
        }

        return current - 1;
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, [focusRunning]);

  useEffect(() => {
    queueMicrotask(() => {
      const saved = localStorage.getItem(comfortStorageKey);
      if (!saved) return;

      try {
        const parsed = JSON.parse(saved) as ComfortImage[];
        setComfortImages(
          parsed.filter(
            (image) =>
              image &&
              typeof image.id === 'string' &&
              typeof image.src === 'string',
          ),
        );
      } catch {
        localStorage.removeItem(comfortStorageKey);
      }
    });
  }, []);

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
          setAssignmentDraft(blankAssignment(parsed.courses[0]?.id ?? ''));
          setScheduleDraft(blankSchedule(parsed.courses[0]?.id ?? ''));
          setOfficeHourDraft(blankOfficeHour(parsed.courses[0]?.id ?? ''));
          setNoteDraft(blankNote(parsed.courses[0]?.id ?? ''));
          setWebsiteDraft(blankWebsite(parsed.courses[0]?.id ?? ''));
          setShoppingDraft(blankShoppingItem(parsed.courses[0]?.id ?? ''));
          setHomeworkDraft(blankHomeworkItem(parsed.courses[0]?.id ?? ''));
          setTodoDraft(blankTodoItem());
          setFocusCourseId(parsed.courses[0]?.id ?? '');
          setFocusAssignmentId('');
        } catch {
          localStorage.removeItem(storageKey);
        }
      }
      if (!hydrated) {
        const currentDefaults = createDefaultData(todayIso());
        const firstCourseId = currentDefaults.courses[0]?.id ?? '';
        setData(currentDefaults);
        setAssignmentDraft(blankAssignment(firstCourseId));
        setScheduleDraft(blankSchedule(firstCourseId));
        setOfficeHourDraft(blankOfficeHour(firstCourseId));
        setNoteDraft(blankNote(firstCourseId));
        setWebsiteDraft(blankWebsite(firstCourseId));
        setShoppingDraft(blankShoppingItem(firstCourseId));
        setHomeworkDraft(blankHomeworkItem(firstCourseId));
        setTodoDraft(blankTodoItem());
        setFocusCourseId(firstCourseId);
        setFocusAssignmentId('');
      }
      setDateLabel(
        new Date().toLocaleDateString(undefined, {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
        }),
      );
      setTodayDay(dayFromIsoDate(todayIso()) ?? 'Monday');
      setWeeklyWeekStart(startOfWeekIso(todayIso()));
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

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  useEffect(() => {
    if (!resizingScheduleBlockId) return;

    const previousUserSelect = document.body.style.userSelect;
    document.body.style.userSelect = 'none';

    return () => {
      document.body.style.userSelect = previousUserSelect;
    };
  }, [resizingScheduleBlockId]);

  const saveCloudData = useCallback(
    async (currentUser = userRef.current, trackerData = dataRef.current) => {
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
    [],
  );

  const loadCloudData = useCallback(
    async (currentUser = userRef.current) => {
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
    [saveCloudData],
  );

  const loadFriendsData = useCallback(async (currentUser = userRef.current) => {
    if (!supabase || !currentUser) return;

    const email = currentUser.email?.trim().toLowerCase();
    if (!email) {
      setFriendsMessage('Sign in with an email to use Friends.');
      return;
    }

    setFriendsBusy(true);
    setFriendsMessage('');

    try {
      const displayName = email.split('@')[0] ?? email;
      const { error: profileError } = await withTimeout(
        supabase.from('tracker_social_profiles').upsert(
          {
            user_id: currentUser.id,
            email,
            display_name: displayName,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' },
        ),
      );

      if (profileError) throw new Error(profileError.message);

      const [
        invitesResult,
        friendshipsResult,
        teamsResult,
        teamMembersResult,
      ] = await Promise.all([
        withTimeout(
          supabase
            .from('tracker_friend_invites')
            .select('*')
            .order('created_at', { ascending: false }),
        ),
        withTimeout(
          supabase
            .from('tracker_friendships')
            .select('*')
            .order('created_at', { ascending: false }),
        ),
        withTimeout(
          supabase
            .from('tracker_friend_teams')
            .select('*')
            .order('created_at', { ascending: false }),
        ),
        withTimeout(
          supabase
            .from('tracker_friend_team_members')
            .select('*')
            .order('created_at', { ascending: true }),
        ),
      ]);

      if (invitesResult.error) throw new Error(invitesResult.error.message);
      if (friendshipsResult.error)
        throw new Error(friendshipsResult.error.message);
      if (teamsResult.error) throw new Error(teamsResult.error.message);
      if (teamMembersResult.error)
        throw new Error(teamMembersResult.error.message);

      const nextInvites = (invitesResult.data ?? []) as FriendInvite[];
      const nextFriendships = (friendshipsResult.data ?? []) as Friendship[];
      const friendIds = nextFriendships.map((friendship) =>
        friendOtherUserId(friendship, currentUser.id),
      );
      const visibleUserIds = Array.from(new Set([currentUser.id, ...friendIds]));

      const [profilesResult, availabilityResult] = await Promise.all([
        withTimeout(
          supabase
            .from('tracker_social_profiles')
            .select('*')
            .in('user_id', visibleUserIds),
        ),
        withTimeout(
          supabase
            .from('tracker_availability_windows')
            .select('*')
            .in('user_id', visibleUserIds)
            .order('day', { ascending: true })
            .order('start_time', { ascending: true }),
        ),
      ]);

      if (profilesResult.error) throw new Error(profilesResult.error.message);
      if (availabilityResult.error)
        throw new Error(availabilityResult.error.message);

      setFriendInvites(nextInvites);
      setFriendships(nextFriendships);
      setSocialProfiles((profilesResult.data ?? []) as SocialProfile[]);
      setAvailabilityRows((availabilityResult.data ?? []) as AvailabilityRow[]);
      setFriendTeams((teamsResult.data ?? []) as FriendTeam[]);
      setFriendTeamMembers(
        (teamMembersResult.data ?? []) as FriendTeamMember[],
      );
      setSelectedFriendIds((currentSelection) => {
        const existingSelection = currentSelection.filter((id) =>
          friendIds.includes(id),
        );
        return existingSelection.length ? existingSelection : friendIds;
      });
    } catch (error) {
      setFriendsMessage(
        cloudErrorMessage(
          error instanceof Error ? error.message : 'Friends sync failed.',
        ),
      );
    } finally {
      setFriendsBusy(false);
    }
  }, []);

  const publishAvailability = async () => {
    if (!supabase || !user) {
      setFriendsMessage('Sign in to publish availability.');
      return;
    }

    const windows = buildAvailabilityWindows(data.schedule, data.officeHours);
    setFriendsBusy(true);
    setFriendsMessage('');

    try {
      const { error: deleteError } = await withTimeout(
        supabase
          .from('tracker_availability_windows')
          .delete()
          .eq('user_id', user.id)
          .eq('source', 'schedule'),
      );

      if (deleteError) throw new Error(deleteError.message);

      if (windows.length) {
        const { error: insertError } = await withTimeout(
          supabase.from('tracker_availability_windows').insert(
            windows.map((window) => ({
              user_id: user.id,
              day: window.day,
              start_time: window.start,
              end_time: window.end,
              source: 'schedule',
              updated_at: new Date().toISOString(),
            })),
          ),
        );

        if (insertError) throw new Error(insertError.message);
      }

      setFriendsMessage('Availability published.');
      await loadFriendsData(user);
    } catch (error) {
      setFriendsMessage(
        cloudErrorMessage(
          error instanceof Error
            ? error.message
            : 'Availability publish failed.',
        ),
      );
    } finally {
      setFriendsBusy(false);
    }
  };

  const sendFriendInvite = async () => {
    if (!supabase || !user) {
      setFriendsMessage('Sign in to add friends.');
      return;
    }

    const recipientEmail = friendEmailDraft.trim().toLowerCase();
    if (!recipientEmail) return;
    const senderEmail = user.email?.trim().toLowerCase() ?? null;

    setFriendsBusy(true);
    setFriendsMessage('');

    try {
      const { error } = await withTimeout(
        supabase.from('tracker_friend_invites').insert({
          sender_id: user.id,
          sender_email: senderEmail,
          recipient_email: recipientEmail,
        }),
      );

      if (error) throw new Error(error.message);

      setFriendEmailDraft('');
      setFriendsMessage('Friend invite sent.');
      await loadFriendsData(user);
    } catch (error) {
      setFriendsMessage(
        cloudErrorMessage(
          error instanceof Error ? error.message : 'Friend invite failed.',
        ),
      );
    } finally {
      setFriendsBusy(false);
    }
  };

  const respondToFriendInvite = async (
    invite: FriendInvite,
    status: 'accepted' | 'declined',
  ) => {
    if (!supabase || !user) return;

    setFriendsBusy(true);
    setFriendsMessage('');

    try {
      const { error: inviteError } = await withTimeout(
        supabase
          .from('tracker_friend_invites')
          .update({
            status,
            recipient_id: user.id,
            responded_at: new Date().toISOString(),
          })
          .eq('id', invite.id),
      );

      if (inviteError) throw new Error(inviteError.message);

      if (status === 'accepted') {
        const { error: friendshipError } = await withTimeout(
          supabase
            .from('tracker_friendships')
            .insert(orderedFriendshipPair(invite.sender_id, user.id)),
        );

        if (
          friendshipError &&
          !friendshipError.message.toLowerCase().includes('duplicate')
        ) {
          throw new Error(friendshipError.message);
        }
      }

      setFriendsMessage(
        status === 'accepted' ? 'Friend invite accepted.' : 'Invite declined.',
      );
      await loadFriendsData(user);
    } catch (error) {
      setFriendsMessage(
        cloudErrorMessage(
          error instanceof Error ? error.message : 'Invite update failed.',
        ),
      );
    } finally {
      setFriendsBusy(false);
    }
  };

  const createFriendTeam = async () => {
    if (!supabase || !user) {
      setFriendsMessage('Sign in to create a team.');
      return;
    }

    const name = teamNameDraft.trim();
    if (!name) return;

    setFriendsBusy(true);
    setFriendsMessage('');

    try {
      const { data: team, error: teamError } = await withTimeout(
        supabase
          .from('tracker_friend_teams')
          .insert({
            owner_id: user.id,
            name,
          })
          .select('*')
          .single(),
      );

      if (teamError) throw new Error(teamError.message);

      const createdTeam = team as FriendTeam;
      const { error: memberError } = await withTimeout(
        supabase.from('tracker_friend_team_members').insert({
          team_id: createdTeam.id,
          user_id: user.id,
          role: 'owner',
          status: 'active',
        }),
      );

      if (memberError) throw new Error(memberError.message);

      setTeamNameDraft('');
      setSelectedTeamId(createdTeam.id);
      setFriendsMessage('Team created.');
      await loadFriendsData(user);
    } catch (error) {
      setFriendsMessage(
        cloudErrorMessage(
          error instanceof Error ? error.message : 'Team creation failed.',
        ),
      );
    } finally {
      setFriendsBusy(false);
    }
  };

  const addFriendToTeam = async () => {
    if (!supabase || !user || !selectedTeamId || !teamMemberDraft) return;

    setFriendsBusy(true);
    setFriendsMessage('');

    try {
      const { error } = await withTimeout(
        supabase.from('tracker_friend_team_members').insert({
          team_id: selectedTeamId,
          user_id: teamMemberDraft,
          role: 'member',
          status: 'active',
        }),
      );

      if (error && !error.message.toLowerCase().includes('duplicate')) {
        throw new Error(error.message);
      }

      setTeamMemberDraft('');
      setFriendsMessage('Team member added.');
      await loadFriendsData(user);
    } catch (error) {
      setFriendsMessage(
        cloudErrorMessage(
          error instanceof Error ? error.message : 'Could not add teammate.',
        ),
      );
    } finally {
      setFriendsBusy(false);
    }
  };

  useEffect(() => {
    if (!supabase) return;

    let cancelled = false;

    const applySessionUser = async (sessionUser: User | null) => {
      if (cancelled) return;
      setUser(sessionUser);

      if (!sessionUser) {
        cloudLoaded.current = false;
        setCloudStatus('local');
        setFriendsMessage('');
        setSocialProfiles([]);
        setFriendInvites([]);
        setFriendships([]);
        setAvailabilityRows([]);
        setFriendTeams([]);
        setFriendTeamMembers([]);
        setSelectedFriendIds([]);
        setSelectedTeamId('');
        setTeamMemberDraft('');
        return;
      }

      setAuthEmail(sessionUser.email ?? '');
      if (cloudLoaded.current && userRef.current?.id === sessionUser.id) return;

      cloudLoaded.current = false;
      await loadCloudData(sessionUser);
      await loadFriendsData(sessionUser);
    };

    void supabase.auth.getSession().then(({ data: sessionData, error }) => {
      if (cancelled) return;
      if (error) {
        setCloudStatus('offline');
        setAuthMessage(cloudErrorMessage(error.message));
        return;
      }

      void applySessionUser(sessionData.session?.user ?? null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      void applySessionUser(session?.user ?? null);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [loadCloudData, loadFriendsData]);

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

  useEffect(() => {
    if (!storageReady) return;

    const flushLatestData = () => {
      localStorage.setItem(storageKey, JSON.stringify(dataRef.current));

      if (cloudSaveTimer.current) {
        clearTimeout(cloudSaveTimer.current);
        cloudSaveTimer.current = null;
      }

      if (supabase && userRef.current && cloudLoaded.current) {
        void saveCloudData(userRef.current, dataRef.current);
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') flushLatestData();
    };

    window.addEventListener('pagehide', flushLatestData);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('pagehide', flushLatestData);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      flushLatestData();
    };
  }, [saveCloudData, storageReady]);

  const courseById = useMemo(
    () => new Map(data.courses.map((course) => [course.id, course])),
    [data.courses],
  );
  const selectedOfficeHourCourse = courseById.get(officeHourDraft.courseId);
  const effectiveFocusCourseId = data.courses.some(
    (course) => course.id === focusCourseId,
  )
    ? focusCourseId
    : (data.courses[0]?.id ?? '');
  const focusCourse = courseById.get(effectiveFocusCourseId);
  const focusAssignments = useMemo(
    () =>
      data.assignments
        .filter(
          (assignment) =>
            assignment.courseId === effectiveFocusCourseId &&
            assignment.status !== 'Done' &&
            !assignment.submitted,
        )
        .sort((a, b) => {
          const dueDateDiff =
            new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
          if (dueDateDiff !== 0) return dueDateDiff;
          return (a.dueTime ?? '').localeCompare(b.dueTime ?? '');
        }),
    [data.assignments, effectiveFocusCourseId],
  );
  const focusAssignment = focusAssignments.find(
    (assignment) => assignment.id === focusAssignmentId,
  );
  const activeFocusMode =
    focusModeOptions.find((option) => option.value === focusMode) ??
    focusModeOptions[0];
  const focusTotalSeconds = activeFocusMode.minutes * 60;
  const focusProgress =
    focusTotalSeconds > 0 ? focusSecondsLeft / focusTotalSeconds : 0;
  const focusElapsedSeconds = focusTotalSeconds - focusSecondsLeft;
  const focusRadius = 102;
  const focusCircumference = 2 * Math.PI * focusRadius;
  const focusDashOffset = focusCircumference * (1 - focusProgress);

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
        assignmentWeekLabel(
          assignment.dueDate,
          data.termStartDate,
          data.termEndDate,
        ) ===
          assignmentWeekLabel(
            todayIso(),
            data.termStartDate,
            data.termEndDate,
          ) &&
        assignment.status !== 'Done' &&
        !assignment.submitted,
    ).length;
    return { total, done, overdue, dueThisWeek };
  }, [data.assignments, data.termEndDate, data.termStartDate]);

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
  const upcomingAssignments = useMemo(
    () =>
      [...data.assignments]
        .filter(
          (assignment) => assignment.status !== 'Done' && !assignment.submitted,
        )
        .sort((a, b) => {
          const dueDateDiff =
            new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
          if (dueDateDiff !== 0) return dueDateDiff;
          return (a.dueTime ?? '').localeCompare(b.dueTime ?? '');
        })
        .slice(0, 6),
    [data.assignments],
  );
  const todaysClasses = useMemo(
    () =>
      data.schedule
        .filter((block) => block.day === todayDay)
        .sort((a, b) => a.start.localeCompare(b.start)),
    [data.schedule, todayDay],
  );
  const weeklyDates = useMemo(
    () => days.map((_day, index) => addIsoDays(weeklyWeekStart, index)),
    [weeklyWeekStart],
  );
  const weeklyDateSet = useMemo(() => new Set(weeklyDates), [weeklyDates]);
  const weeklyAssignments = useMemo(
    () =>
      data.assignments.filter(
        (assignment) =>
          weeklyDateSet.has(assignment.dueDate) &&
          assignment.status !== 'Done' &&
          !assignment.submitted,
      ),
    [data.assignments, weeklyDateSet],
  );
  const ownAvailabilityWindows = useMemo(
    () => buildAvailabilityWindows(data.schedule, data.officeHours),
    [data.officeHours, data.schedule],
  );
  const socialProfileById = useMemo(
    () =>
      new Map(socialProfiles.map((profile) => [profile.user_id, profile])),
    [socialProfiles],
  );
  const friendIds = useMemo(
    () =>
      user
        ? friendships.map((friendship) => friendOtherUserId(friendship, user.id))
        : [],
    [friendships, user],
  );
  const incomingFriendInvites = useMemo(
    () =>
      user
        ? friendInvites.filter(
            (invite) =>
              invite.status === 'pending' &&
              invite.sender_id !== user.id &&
              invite.recipient_email === user.email?.toLowerCase(),
          )
        : [],
    [friendInvites, user],
  );
  const outgoingFriendInvites = useMemo(
    () =>
      user
        ? friendInvites.filter(
            (invite) =>
              invite.status === 'pending' && invite.sender_id === user.id,
          )
        : [],
    [friendInvites, user],
  );
  const selectedTeamMembers = useMemo(
    () =>
      selectedTeamId
        ? friendTeamMembers
            .filter(
              (member) =>
                member.team_id === selectedTeamId &&
                member.status === 'active' &&
                member.user_id !== user?.id,
            )
            .map((member) => member.user_id)
        : [],
    [friendTeamMembers, selectedTeamId, user?.id],
  );
  const overlapFriendIds =
    selectedTeamId && selectedTeamMembers.length
      ? selectedTeamMembers.filter((id) => friendIds.includes(id))
      : selectedFriendIds.filter((id) => friendIds.includes(id));
  const availabilityByUser = useMemo(() => {
    const grouped = new Map<string, AvailabilityWindow[]>();

    if (user) {
      const publishedSelfWindows = windowsFromRows(
        availabilityRows.filter((row) => row.user_id === user.id),
      );
      grouped.set(
        user.id,
        publishedSelfWindows.length
          ? publishedSelfWindows
          : ownAvailabilityWindows,
      );
    }

    friendIds.forEach((friendId) => {
      grouped.set(
        friendId,
        windowsFromRows(
          availabilityRows.filter((row) => row.user_id === friendId),
        ),
      );
    });

    return grouped;
  }, [availabilityRows, friendIds, ownAvailabilityWindows, user]);
  const commonBreakWindows = useMemo(
    () =>
      user
        ? findCommonBreakWindows(
            availabilityByUser,
            [user.id, ...overlapFriendIds],
            minimumBreakMinutes,
          ).slice(0, 6)
        : [],
    [availabilityByUser, minimumBreakMinutes, overlapFriendIds, user],
  );
  const ownPublishedAvailabilityCount = user
    ? availabilityRows.filter((row) => row.user_id === user.id).length
    : 0;
  const sortedNotes = useMemo(
    () => [...data.notes].sort((a, b) => Number(b.pinned) - Number(a.pinned)),
    [data.notes],
  );
  const packedNotes = useMemo(
    () => packNoteLayouts(sortedNotes, notesBoardWidth),
    [notesBoardWidth, sortedNotes],
  );
  const cloudStatusLabel = !supabaseConfigured
    ? 'setup'
    : user
      ? cloudStatus
      : cloudStatus === 'offline'
        ? 'offline'
        : 'local';

  const selectFocusMode = (nextMode: FocusMode) => {
    const nextOption =
      focusModeOptions.find((option) => option.value === nextMode) ??
      focusModeOptions[0];

    setFocusMode(nextMode);
    setFocusRunning(false);
    setFocusSecondsLeft(nextOption.minutes * 60);
  };

  const resetFocusTimer = () => {
    setFocusRunning(false);
    setFocusSecondsLeft(focusTotalSeconds);
  };

  const saveComfortImages = (nextImages: ComfortImage[], message = '') => {
    setComfortImages(nextImages);

    try {
      localStorage.setItem(comfortStorageKey, JSON.stringify(nextImages));
      setComfortMessage(message);
    } catch {
      setComfortMessage(
        'Saved for this session, but the browser ran out of local picture space.',
      );
    }
  };

  const uploadComfortImages = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const files = Array.from(event.target.files ?? []);
    if (!files.length) return;

    setComfortMessage('Adding pictures...');

    try {
      const preparedImages = await Promise.all(files.map(readComfortImageFile));
      const newImages = preparedImages.map((image) => ({
        ...image,
        id: makeId(),
        caption: '',
        addedAt: new Date().toISOString(),
      }));
      const nextImages = [...newImages, ...comfortImages].slice(
        0,
        comfortMaxImages,
      );
      const skippedCount =
        comfortImages.length + newImages.length - nextImages.length;

      saveComfortImages(
        nextImages,
        skippedCount > 0
          ? `Added ${newImages.length} picture${
              newImages.length === 1 ? '' : 's'
            }. Kept the newest ${comfortMaxImages}.`
          : `Added ${newImages.length} picture${
              newImages.length === 1 ? '' : 's'
            }.`,
      );
    } catch (error) {
      setComfortMessage(
        error instanceof Error ? error.message : 'Those pictures could not load.',
      );
    } finally {
      event.target.value = '';
    }
  };

  const updateComfortCaption = (id: string, caption: string) => {
    saveComfortImages(
      comfortImages.map((image) =>
        image.id === id ? { ...image, caption } : image,
      ),
    );
  };

  const removeComfortImage = (id: string) => {
    saveComfortImages(
      comfortImages.filter((image) => image.id !== id),
      'Picture removed.',
    );
  };

  const clearComfortImages = () => {
    saveComfortImages([], 'Comfort board cleared.');
  };

  const updateAssignment = <K extends keyof Assignment>(
    id: string,
    key: K,
    value: Assignment[K],
  ) => {
    setData((current) => ({
      ...current,
      assignments: current.assignments.map((assignment) => {
        if (assignment.id !== id) return assignment;

        const updatedAssignment = { ...assignment, [key]: value };
        if (key !== 'dueDate') return updatedAssignment;

        return {
          ...updatedAssignment,
          week: assignmentWeekLabel(
            String(value),
            current.termStartDate,
            current.termEndDate,
          ),
        };
      }),
    }));
  };

  const updateTermDate = (
    key: 'termStartDate' | 'termEndDate',
    value: string,
  ) => {
    setData((current) => {
      const next = { ...current, [key]: value };

      return {
        ...next,
        assignments: next.assignments.map((assignment) => ({
          ...assignment,
          week: assignmentWeekLabel(
            assignment.dueDate,
            next.termStartDate,
            next.termEndDate,
          ),
        })),
      };
    });
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

  const updateNote = <K extends keyof NoteEntry>(
    id: string,
    key: K,
    value: NoteEntry[K],
  ) => {
    setData((current) => ({
      ...current,
      notes: current.notes.map((item) =>
        item.id === id ? { ...item, [key]: value } : item,
      ),
    }));
  };

  const saveNoteSize = useCallback(
    (id: string, width: number, height: number, snapHeight: number | null) => {
      const nextWidth = clampNumber(
        Math.round(width),
        noteMinWidth,
        noteMaxWidth,
      );
      const nextHeight = clampNumber(
        Math.round(snapHeight ?? height),
        noteMinHeight,
        noteMaxHeight,
      );

      setData((current) => {
        let changed = false;
        const notes = current.notes.map((item) => {
          if (item.id !== id) return item;
          if (item.width === nextWidth && item.height === nextHeight) {
            return item;
          }

          changed = true;
          return {
            ...item,
            width: nextWidth,
            height: nextHeight,
          };
        });

        return changed ? { ...current, notes } : current;
      });
    },
    [],
  );

  const updateCalendarBlockTime = (
    target: 'schedule' | 'officeHours',
    id: string,
    updates: Pick<ScheduleBlock | OfficeHourBlock, 'start' | 'end'>,
  ) => {
    setData((current) =>
      target === 'schedule'
        ? {
            ...current,
            schedule: current.schedule.map((block) =>
              block.id === id ? { ...block, ...updates } : block,
            ),
          }
        : {
            ...current,
            officeHours: current.officeHours.map((block) =>
              block.id === id ? { ...block, ...updates } : block,
            ),
          },
    );
  };

  const startScheduleBlockResize = (
    event: React.PointerEvent<HTMLButtonElement>,
    edge: 'start' | 'end',
    block: Pick<ScheduleBlock | OfficeHourBlock, 'id' | 'start' | 'end'>,
    target: 'schedule' | 'officeHours' = 'schedule',
  ) => {
    if (event.button !== 0) return;

    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);

    const startMinutes = clampNumber(
      timeToMinutes(block.start),
      scheduleStartMinutes,
      scheduleEndMinutes - 5,
    );
    const startEndMinutes = clampNumber(
      timeToMinutes(block.end),
      startMinutes + 5,
      scheduleEndMinutes,
    );

    scheduleResizeRef.current = {
      target,
      edge,
      id: block.id,
      startY: event.clientY,
      startMinutes,
      startEndMinutes,
    };
    setResizingScheduleBlockId(block.id);

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const resize = scheduleResizeRef.current;
      if (!resize) return;

      const minuteDelta = snapToFiveMinutes(
        ((moveEvent.clientY - resize.startY) / scheduleHourHeight) * 60,
      );

      if (resize.edge === 'start') {
        const nextStart = clampNumber(
          snapToFiveMinutes(resize.startMinutes + minuteDelta),
          scheduleStartMinutes,
          resize.startEndMinutes - 5,
        );

        updateCalendarBlockTime(resize.target, resize.id, {
          start: minutesToTime(nextStart),
          end: minutesToTime(resize.startEndMinutes),
        });
        return;
      }

      const nextEnd = clampNumber(
        snapToFiveMinutes(resize.startEndMinutes + minuteDelta),
        resize.startMinutes + 5,
        scheduleEndMinutes,
      );

      updateCalendarBlockTime(resize.target, resize.id, {
        start: minutesToTime(resize.startMinutes),
        end: minutesToTime(nextEnd),
      });
    };

    const handlePointerUp = () => {
      scheduleResizeRef.current = null;
      setResizingScheduleBlockId('');
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
  };

  const addAssignment = () => {
    if (!assignmentDraft.title.trim()) return;
    setData((current) => ({
      ...current,
      assignments: [
        {
          ...assignmentDraft,
          id: makeId(),
          week: assignmentWeekLabel(
            assignmentDraft.dueDate,
            current.termStartDate,
            current.termEndDate,
          ),
        },
        ...current.assignments,
      ],
    }));
    setAssignmentDraft(blankAssignment(assignmentDraft.courseId));
  };

  const createCustomCourse = useCallback((name: string) => {
    const cleanName = name.trim();
    const matchingCourse = dataRef.current.courses.find(
      (course) => course.name.trim().toLowerCase() === cleanName.toLowerCase(),
    );

    if (matchingCourse) return matchingCourse.id;

    const id = makeId();
    const color =
      courseColors[dataRef.current.courses.length % courseColors.length];

    setData((current) => ({
      ...current,
      courses: [
        ...current.courses,
        {
          id,
          name: cleanName,
          code: '',
          room: '',
          instructor: '',
          email: '',
          section: '',
          teams: '',
          extension: '',
          weeklyPonderation: '',
          credits: 0,
          color,
        },
      ],
    }));

    return id;
  }, []);

  const addCourse = () => {
    if (!courseDraft.name.trim()) return;
    const course = { ...courseDraft, id: makeId() };
    setData((current) => ({
      ...current,
      courses: [...current.courses, course],
    }));
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
    const selectedDays = scheduleDraftDays.length
      ? scheduleDraftDays
      : [scheduleDraft.day];
    const { start, end } = calendarBlockMinutes(scheduleDraft);
    const normalizedScheduleDraft = {
      ...scheduleDraft,
      start: minutesToTime(start),
      end: minutesToTime(end),
    };

    setData((current) => ({
      ...current,
      schedule: [
        ...current.schedule,
        ...selectedDays.map((day) => ({
          ...normalizedScheduleDraft,
          id: makeId(),
          day,
        })),
      ],
    }));
    setScheduleDraft({
      ...blankSchedule(scheduleDraft.courseId),
      day: selectedDays[0] ?? 'Monday',
    });
  };

  const addOfficeHour = () => {
    const selectedDays = officeHourDraftDays.length
      ? officeHourDraftDays
      : [officeHourDraft.day];
    const { start, end } = calendarBlockMinutes(officeHourDraft);
    const normalizedOfficeHourDraft = {
      ...officeHourDraft,
      start: minutesToTime(start),
      end: minutesToTime(end),
    };

    setData((current) => ({
      ...current,
      officeHours: [
        ...current.officeHours,
        ...selectedDays.map((day) => ({
          ...normalizedOfficeHourDraft,
          id: makeId(),
          day,
        })),
      ],
    }));
    setOfficeHourDraft({
      ...blankOfficeHour(officeHourDraft.courseId),
      day: selectedDays[0] ?? 'Monday',
    });
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

  const removeItem = (collection: TrackerCollectionKey, id: string) => {
    setData((current) => {
      const items = current[collection] as { id: string }[];

      return {
        ...current,
        [collection]: items.filter((item) => item.id !== id),
      };
    });
  };

  const resetTemplate = () => {
    const currentDefaults = createDefaultData(todayIso());
    setData(currentDefaults);
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

  const importSchedulePdf = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setAuthMessage('Reading schedule PDF...');
      const parsed = parseStudentSchedulePdfText(await extractPdfText(file));
      if (parsed.courses.length === 0 || parsed.schedule.length === 0) {
        throw new Error('No schedule rows were found.');
      }

      const result = mergeStudentScheduleImport(data, parsed);
      setData(result.data);

      setAuthMessage(
        `Imported ${result.addedCourses} new courses, updated ${result.updatedCourses}, added ${result.addedBlocks} class blocks, replaced ${result.replacedBlocks}, skipped ${result.skippedBlocks}.`,
      );
    } catch (error) {
      setAuthMessage('Schedule PDF import failed.');
      alert(
        error instanceof Error
          ? error.message
          : 'That schedule PDF could not be imported.',
      );
    } finally {
      event.target.value = '';
    }
  };

  const importExcelSetup = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setAuthMessage('Reading Excel setup...');
      const xlsx = await import('xlsx');
      const workbook = xlsx.read(await file.arrayBuffer(), {
        type: 'array',
        cellDates: true,
      }) as ExcelWorkbook;
      const result = parseAnnabelleExcelWorkbook(workbook);

      if (
        result.courses === 0 &&
        result.assignments === 0 &&
        result.schedule === 0
      ) {
        throw new Error('No tracker data was found in that workbook.');
      }

      const firstCourseId = result.data.courses[0]?.id ?? '';
      setData(result.data);
      setAssignmentDraft(blankAssignment(firstCourseId));
      setScheduleDraft(blankSchedule(firstCourseId));
      setScheduleDraftDays(['Monday']);
      setOfficeHourDraft(blankOfficeHour(firstCourseId));
      setOfficeHourDraftDays(['Monday']);
      setNoteDraft(blankNote(firstCourseId));
      setHourDraft(blankHour());
      setWebsiteDraft(blankWebsite(firstCourseId));
      setShoppingDraft(blankShoppingItem(firstCourseId));
      setHomeworkDraft(blankHomeworkItem(firstCourseId));
      setTodoDraft(blankTodoItem());

      setAuthMessage(
        `Imported ${result.courses} courses, ${result.assignments} assignments, ${result.schedule} schedule blocks, and ${result.hours} hour entries from Excel.`,
      );
    } catch (error) {
      setAuthMessage('Excel import failed.');
      alert(
        error instanceof Error
          ? error.message
          : 'That Excel file could not be imported.',
      );
    } finally {
      event.target.value = '';
    }
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
    <main className="min-h-[calc(100vh+8rem)] overflow-x-hidden bg-[var(--background)] text-blue-950">
      <div className="tablet-shell mx-auto flex w-full max-w-[1500px] min-w-0 flex-col gap-3 px-2 pt-3 pb-32 sm:px-5 sm:pt-4 sm:pb-40 xl:gap-5 xl:px-8">
        <header className="pixel-panel grid min-w-0 gap-3 p-3 sm:gap-5 sm:p-4 xl:grid-cols-[1fr_auto] xl:items-center">
          <div className="flex min-w-0 items-center gap-3 sm:gap-4">
            <div className="grid size-10 shrink-0 place-items-center border-2 border-blue-300 bg-blue-100 shadow-[3px_3px_0_#dbeafe] sm:size-12 sm:shadow-[4px_4px_0_#dbeafe]">
              <Image
                src="/assets/rabbit-cute.png"
                alt=""
                aria-hidden="true"
                width={600}
                height={600}
                className="size-8 [image-rendering:pixelated] sm:size-10"
              />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase text-blue-950/70">
                {dateLabel}
              </p>
              <h1 className="truncate text-2xl font-black tracking-normal sm:text-4xl">
                McGillTrack
              </h1>
            </div>
          </div>
          <div className="grid w-full gap-2 border-2 border-blue-300 bg-white/75 p-3 shadow-[3px_3px_0_#bfdbfe] sm:min-h-[112px] xl:w-[420px] xl:max-w-[420px]">
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

        <section className="grid min-w-0 grid-cols-2 gap-2 sm:gap-3 md:grid-cols-2 lg:grid-cols-5">
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
          <div className="min-w-0 overflow-x-auto">
            <nav className="pixel-tabs inline-flex h-auto min-w-max items-center justify-center rounded-lg bg-blue-100 p-1 text-muted-foreground">
              {trackerTabs.map((tab) => (
                <Link
                  key={tab.value}
                  href={tab.href}
                  data-slot="tabs-trigger"
                  data-active={activeTab === tab.value ? '' : undefined}
                  aria-current={activeTab === tab.value ? 'page' : undefined}
                  className="relative inline-flex min-h-9 items-center justify-center gap-1.5 border border-transparent px-2.5 py-1 text-sm font-medium whitespace-nowrap text-foreground/60 transition-all hover:text-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1 focus-visible:outline-ring data-active:text-foreground xl:min-h-0 xl:px-1.5 xl:py-0.5"
                >
                  {tab.label}
                </Link>
              ))}
            </nav>
          </div>

          <TabsContent
            value="overview"
            className="tablet-dashboard grid min-w-0 items-stretch gap-4 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]"
          >
            <section className="pixel-panel relative flex min-w-0 flex-col overflow-visible p-3 xl:p-4">
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
              <div className="grid min-w-0 grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
                {statuses.map((status) => (
                  <div
                    key={status}
                    className="border-2 border-blue-200 bg-white p-3"
                  >
                    <p className="min-h-9 text-xs font-bold uppercase text-blue-950/70">
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
                  <p className="min-h-9 text-xs font-bold uppercase text-blue-950/70">
                    Due This Week
                  </p>
                  <p className="mt-2 text-3xl font-black">
                    {assignmentMetrics.dueThisWeek}
                  </p>
                </div>
              </div>
              <Image
                src="/assets/rabbit-cute.png"
                alt=""
                aria-hidden="true"
                width={600}
                height={600}
                className="pointer-events-none absolute right-10 -bottom-3 hidden w-28 [image-rendering:pixelated] md:block xl:right-14 xl:w-32"
              />
            </section>

            <section className="pixel-panel flex min-w-0 flex-col p-3 xl:p-4">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="text-xl font-black">Upcoming Assignments</h2>
                <span className="border border-blue-300 bg-blue-50 px-2 py-0.5 text-xs font-black text-blue-950/70">
                  {upcomingAssignments.length} open
                </span>
              </div>
              <AssignmentPreviewList
                assignments={upcomingAssignments}
                courseById={courseById}
                termStartDate={data.termStartDate}
                termEndDate={data.termEndDate}
              />
            </section>

            <section className="pixel-panel min-w-0 p-3 xl:p-4 lg:col-span-2">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="text-xl font-black">Today&apos;s Classes</h2>
                <span className="border border-blue-300 bg-blue-50 px-2 py-0.5 text-xs font-black text-blue-950/70">
                  {todayDay}
                </span>
              </div>
              <TodayClassList blocks={todaysClasses} courseById={courseById} />
            </section>
          </TabsContent>

          <TabsContent value="weekly" className="grid gap-4">
            <section className="pixel-panel min-w-0 overflow-x-auto p-3 sm:p-4">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-black">Weekly</h2>
                  <p className="text-sm text-blue-950/65">
                    {formatWeekRange(weeklyWeekStart)}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label="Previous week"
                    onClick={() =>
                      setWeeklyWeekStart(addIsoDays(weeklyWeekStart, -7))
                    }
                  >
                    <ChevronLeft />
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() =>
                      setWeeklyWeekStart(startOfWeekIso(todayIso()))
                    }
                  >
                    This week
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label="Next week"
                    onClick={() =>
                      setWeeklyWeekStart(addIsoDays(weeklyWeekStart, 7))
                    }
                  >
                    <ChevronRight />
                  </Button>
                </div>
              </div>
              <div className="mb-4 flex flex-wrap gap-4 text-sm font-semibold text-blue-950/70">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={weeklyShowClasses}
                    onChange={(event) =>
                      setWeeklyShowClasses(event.target.checked)
                    }
                  />
                  Classes
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={weeklyShowOfficeHours}
                    onChange={(event) =>
                      setWeeklyShowOfficeHours(event.target.checked)
                    }
                  />
                  Office Hours
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={weeklyShowAssignments}
                    onChange={(event) =>
                      setWeeklyShowAssignments(event.target.checked)
                    }
                  />
                  Assignments
                </label>
              </div>
              <WeeklyMobileAgenda
                days={days}
                weeklyDates={weeklyDates}
                assignments={weeklyAssignments}
                schedule={data.schedule}
                officeHours={data.officeHours}
                courseById={courseById}
                showClasses={weeklyShowClasses}
                showOfficeHours={weeklyShowOfficeHours}
                showAssignments={weeklyShowAssignments}
              />
              <div className="hidden min-w-[900px] md:block">
                <div className="grid grid-cols-[64px_repeat(5,minmax(140px,1fr))] gap-0">
                  <div />
                  {days.map((day, index) => (
                    <div
                      key={day}
                      className="mx-1 border-2 border-blue-300 bg-amber-50 p-2 text-center text-sm font-black"
                    >
                      <span>{day}</span>
                      <span className="ml-2 text-xs font-bold text-blue-950/55">
                        {formatMonthDay(weeklyDates[index])}
                      </span>
                    </div>
                  ))}
                  {weeklyShowAssignments ? (
                    <>
                      <div className="min-h-12 border-r border-blue-200 bg-blue-50/30" />
                      {days.map((day, dayIndex) => {
                        const date = weeklyDates[dayIndex];
                        const floatingAssignments = weeklyAssignments.filter(
                          (assignment) =>
                            !assignment.dueTime &&
                            assignment.dueDate === date &&
                            (!weeklyShowClasses ||
                              !data.schedule.some(
                                (block) =>
                                  block.day === day &&
                                  block.courseId === assignment.courseId,
                              )),
                        );

                        return (
                          <div
                            key={`${day}-assignments`}
                            className="min-h-12 border-r border-blue-200 bg-blue-50/30 px-1 py-1"
                          >
                            <div className="grid gap-1">
                              {floatingAssignments
                                .slice(0, 2)
                                .map((assignment) => {
                                  const course = courseById.get(
                                    assignment.courseId,
                                  );
                                  return (
                                    <div
                                      key={assignment.id}
                                      className="overflow-hidden border border-blue-300 px-2 py-0.5 text-center text-xs font-black text-blue-950"
                                      style={{
                                        background: course?.color ?? '#dbeafe',
                                      }}
                                      title={`${assignment.type}: ${assignment.title}`}
                                    >
                                      <p className="truncate">
                                        {assignment.type}: {assignment.title}
                                      </p>
                                    </div>
                                  );
                                })}
                              {floatingAssignments.length > 2 ? (
                                <div className="border border-blue-200 bg-white/70 px-2 py-0.5 text-center text-xs font-black text-blue-950/65">
                                  +{floatingAssignments.length - 2} more
                                </div>
                              ) : null}
                            </div>
                          </div>
                        );
                      })}
                    </>
                  ) : null}
                  <div
                    className="relative border-r border-blue-200"
                    style={{ height: scheduleGridHeight }}
                  >
                    {scheduleHours.map((hour) => (
                      <span
                        key={hour}
                        className="absolute right-2 -translate-y-1/2 text-xs font-semibold text-blue-950/60"
                        style={{
                          top:
                            ((hour - scheduleStartHour) /
                              (scheduleEndHour - scheduleStartHour)) *
                            scheduleGridHeight,
                        }}
                      >
                        {formatScheduleHour(hour)}
                      </span>
                    ))}
                  </div>
                  {days.map((day, dayIndex) => {
                    const date = weeklyDates[dayIndex];
                    const dayScheduleBlocks = data.schedule
                      .filter((block) => block.day === day)
                      .sort((a, b) => a.start.localeCompare(b.start));
                    const timedAssignments = weeklyAssignments.filter(
                      (assignment) => {
                        if (
                          !weeklyShowAssignments ||
                          !assignment.dueTime ||
                          assignment.dueDate !== date
                        ) {
                          return false;
                        }

                        return !(
                          weeklyShowClasses &&
                          dayScheduleBlocks.some((block) =>
                            assignmentAttachesToBlock(
                              assignment,
                              date,
                              block,
                              dayScheduleBlocks,
                            ),
                          )
                        );
                      },
                    );

                    return (
                      <div
                        key={day}
                        className="schedule-day-column relative border-r border-blue-200"
                        style={{ height: scheduleGridHeight }}
                      >
                        {weeklyShowClasses
                          ? dayScheduleBlocks.map((block) => {
                              const course = courseById.get(block.courseId);
                              const layout = scheduleBlockLayout(block);
                              const compactBlock = layout.height < 58;
                              const blockAssignments = weeklyAssignments.filter(
                                (assignment) =>
                                  weeklyShowAssignments &&
                                  assignmentAttachesToBlock(
                                    assignment,
                                    date,
                                    block,
                                    dayScheduleBlocks,
                                  ),
                              );
                              return (
                                <div
                                  key={block.id}
                                  className={`absolute inset-x-1 overflow-hidden border-2 border-blue-200 px-2 text-center ${
                                    compactBlock ? 'py-1' : 'py-1.5'
                                  }`}
                                  style={{
                                    top: layout.top,
                                    height: layout.height,
                                    background: course?.color ?? '#dbeafe',
                                  }}
                                  title={`${course?.name ?? 'Course'} · ${formatBlockTimeRange(block)} · ${block.location || course?.room || 'Location'}${block.type ? ` · ${block.type}` : ''}`}
                                >
                                  <div className="flex h-full min-h-0 items-center justify-center">
                                    <div className="min-w-0 max-w-full">
                                      <p
                                        className={`truncate font-black leading-tight ${
                                          compactBlock ? 'text-xs' : 'text-sm'
                                        }`}
                                      >
                                        {course?.name ?? 'Course'}
                                      </p>
                                      <p
                                        className={`text-xs leading-tight text-blue-950/70 ${
                                          compactBlock ? 'truncate' : ''
                                        }`}
                                      >
                                        {formatBlockTimeRange(block)}
                                        {compactBlock
                                          ? ` · ${block.location || course?.room || 'Location'}`
                                          : ''}
                                      </p>
                                      {!compactBlock ? (
                                        <p className="truncate text-xs font-semibold leading-tight text-blue-950/70">
                                          {block.location ||
                                            course?.room ||
                                            'Location'}
                                        </p>
                                      ) : null}
                                      {!compactBlock && block.type ? (
                                        <p className="truncate text-xs font-semibold leading-tight text-blue-950/70">
                                          {block.type}
                                        </p>
                                      ) : null}
                                      {blockAssignments
                                        .slice(0, compactBlock ? 1 : 2)
                                        .map((assignment) => (
                                          <p
                                            key={assignment.id}
                                            className="mt-1 truncate border border-blue-300 bg-white/70 px-1 text-xs font-black leading-tight text-blue-950"
                                          >
                                            {assignment.type}:{' '}
                                            {assignment.title}
                                          </p>
                                        ))}
                                      {!compactBlock &&
                                      blockAssignments.length > 2 ? (
                                        <p className="mt-1 truncate border border-blue-200 bg-white/60 px-1 text-xs font-black leading-tight text-blue-950/65">
                                          +{blockAssignments.length - 2} more
                                        </p>
                                      ) : null}
                                    </div>
                                  </div>
                                </div>
                              );
                            })
                          : null}
                        {weeklyShowOfficeHours
                          ? data.officeHours
                              .filter((block) => block.day === day)
                              .sort((a, b) => a.start.localeCompare(b.start))
                              .map((block) => {
                                const course = courseById.get(block.courseId);
                                const layout = scheduleBlockLayout(block);
                                const compactBlock = layout.height < 64;
                                return (
                                  <div
                                    key={`office-${block.id}`}
                                    className={`absolute inset-x-1 overflow-hidden border-2 border-blue-200 px-2 text-center ${
                                      compactBlock ? 'py-1' : 'py-1.5'
                                    }`}
                                    style={{
                                      top: layout.top,
                                      height: layout.height,
                                      background: course?.color ?? '#dbeafe',
                                    }}
                                    title={`${course?.name ?? 'Course'} office hours · ${formatBlockTimeRange(block)} · ${block.office || 'Office'} · ${block.teacher || course?.instructor || 'Professor'}`}
                                  >
                                    <div className="flex h-full min-h-0 items-center justify-center">
                                      <div className="min-w-0 max-w-full">
                                        <p
                                          className={`truncate font-black leading-tight ${
                                            compactBlock ? 'text-xs' : 'text-sm'
                                          }`}
                                        >
                                          Office Hours
                                        </p>
                                        <p className="truncate text-xs font-semibold leading-tight text-blue-950/75">
                                          {course?.name ?? 'Course'}
                                        </p>
                                        <p className="text-xs leading-tight text-blue-950/70">
                                          {formatBlockTimeRange(block)}
                                          {compactBlock
                                            ? ` · ${block.office || 'Office'}`
                                            : ''}
                                        </p>
                                        {!compactBlock ? (
                                          <p className="truncate text-xs font-semibold leading-tight text-blue-950/70">
                                            {block.office || 'Office'} ·{' '}
                                            {block.teacher ||
                                              course?.instructor ||
                                              'Professor'}
                                          </p>
                                        ) : null}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })
                          : null}
                        {timedAssignments.map((assignment) => {
                          const course = courseById.get(assignment.courseId);
                          const layout = scheduleBlockLayout({
                            start: assignment.dueTime ?? '09:00',
                            end: addMinutesToTime(
                              assignment.dueTime ?? '09:00',
                              45,
                            ),
                          });
                          return (
                            <div
                              key={assignment.id}
                              className="absolute right-1 left-8 overflow-hidden border-2 border-blue-200 px-2 py-1 text-xs font-black text-blue-950"
                              style={{
                                top: layout.top,
                                height: layout.height,
                                background: course?.color ?? '#dbeafe',
                              }}
                            >
                              <p className="truncate">{assignment.title}</p>
                              <p className="truncate font-semibold text-blue-950/70">
                                Due {formatDueTime(assignment.dueTime)}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>
          </TabsContent>

          <TabsContent
            value="friends"
            className="grid min-w-0 gap-3 sm:gap-4 xl:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)]"
          >
            <section className="pixel-panel min-w-0 p-3 sm:p-4 xl:col-span-2">
              <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <h2 className="text-xl font-black">Friends & Teammates</h2>
                    <span className="border-2 border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-black uppercase text-blue-950/70">
                      In progress
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-blue-950/70">
                    Find overlapping breaks with friends or teammates!
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2 border-2 border-blue-200 bg-blue-50 px-3 py-2 text-sm font-black text-blue-950/75">
                  <Users className="size-4" />
                  Free/busy only
                </div>
              </div>
              {friendsMessage ? (
                <p className="mt-3 border-2 border-blue-200 bg-white px-3 py-2 text-sm font-bold text-blue-950/70">
                  {friendsMessage}
                </p>
              ) : null}
              {!user ? (
                <p className="mt-3 border-2 border-amber-200 bg-amber-50 px-3 py-2 text-sm font-bold text-blue-950/70">
                  Sign in to publish availability, add friends, and create
                  teams.
                </p>
              ) : null}
            </section>

            <section className="pixel-panel grid min-w-0 gap-4 p-3 sm:p-4">
              <div className="flex items-center gap-3">
                <UserPlus className="size-5 text-blue-950/70" />
                <h3 className="text-lg font-black">People</h3>
              </div>
              <div className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                <Field label="Friend email">
                  <TextInput
                    type="email"
                    placeholder="name@email.com"
                    value={friendEmailDraft}
                    onChange={(event) =>
                      setFriendEmailDraft(event.target.value)
                    }
                  />
                </Field>
                <Button
                  className="self-end"
                  disabled={!user || friendsBusy || !friendEmailDraft.trim()}
                  onClick={() => void sendFriendInvite()}
                >
                  <Plus data-icon="inline-start" />
                  Invite
                </Button>
              </div>
              <Button
                variant="outline"
                disabled={!user || friendsBusy}
                onClick={() => void publishAvailability()}
              >
                <Upload data-icon="inline-start" />
                Publish my availability
              </Button>
              <div className="grid gap-2 border-2 border-blue-200 bg-white p-3">
                <p className="text-sm font-black text-blue-950">
                  Sharing
                </p>
                <p className="text-sm text-blue-950/65">
                  Friends can see your free/busy windows after you publish.
                  Course names and locations stay private for now.
                </p>
                <p className="text-xs font-bold text-blue-950/55">
                  {ownPublishedAvailabilityCount
                    ? `${ownPublishedAvailabilityCount} windows published.`
                    : 'Nothing published yet.'}
                </p>
              </div>

              {incomingFriendInvites.length ? (
                <div className="grid gap-2">
                  <p className="text-sm font-black text-blue-950">
                    Incoming invites
                  </p>
                  {incomingFriendInvites.map((invite) => (
                    <div
                      key={invite.id}
                      className="grid gap-2 border-2 border-blue-200 bg-white p-3"
                    >
                      <p className="truncate text-sm font-bold text-blue-950/75">
                        {invite.sender_email ?? 'Friend request'}
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          disabled={friendsBusy}
                          onClick={() =>
                            void respondToFriendInvite(invite, 'accepted')
                          }
                        >
                          Accept
                        </Button>
                        <Button
                          variant="outline"
                          disabled={friendsBusy}
                          onClick={() =>
                            void respondToFriendInvite(invite, 'declined')
                          }
                        >
                          Decline
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}

              {outgoingFriendInvites.length ? (
                <div className="grid gap-2">
                  <p className="text-sm font-black text-blue-950">
                    Sent invites
                  </p>
                  {outgoingFriendInvites.map((invite) => (
                    <div
                      key={invite.id}
                      className="border-2 border-blue-200 bg-white p-3 text-sm font-bold text-blue-950/70"
                    >
                      {invite.recipient_email}
                    </div>
                  ))}
                </div>
              ) : null}

              <div className="grid gap-2">
                <p className="text-sm font-black text-blue-950">Friends</p>
                {friendIds.length ? (
                  friendIds.map((friendId, index) => {
                    const profile = socialProfileById.get(friendId);
                    const checked = selectedFriendIds.includes(friendId);

                    return (
                      <label
                        key={friendId}
                        className="flex min-w-0 cursor-pointer items-center gap-3 border-2 border-blue-200 bg-white p-3"
                      >
                        <input
                          type="checkbox"
                          aria-label={`Include ${friendDisplayName(
                            profile,
                            'friend',
                          )} in common breaks`}
                          checked={checked}
                          onChange={(event) =>
                            setSelectedFriendIds((current) =>
                              event.target.checked
                                ? [...current, friendId]
                                : current.filter((id) => id !== friendId),
                            )
                          }
                        />
                        <span
                          className="size-4 shrink-0 border-2 border-blue-400"
                          style={{
                            background:
                              courseColors[index % courseColors.length],
                          }}
                        />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-black text-blue-950">
                            {friendDisplayName(profile, 'Friend')}
                          </p>
                          <p className="truncate text-xs font-semibold text-blue-950/65">
                            {(availabilityByUser.get(friendId) ?? []).length
                              ? 'Availability shared'
                              : 'Waiting for availability'}
                          </p>
                        </div>
                      </label>
                    );
                  })
                ) : (
                  <div className="border-2 border-blue-100 bg-white/70 p-3 text-sm font-semibold text-blue-950/55">
                    No friends yet.
                  </div>
                )}
              </div>
            </section>

            <section className="pixel-panel grid min-w-0 gap-4 p-3 sm:p-4">
              <div className="flex min-w-0 flex-wrap items-end justify-between gap-3">
                <div>
                  <h3 className="text-lg font-black">Common Breaks</h3>
                  <p className="text-sm text-blue-950/65">
                    Finds shared free windows from published availability.
                  </p>
                </div>
                <div className="grid w-full min-w-0 gap-2 sm:w-auto sm:grid-cols-2">
                  <Field label="Minimum">
                    <NativeSelect
                      className="w-full min-w-0"
                      value={String(minimumBreakMinutes)}
                      onChange={(event) =>
                        setMinimumBreakMinutes(Number(event.target.value))
                      }
                    >
                      <NativeSelectOption value="30">30 min</NativeSelectOption>
                      <NativeSelectOption value="45">45 min</NativeSelectOption>
                      <NativeSelectOption value="60">1 hour</NativeSelectOption>
                    </NativeSelect>
                  </Field>
                  <Field label="Team">
                    <NativeSelect
                      className="w-full min-w-0"
                      value={selectedTeamId}
                      onChange={(event) =>
                        setSelectedTeamId(event.target.value)
                      }
                    >
                      <NativeSelectOption value="">Selected friends</NativeSelectOption>
                      {friendTeams.map((team) => (
                        <NativeSelectOption key={team.id} value={team.id}>
                          {team.name}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                  </Field>
                </div>
              </div>

              <div className="grid min-w-0 gap-3 md:grid-cols-2">
                {commonBreakWindows.length ? (
                  commonBreakWindows.map((window) => (
                    <article
                      key={`${window.day}-${window.start}-${window.end}`}
                      className="grid min-w-0 gap-3 border-2 border-blue-200 bg-white p-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs font-black uppercase text-blue-950/60">
                            {window.day}
                          </p>
                          <h4 className="text-base font-black text-blue-950">
                            {formatAvailabilityRange(window)}
                          </h4>
                        </div>
                        <span className="shrink-0 border border-blue-300 bg-blue-50 px-2 py-0.5 text-xs font-black text-blue-950/70">
                          {formatAvailabilityDuration(window)}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {window.userIds.map((personId) => (
                          <span
                            key={personId}
                            className="border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-bold text-blue-950/70"
                          >
                            {personId === user?.id
                              ? 'You'
                              : friendDisplayName(
                                  socialProfileById.get(personId),
                                  'Friend',
                                )}
                          </span>
                        ))}
                      </div>
                    </article>
                  ))
                ) : (
                  <div className="border-2 border-blue-100 bg-white/70 p-3 text-sm font-semibold text-blue-950/55 md:col-span-2">
                    {user
                      ? 'Select friends and ask everyone to publish availability.'
                      : 'Sign in to find common breaks.'}
                  </div>
                )}
              </div>

              <div className="grid gap-3 border-2 border-blue-200 bg-blue-50/60 p-3">
                <p className="text-sm font-black text-blue-950">Teams</p>
                <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                  <Field label="Team name">
                    <TextInput
                      placeholder="Design project team"
                      value={teamNameDraft}
                      onChange={(event) =>
                        setTeamNameDraft(event.target.value)
                      }
                    />
                  </Field>
                  <Button
                    className="self-end"
                    disabled={!user || friendsBusy || !teamNameDraft.trim()}
                    onClick={() => void createFriendTeam()}
                  >
                    <Plus data-icon="inline-start" />
                    Create
                  </Button>
                </div>
                {friendTeams.length ? (
                  <div className="grid gap-2">
                    {friendTeams.map((team) => {
                      const memberCount = friendTeamMembers.filter(
                        (member) =>
                          member.team_id === team.id &&
                          member.status === 'active',
                      ).length;

                      return (
                        <div
                          key={team.id}
                          className="flex min-w-0 items-center justify-between gap-3 border-2 border-blue-200 bg-white p-3"
                        >
                          <p className="truncate text-sm font-black text-blue-950">
                            {team.name}
                          </p>
                          <span className="shrink-0 border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-bold text-blue-950/70">
                            {memberCount} members
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : null}
                {selectedTeamId && friendIds.length ? (
                  <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                    <Field label="Add teammate">
                      <NativeSelect
                        value={teamMemberDraft}
                        onChange={(event) =>
                          setTeamMemberDraft(event.target.value)
                        }
                      >
                        <NativeSelectOption value="">Choose friend</NativeSelectOption>
                        {friendIds.map((friendId) => (
                          <NativeSelectOption key={friendId} value={friendId}>
                            {friendDisplayName(
                              socialProfileById.get(friendId),
                              'Friend',
                            )}
                          </NativeSelectOption>
                        ))}
                      </NativeSelect>
                    </Field>
                    <Button
                      className="self-end"
                      disabled={friendsBusy || !teamMemberDraft}
                      onClick={() => void addFriendToTeam()}
                    >
                      Add
                    </Button>
                  </div>
                ) : null}
              </div>
            </section>
          </TabsContent>

          <TabsContent value="focus" className="grid min-w-0 gap-3 sm:gap-4">
            <section className="pixel-panel grid min-w-0 gap-3 p-3 sm:gap-4 sm:p-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(280px,0.55fr)]">
              <div className="grid min-w-0 gap-3 sm:gap-4">
                <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <h2 className="text-xl font-black">Focus Timer</h2>
                      <span className="border-2 border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-black uppercase text-blue-950/70">
                        In progress
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-blue-950/70">
                      A soft Pomodoro timer for study blocks and breaks.
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2 border-2 border-blue-200 bg-blue-50 px-3 py-2 text-sm font-black text-blue-950/75">
                    <Clock3 className="size-4" />
                    {activeFocusMode.minutes} min
                  </div>
                </div>

                <div className="grid min-w-0 gap-2 md:grid-cols-3">
                  {focusModeOptions.map((option) => {
                    const selected = option.value === focusMode;

                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => selectFocusMode(option.value)}
                        className={`grid min-h-20 min-w-0 gap-1 border-2 px-3 py-2 text-left transition ${
                          selected
                            ? 'border-blue-500 bg-blue-50 shadow-[3px_3px_0_#fef3c7]'
                            : 'border-blue-200 bg-white hover:border-blue-300'
                        }`}
                      >
                        <span className="text-sm font-black text-blue-950">
                          {option.label}
                        </span>
                        <span className="text-2xl font-black text-blue-950">
                          {option.minutes}
                        </span>
                        <span className="text-xs font-semibold text-blue-950/60">
                          {option.description}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="grid min-w-0 gap-3 md:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
                  <Field label="Course">
                    <CourseSelect
                      courses={data.courses}
                      value={effectiveFocusCourseId}
                      onChange={(value) => {
                        setFocusCourseId(value);
                        setFocusAssignmentId('');
                      }}
                    />
                  </Field>
                  <Field label="Task">
                    <NativeSelect
                      className="w-full min-w-0"
                      value={focusAssignmentId}
                      onChange={(event) =>
                        setFocusAssignmentId(event.target.value)
                      }
                    >
                      <NativeSelectOption value="">
                        General focus
                      </NativeSelectOption>
                      {focusAssignments.map((assignment) => (
                        <NativeSelectOption
                          key={assignment.id}
                          value={assignment.id}
                        >
                          {assignment.title || assignment.type}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                  </Field>
                </div>

                <div className="grid min-w-0 gap-3 border-2 border-blue-200 bg-white p-3 sm:grid-cols-3">
                  <div className="min-w-0">
                    <p className="text-xs font-black uppercase text-blue-950/60">
                      Course
                    </p>
                    <p className="mt-1 truncate text-sm font-black text-blue-950">
                      {focusCourse?.name ?? 'General'}
                    </p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-black uppercase text-blue-950/60">
                      Task
                    </p>
                    <p className="mt-1 truncate text-sm font-black text-blue-950">
                      {focusAssignment?.title ?? 'General focus'}
                    </p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-black uppercase text-blue-950/60">
                      Elapsed
                    </p>
                    <p className="mt-1 text-sm font-black text-blue-950">
                      {formatFocusSeconds(focusElapsedSeconds)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid min-w-0 content-center gap-3 border-2 border-blue-200 bg-blue-50/50 p-3 sm:gap-4 sm:p-4">
                <div className="relative mx-auto grid aspect-square w-full max-w-64 place-items-center sm:max-w-72">
                  <svg
                    className="absolute inset-0 size-full -rotate-90"
                    viewBox="0 0 240 240"
                    aria-hidden="true"
                  >
                    <circle
                      cx="120"
                      cy="120"
                      r={focusRadius}
                      fill="none"
                      stroke="#dbeafe"
                      strokeWidth="14"
                    />
                    <circle
                      cx="120"
                      cy="120"
                      r={focusRadius}
                      fill="none"
                      stroke="#60a5fa"
                      strokeLinecap="butt"
                      strokeWidth="14"
                      strokeDasharray={focusCircumference}
                      strokeDashoffset={focusDashOffset}
                      className="transition-[stroke-dashoffset] duration-500 ease-linear"
                    />
                  </svg>
                  <div className="relative grid place-items-center gap-1 text-center">
                    <p className="text-sm font-black uppercase text-blue-950/60">
                      {activeFocusMode.label}
                    </p>
                    <p className="text-5xl font-black leading-none text-blue-950 sm:text-6xl">
                      {formatFocusSeconds(focusSecondsLeft)}
                    </p>
                    <p className="text-xs font-bold text-blue-950/55">
                      {focusSecondsLeft === 0
                        ? 'Done'
                        : `${Math.round(focusProgress * 100)}% left`}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Button
                    className="min-h-11"
                    onClick={() =>
                      setFocusRunning((current) =>
                        focusSecondsLeft > 0 ? !current : current,
                      )
                    }
                    disabled={focusSecondsLeft === 0}
                  >
                    {focusRunning ? (
                      <Pause data-icon="inline-start" />
                    ) : (
                      <Play data-icon="inline-start" />
                    )}
                    {focusRunning ? 'Pause' : 'Start'}
                  </Button>
                  <Button
                    className="min-h-11"
                    variant="outline"
                    onClick={resetFocusTimer}
                  >
                    <RotateCcw data-icon="inline-start" />
                    Reset
                  </Button>
                </div>
              </div>
            </section>
          </TabsContent>

          <TabsContent value="comfort" className="grid min-w-0 gap-3 sm:gap-4">
            <section className="pixel-panel grid min-w-0 gap-3 p-3 sm:gap-4 sm:p-4">
              <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <h2 className="text-xl font-black">Comfort Board</h2>
                    <span className="border-2 border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-black uppercase text-blue-950/70">
                      Local
                    </span>
                  </div>
                  <p className="max-w-3xl text-sm font-semibold text-blue-950/70">
                    Keep memes, quotes, cozy pictures, or tiny visual boosts for
                    rough study days.
                  </p>
                </div>
                <div className="grid w-full min-w-0 gap-2 sm:w-auto sm:grid-cols-2">
                  <Button
                    type="button"
                    onClick={() => comfortImageInputRef.current?.click()}
                  >
                    <Upload data-icon="inline-start" />
                    Add pictures
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={!comfortImages.length}
                    onClick={() => {
                      if (window.confirm('Clear every comfort picture?')) {
                        clearComfortImages();
                      }
                    }}
                  >
                    <Trash2 data-icon="inline-start" />
                    Clear
                  </Button>
                </div>
              </div>

              {comfortMessage ? (
                <p className="border-2 border-blue-200 bg-white px-3 py-2 text-sm font-bold text-blue-950/70">
                  {comfortMessage}
                </p>
              ) : null}

              <input
                ref={comfortImageInputRef}
                className="hidden"
                type="file"
                accept="image/*"
                multiple
                onChange={(event) => void uploadComfortImages(event)}
              />
            </section>

            {comfortImages.length ? (
              <section className="grid min-w-0 grid-cols-[repeat(auto-fit,minmax(min(260px,100%),1fr))] gap-3 sm:gap-4">
                {comfortImages.map((image) => (
                  <article
                    key={image.id}
                    className="pixel-panel grid min-w-0 gap-3 p-3 sm:p-4"
                  >
                    <div className="grid min-h-44 place-items-center overflow-hidden border-2 border-blue-200 bg-white/80 p-2 sm:min-h-56">
                      <Image
                        src={image.src}
                        alt={image.caption || image.fileName}
                        width={image.width}
                        height={image.height}
                        unoptimized
                        className="max-h-80 max-w-full object-contain"
                      />
                    </div>
                    <div className="grid min-w-0 gap-2">
                      <TextInput
                        value={image.caption}
                        placeholder="Caption, reminder, or quote"
                        aria-label={`Caption for ${image.fileName}`}
                        onChange={(event) =>
                          updateComfortCaption(image.id, event.target.value)
                        }
                      />
                      <div className="flex min-w-0 items-center justify-between gap-3">
                        <p className="truncate text-xs font-bold text-blue-950/55">
                          {image.fileName}
                        </p>
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon"
                          aria-label={`Delete ${image.fileName}`}
                          onClick={() => removeComfortImage(image.id)}
                        >
                          <Trash2 />
                        </Button>
                      </div>
                    </div>
                  </article>
                ))}
              </section>
            ) : (
              <section className="pixel-panel grid min-h-72 place-items-center p-4 text-center">
                <div className="grid max-w-md gap-3">
                  <p className="text-xl font-black text-blue-950">
                    Nothing cozy here yet.
                  </p>
                  <p className="text-sm font-semibold text-blue-950/65">
                    Add a few images and they will resize to fit while keeping
                    their original proportions.
                  </p>
                  <Button
                    className="mx-auto"
                    type="button"
                    onClick={() => comfortImageInputRef.current?.click()}
                  >
                    <Upload data-icon="inline-start" />
                    Add pictures
                  </Button>
                </div>
              </section>
            )}
          </TabsContent>

          <TabsContent value="assignments" className="grid gap-4">
            <section className="pixel-panel grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-[1fr_1fr_auto]">
              <Field label="First Day of Classes">
                <TextInput
                  type="date"
                  value={data.termStartDate}
                  onChange={(event) =>
                    updateTermDate('termStartDate', event.target.value)
                  }
                />
              </Field>
              <Field label="Last Day of Classes">
                <TextInput
                  type="date"
                  value={data.termEndDate}
                  onChange={(event) =>
                    updateTermDate('termEndDate', event.target.value)
                  }
                />
              </Field>
              <div className="grid gap-1.5 md:col-span-2 xl:col-span-1">
                <p className="text-xs font-semibold uppercase text-blue-950/65">
                  Current Week
                </p>
                <div className="min-w-36 border-2 border-blue-200 bg-blue-50 px-3 py-2 text-sm font-black text-blue-950">
                  {assignmentWeekLabel(
                    todayIso(),
                    data.termStartDate,
                    data.termEndDate,
                  )}
                </div>
              </div>
            </section>
            <section className="pixel-panel grid gap-3 p-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-[1fr_1fr_0.8fr_0.8fr_0.65fr_0.65fr_auto]">
              <Field label="Course">
                <CourseSelect
                  courses={data.courses}
                  onCreateCustom={createCustomCourse}
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
              <Field label="Due Time">
                <TextInput
                  type="time"
                  value={assignmentDraft.dueTime ?? ''}
                  onChange={(event) =>
                    setAssignmentDraft({
                      ...assignmentDraft,
                      dueTime: event.target.value,
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
                <Button onClick={addAssignment} className="h-10 w-full xl:h-9">
                  <Plus data-icon="inline-start" />
                  Add
                </Button>
              </div>
            </section>
            <section className="pixel-panel min-w-0 overflow-hidden p-3 sm:p-4">
              <div className="md:hidden">
                <AssignmentMobileCards
                  assignments={data.assignments}
                  courseById={courseById}
                  websites={data.websites}
                  termStartDate={data.termStartDate}
                  termEndDate={data.termEndDate}
                  updateAssignment={updateAssignment}
                  removeAssignment={(id) => removeItem('assignments', id)}
                />
              </div>
              <div className="hidden md:block">
                <AssignmentTable
                  assignments={data.assignments}
                  courseById={courseById}
                  websites={data.websites}
                  termStartDate={data.termStartDate}
                  termEndDate={data.termEndDate}
                  updateAssignment={updateAssignment}
                  removeAssignment={(id) => removeItem('assignments', id)}
                />
              </div>
            </section>
          </TabsContent>

          <TabsContent
            value="courses"
            className="grid min-w-0 gap-4 xl:grid-cols-[360px_minmax(0,1fr)]"
          >
            <section className="tablet-form pixel-panel grid min-w-0 gap-2.5 p-3 xl:gap-3 xl:p-4">
              <h2 className="text-xl font-black">Add Course</h2>
              <div className="grid min-w-0 gap-2.5 md:grid-cols-[minmax(0,1.4fr)_minmax(180px,0.8fr)] xl:grid-cols-1 xl:gap-3">
                <Field label="Name">
                  <TextInput
                    value={courseDraft.name}
                    onChange={(event) =>
                      setCourseDraft({
                        ...courseDraft,
                        name: event.target.value,
                      })
                    }
                    placeholder="Course name"
                  />
                </Field>
                <Field label="Code">
                  <TextInput
                    value={courseDraft.code}
                    onChange={(event) =>
                      setCourseDraft({
                        ...courseDraft,
                        code: event.target.value,
                      })
                    }
                    placeholder="COUR 101"
                  />
                </Field>
              </div>
              <div className="grid min-w-0 gap-2.5 md:grid-cols-[minmax(0,1.4fr)_minmax(160px,0.8fr)] xl:grid-cols-1 xl:gap-3">
                <Field label="Room">
                  <TextInput
                    value={courseDraft.room}
                    onChange={(event) =>
                      setCourseDraft({
                        ...courseDraft,
                        room: event.target.value,
                      })
                    }
                    placeholder="Room"
                  />
                </Field>
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
              </div>
              <div className="grid min-w-0 gap-2.5 md:grid-cols-2 xl:grid-cols-1 xl:gap-3">
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
              </div>
              <CourseColorControls
                value={courseDraft.color}
                label="Use course color"
                onChange={(color) => setCourseDraft({ ...courseDraft, color })}
              />
              <Button onClick={addCourse}>
                <Plus data-icon="inline-start" />
                Add course
              </Button>
            </section>

            <section className="pixel-panel min-w-0 overflow-hidden p-3 xl:p-4">
              <div className="md:hidden">
                <CourseMobileCards
                  courses={data.courses}
                  updateCourse={updateCourse}
                  removeCourse={(id) => removeItem('courses', id)}
                />
              </div>
              <div className="hidden min-w-0 overflow-x-auto md:block">
                <Table className="min-w-[900px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Course</TableHead>
                      <TableHead>Color</TableHead>
                      <TableHead>Code</TableHead>
                      <TableHead>Room</TableHead>
                      <TableHead>Instructor</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Section</TableHead>
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
                              updateCourse(
                                course.id,
                                'name',
                                event.target.value,
                              )
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <div className="w-[136px]">
                            <CourseColorControls
                              value={course.color}
                              size="sm"
                              presetLimit={3}
                              label={`Set ${course.name || 'course'} color`}
                              onChange={(color) =>
                                updateCourse(course.id, 'color', color)
                              }
                            />
                          </div>
                        </TableCell>
                        <TableCell>
                          <TextInput
                            value={course.code}
                            onChange={(event) =>
                              updateCourse(
                                course.id,
                                'code',
                                event.target.value,
                              )
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <TextInput
                            value={course.room}
                            onChange={(event) =>
                              updateCourse(
                                course.id,
                                'room',
                                event.target.value,
                              )
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
                              updateCourse(
                                course.id,
                                'email',
                                event.target.value,
                              )
                            }
                            className="w-52"
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
              </div>
            </section>
          </TabsContent>

          <TabsContent
            value="grades"
            className="grid gap-4 xl:grid-cols-[1fr_360px]"
          >
            <section className="pixel-panel overflow-x-auto p-4">
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
            className="grid min-w-0 gap-4 xl:grid-cols-[360px_minmax(0,1fr)]"
          >
            <section className="tablet-form pixel-panel grid min-w-0 gap-2.5 p-3 xl:gap-3 xl:p-4">
              <h2 className="text-xl font-black">Add Block</h2>
              <div className="grid min-w-0 gap-2.5 md:grid-cols-[minmax(0,1.65fr)_minmax(220px,0.9fr)] xl:grid-cols-1 xl:gap-3">
                <Field label="Course">
                  <CourseSelect
                    courses={data.courses}
                    onCreateCustom={createCustomCourse}
                    value={scheduleDraft.courseId}
                    onChange={(value) =>
                      setScheduleDraft({ ...scheduleDraft, courseId: value })
                    }
                  />
                </Field>
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
              </div>
              <div className="grid gap-1.5">
                <p className="text-xs font-semibold uppercase text-blue-950/65">
                  Day
                </p>
                <WeekdayToggleGroup
                  value={scheduleDraftDays}
                  onChange={(selectedDays) => {
                    setScheduleDraftDays(selectedDays);
                    setScheduleDraft({
                      ...scheduleDraft,
                      day: selectedDays[0] ?? scheduleDraft.day,
                    });
                  }}
                />
              </div>
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
              <Button onClick={addSchedule}>
                <Plus data-icon="inline-start" />
                Add block
              </Button>
            </section>

            <section className="pixel-panel min-w-0 overflow-hidden p-3 xl:p-4">
              <h2 className="mb-4 text-xl font-black">Weekly Schedule</h2>
              <ScheduleMobileList
                days={days}
                blocks={data.schedule}
                courseById={courseById}
                onDelete={(id) => removeItem('schedule', id)}
              />
              <div className="hidden min-w-0 overflow-x-auto md:block">
                <div className="grid min-w-[860px] grid-cols-[64px_repeat(5,minmax(140px,1fr))]">
                  <div />
                  {days.map((day) => (
                    <div
                      key={day}
                      className="mx-1 border-2 border-blue-300 bg-amber-50 p-2 text-center text-sm font-black"
                    >
                      {day}
                    </div>
                  ))}
                  <div
                    className="relative border-r border-blue-200"
                    style={{ height: scheduleGridHeight }}
                  >
                    {scheduleHours.map((hour) => (
                      <span
                        key={hour}
                        className="absolute right-2 -translate-y-1/2 text-xs font-semibold text-blue-950/60"
                        style={{
                          top:
                            ((hour - scheduleStartHour) /
                              (scheduleEndHour - scheduleStartHour)) *
                            scheduleGridHeight,
                        }}
                      >
                        {formatScheduleHour(hour)}
                      </span>
                    ))}
                  </div>
                  {days.map((day) => (
                    <div
                      key={day}
                      className="schedule-day-column relative border-r border-blue-200"
                      style={{ height: scheduleGridHeight }}
                    >
                      {data.schedule
                        .filter((block) => block.day === day)
                        .sort((a, b) => a.start.localeCompare(b.start))
                        .map((block) => {
                          const course = courseById.get(block.courseId);
                          const layout = scheduleBlockLayout(block);
                          const compactBlock = layout.height < 58;
                          return (
                            <div
                              key={block.id}
                              className={`group absolute inset-x-1 overflow-hidden border-2 border-blue-200 px-2 text-center ${
                                compactBlock ? 'py-1' : 'py-1.5'
                              }`}
                              style={{
                                top: layout.top,
                                height: layout.height,
                                background: course?.color ?? '#dbeafe',
                              }}
                              title={`${course?.name ?? 'Course'} · ${formatBlockTimeRange(block)} · ${block.location || course?.room || 'Location'}${block.type ? ` · ${block.type}` : ''}`}
                            >
                              <button
                                type="button"
                                aria-label={`Adjust ${course?.name ?? 'class'} start time`}
                                className={`absolute top-0 right-7 left-0 z-10 h-3 cursor-ns-resize touch-none bg-transparent transition group-hover:bg-blue-300/30 xl:h-2 ${
                                  resizingScheduleBlockId === block.id
                                    ? 'bg-blue-300/40'
                                    : ''
                                }`}
                                title="Drag to adjust start time"
                                onPointerDown={(event) =>
                                  startScheduleBlockResize(
                                    event,
                                    'start',
                                    block,
                                  )
                                }
                              />
                              <button
                                type="button"
                                aria-label={`Adjust ${course?.name ?? 'class'} end time`}
                                className={`absolute right-0 bottom-0 left-0 z-10 h-3 cursor-ns-resize touch-none bg-transparent transition group-hover:bg-blue-300/30 xl:h-2 ${
                                  resizingScheduleBlockId === block.id
                                    ? 'bg-blue-300/40'
                                    : ''
                                }`}
                                title="Drag to adjust end time"
                                onPointerDown={(event) =>
                                  startScheduleBlockResize(event, 'end', block)
                                }
                              />
                              <div className="flex h-full min-h-0 items-center justify-center">
                                <div className="min-w-0 max-w-full">
                                  <p
                                    className={`truncate font-black leading-tight ${
                                      compactBlock ? 'text-xs' : 'text-sm'
                                    }`}
                                  >
                                    {course?.name ?? 'Course'}
                                  </p>
                                  <p
                                    className={`text-xs leading-tight text-blue-950/70 ${
                                      compactBlock ? 'truncate' : ''
                                    }`}
                                  >
                                    {formatBlockTimeRange(block)}
                                    {compactBlock
                                      ? ` · ${block.location || course?.room || 'Location'}`
                                      : ''}
                                  </p>
                                  {!compactBlock ? (
                                    <p className="truncate text-xs font-semibold leading-tight text-blue-950/70">
                                      {block.location ||
                                        course?.room ||
                                        'Location'}
                                    </p>
                                  ) : null}
                                  {!compactBlock && block.type ? (
                                    <p className="truncate text-xs font-semibold leading-tight text-blue-950/70">
                                      {block.type}
                                    </p>
                                  ) : null}
                                </div>
                                <button
                                  aria-label="Delete schedule block"
                                  className="absolute top-1 right-1 opacity-0 transition group-hover:opacity-100"
                                  onClick={() =>
                                    removeItem('schedule', block.id)
                                  }
                                >
                                  <Trash2 className="size-3.5" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </TabsContent>

          <TabsContent
            value="office-hours"
            className="grid min-w-0 gap-4 xl:grid-cols-[360px_minmax(0,1fr)]"
          >
            <section className="tablet-form pixel-panel grid min-w-0 gap-2.5 p-3 xl:gap-3 xl:p-4">
              <h2 className="text-xl font-black">Add Office Hours</h2>
              <Field label="Course">
                <CourseSelect
                  courses={data.courses}
                  onCreateCustom={createCustomCourse}
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
              <div className="grid min-w-0 gap-2.5 md:grid-cols-2 xl:grid-cols-1 xl:gap-3">
                <Field label="Teacher">
                  <TextInput
                    list="office-hour-teacher-options"
                    value={officeHourDraft.teacher}
                    onChange={(event) =>
                      setOfficeHourDraft({
                        ...officeHourDraft,
                        teacher: event.target.value,
                      })
                    }
                    placeholder="Instructor, TA, or other name"
                  />
                  <datalist id="office-hour-teacher-options">
                    {selectedOfficeHourCourse?.instructor ? (
                      <option
                        label={selectedOfficeHourCourse.instructor}
                        value={selectedOfficeHourCourse.instructor}
                      >
                        {selectedOfficeHourCourse.instructor}
                      </option>
                    ) : null}
                    <option label="TA" value="TA">
                      TA
                    </option>
                    <option label="Other" value="Other">
                      Other
                    </option>
                  </datalist>
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
              </div>
              <div className="grid gap-1.5">
                <p className="text-xs font-semibold uppercase text-blue-950/65">
                  Day
                </p>
                <WeekdayToggleGroup
                  value={officeHourDraftDays}
                  onChange={(selectedDays) => {
                    setOfficeHourDraftDays(selectedDays);
                    setOfficeHourDraft({
                      ...officeHourDraft,
                      day: selectedDays[0] ?? officeHourDraft.day,
                    });
                  }}
                />
              </div>
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

            <section className="pixel-panel min-w-0 overflow-hidden p-3 xl:p-4">
              <h2 className="mb-4 text-xl font-black">Office Hours</h2>
              <OfficeHoursMobileList
                days={days}
                blocks={data.officeHours}
                courseById={courseById}
                onDelete={(id) => removeItem('officeHours', id)}
              />
              <div className="hidden min-w-0 overflow-x-auto md:block">
                <div className="grid min-w-[860px] grid-cols-[64px_repeat(5,minmax(140px,1fr))]">
                  <div />
                  {days.map((day) => (
                    <div
                      key={day}
                      className="mx-1 border-2 border-blue-300 bg-amber-50 p-2 text-center text-sm font-black"
                    >
                      {day}
                    </div>
                  ))}
                  <div
                    className="relative border-r border-blue-200"
                    style={{ height: scheduleGridHeight }}
                  >
                    {scheduleHours.map((hour) => (
                      <span
                        key={hour}
                        className="absolute right-2 -translate-y-1/2 text-xs font-semibold text-blue-950/60"
                        style={{
                          top:
                            ((hour - scheduleStartHour) /
                              (scheduleEndHour - scheduleStartHour)) *
                            scheduleGridHeight,
                        }}
                      >
                        {formatScheduleHour(hour)}
                      </span>
                    ))}
                  </div>
                  {days.map((day) => (
                    <div
                      key={day}
                      className="schedule-day-column relative border-r border-blue-200"
                      style={{ height: scheduleGridHeight }}
                    >
                      {data.officeHours
                        .filter((block) => block.day === day)
                        .sort((a, b) => a.start.localeCompare(b.start))
                        .map((block) => {
                          const course = courseById.get(block.courseId);
                          const layout = scheduleBlockLayout(block);
                          const compactBlock = layout.height < 64;
                          return (
                            <div
                              key={block.id}
                              className={`group absolute inset-x-1 overflow-hidden border-2 border-blue-200 px-2 text-center ${
                                compactBlock ? 'py-1' : 'py-1.5'
                              }`}
                              style={{
                                top: layout.top,
                                height: layout.height,
                                background: course?.color ?? '#dbeafe',
                              }}
                              title={`${course?.name ?? 'Course'} · ${formatBlockTimeRange(block)} · ${block.office || 'Office'} · ${block.teacher || course?.instructor || 'Professor'}`}
                            >
                              <button
                                type="button"
                                aria-label={`Adjust ${course?.name ?? 'office hours'} start time`}
                                className={`absolute top-0 right-7 left-0 z-10 h-3 cursor-ns-resize touch-none bg-transparent transition group-hover:bg-blue-300/30 xl:h-2 ${
                                  resizingScheduleBlockId === block.id
                                    ? 'bg-blue-300/40'
                                    : ''
                                }`}
                                title="Drag to adjust start time"
                                onPointerDown={(event) =>
                                  startScheduleBlockResize(
                                    event,
                                    'start',
                                    block,
                                    'officeHours',
                                  )
                                }
                              />
                              <button
                                type="button"
                                aria-label={`Adjust ${course?.name ?? 'office hours'} end time`}
                                className={`absolute right-0 bottom-0 left-0 z-10 h-3 cursor-ns-resize touch-none bg-transparent transition group-hover:bg-blue-300/30 xl:h-2 ${
                                  resizingScheduleBlockId === block.id
                                    ? 'bg-blue-300/40'
                                    : ''
                                }`}
                                title="Drag to adjust end time"
                                onPointerDown={(event) =>
                                  startScheduleBlockResize(
                                    event,
                                    'end',
                                    block,
                                    'officeHours',
                                  )
                                }
                              />
                              <div className="flex h-full min-h-0 items-center justify-center">
                                <div className="min-w-0 max-w-full">
                                  <p
                                    className={`truncate font-black leading-tight ${
                                      compactBlock ? 'text-xs' : 'text-sm'
                                    }`}
                                  >
                                    {course?.name ?? 'Course'}
                                  </p>
                                  <p className="text-xs leading-tight text-blue-950/70">
                                    {formatBlockTimeRange(block)} ·{'  '}
                                    {block.office || 'Office'}
                                  </p>
                                  <p className="truncate text-xs font-semibold leading-tight text-blue-950/70">
                                    {block.teacher ||
                                      course?.instructor ||
                                      'Professor'}
                                  </p>
                                  {!compactBlock && block.notes ? (
                                    <p className="truncate text-xs leading-tight text-blue-950/65">
                                      {block.notes}
                                    </p>
                                  ) : null}
                                </div>
                                <button
                                  aria-label="Delete office hours"
                                  className="absolute top-1 right-1 opacity-0 transition group-hover:opacity-100"
                                  onClick={() =>
                                    removeItem('officeHours', block.id)
                                  }
                                >
                                  <Trash2 className="size-3.5" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  ))}
                </div>
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
                    onCreateCustom={createCustomCourse}
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
                    onCreateCustom={createCustomCourse}
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
                    onCreateCustom={createCustomCourse}
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
            className="grid items-start gap-4 lg:grid-cols-[360px_1fr]"
          >
            <section className="pixel-panel grid gap-3 p-4">
              <h2 className="text-xl font-black">New Note</h2>
              <Field label="Course">
                <CourseSelect
                  courses={data.courses}
                  onCreateCustom={createCustomCourse}
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
            <section
              ref={notesBoardRef}
              className="relative min-h-[260px] w-full"
              style={{ height: packedNotes.height }}
            >
              {packedNotes.items.map(({ note, x, y }) => (
                <div
                  key={note.id}
                  className="absolute transition-[top,left] duration-150"
                  style={{ left: x, top: y }}
                >
                  <StickyNoteCard
                    note={note}
                    courseName={
                      courseById.get(note.courseId)?.name ?? 'General'
                    }
                    onResize={saveNoteSize}
                    onUpdate={updateNote}
                    onDelete={(id) => removeItem('notes', id)}
                  />
                </div>
              ))}
            </section>
          </TabsContent>

          <TabsContent
            value="hours"
            className="grid min-w-0 gap-4 lg:grid-cols-[360px_minmax(0,1fr)]"
          >
            <section className="pixel-panel grid min-w-0 gap-3 p-3 xl:p-4">
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
            <section className="pixel-panel min-w-0 overflow-hidden p-3 xl:p-4">
              <div className="mb-4 flex min-w-0 items-center justify-between gap-3">
                <h2 className="text-xl font-black">Hours Tracker</h2>
                <span className="border-2 border-blue-300 bg-amber-50 px-3 py-1 text-sm font-black">
                  {oneDecimal(totalHours)} total
                </span>
              </div>
              <Table className="min-w-[680px]">
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

          <TabsContent value="import" className="grid min-w-0 gap-3 sm:gap-4">
            <section className="pixel-panel min-w-0 p-3 sm:p-4">
              <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-xl font-black">Import</h2>
                  <p className="text-sm text-blue-950/65">
                    Bring in schedule files, restore saved data, or export a
                    backup.
                  </p>
                </div>
                <span className="border-2 border-blue-300 bg-blue-50 px-3 py-1 text-xs font-black uppercase text-blue-950/70">
                  Data tools
                </span>
              </div>

              <div className="grid min-w-0 gap-3 md:grid-cols-2 xl:grid-cols-3">
                <div className="grid min-w-0 gap-2 border-2 border-blue-200 bg-white p-3 shadow-[3px_3px_0_#dbeafe]">
                  <h3 className="text-base font-black">Schedule PDF</h3>
                  <p className="text-sm text-blue-950/65">
                    Import classes from a schedule PDF.
                  </p>
                  <Button
                    className="mt-2 w-full"
                    variant="outline"
                    onClick={() => schedulePdfInputRef.current?.click()}
                  >
                    <Upload data-icon="inline-start" />
                    Import PDF
                  </Button>
                </div>

                <div className="grid min-w-0 gap-2 border-2 border-blue-200 bg-white p-3 shadow-[3px_3px_0_#dbeafe]">
                  <h3 className="text-base font-black">Excel Setup</h3>
                  <p className="text-sm text-blue-950/65">
                    Import courses and class blocks from Excel.
                  </p>
                  <Button
                    className="mt-2 w-full"
                    variant="outline"
                    onClick={() => excelInputRef.current?.click()}
                  >
                    <Upload data-icon="inline-start" />
                    Import Excel
                  </Button>
                </div>

                <div className="grid min-w-0 gap-2 border-2 border-blue-200 bg-white p-3 shadow-[3px_3px_0_#dbeafe]">
                  <h3 className="text-base font-black">Saved Data</h3>
                  <p className="text-sm text-blue-950/65">
                    Restore a tracker JSON backup.
                  </p>
                  <Button
                    className="mt-2 w-full"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload data-icon="inline-start" />
                    Import Data
                  </Button>
                </div>

                <div className="grid min-w-0 gap-2 border-2 border-blue-200 bg-white p-3 shadow-[3px_3px_0_#dbeafe]">
                  <h3 className="text-base font-black">Export Backup</h3>
                  <p className="text-sm text-blue-950/65">
                    Download a JSON copy of your tracker.
                  </p>
                  <Button
                    className="mt-2 w-full"
                    variant="outline"
                    onClick={exportData}
                  >
                    <Download data-icon="inline-start" />
                    Export
                  </Button>
                </div>

                <div className="grid min-w-0 gap-2 border-2 border-amber-200 bg-amber-50 p-3 shadow-[3px_3px_0_#fde68a] md:col-span-2 xl:col-span-1">
                  <h3 className="text-base font-black">Reset Tracker</h3>
                  <p className="text-sm text-blue-950/65">
                    Return the tracker to its starter template.
                  </p>
                  <Button
                    className="mt-2 w-full"
                    variant="secondary"
                    onClick={resetTemplate}
                  >
                    <RotateCcw data-icon="inline-start" />
                    Reset
                  </Button>
                </div>
              </div>

              <input
                ref={schedulePdfInputRef}
                className="hidden"
                type="file"
                accept="application/pdf"
                onChange={(event) => void importSchedulePdf(event)}
              />
              <input
                ref={excelInputRef}
                className="hidden"
                type="file"
                accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                onChange={(event) => void importExcelSetup(event)}
              />
              <input
                ref={fileInputRef}
                className="hidden"
                type="file"
                accept="application/json"
                onChange={importData}
              />
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

function CourseSelect({
  courses,
  value,
  onChange,
  onCreateCustom,
}: {
  courses: Course[];
  value: string;
  onChange: (value: string) => void;
  onCreateCustom?: (name: string) => string;
}) {
  const customOptionValue = '__custom_course__';
  const handleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedValue = event.target.value;

    if (selectedValue !== customOptionValue) {
      onChange(selectedValue);
      return;
    }

    const customName = window.prompt('Name this custom class or category');
    const cleanName = customName?.trim();
    if (!cleanName || !onCreateCustom) return;

    onChange(onCreateCustom(cleanName));
  };

  return (
    <NativeSelect value={value} onChange={handleChange} className="w-full">
      {courses.map((course) => (
        <NativeSelectOption key={course.id} value={course.id}>
          {course.name}
        </NativeSelectOption>
      ))}
      {onCreateCustom ? (
        <NativeSelectOption value={customOptionValue}>
          + Custom...
        </NativeSelectOption>
      ) : null}
    </NativeSelect>
  );
}

function WeeklyMobileAgenda({
  days,
  weeklyDates,
  assignments,
  schedule,
  officeHours,
  courseById,
  showClasses,
  showOfficeHours,
  showAssignments,
}: {
  days: string[];
  weeklyDates: string[];
  assignments: Assignment[];
  schedule: ScheduleBlock[];
  officeHours: OfficeHourBlock[];
  courseById: Map<string, Course>;
  showClasses: boolean;
  showOfficeHours: boolean;
  showAssignments: boolean;
}) {
  return (
    <div className="grid gap-3 md:hidden">
      {days.map((day, index) => {
        const date = weeklyDates[index];
        const dayBlocks = schedule
          .filter((block) => block.day === day)
          .sort((first, second) => first.start.localeCompare(second.start));
        const dayOfficeHours = officeHours
          .filter((block) => block.day === day)
          .sort((first, second) => first.start.localeCompare(second.start));
        const attachedAssignmentIds = new Set<string>();

        const items: {
          id: string;
          sort: string;
          node: React.ReactNode;
        }[] = [];

        if (showClasses) {
          dayBlocks.forEach((block) => {
            const course = courseById.get(block.courseId);
            const attachedAssignments = showAssignments
              ? assignments.filter((assignment) =>
                  assignmentAttachesToBlock(assignment, date, block, dayBlocks),
                )
              : [];
            attachedAssignments.forEach((assignment) =>
              attachedAssignmentIds.add(assignment.id),
            );

            items.push({
              id: `class-${block.id}`,
              sort: block.start,
              node: (
                <article
                  className="grid min-w-0 gap-2 overflow-hidden border-2 border-blue-200 p-3"
                  style={{ background: course?.color ?? '#dbeafe' }}
                >
                  <div className="min-w-0">
                    <h4 className="truncate font-black text-blue-950">
                      {course?.name ?? 'Course'}
                    </h4>
                    <p className="text-sm font-semibold text-blue-950/70">
                      {formatBlockTimeRange(block)}
                    </p>
                    <p className="truncate text-sm text-blue-950/70">
                      {block.location || course?.room || 'Location'}
                    </p>
                    {block.type ? (
                      <p className="truncate text-xs font-semibold text-blue-950/65">
                        {block.type}
                      </p>
                    ) : null}
                  </div>
                  {attachedAssignments.length ? (
                    <div className="grid gap-1">
                      {attachedAssignments.map((assignment) => (
                        <div
                          key={assignment.id}
                          className="border border-blue-300 bg-white/70 px-2 py-1 text-sm font-black text-blue-950"
                        >
                          <p className="truncate">{assignment.title}</p>
                          <p className="text-xs font-semibold text-blue-950/65">
                            {assignment.type}
                            {assignment.dueTime
                              ? ` · Due ${formatDueTime(assignment.dueTime)}`
                              : ''}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </article>
              ),
            });
          });
        }

        if (showOfficeHours) {
          dayOfficeHours.forEach((block) => {
            const course = courseById.get(block.courseId);
            items.push({
              id: `office-${block.id}`,
              sort: block.start,
              node: (
                <article
                  className="grid min-w-0 gap-1 overflow-hidden border-2 border-blue-200 bg-purple-100 p-3"
                  style={{ background: course?.color ?? '#e9d5ff' }}
                >
                  <p className="text-xs font-black uppercase text-blue-950/65">
                    Office Hours
                  </p>
                  <h4 className="truncate font-black text-blue-950">
                    {course?.name ?? 'Course'}
                  </h4>
                  <p className="text-sm font-semibold text-blue-950/70">
                    {formatBlockTimeRange(block)}
                  </p>
                  <p className="truncate text-sm text-blue-950/70">
                    {block.office || 'Office'}
                  </p>
                  <p className="truncate text-sm text-blue-950/70">
                    {block.teacher || course?.instructor || 'Instructor'}
                  </p>
                  {block.notes ? (
                    <p className="text-sm text-blue-950/65">{block.notes}</p>
                  ) : null}
                </article>
              ),
            });
          });
        }

        if (showAssignments) {
          assignments
            .filter(
              (assignment) =>
                assignment.dueDate === date &&
                !attachedAssignmentIds.has(assignment.id),
            )
            .forEach((assignment) => {
              const course = courseById.get(assignment.courseId);
              items.push({
                id: `assignment-${assignment.id}`,
                sort: assignment.dueTime || '23:59',
                node: (
                  <article
                    className="grid min-w-0 gap-1 overflow-hidden border-2 border-blue-200 bg-blue-50 p-3"
                    style={{ background: course?.color ?? '#dbeafe' }}
                  >
                    <p className="text-xs font-black uppercase text-blue-950/65">
                      {assignment.type}
                    </p>
                    <h4 className="truncate font-black text-blue-950">
                      {assignment.title || 'Untitled assignment'}
                    </h4>
                    <p className="truncate text-sm font-semibold text-blue-950/70">
                      {course?.name ?? 'Course'}
                    </p>
                    <p className="text-sm text-blue-950/70">
                      Due{' '}
                      {assignment.dueTime
                        ? formatDueTime(assignment.dueTime)
                        : formatMonthDay(assignment.dueDate)}
                    </p>
                  </article>
                ),
              });
            });
        }

        items.sort((first, second) => first.sort.localeCompare(second.sort));

        return (
          <section key={day} className="grid gap-2">
            <h3 className="border-2 border-blue-300 bg-amber-50 p-2 text-center text-sm font-black text-blue-950">
              {day}
              <span className="ml-2 text-xs font-bold text-blue-950/55">
                {formatMonthDay(date)}
              </span>
            </h3>
            {items.length ? (
              items.map((item) => <div key={item.id}>{item.node}</div>)
            ) : (
              <div className="border-2 border-blue-100 bg-white/70 p-3 text-sm font-semibold text-blue-950/55">
                Nothing scheduled.
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

function AssignmentMobileCards({
  assignments,
  courseById,
  websites,
  termStartDate,
  termEndDate,
  updateAssignment,
  removeAssignment,
}: {
  assignments: Assignment[];
  courseById: Map<string, Course>;
  websites: WebsiteEntry[];
  termStartDate: string;
  termEndDate: string;
  updateAssignment: <K extends keyof Assignment>(
    id: string,
    key: K,
    value: Assignment[K],
  ) => void;
  removeAssignment: (id: string) => void;
}) {
  const websiteById = new Map(websites.map((website) => [website.id, website]));
  const sortedAssignments = [...assignments].sort((first, second) => {
    const firstDone = first.status === 'Done' || first.submitted;
    const secondDone = second.status === 'Done' || second.submitted;
    if (firstDone !== secondDone) return firstDone ? 1 : -1;

    const firstDue = new Date(
      `${first.dueDate || '9999-12-31'}T${first.dueTime || '23:59'}`,
    ).getTime();
    const secondDue = new Date(
      `${second.dueDate || '9999-12-31'}T${second.dueTime || '23:59'}`,
    ).getTime();

    if (firstDue !== secondDue) return firstDue - secondDue;
    return first.title.localeCompare(second.title);
  });

  if (!sortedAssignments.length) {
    return (
      <div className="border-2 border-blue-200 bg-blue-50 p-4 text-sm font-semibold text-blue-950/70">
        No assignments yet.
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {sortedAssignments.map((assignment) => {
        const left = daysLeft(assignment.dueDate);
        const done = assignment.status === 'Done' || assignment.submitted;
        const week = assignmentWeekLabel(
          assignment.dueDate,
          termStartDate,
          termEndDate,
        );
        const linkIds = assignment.linkIds ?? [];
        const attachedWebsites = linkIds
          .map((id) => websiteById.get(id))
          .filter((website): website is WebsiteEntry => Boolean(website));
        const availableWebsites = websites
          .filter(
            (website) => website.url.trim() && !linkIds.includes(website.id),
          )
          .sort((first, second) => {
            const firstMatchesCourse =
              first.courseId === assignment.courseId ? 0 : 1;
            const secondMatchesCourse =
              second.courseId === assignment.courseId ? 0 : 1;
            if (firstMatchesCourse !== secondMatchesCourse) {
              return firstMatchesCourse - secondMatchesCourse;
            }

            return first.label.localeCompare(second.label);
          });
        const urgencyClass =
          !done && left !== null && left <= 2
            ? 'bg-red-50'
            : !done && left !== null && left <= 5
              ? 'bg-orange-50'
              : 'bg-white';
        const urgencyTextClass =
          !done && left !== null && left <= 2
            ? 'text-red-700'
            : !done && left !== null && left <= 5
              ? 'text-orange-700'
              : 'text-blue-950';
        const leftLabel =
          left === null
            ? '-'
            : left < 0
              ? `${Math.abs(left)} late`
              : `${left} days left`;

        return (
          <article
            key={assignment.id}
            className={`grid min-w-0 gap-3 overflow-hidden border-2 border-blue-200 p-3 ${urgencyClass}`}
          >
            <div className="flex min-w-0 items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-blue-950/65">
                  {courseById.get(assignment.courseId)?.name ?? 'Course'}
                </p>
                <p className={`text-sm font-black ${urgencyTextClass}`}>
                  {leftLabel}
                </p>
              </div>
              <Button
                variant="destructive"
                size="icon"
                aria-label={`Delete ${assignment.title || 'assignment'}`}
                onClick={() => removeAssignment(assignment.id)}
              >
                <Trash2 />
              </Button>
            </div>
            <Field label="Assignment">
              <TextInput
                value={assignment.title}
                onChange={(event) =>
                  updateAssignment(assignment.id, 'title', event.target.value)
                }
              />
            </Field>
            <div className="grid gap-2">
              <NativeSelect
                value=""
                onChange={(event) => {
                  const websiteId = event.target.value;
                  if (!websiteId) return;
                  updateAssignment(assignment.id, 'linkIds', [
                    ...linkIds,
                    websiteId,
                  ]);
                }}
              >
                <NativeSelectOption value="">
                  Attach saved link...
                </NativeSelectOption>
                {availableWebsites.map((website) => {
                  const courseName =
                    courseById.get(website.courseId)?.name ?? 'General';
                  return (
                    <NativeSelectOption key={website.id} value={website.id}>
                      {website.label || website.url} · {courseName}
                    </NativeSelectOption>
                  );
                })}
              </NativeSelect>
              {attachedWebsites.length ? (
                <div className="flex flex-wrap gap-1.5">
                  {attachedWebsites.map((website) => (
                    <span
                      key={website.id}
                      className="inline-flex max-w-full items-center gap-1 border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-bold text-blue-950/75"
                    >
                      <a
                        href={website.url}
                        target="_blank"
                        rel="noreferrer"
                        className="max-w-36 truncate hover:text-blue-700"
                        title={website.url}
                      >
                        {website.label || 'Link'}
                      </a>
                      <button
                        type="button"
                        className="font-black text-blue-950/55 hover:text-red-600"
                        aria-label={`Remove ${website.label || 'link'}`}
                        onClick={() =>
                          updateAssignment(
                            assignment.id,
                            'linkIds',
                            linkIds.filter((id) => id !== website.id),
                          )
                        }
                      >
                        x
                      </button>
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Type">
                <NativeSelect
                  value={assignment.type}
                  onChange={(event) =>
                    updateAssignment(
                      assignment.id,
                      'type',
                      event.target.value as AssignmentType,
                    )
                  }
                >
                  {assignmentTypes.map((type) => (
                    <NativeSelectOption key={type} value={type}>
                      {type}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
              <Field label="Status">
                <NativeSelect
                  value={assignment.status}
                  onChange={(event) => {
                    const nextStatus = event.target.value as Status;
                    updateAssignment(assignment.id, 'status', nextStatus);
                    updateAssignment(
                      assignment.id,
                      'submitted',
                      nextStatus === 'Done',
                    );
                  }}
                >
                  {statuses.map((status) => (
                    <NativeSelectOption key={status} value={status}>
                      {status}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
              <Field label="Week">
                <TextInput value={week} readOnly className="bg-blue-50" />
              </Field>
              <Field label="Due Date">
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
                />
              </Field>
              <Field label="Due Time">
                <TextInput
                  type="time"
                  value={assignment.dueTime ?? ''}
                  onChange={(event) =>
                    updateAssignment(
                      assignment.id,
                      'dueTime',
                      event.target.value,
                    )
                  }
                />
              </Field>
              <Field label="Weight">
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
                />
              </Field>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function CourseMobileCards({
  courses,
  updateCourse,
  removeCourse,
}: {
  courses: Course[];
  updateCourse: <K extends keyof Course>(
    id: string,
    key: K,
    value: Course[K],
  ) => void;
  removeCourse: (id: string) => void;
}) {
  return (
    <div className="grid gap-3">
      {courses.map((course) => (
        <article
          key={course.id}
          className="grid min-w-0 gap-3 overflow-hidden border-2 border-blue-200 bg-white p-3"
        >
          <div className="flex min-w-0 items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <Field label="Course">
                <TextInput
                  value={course.name}
                  onChange={(event) =>
                    updateCourse(course.id, 'name', event.target.value)
                  }
                />
              </Field>
            </div>
            <Button
              variant="destructive"
              size="icon"
              aria-label={`Delete ${course.name}`}
              onClick={() => removeCourse(course.id)}
            >
              <Trash2 />
            </Button>
          </div>
          <CourseColorControls
            value={course.color}
            size="sm"
            presetLimit={3}
            label={`Set ${course.name || 'course'} color`}
            onChange={(color) => updateCourse(course.id, 'color', color)}
          />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Code">
              <TextInput
                value={course.code}
                onChange={(event) =>
                  updateCourse(course.id, 'code', event.target.value)
                }
              />
            </Field>
            <Field label="Credits">
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
              />
            </Field>
          </div>
          <Field label="Room">
            <TextInput
              value={course.room}
              onChange={(event) =>
                updateCourse(course.id, 'room', event.target.value)
              }
            />
          </Field>
          <Field label="Instructor">
            <TextInput
              value={course.instructor}
              onChange={(event) =>
                updateCourse(course.id, 'instructor', event.target.value)
              }
            />
          </Field>
          <Field label="Email">
            <TextInput
              type="email"
              value={course.email ?? ''}
              onChange={(event) =>
                updateCourse(course.id, 'email', event.target.value)
              }
            />
          </Field>
          <Field label="Section">
            <TextInput
              value={course.section ?? ''}
              onChange={(event) =>
                updateCourse(course.id, 'section', event.target.value)
              }
            />
          </Field>
        </article>
      ))}
    </div>
  );
}

function ScheduleMobileList({
  days,
  blocks,
  courseById,
  onDelete,
}: {
  days: string[];
  blocks: ScheduleBlock[];
  courseById: Map<string, Course>;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="grid gap-3 md:hidden">
      {days.map((day) => {
        const dayBlocks = blocks
          .filter((block) => block.day === day)
          .sort((first, second) => first.start.localeCompare(second.start));
        return (
          <section key={day} className="grid gap-2">
            <h3 className="border-2 border-blue-300 bg-amber-50 p-2 text-center text-sm font-black text-blue-950">
              {day}
            </h3>
            {dayBlocks.length ? (
              dayBlocks.map((block) => {
                const course = courseById.get(block.courseId);
                return (
                  <article
                    key={block.id}
                    className="grid min-w-0 gap-2 overflow-hidden border-2 border-blue-200 p-3"
                    style={{ background: course?.color ?? '#dbeafe' }}
                  >
                    <div className="flex min-w-0 items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h4 className="truncate font-black text-blue-950">
                          {course?.name ?? 'Course'}
                        </h4>
                        <p className="text-sm font-semibold text-blue-950/70">
                          {formatBlockTimeRange(block)}
                        </p>
                        <p className="truncate text-sm text-blue-950/70">
                          {block.location || course?.room || 'Location'}
                        </p>
                        {block.type ? (
                          <p className="truncate text-xs font-semibold text-blue-950/65">
                            {block.type}
                          </p>
                        ) : null}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Delete schedule block"
                        onClick={() => onDelete(block.id)}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </article>
                );
              })
            ) : (
              <div className="border-2 border-blue-100 bg-white/70 p-3 text-sm font-semibold text-blue-950/55">
                No blocks.
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

function OfficeHoursMobileList({
  days,
  blocks,
  courseById,
  onDelete,
}: {
  days: string[];
  blocks: OfficeHourBlock[];
  courseById: Map<string, Course>;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="grid gap-3 md:hidden">
      {days.map((day) => {
        const dayBlocks = blocks
          .filter((block) => block.day === day)
          .sort((first, second) => first.start.localeCompare(second.start));
        return (
          <section key={day} className="grid gap-2">
            <h3 className="border-2 border-blue-300 bg-amber-50 p-2 text-center text-sm font-black text-blue-950">
              {day}
            </h3>
            {dayBlocks.length ? (
              dayBlocks.map((block) => {
                const course = courseById.get(block.courseId);
                return (
                  <article
                    key={block.id}
                    className="grid min-w-0 gap-2 overflow-hidden border-2 border-blue-200 p-3"
                    style={{ background: course?.color ?? '#e9d5ff' }}
                  >
                    <div className="flex min-w-0 items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-black uppercase text-blue-950/65">
                          Office Hours
                        </p>
                        <h4 className="truncate font-black text-blue-950">
                          {course?.name ?? 'Course'}
                        </h4>
                        <p className="text-sm font-semibold text-blue-950/70">
                          {formatBlockTimeRange(block)}
                        </p>
                        <p className="truncate text-sm text-blue-950/70">
                          {block.office || 'Office'}
                        </p>
                        <p className="truncate text-sm text-blue-950/70">
                          {block.teacher || course?.instructor || 'Instructor'}
                        </p>
                        {block.notes ? (
                          <p className="text-sm text-blue-950/65">
                            {block.notes}
                          </p>
                        ) : null}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Delete office hours"
                        onClick={() => onDelete(block.id)}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </article>
                );
              })
            ) : (
              <div className="border-2 border-blue-100 bg-white/70 p-3 text-sm font-semibold text-blue-950/55">
                No office hours.
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

function AssignmentPreviewList({
  assignments,
  courseById,
  termStartDate,
  termEndDate,
}: {
  assignments: Assignment[];
  courseById: Map<string, Course>;
  termStartDate: string;
  termEndDate: string;
}) {
  if (assignments.length === 0) {
    return (
      <div className="border-2 border-blue-200 bg-blue-50 p-4 text-sm font-semibold text-blue-950/70">
        No upcoming assignments.
      </div>
    );
  }

  return (
    <div className="grid min-w-0 grid-cols-[repeat(auto-fit,minmax(min(260px,100%),1fr))] gap-3">
      {assignments.map((assignment) => {
        const course = courseById.get(assignment.courseId);
        const left = daysLeft(assignment.dueDate);
        const dueTime = formatDueTime(assignment.dueTime);
        const overdue = left !== null && left < 0;
        return (
          <article
            key={assignment.id}
            className={`grid min-w-0 gap-2 overflow-hidden border-2 border-blue-200 bg-white p-3 ${
              overdue ? 'bg-orange-50' : ''
            }`}
          >
            <div className="flex items-start gap-3">
              <span
                className="mt-1 size-4 shrink-0 border-2 border-blue-400"
                style={{ background: course?.color ?? '#dbeafe' }}
              />
              <div className="min-w-0 flex-1">
                <p className="overflow-hidden text-sm leading-tight font-black text-blue-950 [display:-webkit-box] [overflow-wrap:anywhere] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]">
                  {assignment.title || 'Untitled assignment'}
                </p>
                <p className="mt-0.5 text-xs font-semibold text-blue-950/65 [overflow-wrap:anywhere]">
                  {course?.name ?? 'Course'} · {assignment.type}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-blue-950/70">
              <span className="border border-blue-200 bg-blue-50 px-2 py-0.5">
                {formatMonthDay(assignment.dueDate)}
                {dueTime ? `, ${dueTime}` : ''}
              </span>
              <span className="border border-blue-200 bg-white px-2 py-0.5">
                {assignmentWeekLabel(
                  assignment.dueDate,
                  termStartDate,
                  termEndDate,
                )}
              </span>
              <span
                className={`border px-2 py-0.5 ${
                  overdue
                    ? 'border-orange-300 bg-orange-100 text-orange-800'
                    : 'border-blue-200 bg-white'
                }`}
              >
                {left === null
                  ? '-'
                  : left < 0
                    ? `${Math.abs(left)} late`
                    : `${left} days`}
              </span>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function TodayClassList({
  blocks,
  courseById,
}: {
  blocks: ScheduleBlock[];
  courseById: Map<string, Course>;
}) {
  if (blocks.length === 0) {
    return (
      <div className="border-2 border-blue-200 bg-blue-50 p-4 text-sm font-semibold text-blue-950/70">
        No classes scheduled today.
      </div>
    );
  }

  return (
    <div className="grid min-w-0 grid-cols-[repeat(auto-fit,minmax(min(230px,100%),1fr))] gap-3">
      {blocks.map((block) => {
        const course = courseById.get(block.courseId);
        return (
          <article
            key={block.id}
            className="grid min-w-0 gap-2 overflow-hidden border-2 border-blue-200 p-3"
            style={{ background: course?.color ?? '#dbeafe' }}
          >
            <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="overflow-hidden text-sm leading-tight font-black text-blue-950 [display:-webkit-box] [overflow-wrap:anywhere] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]">
                  {course?.name ?? 'Course'}
                </p>
                <p className="truncate text-xs font-semibold text-blue-950/65">
                  {course?.code || 'No code'}
                </p>
              </div>
              <span className="max-w-full shrink-0 border border-blue-300 bg-white/70 px-2 py-0.5 text-xs font-black text-blue-950/70">
                {formatBlockTimeRange(block)}
              </span>
            </div>
            <p className="truncate text-xs font-semibold text-blue-950/75">
              {block.location || course?.room || 'Location'}
            </p>
            {block.type ? (
              <p className="truncate text-xs font-semibold text-blue-950/70">
                {block.type}
              </p>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}

function AssignmentTable({
  assignments,
  courseById,
  websites,
  termStartDate,
  termEndDate,
  updateAssignment,
  removeAssignment,
}: {
  assignments: Assignment[];
  courseById: Map<string, Course>;
  websites: WebsiteEntry[];
  termStartDate: string;
  termEndDate: string;
  updateAssignment: <K extends keyof Assignment>(
    id: string,
    key: K,
    value: Assignment[K],
  ) => void;
  removeAssignment: (id: string) => void;
}) {
  const websiteById = new Map(websites.map((website) => [website.id, website]));
  const sortedAssignments = [...assignments].sort((first, second) => {
    const firstDone = first.status === 'Done' || first.submitted;
    const secondDone = second.status === 'Done' || second.submitted;
    if (firstDone !== secondDone) return firstDone ? 1 : -1;

    const firstDue = new Date(
      `${first.dueDate || '9999-12-31'}T${first.dueTime || '23:59'}`,
    ).getTime();
    const secondDue = new Date(
      `${second.dueDate || '9999-12-31'}T${second.dueTime || '23:59'}`,
    ).getTime();

    if (firstDue !== secondDue) return firstDue - secondDue;
    return first.title.localeCompare(second.title);
  });

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Course</TableHead>
          <TableHead>Assignment</TableHead>
          <TableHead>Links</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Week</TableHead>
          <TableHead>Due</TableHead>
          <TableHead />
        </TableRow>
      </TableHeader>
      <TableBody>
        {sortedAssignments.map((assignment) => {
          const left = daysLeft(assignment.dueDate);
          const done = assignment.status === 'Done' || assignment.submitted;
          const week = assignmentWeekLabel(
            assignment.dueDate,
            termStartDate,
            termEndDate,
          );
          const linkIds = assignment.linkIds ?? [];
          const attachedWebsites = linkIds
            .map((id) => websiteById.get(id))
            .filter((website): website is WebsiteEntry => Boolean(website));
          const availableWebsites = websites
            .filter(
              (website) => website.url.trim() && !linkIds.includes(website.id),
            )
            .sort((first, second) => {
              const firstMatchesCourse =
                first.courseId === assignment.courseId ? 0 : 1;
              const secondMatchesCourse =
                second.courseId === assignment.courseId ? 0 : 1;
              if (firstMatchesCourse !== secondMatchesCourse) {
                return firstMatchesCourse - secondMatchesCourse;
              }

              return first.label.localeCompare(second.label);
            });
          const urgencyClass =
            !done && left !== null && left <= 2
              ? 'bg-red-50'
              : !done && left !== null && left <= 5
                ? 'bg-orange-50'
                : '';
          const urgencyTextClass =
            !done && left !== null && left <= 2
              ? 'text-red-700'
              : !done && left !== null && left <= 5
                ? 'text-orange-700'
                : 'text-blue-950';
          const leftLabel =
            left === null
              ? '-'
              : left < 0
                ? `${Math.abs(left)} late`
                : `${left} days left`;
          return (
            <TableRow key={assignment.id} className={urgencyClass}>
              <TableCell className="align-top py-2">
                {courseById.get(assignment.courseId)?.name ?? 'Course'}
              </TableCell>
              <TableCell className="min-w-56 align-top py-2">
                <TextInput
                  value={assignment.title}
                  onChange={(event) =>
                    updateAssignment(assignment.id, 'title', event.target.value)
                  }
                  className="w-full"
                />
              </TableCell>
              <TableCell className="min-w-60 align-top py-2">
                <div className="grid gap-2">
                  <NativeSelect
                    value=""
                    onChange={(event) => {
                      const websiteId = event.target.value;
                      if (!websiteId) return;

                      updateAssignment(assignment.id, 'linkIds', [
                        ...linkIds,
                        websiteId,
                      ]);
                    }}
                    className="w-full"
                  >
                    <NativeSelectOption value="">
                      Attach saved link...
                    </NativeSelectOption>
                    {availableWebsites.map((website) => {
                      const courseName =
                        courseById.get(website.courseId)?.name ?? 'General';
                      return (
                        <NativeSelectOption key={website.id} value={website.id}>
                          {website.label || website.url} · {courseName}
                        </NativeSelectOption>
                      );
                    })}
                  </NativeSelect>
                  {attachedWebsites.length ? (
                    <div className="flex flex-wrap gap-1.5">
                      {attachedWebsites.map((website) => (
                        <span
                          key={website.id}
                          className="inline-flex max-w-full items-center gap-1 border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-bold text-blue-950/75"
                        >
                          <a
                            href={website.url}
                            target="_blank"
                            rel="noreferrer"
                            className="max-w-28 truncate hover:text-blue-700"
                            title={website.url}
                          >
                            {website.label || 'Link'}
                          </a>
                          <button
                            type="button"
                            className="font-black text-blue-950/55 hover:text-red-600"
                            aria-label={`Remove ${website.label || 'link'}`}
                            onClick={() =>
                              updateAssignment(
                                assignment.id,
                                'linkIds',
                                linkIds.filter((id) => id !== website.id),
                              )
                            }
                          >
                            x
                          </button>
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              </TableCell>
              <TableCell className="align-top py-2">
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
              <TableCell className="min-w-36 align-top py-2">
                <div className="grid gap-1.5">
                  <NativeSelect
                    value={assignment.status}
                    onChange={(event) => {
                      const nextStatus = event.target.value as Status;
                      updateAssignment(assignment.id, 'status', nextStatus);
                      updateAssignment(
                        assignment.id,
                        'submitted',
                        nextStatus === 'Done',
                      );
                    }}
                    className="w-36"
                  >
                    {statuses.map((status) => (
                      <NativeSelectOption key={status} value={status}>
                        {status}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                  <span
                    className={`text-sm leading-tight font-black ${urgencyTextClass}`}
                  >
                    {leftLabel}
                  </span>
                </div>
              </TableCell>
              <TableCell className="align-top py-2">
                <span className="inline-flex min-w-28 justify-center border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-black text-blue-950/75">
                  {week}
                </span>
              </TableCell>
              <TableCell className="min-w-40 align-top py-2">
                <div className="grid gap-1">
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
                  <TextInput
                    type="time"
                    value={assignment.dueTime ?? ''}
                    onChange={(event) =>
                      updateAssignment(
                        assignment.id,
                        'dueTime',
                        event.target.value,
                      )
                    }
                    className="w-40"
                  />
                </div>
              </TableCell>
              <TableCell className="align-top py-2">
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



