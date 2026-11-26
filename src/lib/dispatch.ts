import type {LuaRunner} from './evaluation';

export type Direction = 'north' | 'east' | 'south' | 'west';
export interface Point { x: number; y: number }
interface Landmark extends Point { name: string }

export interface DispatchMission {
  id: 'first-stop' | 'market-loop' | 'night-shift';
  title: string;
  district: string;
  brief: string;
  concept: string;
  hint: string;
  streets: string[];
  start: Point;
  facing: Direction;
  stops: Landmark[];
  terminus: Landmark;
  starter: string;
  solution: string;
}

export interface DispatchFrame extends Point {
  facing: Direction;
  collected: number[];
  action: 'start' | 'drive' | 'pickup';
  note: string;
}

export interface DispatchResult {
  pass: boolean;
  frames: DispatchFrame[];
  feedback: string;
}

export const missions: DispatchMission[] = [
  {
    id: 'first-stop', title: 'First stop', district: 'Harborfront',
    brief: 'The ferry just docked. Pick up the passengers at Ferry Pier and take them to the station.',
    concept: 'Sequence',
    hint: 'Each drive moves one square. From Ferry Pier the station is two squares east.',
    streets: ['.......', '.##.##.', '.......', '.##.##.', '.......'],
    start: {x: 1, y: 2}, facing: 'east',
    stops: [{name: 'Ferry Pier', x: 3, y: 2}], terminus: {name: 'Harbor Station', x: 5, y: 2},
    starter: 'drive("east")\ndrive("east")\npickup()\ndrive("east")\n-- Add the last move to the station.',
    solution: 'drive("east")\ndrive("east")\npickup()\ndrive("east")\ndrive("east")',
  },
  {
    id: 'market-loop', title: 'Market loop', district: 'Old Market',
    brief: 'The market is closing. Collect riders at the flower stalls and the bakery, then head to Central Station.',
    concept: 'Counting loops',
    hint: 'Count three squares east to the flower stalls. The second loop already takes you two squares south to the bakery.',
    streets: ['#.....#', '#.###.#', '.......', '.###.#.', '.......'],
    start: {x: 1, y: 2}, facing: 'east',
    stops: [{name: 'Flower Stalls', x: 4, y: 2}, {name: 'Bakery', x: 4, y: 4}],
    terminus: {name: 'Central Station', x: 6, y: 4},
    starter: '-- Fix the first loop to reach the flower stalls.\nfor block = 1, 2 do\n  drive("east")\nend\npickup()\nfor block = 1, 2 do\n  drive("south")\nend\npickup()\ndrive("east")\ndrive("east")',
    solution: 'for block = 1, 3 do\n  drive("east")\nend\npickup()\nfor block = 1, 2 do\n  drive("south")\nend\npickup()\ndrive("east")\ndrive("east")',
  },
  {
    id: 'night-shift', title: 'Night shift', district: 'Neon Heights',
    brief: 'Run the last bus home. Collect the crews at the diner, the arcade and the cinema before pulling into the depot.',
    concept: 'Reusable functions',
    hint: 'Inside ride, repeat drive(direction) once for every block. The four calls spell out the whole route.',
    streets: ['.......', '.#..#..', '....#.#', '.##.##.', '.......'],
    start: {x: 0, y: 4}, facing: 'north',
    stops: [{name: 'Diner', x: 0, y: 2}, {name: 'Arcade', x: 3, y: 2}, {name: 'Cinema', x: 3, y: 0}],
    terminus: {name: 'Night Depot', x: 6, y: 0},
    starter: 'local function ride(direction, blocks)\n  -- Make the bus travel the full number of blocks.\n  drive(direction)\nend\n\nride("north", 2)\npickup()\nride("east", 3)\npickup()\nride("north", 2)\npickup()\nride("east", 3)',
    solution: 'local function ride(direction, blocks)\n  for block = 1, blocks do\n    drive(direction)\n  end\nend\n\nride("north", 2)\npickup()\nride("east", 3)\npickup()\nride("north", 2)\npickup()\nride("east", 3)',
  },
];

const movement: Record<Direction, Point> = {
  north: {x: 0, y: -1}, east: {x: 1, y: 0}, south: {x: 0, y: 1}, west: {x: -1, y: 0},
};
const maxCommands = 40;

export function initialFrame(mission: DispatchMission): DispatchFrame {
  return {...mission.start, facing: mission.facing, collected: [], action: 'start', note: 'Bus ready at the starting bay.'};
}

function sameSquare(a: Point, b: Point) { return a.x === b.x && a.y === b.y; }

// The existing Lua worker owns execution and timeouts. Its captured output
// carries a small, per-run command stream alongside ordinary learner prints.
export async function runDispatch(mission: DispatchMission, code: string, runner: LuaRunner): Promise<DispatchResult> {
  const frames: DispatchFrame[] = [initialFrame(mission)];
  const fail = (feedback: string): DispatchResult => ({pass: false, frames, feedback});
  const prefix = 'dispatch-' + crypto.randomUUID() + '/';
  const mock = `
local emit = print
local commands = 0
local function record(action)
  commands = commands + 1
  if commands > ${maxCommands} then
    error("This route allows ${maxCommands} actions. Shorten the loop or route.", 3)
  end
  emit("${prefix}" .. action)
end
function drive(direction)
  if direction ~= "north" and direction ~= "east" and direction ~= "south" and direction ~= "west" then
    error('Choose "north", "east", "south" or "west" for drive().', 2)
  end
  record(direction)
end
function pickup()
  record("pickup")
end`;
  const result = await runner(code, {mock});
  for (const line of result.output) {
    if (!line.startsWith(prefix)) continue;
    const command = line.slice(prefix.length);
    const current = frames[frames.length - 1];
    if (frames.length > maxCommands) return fail(`This route allows ${maxCommands} actions. Shorten the loop or route.`);
    if (command === 'pickup') {
      const stop = mission.stops.findIndex(place => sameSquare(place, current));
      if (stop < 0) return fail('Nobody is waiting on this square. Move onto a marked stop before calling pickup().');
      if (current.collected.includes(stop)) return fail(`The riders from ${mission.stops[stop].name} are already aboard. Continue the route.`);
      frames.push({...current, action: 'pickup', collected: [...current.collected, stop], note: `Riders aboard at ${mission.stops[stop].name}.`});
      continue;
    }
    if (!Object.hasOwn(movement, command)) return fail('Unknown direction. Choose north, east, south or west.');
    const facing = command as Direction;
    const x = current.x + movement[facing].x;
    const y = current.y + movement[facing].y;
    const tile = mission.streets[y]?.[x];
    if (tile === undefined) return fail(`Driving ${facing} here leaves the map. Turn at the edge of the street.`);
    if (tile !== '.') return fail(`A city block is in the way to the ${facing}. Follow the street to the next intersection.`);
    frames.push({x, y, facing, action: 'drive', collected: current.collected, note: `Drove one square ${facing}.`});
  }
  if (!result.ok) return fail(result.error ?? 'Lua stopped before the route finished. Check your script and try again.');
  if (result.output.includes('[Output limit reached]')) return fail('The radio log filled up. Use fewer print calls so dispatch can hear the whole route.');
  const last = frames[frames.length - 1];
  const missingStop = mission.stops.find((_, index) => !last.collected.includes(index));
  if (missingStop) return fail(`There are still riders waiting at ${missingStop.name}. Drive onto the stop and call pickup().`);
  if (!sameSquare(last, mission.terminus)) return fail(`Everyone is aboard. Finish the route at ${mission.terminus.name}.`);
  return {pass: true, frames, feedback: `All riders made it to ${mission.terminus.name}.`};
}
