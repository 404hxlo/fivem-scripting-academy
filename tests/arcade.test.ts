import {describe, expect, it} from 'vitest';
import {dealArcade, puzzlePools} from '../src/lib/arcade';
import {executeLua} from '../src/lib/lua-core';
import {newState, parseBackup, serializeBackup} from '../src/lib/state';

describe('Output Arcade', () => {
  it.each(puzzlePools.flat())('offers exactly one real Lua output for $title', async puzzle => {
    const run = await executeLua(puzzle.code);
    expect(run.ok).toBe(true);
    expect(run.output).toEqual([puzzle.output]);
    expect(new Set([puzzle.output, ...puzzle.alternatives]).size).toBe(3);
  });
  it('deals three distinct rounds and replaces all of them on replay', () => {
    const first = dealArcade();
    const second = dealArcade(first);
    expect(first).toHaveLength(3);
    expect(second).toHaveLength(3);
    expect(new Set([...first, ...second].map(puzzle => puzzle.id)).size).toBe(6);
    second.forEach((puzzle, i) => {
      expect(puzzlePools[i].some(item => item.id === puzzle.id)).toBe(true);
      expect(puzzle.choices.toSorted()).toEqual([puzzle.output, ...puzzle.alternatives].toSorted());
    });
  });
  it('loads pre-arcade profiles as saved and round-trips completed scores including zero', () => {
    const legacy = newState();
    expect(parseBackup(serializeBackup(legacy))).toEqual(legacy);
    for (const bestScore of [0, 1, 2, 3]) {
      const profile = {...legacy, arcade:{bestScore}};
      expect(parseBackup(serializeBackup(profile))).toEqual(profile);
    }
    for (const invalid of [-1, 1.5, 4, null, '3']) {
      expect(() => parseBackup(JSON.stringify({...legacy, arcade:{bestScore:invalid}}))).toThrow();
    }
  });
});
