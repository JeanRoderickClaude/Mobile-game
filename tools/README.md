# Balance tools

Scripts that measure how hard a level is. Each one starts its own Vite dev server, opens the game in headless Chromium, loads the level you name and drives the real game code. Officers, crowds, detection and collision are the same code the player runs, stepped in fixed 16 ms frames, so results repeat exactly from run to run.

## Setup

Run `npm install` in the repository root. It installs Playwright 1.63.0. On a new machine, download its browser once:

```
npx playwright install chromium
```

To use a Chromium that is already installed elsewhere, set `CHROMIUM_PATH` to its executable. No dev server needs to be running; each script starts and stops its own. The game opens on the main menu; the scripts start the level scene directly.

## Running

Run every script from the repository root and pass a level file. The file must be in `src/levels/`, because the game only loads levels from there.

```
node tools/ride.mjs src/levels/level-01.json
```

Flags go after the level file. A script that runs the whole level many times takes a minute or two.

Every script takes `--difficulty easy` (shown to players as Relaxed) or `--difficulty normal` (default normal). It sets the catch time and cone length the same way the game does, and the first output line says which one ran. Running several scripts at once slows the machine and can shift results by a few ms; run them one at a time for exact numbers.

## ride.mjs: is riding a crowd safe?

Rides every marching group from its spawn to the finish, once per cycle (default 12 cycles, `--cycles N`). Each cycle starts later, so the officers are at different points of their patrols. The simulated player steers toward the group centre and never moves faster than 105 percent of the group's pace, so it stays hidden the whole way.

```
node tools/ride.mjs src/levels/level-01.json --cycles 12
node tools/ride.mjs src/levels/level-01.json --assist --difficulty easy
```

`--assist` replaces the precise steering with a casual thumb: a three-quarter joystick push along the group's heading, nudged toward its centre, leaving the speed to the crowd pace assist. Level 1 gives 23 of 24 on Normal and 24 of 24 on Easy.

Each line is one ride: the crowd's index in the level's `crowds` list, the cycle, when that group spawned, and the outcome (`finished`, `CAUGHT`, or `group vanished` if the group reached its end before the player reached the finish). `peak` is the highest the suspicion meter got, in ms; 500 means caught. `at` is where that peak happened. Next comes the finish time and the payout: coins picked up on the way plus the speed bonus. The finish time includes waiting at the start for that cycle's group, so later cycles earn the minimum bonus. The last part lists, per officer (index in the level's `officers` list), the longest unbroken time that officer saw the player. An officer above about 1500 ms is the one to fix. The summary gives survived rides out of total, the worst peak, and per crowd the coins a finished ride earns. Level 1 gives 24 of 24, worst peak 464 ms, and 60 (crowd 0) or 51 (crowd 1) coins when joining the first group. That figure is a "good run" for pricing shop items.

## blind.mjs: how risky is the same route alone?

Walks each marching group's path with no crowd protection, once at full speed and once at crowd pace, from 23 start times 1.5 s apart (`--every ms`, `--until ms`). It does not dodge or wait.

```
node tools/blind.mjs src/levels/level-01.json
```

Each line gives start times survived out of total. Compare with ride.mjs: if crowds are the safe route, blind runs should mostly fail. Level 1 gives 5 of 23 at full speed on Normal and 23 of 23 on Easy.

## stand.mjs: are the standing groups worth using?

Stands still at the centre of each standing group for 90 s (`--seconds N`), once inside the group and once with crowds switched off.

```
node tools/stand.mjs src/levels/level-01.json
```

Each line shows `survived` or `CAUGHT after N s`, plus the peak suspicion. A useful standing group survives in the group and gets caught alone. If it survives alone too, its crowd adds nothing; move it with spots.mjs.

## spots.mjs: where should standing groups go?

Checks a grid of points (`--grid 30` units) over 90 s of officer movement (`--seconds`). It lists points where standing alone gets caught but standing in a group keeps the meter under 300 ms (`--max-peak`).

```
node tools/spots.mjs src/levels/level-01.json
```

Each line is `x,y` and the peak a hidden player would reach there. Put a standing group's `x, y` on or near one of these points, then confirm with stand.mjs.

## solve.mjs: can a perfect player finish, and with how much slack?

Searches every possible route with full knowledge of where every officer and crowd will be. The player moves on a 10-unit grid in 100 ms steps at 100 to 141 units/s, slower than the real 170, so any route it finds is one a real player could also take.

```
node tools/solve.mjs src/levels/level-01.json
node tools/solve.mjs src/levels/level-01.json --range-mul 1.2 --angle-add 10
node tools/solve.mjs src/levels/level-01.json --crowds --draw route.png
```

The output says whether a route exists and when it reaches the finish, or when every option got caught. `--range-mul` and `--angle-add` make every cone bigger: if a route still exists, the solo route has slack. `--cap ms` sets the catch threshold (default: the difficulty's catch time), so `--cap 1` asks for a route on which the player is never seen at all. `--crowds` lets the search hide in crowds. `--max-sec` limits the search (default 120). `--draw file.png` saves a picture of the whole level with the route in magenta and labels in seconds along it. The search knows the future, so it is much better than a person. Use it to answer "is this possible at all", and use blind.mjs for "is this easy".

The hiding rules are copied from GameScene (1.1 speed margin, 25 units/s floor, 25 percent rate). Update `solve.mjs` if those constants change in `src/config.ts`.

## coins.mjs: where do the coins sit?

For every coin in the level, reports whether riding a marching group picks it up, how much of the time some officer sees the spot (over 60 s, `--seconds`), and how often a solo dash gets caught. The dash runs at full speed from the nearest point on any marching path to the coin and straight back, with no crowd cover, from 40 start times 1.5 s apart (`--every ms`). It knows nothing about timing, like blind.mjs. `--try "x,y;x,y"` adds candidate spots to the report without editing the level.

```
node tools/coins.mjs src/levels/level-01.json
node tools/coins.mjs src/levels/level-01.json --try "60,650;480,1350"
```

Common coins should say `on crowd N's route` (riding picks them up) and get caught on 0 dashes. Valuable coins should be more than the crowd radius (75) from every route, so a rider cannot drift over while hidden, and catch a blind dash in at least 40 percent of start times. Level 1's three valuable coins are caught on 28, 18 and 18 of 40 dashes on Normal, and 5, 4 and 2 on Easy. `(straight dash crosses an obstacle)` means the real route is longer than the measured one.

## coverage.mjs: where are the safe pockets?

Replays 60 s of officer movement (`--seconds N`) and colours the level: green squares were never inside a cone, red ones were, with darker red meaning more of the time.

```
node tools/coverage.mjs src/levels/level-01.json coverage.png
```

Green pockets behind cars and buildings are where a solo player waits. A route with no green near it can only be crossed by timing.

## trumpet.mjs: does the trumpet carry a guarded stretch?

For levels with the trumpet. Starts at a point before the guarded stretch (`--from x,y`, default 270,1330, level 2's square edge) and follows a route of points (`--route "x,y;x,y"`) to the finish, from 20 start times (`--starts N`, `--every ms`). Three ways across:

- alone, full speed, no trumpet: blind, like blind.mjs.
- gather, then move in the linger time: plays standing still until 5 bystanders have gathered (at most 3 s), then walks at a three-quarter push (the crowd pace assist keeps it at the group's pace). It plays again, while walking, only when fewer than 3 are gathered or the linger time is under 0.9 s, and never above 70 percent noise. It does not watch the cones.
- play nonstop while crossing: gathers the same way, then never stops playing.

Each gives survivals, average time and coins of the survivors, how many runs called officers, and `caught at` positions for the failures. Then, for each point in `--spots "x,y;x,y"`, it holds the trumpet standing still until the meter fills (with catching switched off), then waits 30 s, 10 start times each, and reports how long the meter took, in how many runs officers were called and reached the spot, and in how many they were all back on patrol.

```
node tools/trumpet.mjs src/levels/level-02.json --route "360,900;360,650;270,450;270,40"
```

Want: alone rarely survives, gather usually survives, nonstop calls officers nearly every run, and the level's practice spot calls nobody.

## posters.mjs: posters and tags at night

For levels with poster spots. First prints each spot: lit or dark, and how much of 60 s some officer can see it (darkness included, so a dark spot is only "seen" when an officer is within the dark range). Then walks plans from the start, from 20 start times (`--starts`, `--every`): to each stop bottom to top, stands still there until the game counts it done, then goes to the finish. It steps sideways when stuck on a car. It never watches the beams.

- `dark4`: the four darkest spots (unlit first, then least seen), or `--dark "i,j,k,l"`.
- `all`: all six.
- `dark4+tags`: the four darkest plus every tag spot (the van).

```
node tools/posters.mjs src/levels/level-03.json --difficulty easy
node tools/posters.mjs src/levels/level-03.json --light
```

`--light` prints only the spot report. Each plan gives survivals, average time and coins of the survivors, and `caught at` positions.

## chase.mjs: do chases and searches work, and who gets away?

For levels with `"chaseMode": true`, such as the practice level `src/levels/dev/practice-chase.json`. For each of 23 start times (`--starts`, `--every`) the level runs with the officers at a different point of their routes. Pip waits unseen at the start, is placed at the spot (`--spot x,y`, default 245,1140) and spotted: the nearest officer starts chasing and the others join as the level's rules say. Then one of these players takes over, both on a navigation grid like the officers' (with a wider margin for Pip's body):

- `run`: keeps running in the open at full speed, to the far end of the level and back, whatever happens.
- `hide`: hops from cover to cover (behind a building, out of every officer's view, not past an officer who is not already chasing him) until the chasers lose him, then runs to a point on the marching crowd's route that he reaches first, slows to crowd pace on the last stretch, falls in with the crowd and walks on inside it.
- `--hold` adds `hold`: stands still where he was spotted.

The level does not end at the finish. A run ends when Pip is caught (a chasing officer touches him), when every officer is back on patrol with Pip free ("got away"), or after 60 s. The output gives, per player, how many got away, were caught or were still chased, how many runs had a search begin, how long until the chase was over, how many officers chased at once, and for `hide` how often a searching officer came within 80 units of him while he was hidden and how often it noticed him. `caught at` lists where.

`--speed`, `--react`, `--join`, `--alert`, `--ahead`, `--max`, `--spread` and `--search` override the difficulty's `chaseSpeedFactor`, `chaseReactMs`, `chaseJoinMs`, `chaseAlertRadius`, `searchAheadSec`, `searchAheadMax`, `searchSpread` and `searchMs`; `--why` prints each time a searcher took up the chase (distance, whether Pip was hidden) and, for `hide`, the closest searcher in every run for one run, to try values before putting them in `config.ts`.

```
node tools/chase.mjs src/levels/dev/practice-chase.json --hold
node tools/chase.mjs src/levels/dev/practice-chase.json --difficulty easy
node tools/chase.mjs src/levels/dev/practice-chase.json --speed 1.1 --react 600 --join 2000
node tools/chase.mjs src/levels/dev/practice-chase.json --trace hide,5 --shots shots
```

`--trace policy,N` prints a line every 500 ms for one run (start number N): Pip, whether he is hidden, and each officer's state (`C` chasing, `S` searching, `r` walking back, `.` patrol), position and distance. With `--shots dir` it also saves screenshots of that run: the spot, the first search, every 4 s, and when the officers are back on patrol. Pass the file path as for the other tools (levels in `src/levels/dev/` work).

## Balancing workflow

Edit the level JSON, then run ride.mjs (crowds safe), blind.mjs (solo risky), stand.mjs (standing groups useful), solve.mjs (solo still possible) and coins.mjs (route coins safe, valuable coins risky). When a crowd ride fails, look at the officer with the longest sighting. Officers walking the same direction as a crowd, just behind it, are the usual cause; crosswise sweeps with narrow cones are kinder to crowds.
