export interface ArcadePuzzle {
  id: string;
  title: string;
  code: string;
  output: string;
  alternatives: [string, string];
  explanation: string;
}

// Each session starts with a single expression, then moves on to data and control flow.
export const puzzlePools: ArcadePuzzle[][] = [
  [
    {id:'fare', title:'Split the fare', code:'local riders = 3\nlocal fare = 8\nprint(riders * fare)', output:'24', alternatives:['11','38'], explanation:'The * operator multiplies the number of riders by the fare. Three fares at 8 each total 24.'},
    {id:'callsign', title:'Radio check', code:"local unit = 'Echo'\nprint(unit .. '-7')", output:'Echo-7', alternatives:['Echo -7','unit-7'], explanation:'The two dots join the value of unit and the text -7. Lua inserts no space between them.'},
    {id:'garage', title:'Garage capacity', code:'local parked = 6\nlocal spaces = 6\nprint(parked < spaces)', output:'false', alternatives:['true','6'], explanation:'The < operator checks for strictly fewer parked cars than spaces. Both numbers are 6, so the comparison gives false.'},
    {id:'fuel', title:'Fuel stop', code:'local fuel = 14\nfuel = fuel - 5\nprint(fuel)', output:'9', alternatives:['14','19'], explanation:'The assignment replaces 14 with the result of 14 minus 5. The later print reads the updated value.'},
  ],
  [
    {id:'route', title:'Pick a route', code:"local stops = {'Pier', 'Market', 'Docks'}\nprint(stops[2])", output:'Market', alternatives:['Pier','Docks'], explanation:'Lua assigns sequential list entries the keys 1, 2 and 3. The second entry is Market.'},
    {id:'delivery', title:'Delivery manifest', code:"local loads = {'mail', 'food'}\ntable.insert(loads, 'tools')\nprint(#loads)", output:'3', alternatives:['2','tools'], explanation:'table.insert adds tools after food. The # operator gives the length of this list, which now has three entries.'},
    {id:'rank', title:'Dispatch desk', code:"local driver = {name = 'Rae', rank = 2}\ndriver.rank = driver.rank + 1\nprint(driver.rank)", output:'3', alternatives:['2','Rae'], explanation:'The field starts at 2. Adding 1 and assigning the result back to driver.rank raises it to 3.'},
    {id:'crew', title:'Crew shuttle', code:'local seats = 11\nlocal crewSize = 4\nprint(seats // crewSize)', output:'2', alternatives:['2.75','3'], explanation:'Integer division rounds 11 divided by 4 down to 2. Eleven seats can take two whole crews of four.'},
  ],
  [
    {id:'checkpoints', title:'Checkpoint bonus', code:'local score = 0\nfor gate = 1, 3 do\n  score = score + gate\nend\nprint(score)', output:'6', alternatives:['3','4'], explanation:'The loop adds 1 at the first gate, 2 at the second and 3 at the third. The final score is 6.'},
    {id:'signal', title:'Traffic signal', code:"local light = 'red'\nif light == 'green' then\n  print('go')\nelse\n  print('wait')\nend", output:'wait', alternatives:['go','red'], explanation:'A red light fails the comparison with green. Lua runs the else branch, which prints wait.'},
    {id:'payout', title:'Courier payout', code:'local function payout(boxes)\n  return 4 + 2 * boxes\nend\nprint(payout(3))', output:'10', alternatives:['18','6'], explanation:'With three boxes, the multiplication gives 6. The base payout of 4 brings the total to 10.'},
    {id:'rounds', title:'Last lap', code:'local lap = 1\nwhile lap < 4 do\n  lap = lap + 1\nend\nprint(lap)', output:'4', alternatives:['3','5'], explanation:'The loop increments lap while it is below 4. Once lap reaches 4 the condition is false, and print sees 4.'},
  ],
];

export interface ArcadeRound extends ArcadePuzzle { choices: string[] }

export function dealArcade(previous: ArcadeRound[] = []): ArcadeRound[] {
  const used = new Set(previous.map(round => round.id));
  return puzzlePools.map(pool => {
    const available = pool.filter(puzzle => !used.has(puzzle.id));
    const puzzle = available[Math.floor(Math.random() * available.length)];
    const choices = [puzzle.output, ...puzzle.alternatives];
    for (let i = choices.length - 1; i > 0; i--) {
      const swap = Math.floor(Math.random() * (i + 1));
      [choices[i], choices[swap]] = [choices[swap], choices[i]];
    }
    return {...puzzle, choices};
  });
}
