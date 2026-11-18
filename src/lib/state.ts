import {safeFilePath} from '../../electron/academy-state.mjs';
export {parseBackup, serializeBackup, validateUrl, MAX_BACKUP_BYTES} from '../../electron/academy-state.mjs';
import type {AcademyState, Lesson, LessonProgress} from '../types';
export const newState = ():AcademyState => ({version:1,onboarded:false,track:'Beginner',depth:'Detailed',currentLesson:'',progress:{},projects:[],studySeconds:0,studyDays:[],sourceOverrides:{},serverPath:''});
export const freshProgress = (lesson:Lesson):LessonProgress => ({code:lesson.exercise.starter,files:lesson.exercise.files,exercisePassed:false,completed:false,hints:0,attempts:0,updated:new Date().toISOString()});
export function localDay(date=new Date()){return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`}
export function streak(days:string[], now=new Date()) { const dates=new Set(days); const d=new Date(now); let n=0;if(!dates.has(localDay(d)))d.setDate(d.getDate()-1);while(dates.has(localDay(d))){n++;d.setDate(d.getDate()-1)}return n; }
export function nextLesson(state:AcademyState, lessons:Lesson[]) {return lessons.find(l=>l.id===state.currentLesson&&!state.progress[l.id]?.completed) ?? lessons.find(l=>!state.progress[l.id]?.completed && (state.track==='Beginner'||l.module>=(state.track==='Intermediate'?2:8))) ?? lessons.find(l=>!state.progress[l.id]?.completed) ?? lessons[0]}
export function isComplete(p:LessonProgress){return p.exercisePassed&&p.quizCorrect===true}
export function safeFileName(name: string): boolean {
  try {
    safeFilePath(name);
    return true;
  } catch {
    return false;
  }
}
export function download(name:string,content:string|Uint8Array,type='application/json'){const blob=new Blob([content as BlobPart],{type});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),5000)}
