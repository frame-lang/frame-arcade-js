# CCA JS Validation-Parity — Status

**Goal:** make the JS Colossal Cave Adventure port (`frame-arcade-js`) pass the **same
~110-test Godot validation suite with the same results** as the Godot reference
(`frame-arcade/cca`). Faithfulness rule (user-confirmed): when a ported test fails,
**fix the JS driver/FSM to behave like Godot — do NOT relax the test's assertions**.
User directives in force: *match canon everywhere* (full canon prose, not web-abbreviated);
*commit green batches as I go* (standing permission); framec fixes are the framepiler
team's job (file `FRAMEC_BUGS`, don't edit framec).

---

## TL;DR — where we are (EFFECTIVELY COMPLETE)

- **Fast suite (`npm run test:cca:suite`): 96 files, 1468 checks, 0 failures (~7s).**
- **Slow suite (`npm run test:cca:slow`): 10 files, 21 checks, 0 failures (~58s).**
- ~18 commits this effort, working tree clean.
- **106 of 110 Godot tests ported & passing.** The only 4 not ported are
  `journey_tree_audit`×4, which are **retired in Godot** (skipped by default,
  superseded by dag_coverage which passes at 140/140) — see "Remaining" for why
  porting them as gates would be unfaithful.
- `canonical` (the stage-DAG "if this passes, the game works" test) is **DONE** —
  119 checks, init → won via real commands + all branch/fork stages.
- Slow bucket: state_space×6, area_explorer, monkey, **dag_coverage (140/140
  headline)**, probe.

## THE keystone fix (most important thing to remember)

The seeded LCGs (`Chance` / `Dwarf` / `Pirate` in `src/cca/npcs.fjs`) used
`Math.imul(...) >>> 0`, truncating to **32 bits at each step**. GDScript computes the
same LCG in **signed 64-bit** and masks only at the end. They agree only while
`seed*A + step*B < 2^32`, i.e. they **diverge from Godot's rolls the moment that
intermediate overflows 32 bits** (for seed=42, that's step 5). Fixed by computing the
LCG in **BigInt** (`npcs.fjs`, all 7 LCG bodies). This made the JS rolls **bit-identical
to Godot** and unblocked the organic win journey + every RNG-distribution test (exact
golden tallies). Verified end-to-end: `stochastic_probe` golden tallies, `state_space`
reaching the identical 424 states / 15 rooms as Godot.

## Buckets DONE (all committed, all green)

- **Journey rails:** win_journey (organic 10-treasure win), canonical_journey,
  multiseed, + sub-rails maze/plant/troll/rusty/room110, journey_completable
  (33 milestones resume-to-won), playthrough, full (15 treasures+endgame+detonate),
  canon (always-pass dashboard stub), death_journeys (3 canon death rails).
- **RNG-distribution (10):** 5 `stochastic_probe*` (exact golden tallies),
  pirate_rustling, dark_pit_fall, flavor_msgs, witts_end, 19_sw_chain.
- **Content-prose (15/15):** verb_defaults, verb_effects, minor_verbs (BRIEF revisit),
  scenery_flavor, find_msg94 (FIND verb), attack_bird, cave_y2_back, maze_decoration,
  npc_spec, world_spec, dwarf_canon (msg#3), credit_splash (canon welcome msg#1),
  pdp10_easter_eggs (HOURS/MAINT/WIZARD/SUSPEND), rod2_dynamite, death_resurrection.
- **Model-checking harness (fast):** affordance_fsm_agree, retry_gate, maze_sweep,
  restore_soundness_milestones, frame_checker_demo (generic checker == bespoke
  StateSpace, 54 rooms; EF-won; restore bisimulation), bfs_restore_property,
  state_exploration (6 sub-FSMs).
- **Slow state-space:** state_space (canonical-start), + 5 seeded variants
  (seeded/progression/post_bridge/endgame/multiseed), area_explorer, monkey.

## Driver / FSM gap-fixes made (faithful, in `src/cca/driver.ts` + `npcs.fjs`)

- **BigInt LCG** (`npcs.fjs`) — the keystone.
- **y2_whisper roll** in `printRoom` (was missing; desynced the shared chance stream).
- **`interactive` flag** = Godot's `is_inside_tree()` gate: end-of-run `deadEnd`
  only latches in a live session (`cca-main.ts` passes `true`); headless harness keeps
  playing + prints canon prose. Without this, the lamp dying at canon turn 330 ended
  flavor_msgs' 1000-frobnicate loop early.
- **Exposed test hooks:** `captured` buffer, `checkPirateRustle`, `checkDarkPitHazard`,
  `tryBumperRule`, `captureRoomRender`, `restoreFsmState`, `resetSession`,
  `listActionsHere` (affordance enumerator), `objectInRoom`/`resolveObjectId` (FIND).
- **Content prose:** FIND verb ladder, scenery EXAMINE/READ intercept (`iSceneryRead`),
  dwarf first-encounter msg#3, BRIEF revisit (`visitedRooms` + `maybePrintRoom`),
  canon welcome msg#1 in `start()`, HOURS/MAINT/WIZARD canon prose, SUSPEND flow
  (`offer_suspend` + Y/N → "Saved."), `saveGame()` → "Saved.".

## Infrastructure built (in `src/cca/tests/`)

- `_harness.ts` (pre-existing) — file/expect/ok/expectContains/makeAdventure/makeDriver/capture.
- `_probe.ts` — StochasticProbe (seed dispenser + tally).
- `_loops.ts` — RetryGate + MazeSweep (reactive exploration loops).
- `_modelcheck.ts` — **the model-checking core**: `CcaModelAdapter`, `FrameStateChecker`
  (explore/reachable_satisfying/restore_soundness), `StateSpace` (bespoke BFS +
  invariants + areaRooms + seeding + checkSaveRestore), `MilestoneRegistry`,
  `captureCanonicalMilestones(seed)`, `seededBfs`, `exploreStates` (StateExplorer).
- `_monkey.ts` — random-command fuzzer (mulberry32 PRNG; floor-based).
- `journeys.ts` — CANONICAL_JOURNEY + WIN_JOURNEY data, sub-rail command arrays
  (MAZE_RAIL/PLANT_RAIL/TROLL_RAIL/RUSTY_RAIL/ROOM110_RAIL), `walkWinToBridgeBuilt`,
  `feedCommands` (honors `force:CH=V` / `clear:CH` chance-steering tokens).
- `run.ts` (fast runner), `run_slow.ts` (slow runner).

## DONE since the first status snapshot

- **`dag_coverage`** (DONE, committed) — the 140/140 headline. Union of 134 graph
  rooms from 63 rail waypoints × seed [42,7] blooms + MazeSweep; 0 unexpected misses
  (only the 6 transient-prose teleport rooms, covered by `transient_prose`). ~10s.
- **`probe`** (DONE, committed) — core LFU-biased coverage walker, floor-based; clears
  the ≥1500-cell floor via the wild verb×noun emission. ~1.4s. (Godot's Go-Explore
  archive/routing/storm boosters omitted — engine-RNG-bound coverage *above* the floor.)

## REMAINING (5 tests — all retired or redundant)

1. **`journey_tree_audit` ×4** (audit / audit_union / plant_unlock / rusty_door) —
   **NOT ported as gates. RETIRED in Godot** (`run_tests.sh` SLOW_TESTS: "skipped by
   default … run explicitly if you ever need the BFS gap report") and **superseded by
   `dag_coverage`** (which passes at 140/140). I ported `audit` to check, and it
   reaches **101 rooms** from BearReleased at cap 15000 vs Godot's **122** (floor 115) —
   a **BFS-exploration-order-at-cap divergence**, NOT a reachability bug: the StateSpace
   hash dedups on room+inv+npc but NOT chance, so the frontier order (and thus which
   rooms land inside the 15000-state cap) cascades differently from Godot. dag_coverage
   proves the rooms ARE reachable. Relaxing the floor would violate the faithfulness
   rule; chasing bit-identical BFS frontier order is deep + low-value for retired tests.
   So these match Godot's **default result = skipped**. Port removed.

2. **`canonical`** (`tests/test_cca_canonical.gd`, 1357 LoC) — stage-DAG playthrough:
   ~33 stages, each restores a `from` checkpoint, runs real `do_command` actions
   (`["go", dir]` resolves direction→move; `["take", noun]` etc.), asserts post-
   conditions, saves a named checkpoint. Big **mechanical** port (bulk = the `_stages()`
   array + assert closures). **Functionally redundant** — canonical_journey + full +
   win_journey + journey_completable already exercise the same path & guarantees (all
   passing). Needed only for literal 1:1 file parity. FAST if ported (checkpoints
   fast-forward). **The one remaining non-retired test.**

## How to run / iterate

```
cd /Users/marktruluck/projects/frame-arcade-js     # ALWAYS cd first — shell cwd drifts
npm run test:cca:suite      # fast suite (gen + bundle + node), ~7s
npm run test:cca:slow       # slow suite (BFS/state-space/fuzzer), ~47s
# Fast iteration without regen (machines already current):
./node_modules/.bin/esbuild --bundle src/cca/tests/run.ts --format=esm --platform=node \
  --outfile=node_modules/.cache/cca-suite.mjs && node node_modules/.cache/cca-suite.mjs
# Verify one new test in isolation: make a temp src/cca/tests/_slowprobe.ts that imports
# the test + `summary` from ./_harness, bundle+run it, then delete it.
```

- **framec 4.3.0** is installed via cargo (`~/.cargo/bin/framec`, on PATH), so
  `npm run gen` needs no `FRAMEC=` env. The old `framec-cleanup/target/release/framec`
  local build is gone. Generated `*.machine.js` are gitignored (build artifacts).
- Godot reference tests: `frame-arcade/cca/tests/*.gd`; helpers `godot/scripts/`.
  Run one: `godot --headless --path godot/ --script ../tests/test_cca_X.gd`.

## Known residuals / notes

- **Engine-RNG residual:** Godot's `RandomNumberGenerator` (engine) is NOT
  JS-reproducible. The few tests that used it (monkey, probe, and ±5σ distribution
  windows) are **floor/range-based by design**, so the JS PRNG walk differs in exact
  numbers but clears the thresholds. The *model* `chance` LCG (the one that matters for
  determinism) IS bit-faithful (BigInt fix).
- **Dwarf-wandering divergence (flagged, currently MOOT):** the driver's `stepDwarves`
  free-play wandering can reach rooms Godot's doesn't (seed-level `pick_destination`
  difference). But: journey/state-space tests suppress dwarves (`dwarves_auto_woken`),
  and monkey runs FSM-only (no driver `stepDwarves`), so nothing exercised so far is
  affected. `witts_end` isolates the gate with `dwarves_auto_woken` for this reason.
  If a future free-play test asserts exact dwarf-dependent coverage, investigate
  `Dwarf.pick_destination` (pick_step stream) vs Godot.
- The 8 content-prose driver additions changed player-facing prose to canon (welcome
  screen is now the full 1977 text) per the *match canon everywhere* directive.
