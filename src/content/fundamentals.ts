import type { Lesson } from '../types';
import { lesson, lua, quiz } from './helpers';

export const fundamentals: Lesson[] = [
lesson({
 id:'lua-first-program', module:1, title:'Your first instruction', minutes:10, level:'Beginner',
 concept:'Programming means describing a task as precise instructions. A script is a text file containing those instructions. Lua is the language FiveM can read. When you run a script, Lua follows its instructions in order. You do not need a game server yet: the academy can run ordinary Lua 5.4 in an isolated practice environment.',
 why:'Before building a garage or job system, learn how to make one small action happen and observe its result. Printing a message is also a useful first debugging tool.',
 example:'print("Practice begins")\nprint("One instruction at a time")',
 explanation:['Line 1 calls print, a built-in function that writes text to the output. A function is a named action; the parentheses tell Lua to perform it.','The quoted text is a string: data made of characters. Quotes mark its boundaries and are not printed.','Line 2 runs after line 1. A line break separates these two instructions.'],
 exercise:lua('Write a program that prints Hello, FiveM! on its own line. Keep the spelling and punctuation shown; choose either single or double quotes.','-- Write your first print instruction below.\n','print("Hello, FiveM!")',[['Greeting appears','assert(_OUTPUT[1] == "Hello, FiveM!", "Print Hello, FiveM! as the first line.")'],['One deliberate instruction','assert(#_OUTPUT == 1, "Print exactly one line for this exercise.")']],['A function call uses a name followed by parentheses.','Put the greeting inside quotation marks, inside the parentheses.','Use this shape: print("your message"). Replace only the message.']),
 challenge:'Without copying your exercise, write two print instructions: one introducing yourself and one naming a resource you want to build. Predict the output before running it.',
 quiz:quiz('What does print("Ready") do?',['Creates a file named Ready','Writes Ready to the output','Starts a FiveM server'],1,'print displays its argument. It does not create a resource or start a game.'),
 review:['A program is a sequence of precise instructions.','Strings use quotes; function calls use parentheses.','Run small changes and compare actual output with your prediction.'], sources:['lua-manual','lua-runtime'], technical:'The academy executes standard Lua 5.4. CfxLua adds game-specific functions and data types, which are not part of this first exercise.'
}),
lesson({
 id:'lua-syntax-comments', module:1, title:'Syntax, comments, and readable code', minutes:10, level:'Beginner',
 concept:'Syntax is a language’s grammar. Lua distinguishes punctuation, names, and quoted values. A missing closing quote or parenthesis prevents a program from being understood. A comment begins with two hyphens and continues to the end of the line. Lua ignores comments; people use them to explain intent.',
 why:'Resource errors often begin as a tiny punctuation mistake. Reading the line number and checking matching symbols is more productive than randomly changing code.',
 example:'-- Explain why, not just what.\nprint("Workshop open") -- this part is a comment',
 explanation:['The first line is a comment; it produces no output.','The second line calls print and then contains a comment. Text inside quotes is still data, even if it contains hyphens.','Lua names are case-sensitive: print and Print are different names. Indentation makes code easier to read but does not replace punctuation.'],
 exercise:lua('Repair the greeting so the program prints Workshop ready. Add a comment explaining that the message confirms startup.','-- Repair the punctuation below.\nprint("Workshop ready"\n','-- Confirm that the workshop script started.\nprint("Workshop ready")',[['Program parses and prints','assert(_OUTPUT[1] == "Workshop ready", "Keep the message and repair the closing punctuation.")'],['No accidental output','assert(#_OUTPUT == 1, "Comments should not be printed as separate messages.")']],['A function call must close both its string and its parentheses.','Look at the right edge of the print instruction.','Count opening and closing symbols: print( "text" ).']),
 challenge:'Write a print statement containing the text -- is inside a string. Explain why those hyphens do not start a comment.',
 quiz:quiz('Which text is ignored by Lua?',['Text after -- outside a string','Everything inside quotation marks','A correctly named variable'],0,'A line comment starts with -- outside a quoted string.'),
 review:['Check punctuation before changing the logic.','Use comments to record intent and assumptions.','Names are case-sensitive.'],sources:['lua-manual']
}),
lesson({
 id:'lua-variables', module:1, title:'Remembering values with variables', minutes:12, level:'Beginner',
 concept:'A variable gives a value a name. local creates a name in the current area of code. The equals sign assigns the value on its right to the name on its left; it is an instruction, not a mathematical equality claim. Later assignments replace the stored value.',
 why:'A game script needs names for a player’s score, a vehicle model, or a cooldown. Descriptive names help you explain what the program is doing.',
 example:'local deliveries = 2\ndeliveries = deliveries + 1\nprint(deliveries)',
 explanation:['Line 1 creates a local variable and stores 2.','Line 2 reads the old value, adds 1, then stores the result back.','Line 3 passes the stored number to print; it prints 3, not the word deliveries.'],
 exercise:lua('Create local score with value 10. Increase it by 5 using the existing value, then print score.','local score = 10\n-- Increase score, then print it.\n','local score = 10\nscore = score + 5\nprint(score)',[['Value updated','assert(score == 15, "score should hold 15 after the update.")'],['Value is displayed','assert(_OUTPUT[1] == "15", "Print the variable, not its name in quotes.")']],['Assignment replaces a variable’s value.','Use score on both sides of the assignment to read then update it.','Think: score becomes old score plus five.']),
 challenge:'Create fuel with value 50, subtract 8, then add 12. Predict the final value and print it.',
 quiz:quiz('What does score = score + 5 mean?',['Compare two expressions','Read score, add five, store the result in score','Create five new variables'],1,'Lua evaluates the right-hand expression before assigning the result.'),
 review:['Use local for names that should stay in their own area.','Assignment is different from comparison.','Prefer names that describe the value.'], sources:['lua-manual']
}),
lesson({
 id:'lua-types', module:1, title:'Numbers, text, booleans, and nil', minutes:14, level:'Beginner',
 concept:'Values have types. A number supports arithmetic; a string stores text. A boolean is true or false. nil represents an absent value, such as a player that was not found. The type function tells you a value’s type. Lua does not make 0 or an empty string false: only false and nil are false in conditions.',
 why:'Many script bugs come from confusing a numeric ID with text, or using a player record after lookup returned nil. Knowing the type lets you choose a valid operation.',
 example:'local name = "Maya"\nlocal level = 3\nlocal onDuty = false\nlocal vehicle = nil\nprint(type(level))',
 explanation:['name contains a string; level contains a number.','onDuty is a boolean because false has no quotes. "false" would be text.','vehicle is nil, which means no useful value is stored.','type(level) returns the string "number", which print displays.'],
 exercise:lua('Set playerName to the string Alex, lives to the number 3, onDuty to true, and assignedVehicle to nil.','local playerName = 7\nlocal lives = "3"\nlocal onDuty = "true"\nlocal assignedVehicle = "nil"','local playerName = "Alex"\nlocal lives = 3\nlocal onDuty = true\nlocal assignedVehicle = nil',[['Text and number','assert(playerName == "Alex" and type(lives) == "number" and lives == 3, "Use text for the name and a number for lives.")'],['Boolean and absence','assert(onDuty == true and assignedVehicle == nil, "true and nil are keywords without quotes.")']],['Quotation marks turn characters into a string.','Remove quotes from values that should be a number, boolean, or nil.','Use local name = "text", local flag = true, and local missing = nil.']),
 challenge:'Print type(false), type("false"), and type(nil). Explain why all three answers differ.',
 quiz:quiz('Which value is false in a Lua condition?',['0','An empty string','nil'],2,'Only false and nil make a Lua condition false; 0 and "" are truthy.'),
 review:['Types belong to values.','Quoted digits are strings.','Check for nil before using a missing record.'],sources:['lua-manual']
}),
lesson({
 id:'lua-strings', module:1, title:'Building useful messages', minutes:12, level:'Beginner',
 concept:'Concatenation joins strings. Lua uses two dots, .., for this operation. Spaces are characters too: if a message needs a space, put one inside a string. tostring converts a value into text deliberately, which makes messages easier to reason about.',
 why:'Commands and debug logs should explain who did something and which value the code used. Building messages from variables avoids hardcoded names.',
 example:'local driver = "Jules"\nlocal message = "Welcome, " .. driver .. "!"\nprint(message)',
 explanation:['The variable stores the changing part of the message.','The second line joins three pieces; the comma and space belong to the first string.','print receives one assembled string. The .. operator is different from arithmetic +.'],
 exercise:lua('Using the supplied name and level variables, create message with the exact value Alex reached level 4. Print message.','local name = "Alex"\nlocal level = 4\nlocal message = ""\n','local name = "Alex"\nlocal level = 4\nlocal message = name .. " reached level " .. tostring(level)\nprint(message)',[['Assembled text','assert(message == "Alex reached level 4", "Join the name, words, and level with spaces.")'],['Message printed','assert(_OUTPUT[1] == message, "Print the assembled message.")']],['Use .. between string pieces.','Keep the spaces inside " reached level ".','message = name .. words .. tostring(level)']),
 challenge:'Write a reusable status message containing a vehicle name and remaining fuel. Change the variables and verify the message changes.',
 quiz:quiz('Which operator joins Lua strings?',['+','..','=='],1,'Two dots concatenate values into text; == compares values.'),
 review:['Use .. for concatenation.','Spaces must be included intentionally.','A message built from variables adapts to new values.'],sources:['lua-manual']
}),
lesson({
 id:'lua-arithmetic', module:1, title:'Calculations and operators', minutes:12, level:'Beginner',
 concept:'An expression calculates a value. Lua provides +, -, *, /, //, and %. The single slash divides, double slash performs floor division, and % finds the remainder. Multiplication happens before addition unless parentheses change the order.',
 why:'Prices, distances, fuel use and cooldowns all involve calculations. Separating inputs from the calculation makes it possible to test other cases.',
 example:'local price = 12\nlocal quantity = 3\nlocal subtotal = price * quantity\nlocal final = subtotal + 5\nprint(final)',
 explanation:['price and quantity are inputs.','Multiplication computes the subtotal as 36.','The fee is added after the subtotal, yielding 41.','Keep calculations numeric until building a display message.'],
 exercise:lua('Calculate total for 4 items at 25 each with a fixed fee of 10. Also compute remaining from a budget of 150.','local price = 25\nlocal quantity = 4\nlocal fee = 10\nlocal budget = 150\nlocal total = 0\nlocal remaining = 0','local price = 25\nlocal quantity = 4\nlocal fee = 10\nlocal budget = 150\nlocal total = price * quantity + fee\nlocal remaining = budget - total',[['Correct total','assert(total == 110, "Multiply quantity by price before adding the fixed fee.")'],['Budget balance','assert(remaining == 40, "Subtract the total from the budget.")']],['Write the relationship in words before writing operators.','The fee is charged once, not once per item.','total = price times quantity plus fee; remaining = budget minus total.']),
 challenge:'For 17 reward tokens distributed evenly to 5 players, calculate tokens per player with // and leftover tokens with %.',
 quiz:quiz('What does 2 + 3 * 4 produce?',['20','14','24'],1,'Multiplication has higher precedence. Parentheses would be needed for (2 + 3) * 4.'),
 review:['Expressions produce values.','Parentheses make intended order explicit.','Keep amounts numeric while calculating.'],sources:['lua-manual']
}),
lesson({
 id:'lua-comparisons', module:1, title:'Asking yes-or-no questions', minutes:13, level:'Beginner',
 concept:'Comparisons produce booleans. == checks equality; ~= checks inequality; <, >, <= and >= compare order. and requires both conditions, or accepts either, and not reverses truth. Lua’s and/or return operands, so begin with explicit boolean comparisons when designing rules.',
 why:'A garage might require a nearby player AND ownership. Confusing and with or can turn a permission check into an unintended bypass.',
 example:'local distance = 2\nlocal ownsVehicle = true\nlocal canOpen = distance <= 3 and ownsVehicle\nprint(canOpen)',
 explanation:['distance <= 3 evaluates to true.','and combines the distance condition with ownership.','Both are true, so canOpen becomes true. This local calculation alone does not authorize a server operation.'],
 exercise:lua('Compute canPurchase using balance >= price AND inShop. Compute needsHelp using health < 20 OR stranded.','local balance, price = 80, 60\nlocal inShop = false\nlocal health, stranded = 15, false\nlocal canPurchase = true\nlocal needsHelp = false','local balance, price = 80, 60\nlocal inShop = false\nlocal health, stranded = 15, false\nlocal canPurchase = balance >= price and inShop\nlocal needsHelp = health < 20 or stranded',[['Both purchase conditions matter','assert(canPurchase == false, "Enough money alone is not enough when inShop is false.")'],['Either help condition matters','assert(needsHelp == true, "Low health should request help even when not stranded.")']],['and asks for both conditions; or asks for at least one.','The player has money but is outside the shop.','canPurchase = affordability and location; needsHelp = lowHealth or stranded.']),
 challenge:'Build a canDrive condition requiring a license, fuel above zero, and a vehicle that is not locked. Test one failed condition at a time.',
 quiz:quiz('Which checks whether two values are equal?',['=','==','~='],1,'= assigns; == compares equality; ~= compares inequality.'),
 review:['Comparisons produce true or false.','Use and when every requirement must hold.','Test denied cases as well as allowed cases.'],sources:['lua-manual','security']
}),
lesson({
 id:'lua-conditions', module:1, title:'Choosing a path with if', minutes:15, level:'Beginner',
 concept:'An if statement runs a block only when its condition is truthy. elseif adds another condition, and else handles remaining cases. end closes the entire decision. Lua evaluates branches from top to bottom and runs only the first matching branch.',
 why:'A gameplay system must respond differently to low fuel, empty fuel, and normal fuel. The order of conditions changes which message the player receives.',
 example:'local fuel = 0\nif fuel == 0 then\n  print("Empty")\nelseif fuel < 20 then\n  print("Low")\nelse\n  print("Ready")\nend',
 explanation:['The exact zero case is checked before the wider less-than-20 case.','then begins the chosen block. elseif only runs its test when earlier tests were false.','else needs no condition. end closes the decision, not each individual branch.'],
 exercise:lua('Set status to empty when fuel == 0, low when fuel < 20, otherwise ready. Use the provided fuel value.','local fuel = 12\nlocal status\n-- Choose a status with if / elseif / else.','local fuel = 12\nlocal status\nif fuel == 0 then\n  status = "empty"\nelseif fuel < 20 then\n  status = "low"\nelse\n  status = "ready"\nend',[['Low fuel classified','assert(status == "low", "12 is above zero and below 20; status should be low.")'],['Result is text','assert(type(status) == "string", "Assign one of the requested text labels.")']],['List the most specific condition first.','Check zero before checking less than 20.','if zero then empty; elseif below twenty then low; else ready; end.']),
 challenge:'Run your code three times with fuel 0, 19, and 20. Explain why 20 belongs to ready. Then wrap the decision in a function after the functions lesson.',
 quiz:quiz('If two branches would be true, which runs?',['Both','The last branch','The first matching branch'],2,'An if/elseif chain selects the first true condition and skips the remaining branches.'),
 review:['Order overlapping conditions carefully.','then begins a branch and end closes the decision.','Boundary values reveal mistakes.'],sources:['lua-manual']
}),
lesson({
 id:'lua-for-loops', module:1, title:'Repeating a known number of times', minutes:14, level:'Beginner',
 concept:'A numeric for loop repeats a block using a changing counter. for i = 1, 3 do visits 1, 2, and 3. The final value is included when reached. An accumulator stores a running total; initialize it before the loop, then update it inside.',
 why:'You may need to create several checkpoints or total a series of rewards. A loop makes repeated work explicit without copying the same instruction many times.',
 example:'local total = 0\nfor i = 1, 3 do\n  total = total + i\nend\nprint(total)',
 explanation:['The accumulator begins at zero.','The loop variable i takes the values 1, 2, and 3.','Each pass adds the current i, producing totals 1, 3, then 6.','The final print runs once after the loop ends.'],
 exercise:lua('Use a for loop to add the integers from 1 through 5 into total. Then print total.','local total = 0\n-- Add each integer from 1 to 5.\n','local total = 0\nfor i = 1, 5 do\n  total = total + i\nend\nprint(total)',[['Accumulation','assert(total == 15, "1 + 2 + 3 + 4 + 5 is 15. Keep the accumulator outside the loop.")'],['Final output','assert(_OUTPUT[1] == "15" and #_OUTPUT == 1, "Print once after the loop finishes.")']],['A loop counter can be used in arithmetic.','Do not reset total to zero inside the repeated block.','For each i from one through five: add i to total.']),
 challenge:'Print a countdown from 5 to 1 using a third numeric-for value of -1. Explain what changing the step does.',
 quiz:quiz('How many passes does for i = 1, 3 do make?',['2','3','4'],1,'The loop includes both 1 and 3 with the default step of 1.'),
 review:['Use numeric for when the count is known.','Initialize accumulators before the loop.','A loop’s end is different from the program’s end.'],sources:['lua-manual']
}),
lesson({
 id:'lua-while-loops', module:1, title:'Repeating until a condition changes', minutes:14, level:'Beginner',
 concept:'A while loop checks a condition before each pass. The body must make progress toward stopping, or deliberately yield in an ongoing FiveM task. A loop that never stops can freeze its runtime. The academy limits execution, but a game resource needs its own careful scheduling.',
 why:'Loading a game model involves repeatedly checking whether it is ready. Understanding termination now prevents endless loops later.',
 example:'local remaining = 3\nwhile remaining > 0 do\n  print(remaining)\n  remaining = remaining - 1\nend',
 explanation:['The condition is tested before entering the body, so zero starts with no passes.','The body prints the current value.','Subtracting one changes the condition eventually. When remaining becomes zero, the loop stops.'],
 exercise:lua('Starting with charge = 0, add 10 per loop until charge reaches 50. Count the passes in steps.','local charge = 0\nlocal steps = 0\n-- Use a while loop that makes progress.','local charge = 0\nlocal steps = 0\nwhile charge < 50 do\n  charge = charge + 10\n  steps = steps + 1\nend',[['Target reached','assert(charge == 50, "Increase charge by 10 until it reaches 50.")'],['Correct number of passes','assert(steps == 5, "Count one step on each pass.")']],['Choose a condition that becomes false at your target.','Update charge and steps inside the loop.','While charge is below 50: add 10 charge and add 1 step.']),
 challenge:'Explain what happens if the charge update is removed. Then write a loop that stops after at most three attempts even if a success flag stays false.',
 quiz:quiz('What usually makes this kind of loop terminate?',['Indentation','A value used in its condition changes','Adding more comments'],1,'The condition must eventually become false, or a deliberate break must exit the loop.'),
 review:['while tests before each pass.','Ensure the loop progresses or has an exit.','FiveM’s continuous loops also need Wait.'],sources:['lua-manual','wait']
}),
lesson({
 id:'lua-functions', module:1, title:'Naming a reusable action', minutes:14, level:'Beginner',
 concept:'A function groups instructions under a name. Defining a function describes what it will do; calling it makes it run. Functions reduce repeated code and give a larger script readable building blocks. A local function stays within its intended scope.',
 why:'The same notification or cleanup action may be needed from a command, an event, and a resource-stop handler. One function keeps those paths consistent.',
 example:'local function announce()\n  print("Workshop open")\nend\nannounce()\nannounce()',
 explanation:['local function announces a function definition, not its execution.','The indented print is the function body. end finishes the definition.','Each announce() call executes the body once; this example prints twice.'],
 exercise:lua('Define local function greet that prints Welcome back. Call it exactly twice.','-- Define greet, then call it twice.\n','local function greet()\n  print("Welcome back")\nend\ngreet()\ngreet()',[['Reusable action exists','assert(type(greet) == "function", "Create a function named greet.")'],['Two calls','assert(#_OUTPUT == 2 and _OUTPUT[1] == "Welcome back" and _OUTPUT[2] == "Welcome back", "Call greet twice after defining it.")']],['Definition and call are separate steps.','Put the print inside a local function block.','local function greet() ... end, followed by two greet() calls.']),
 challenge:'Create a function called showHelp that prints three command descriptions. Call it once. Explain why defining it alone prints nothing.',
 quiz:quiz('When does a defined function’s body run?',['When it is called','Whenever Lua sees its name in a comment','Only when the file is saved'],0,'A function definition creates a callable value; a call performs its instructions.'),
 review:['Group related steps into small named functions.','Definition is different from invocation.','One reusable function is easier to fix than several copied blocks.'],sources:['lua-manual']
}),
lesson({
 id:'lua-parameters-return', module:1, title:'Inputs and results', minutes:17, level:'Beginner',
 concept:'A parameter is a name a function uses for an incoming value. An argument is the actual value supplied in a call. return sends a result back to the caller and stops that function. Printing a number and returning it are different: a caller can calculate with a returned value.',
 why:'A fee calculator should work for many prices, not only one hardcoded example. Small functions with explicit inputs and results are easy to test without a game server.',
 example:'local function double(value)\n  return value * 2\nend\nlocal reward = double(7)\nprint(reward)',
 explanation:['value is the parameter in the definition.','7 is the argument in the call.','return gives 14 back, and the assignment stores it in reward.','The function itself need not print anything.'],
 exercise:lua('Write local function totalCost(price, quantity) that returns their product. It must work for different inputs, including zero quantity.','local function totalCost(price, quantity)\n  -- Return the calculated result.\nend','local function totalCost(price, quantity)\n  return price * quantity\nend',[['Ordinary purchase','assert(totalCost(25, 4) == 100, "Return price multiplied by quantity.")'],['General behavior','assert(totalCost(7, 3) == 21 and totalCost(5, 0) == 0, "Use parameters rather than a fixed answer.")']],['A return value can be stored by the caller.','The multiplication belongs after return.','Return price times quantity; do not just print the answer.']),
 challenge:'Write discountedPrice(price, discount) that returns price minus discount, but never below zero. Test a discount greater than the price.',
 quiz:quiz('In double(7), what is 7?',['A parameter name','An argument value','A function definition'],1,'The definition names parameters; calls supply argument values.'),
 review:['Parameters name inputs; arguments supply values.','return produces a reusable result.','Test more than one input to detect hardcoding.'],sources:['lua-manual']
}),
lesson({
 id:'lua-scope', module:1, title:'Local scope and accidental globals', minutes:15, level:'Beginner',
 concept:'Scope determines where a name is visible. A local declared inside a function belongs to that function’s block. A local with the same name as an outer one shadows it temporarily. Assigning an undeclared name creates or changes a global in the environment, which can cause distant code to interfere.',
 why:'Large resources become difficult to debug when every function changes the same global variables. Keep temporary values local and pass important inputs explicitly.',
 example:'local balance = 100\nlocal function preview()\n  local balance = 20\n  return balance\nend\nprint(preview())\nprint(balance)',
 explanation:['The outer balance stores 100.','The inner local balance is a different name visible inside preview.','preview returns 20 while the outer balance remains 100.','Without local on the inner assignment, the visible outer balance would be changed.'],
 exercise:lua('Repair preview so it returns 20 without changing the outer balance of 100.','local balance = 100\nlocal function preview()\n  balance = 20\n  return balance\nend\nlocal result = preview()','local balance = 100\nlocal function preview()\n  local balance = 20\n  return balance\nend\nlocal result = preview()',[['Preview result','assert(result == 20, "The preview should still return 20.")'],['Outer state preserved','assert(balance == 100, "Use a local inner value so preview does not mutate the outer balance.")']],['A local declaration creates a name for the current block.','Look at the assignment inside preview.','Add local before the inner balance assignment.']),
 challenge:'Rewrite preview to accept an amount as a parameter instead of shadowing balance. Explain why that makes the function’s input clearer.',
 quiz:quiz('What is a good default for a temporary variable?',['A global shared by every function','A local in the narrowest useful scope','A name reused for unrelated things'],1,'Narrow scope reduces accidental interference and clarifies ownership.'),
 review:['Scope controls visibility.','Shadowing creates a different local name.','Prefer explicit inputs to hidden global dependencies.'],sources:['lua-manual']
}),
lesson({
 id:'lua-tables-records', module:1, title:'Tables as named records', minutes:16, level:'Beginner',
 concept:'A table groups related values using keys. A record-style table uses names such as model and fuel. record.fuel is shorthand for record["fuel"]. Reading an absent key returns nil. Tables are referenced values: assigning a table to another variable does not make a separate deep copy.',
 why:'Configuration, player information, vehicles and event payloads are often tables. You need to know which keys exist and whether modifying a table changes a shared object.',
 example:'local vehicle = { model = "blista", fuel = 60 }\nvehicle.fuel = vehicle.fuel - 5\nprint(vehicle.model, vehicle.fuel)',
 explanation:['Braces create a table. Named fields associate string keys with values.','Dot notation reads and writes a field.','The table can hold different value types; model is text and fuel is a number.'],
 exercise:lua('Create a vehicle record with model = blista and fuel = 75. Add a locked field set to true, then reduce fuel by 10.','local vehicle = {}\n-- Populate and update the record.','local vehicle = { model = "blista", fuel = 75 }\nvehicle.locked = true\nvehicle.fuel = vehicle.fuel - 10',[['Record fields','assert(vehicle.model == "blista" and vehicle.locked == true, "Use named model and locked fields.")'],['Updated number','assert(vehicle.fuel == 65, "Start with 75 and subtract 10 from the fuel field.")']],['A table can be populated in braces or through later assignments.','Use vehicle.fuel for the numeric update.','Create model and fuel fields; set locked; subtract ten from fuel.']),
 challenge:'Set another = vehicle, change another.fuel, then inspect vehicle.fuel. Explain the result and why a backup needs an actual copy.',
 quiz:quiz('What does a missing table key return?',['0','An empty string','nil'],2,'A missing key has no associated value, so Lua returns nil.'),
 review:['Tables associate keys with values.','Dot syntax addresses named fields.','Two variables can refer to the same table.'],sources:['lua-manual']
}),
lesson({
 id:'lua-arrays', module:1, title:'Lists, ipairs, and totals', minutes:17, level:'Beginner',
 concept:'A Lua list is a table using consecutive numeric keys, usually starting at 1. ipairs visits this sequence until the first absent element; pairs visits table keys without promising an order. The length operator # is useful for a sequence without holes, but is not a count of every arbitrary table key.',
 why:'You will loop over configured spawn points, item lists, or checkpoints. Choosing a list or a named record makes the intended access pattern clear.',
 example:'local rewards = { 5, 8, 2 }\nlocal total = 0\nfor index, amount in ipairs(rewards) do\n  total = total + amount\nend\nprint(total)',
 explanation:['The first element is rewards[1], not rewards[0].','ipairs provides both the numeric index and its value.','The accumulator adds each amount once.','A named record such as { fuel = 10 } is not a sequence for ipairs.'],
 exercise:lua('Implement sum(values), which adds every number in a consecutive list. Return 0 for an empty list.','local function sum(values)\n  local total = 0\n  -- Visit every amount, then return total.\nend','local function sum(values)\n  local total = 0\n  for _, amount in ipairs(values) do\n    total = total + amount\n  end\n  return total\nend',[['List total','assert(sum({5, 8, 2}) == 15 and sum({2, 2}) == 4, "Add each value with ipairs.")'],['Empty list','assert(sum({}) == 0, "An empty list should keep the initial total of zero.")']],['Use a loop that reads values, not only positions.','The return belongs after the loop.','For each amount in ipairs(values), add it to total; then return total.']),
 challenge:'Create a list of three vehicle records and count how many have fuel below 20. Avoid assuming the list always has three entries.',
 quiz:quiz('Which iteration is designed for a consecutive list?',['ipairs','pairs in guaranteed sorted order','A loop beginning at index 0 by default'],0,'ipairs walks the conventional 1-based sequence. pairs does not guarantee ordering.'),
 review:['Lua lists conventionally start at 1.','Use ipairs for a sequence and pairs for arbitrary keys.','Handle empty inputs deliberately.'],sources:['lua-manual']
}),
lesson({
 id:'lua-debugging', module:1, title:'Debugging without guessing', minutes:20, level:'Beginner',
 concept:'A syntax error means Lua cannot parse the program. A runtime error happens while valid syntax runs. A logic error runs without crashing but produces the wrong result. Reproduce the smallest failing case, read the first useful error, inspect values and types, change one cause, then rerun your checks.',
 why:'Copying more code rarely explains why a resource failed. A disciplined debugging loop turns console messages into evidence instead of frustration.',
 example:'local function affordable(balance, cost)\n  return balance >= cost\nend\nprint(affordable(20, 20))\nprint(affordable(19, 20))',
 explanation:['The function states a rule with explicit inputs.','The exact-price test verifies the boundary: equality must be allowed.','The below-price test verifies denial. A happy-path test alone would miss many bugs.'],
 exercise:lua('Fix canAfford(balance, price). It must return true when balance is enough, including equal amounts, and false when balance is too low.','local function canAfford(balance, price)\n  return balance > price\nend','local function canAfford(balance, price)\n  return balance >= price\nend',[['Enough and not enough','assert(canAfford(100, 30) == true and canAfford(20, 30) == false, "Compare balance against price.")'],['Boundary regression','assert(canAfford(30, 30) == true and canAfford(0, 0) == true, "Exact amounts are affordable: include equality.")']],['The current code works for some inputs; locate the failing boundary.','Compare the meaning of > with >=.','Enough means greater than OR equal to the price.']),
 challenge:'Write a short bug report: input, expected result, actual result, cause, fix, and regression test. Then add negative-price rejection as a new requirement rather than silently changing the original rule.',
 quiz:quiz('A program runs but rejects an exact-price purchase. What kind of error is this?',['Syntax error','Logic error','A missing game model'],1,'The code parses and executes, but the condition expresses the wrong rule.'),
 review:['Distinguish syntax, runtime, and logic failures.','Use small reproducible cases.','Keep a regression test for each fixed bug.'],sources:['lua-manual','profiler'],technical:'Assertions document executable expectations. Tests can disprove incorrect behavior but passing a finite set does not prove every possible input is safe.'
})
];
