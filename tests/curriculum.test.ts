import {describe,it,expect} from 'vitest';
import {lessons,sources,modules,projects} from '../src/content';
import {evaluateWithRunner} from '../src/lib/evaluation';
import {executeLua} from '../src/lib/lua-core';
describe('bundled course integrity',()=>{
 it('has unique lesson/source identifiers and resolves every source',()=>{expect(new Set(lessons.map(l=>l.id)).size).toBe(lessons.length);expect(new Set(sources.map(s=>s.id)).size).toBe(sources.length);for(const l of lessons){expect(l.sources.length,l.id).toBeGreaterThan(0);for(const source of l.sources)expect(sources.some(s=>s.id===source),`${l.id}: ${source}`).toBe(true);expect(l.exercise.hints).toHaveLength(3);expect(l.quiz.answer).toBeGreaterThanOrEqual(0);expect(l.quiz.answer).toBeLessThan(l.quiz.options.length);expect(l.explanation.length,l.id).toBeGreaterThan(0)}});
 it('includes all nine modules and eleven advanced project briefs',()=>{expect(modules).toHaveLength(9);expect(projects.length).toBeGreaterThanOrEqual(11);for(const m of modules)expect(lessons.some(l=>l.module===m.id),m.title).toBe(true);for(const p of projects){expect(p.requirements.length).toBeGreaterThan(0);expect(p.milestones.length).toBeGreaterThan(0);expect(p.checkpoints.length).toBeGreaterThan(0);expect(p.review.length).toBeGreaterThan(0)}});
 for(const lesson of lessons){
  it(`${lesson.id}: solution satisfies the actual checks`,async()=>{const r=await evaluateWithRunner(lesson.exercise,lesson.exercise.solution,lesson.exercise.files,executeLua);expect(r.results.filter(x=>!x.passed),JSON.stringify(r.results.filter(x=>!x.passed))).toEqual([]);expect(r.passed).toBe(true)},15000);
  it(`${lesson.id}: starter requires learner work`,async()=>{const r=await evaluateWithRunner(lesson.exercise,lesson.exercise.starter,lesson.exercise.files,executeLua);expect(r.passed,lesson.id).toBe(false)},15000);
 }
});
