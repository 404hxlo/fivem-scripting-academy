export type Track = 'Beginner' | 'Intermediate' | 'Advanced';
export type Depth = 'Simple' | 'Detailed' | 'Technical';
export interface Source { id: string; title: string; url: string; topic: string; retrieved: string; kind: 'official' | 'framework' | 'educational'; notes?: string; lessons?: string[] }
export interface Check { name: string; code: string }
export interface Rule { name: string; pattern: string; flags?: string; file?: string; absent?: boolean; explanation: string }
export interface Exercise { instructions: string; starter: string; solution: string; mode: 'lua' | 'fivem' | 'static'; tests: Check[]; rules?: Rule[]; hints: [string,string,string]; filename?: string; files?: Record<string,string>; mock?: string }
export interface Lesson { id: string; module: number; title: string; minutes: number; level: Track; concept: string; why: string; example: string; explanation: string[]; exercise: Exercise; challenge: string; quiz: { question: string; options: string[]; answer: number; explanation: string }; review: string[]; sources: string[]; technical?: string; prerequisites?: string[] }
export interface CourseModule { id: number; title: string; subtitle: string; icon: string; project: string }
export interface ProjectBrief { id: string; title: string; level: Track; description: string; requirements: string[]; milestones: string[]; checkpoints: string[]; review: string[]; sources: string[]; template?: string }
export interface LessonProgress { code: string; files?: Record<string,string>; exercisePassed: boolean; quizAnswer?: number; quizCorrect?: boolean; completed: boolean; hints: number; attempts: number; updated: string }
export interface Project { id: string; name: string; template: string; files: Record<string,string>; updated: string; history: { date: string; files: Record<string,string> }[]; briefId?: string; checkpoints?: number[] }
export interface AcademyState { version: 1; onboarded: boolean; track: Track; depth: Depth; currentLesson: string; progress: Record<string,LessonProgress>; projects: Project[]; studySeconds: number; studyDays: string[]; sourceOverrides: Record<string,{url:string; checked?:string; status?:string}>; serverPath: string; arcade?: {bestScore: number}; dispatch?: {drafts: Record<string,string>; completed: string[]} }
export interface RunResult { ok: boolean; output: string[]; error?: string; line?: number; durationMs: number }
export interface Evaluation { passed: boolean; results: { name: string; passed: boolean; detail: string }[]; output: string[]; mode: string }
export interface DesktopAPI { saveBeforeClose: (state:AcademyState)=>boolean; load: () => Promise<AcademyState|null>; save: (state:AcademyState)=>Promise<void>; exportResource: (project:Project, format:'folder'|'zip')=>Promise<string|null>; exportBackup: (state:AcademyState)=>Promise<string|null>; importBackup: ()=>Promise<AcademyState|null>; openExternal: (url:string)=>Promise<void>; openVSCode: (project:Project)=>Promise<string>; refreshSource:(url:string)=>Promise<{status:string;checked:string}>; chooseServer:()=>Promise<string|null> }
declare global { interface Window { academy?: DesktopAPI } }
