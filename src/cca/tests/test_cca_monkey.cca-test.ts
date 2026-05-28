// Port of Godot tests/test_cca_monkey.gd — random-command fuzzer over the raw
// Adventure FSM. Asserts FLOOR thresholds (coverage with margin) + zero soft-lock
// candidates. Godot's walk uses its engine RNG (not JS-reproducible), so the
// exact numbers differ; the floors are what the Godot thresholds assert too, and
// any soft-lock is a genuine finding regardless of the walk.
import { file, ok } from "./_harness";
import { runMonkey } from "./_monkey";
import { ROOMS } from "../topology";

file("test_cca_monkey");

const SEED = 42;
const MAX_STEPS = 10000;
const MIN_ROOMS = 18;
const MIN_FPS = 50;
const MIN_MOVES = 1000;
const MAX_SOFTLOCK = 0;

const r = runMonkey(ROOMS, SEED, MAX_STEPS);

ok(`rooms_visited >= ${MIN_ROOMS} (got ${r.rooms_visited})`, r.rooms_visited >= MIN_ROOMS);
ok(`fingerprints >= ${MIN_FPS} (got ${r.fingerprints})`, r.fingerprints >= MIN_FPS);
ok(`state-change moves >= ${MIN_MOVES} (got ${r.moves})`, r.moves >= MIN_MOVES);
ok(`soft-lock candidates == ${MAX_SOFTLOCK} (got ${r.soft_lock_count})`, r.soft_lock_count <= MAX_SOFTLOCK);
