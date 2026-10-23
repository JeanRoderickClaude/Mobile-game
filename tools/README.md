# Balance tools

Scripts that measure how hard a level is. Each one starts its own Vite dev server, opens the game in headless Chromium, loads the level you name and drives the real game code. Officers, crowds, detection and collision are the same code the player runs, stepped in fixed 16 ms frames, so results repeat exactly from run to run.

## Setup

Run `npm install` in the repository root. It installs Playwright 1.63.0. On a new machine, download its browser once:

```
npx playwright install chromium
```

To use a Chromium that is already installed elsewhere, set `CHROMIUM_PATH` to its executable. No dev server needs to be running; each script starts and stops its own.

## Running

Run every script from the repository root and pass a level file. The file must be in `src/levels/`, because the game only loads levels from there.

```
node tools/ride.mjs src/levels/level-01.json
```

Flags go after the level file. A script that runs the whole level many times takes a minute or two.

## ride.mjs: is riding a crowd safe?

Rides every marching group from its spawn to the finish, once per cycle (default 12 cycles, `--cycles N`). Each cycle starts later, so the officers are at different points of their patrols. The simulated player steers toward the group centre and never moves faster than 105 percent of the group's pace, so it stays hidden the whole way.

```
node tools/ride.mjs src/levels/level-01.json --cycles 12
```

Each line is one ride: the crowd's index in the level's `crowds` list, the cycle, when that group spawned, and the outcome (`finished`, `CAUGHT`, or `group vanished` if the group reached its end before the player reached the finish). `peak` is the highest the suspicion meter got, in ms; 500 means caught. `at` is where that peak happened. The last part lists, per officer (index in the level's `officers` list), the longest unbroken time that officer saw the player. An officer above about 1500 ms is the one to fix. The summary line gives survived rides out of total and the worst peak. Level 1 gives 24 of 24, worst peak 464 ms.

## blind.mjs: how risky is the same route alone?

Walks each marching group's path with no crowd protection, once at full speed and once at crowd pace, from 23 start times 1.5 s apart (`--every ms`, `--until ms`). It does not dodge or wait.

```
node tools/blind.mjs src/levels/level-01.json
```

Each line gives start times survived out of total. Compare with ride.mjs: if crowds are the safe route, blind runs should mostly fail. Level 1 gives 5 of 23 at full speed.

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

The output says whether a route exists and when it reaches the finish, or when every option got caught. `--range-mul` and `--angle-add` make every cone bigger: if a route still exists, the solo route has slack. `--cap ms` sets the catch threshold, so `--cap 1` asks for a route on which the player is never seen at all. `--crowds` lets the search hide in crowds. `--max-sec` limits the search (default 120). `--draw file.png` saves a picture of the whole level with the route in magenta and labels in seconds along it. The search knows the future, so it is much better than a person. Use it to answer "is this possible at all", and use blind.mjs for "is this easy".

The hiding rules are copied from GameScene (1.1 speed margin, 25 units/s floor, 25 percent rate). Update `solve.mjs` if those constants change in `src/config.ts`.

## coverage.mjs: where are the safe pockets?

Replays 60 s of officer movement (`--seconds N`) and colours the level: green squares were never inside a cone, red ones were, with darker red meaning more of the time.

```
node tools/coverage.mjs src/levels/level-01.json coverage.png
```

Green pockets behind cars and buildings are where a solo player waits. A route with no green near it can only be crossed by timing.

## Balancing workflow

Edit the level JSON, then run ride.mjs (crowds safe), blind.mjs (solo risky), stand.mjs (standing groups useful) and solve.mjs (solo still possible). When a crowd ride fails, look at the officer with the longest sighting. Officers walking the same direction as a crowd, just behind it, are the usual cause; crosswise sweeps with narrow cones are kinder to crowds.
