import {describe, expect, it} from 'vitest';
import {initialFrame, missions, runDispatch} from '../src/lib/dispatch';
import {executeLua} from '../src/lib/lua-core';

const first = missions[0];

describe('City Dispatch', () => {
  it.each(missions)('$title has a reachable route and a starter that needs a change', async mission => {
    expect(mission.streets).toHaveLength(5);
    expect(mission.streets.every(row => /^[.#]{7}$/.test(row))).toBe(true);
    const unfinished = await runDispatch(mission, mission.starter, executeLua);
    expect(unfinished.pass).toBe(false);
    expect(unfinished.frames.length).toBeGreaterThan(1);

    const trip = await runDispatch(mission, mission.solution, executeLua);
    expect(trip.pass, trip.feedback).toBe(true);
    expect(trip.frames[0]).toEqual(initialFrame(mission));
    const last = trip.frames.at(-1)!;
    expect([last.x, last.y]).toEqual([mission.terminus.x, mission.terminus.y]);
    expect(trip.frames.filter(frame => frame.action === 'pickup')).toHaveLength(mission.stops.length);
    expect(new Set(last.collected).size).toBe(mission.stops.length);
    for (const [index, frame] of trip.frames.entries()) {
      expect(mission.streets[frame.y][frame.x]).toBe('.');
      if (index > 0) {
        const previous = trip.frames[index - 1];
        expect(Math.abs(frame.x - previous.x) + Math.abs(frame.y - previous.y)).toBe(frame.action === 'drive' ? 1 : 0);
      }
    }
  });

  it('accepts a different route and programming style with ordinary debugging prints', async () => {
    const script = `local route = {"west", "east", "east", "east"}
      for _, direction in ipairs(route) do
        print("Taking the " .. direction .. " road")
        drive(direction)
      end
      pickup()
      for i = 1, 2 do drive("east") end`;
    expect((await runDispatch(first, script, executeLua)).pass).toBe(true);
  });

  it.each([
    ['drive("north")', /city block/i],
    ['drive("west")\ndrive("west")', /leaves the map/i],
    ['pickup()', /marked stop/i],
    ['drive("east")\ndrive("east")\npickup()\npickup()', /already aboard/i],
    ['for block = 1, 4 do drive("east") end', /Ferry Pier/],
    ['drive("east")\ndrive("east")\npickup()', /Harbor Station/],
    ['drive("left")', /north.*east.*south.*west/i],
    ['drive("east"', /student.lua:1/],
  ])('gives actionable feedback for %s', async (script, expected) => {
    const result = await runDispatch(first, script, executeLua);
    expect(result.pass).toBe(false);
    expect(result.feedback).toMatch(expected);
  });

  it('keeps the last legal position on a bad turn and preserves completed pickups', async () => {
    const result = await runDispatch(first, 'drive("east")\ndrive("east")\npickup()\ndrive("east")\ndrive("north")', executeLua);
    expect(result.pass).toBe(false);
    expect(result.frames.at(-1)).toMatchObject({x: 4, y: 2, facing: 'east', collected: [0]});
    expect(result.frames[0].collected).toEqual([]);
  });

  it('caps playback even when Lua produces more than forty route actions', async () => {
    const result = await runDispatch(first, 'for i = 1, 100 do drive("east") drive("west") end', executeLua);
    expect(result.pass).toBe(false);
    expect(result.feedback).toMatch(/40 actions/);
    expect(result.frames).toHaveLength(41);
  });

  it('does not award a route whose final commands or completion were lost', async () => {
    const outputLimit = await runDispatch(first, first.solution + '\nfor i = 1, 150 do print(i) end\ndrive("east")', executeLua);
    expect(outputLimit.pass).toBe(false);
    expect(outputLimit.feedback).toMatch(/radio log/);
    const timeout = await runDispatch(first, first.solution, async () => ({
      ok: false, error: 'Execution stopped after 1.5 seconds.', output: [], durationMs: 1500,
    }));
    expect(timeout.pass).toBe(false);
    expect(timeout.feedback).toMatch(/1.5 seconds/);
    expect(timeout.frames).toEqual([initialFrame(first)]);
  });
});
