import type { Lesson, Exercise, Rule } from '../types';

export const quiz = (question: string, options: string[], answer: number, explanation: string) => ({ question, options, answer, explanation });
export const rule = (name: string, pattern: string, explanation: string, file?: string): Rule => ({ name, pattern, explanation, file });
export const lua = (instructions: string, starter: string, solution: string, tests: [string, string][], hints: [string, string, string]): Exercise => ({ instructions, starter, solution, mode: 'lua', filename: 'exercise.lua', tests: tests.map(([name, code]) => ({ name, code })), hints });
export const structural = (instructions: string, starter: string, solution: string, rules: Rule[], hints: [string, string, string], filename = 'client.lua', files?: Record<string, string>): Exercise => ({ instructions: instructions + '\n\nEvaluation: Lua syntax and the listed structural requirements only. This is not a live FiveM test or a proof of security. Follow the independent challenge in a private development server.', starter, solution, mode: 'static', tests: [], rules, hints, filename, files });
export const simulated = (exercise: Exercise, mock: string, tests: [string, string][]): Exercise => ({
  ...exercise,
  instructions: exercise.instructions.replace(/\n\nEvaluation:[\s\S]*$/, '') + '\n\nEvaluation: isolated Lua with educational mocks checks the listed handler behaviors. It does not run FiveM, a framework, a browser, or a database. Complete the independent challenge in your private development server to verify integration.',
  mode: 'fivem', mock, tests: tests.map(([name, code]) => ({ name, code })), rules: undefined,
});
export const lesson = (data: Lesson): Lesson => data;
export const manifest = "fx_version 'cerulean'\ngame 'gta5'\nauthor 'Academy learner'\ndescription 'Private development resource'\nversion '1.0.0'\nclient_script 'client.lua'\n";
export const commandMock = `_COMMANDS = {}
_EVENTS = {}
function RegisterCommand(name, callback, restricted)
  _COMMANDS[name] = { callback = callback, restricted = restricted }
end
function TriggerEvent(name, data)
  _EVENTS[#_EVENTS + 1] = { name = name, data = data }
end`;
