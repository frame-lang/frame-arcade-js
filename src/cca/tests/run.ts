// CCA validation suite runner — the faithful counterpart to Godot's
// run_tests.sh. Imports every *.cca-test module (each runs its checks on
// import), then prints per-file PASS/FAIL + totals and exits with the
// failed-file count. Run: `npm run test:cca:suite` (needs framec >= 4.3.0).
//
// Tests are registered by importing them here, in the Godot file order.
import "./lamp.cca-test";
import "./bird_snake.cca-test";
import "./dragon.cca-test";
import "./bear.cca-test";
import "./troll.cca-test";
import "./grate.cca-test";
import "./bridge.cca-test";
import "./rusty_door.cca-test";
import "./plant.cca-test";
import "./vending.cca-test";
import "./prop_gates.cca-test";
import "./topology.cca-test";
import "./conditional.cca-test";
import "./score.cca-test";
import "./score_system.cca-test";
import "./hints.cca-test";
import "./hint_thresholds.cca-test";
import "./treasure_values.cca-test";
import "./oyster_hint.cca-test";
import "./chest_hint.cca-test";
import "./test_cca_liquid_sources.cca-test";
import "./test_cca_pour_oil_plant.cca-test";
import "./test_cca_dwarves.cca-test";
import "./test_cca_dwarf_anger.cca-test";
import "./test_cca_multi_dwarf.cca-test";
import "./test_cca_pirate.cca-test";
import "./test_cca_npc_throws.cca-test";
import "./test_cca_bear_msgs.cca-test";
import "./test_cca_dwarf_persist.cca-test";
import "./test_cca_death_rooms.cca-test";
import "./test_cca_death_scenarios.cca-test";
import "./test_cca_death_paths.cca-test";
import "./test_cca_dark.cca-test";
import "./test_cca_endgame.cca-test";
import "./test_cca_endgame_panic.cca-test";
import "./test_cca_endgame_blast.cca-test";
import "./test_cca_aspects.cca-test";
import "./test_cca_mechanics.cca-test";
import "./test_cca_canon_38.cca-test";
import "./test_cca_canon_conditional_rows.cca-test";
import "./test_cca_fragile_vase.cca-test";
import "./test_cca_clam_squeeze.cca-test";
import "./test_cca_plover_emerald.cca-test";
import "./test_cca_forest_selfloop.cca-test";
import "./test_cca_transient_prose.cca-test";
import "./test_cca_gold_blocks_steps.cca-test";
import "./test_cca_gold_falls_pit.cca-test";
import "./test_cca_back_verb.cca-test";
import "./test_cca_lamp_quit_etc.cca-test";
import "./test_cca_dwarf_hitrate_curve.cca-test";
import "./test_cca_canonical_journey.cca-test";
import "./test_cca_win_journey.cca-test";
import "./test_cca_completable_multiseed.cca-test";
import "./test_cca_stochastic_probe.cca-test";
import "./test_cca_stochastic_probe_dispatch.cca-test";
import "./test_cca_stochastic_probe_y2.cca-test";
import "./test_cca_stochastic_probe_dwarf.cca-test";
import "./test_cca_stochastic_probe_pirate.cca-test";
import "./test_cca_pirate_rustling.cca-test";
import "./test_cca_dark_pit_fall.cca-test";
import "./test_cca_flavor_msgs.cca-test";
import "./test_cca_witts_end.cca-test";
import "./test_cca_19_sw_chain.cca-test";
import "./test_cca_maze_journey.cca-test";
import "./test_cca_plant_journey.cca-test";
import "./test_cca_troll_journey.cca-test";
import "./test_cca_rusty_journey.cca-test";
import "./test_cca_room110_journey.cca-test";
import "./test_cca_journey_completable.cca-test";
// Content-prose bucket — passing ports (the 8 that reveal JS content-prose gaps
// are drafted on disk but not yet wired; they'll be enabled as each canon-prose
// gap is filled in the driver/FSM: welcome msg#1, PDP-10 easter eggs, scenery
// examine/read, FIND verb, EXAMINE ROD, dwarf first-encounter msg#3, BRIEF revisit).
import "./test_cca_verb_effects.cca-test";
import "./test_cca_attack_bird.cca-test";
import "./test_cca_cave_y2_back.cca-test";
import "./test_cca_maze_decoration.cca-test";
import "./test_cca_npc_spec.cca-test";
import "./test_cca_world_spec.cca-test";
import "./test_cca_death_resurrection.cca-test";
import "./test_cca_dwarf_canon.cca-test";
import "./test_cca_find_msg94.cca-test";
import "./test_cca_scenery_flavor.cca-test";
import "./test_cca_rod2_dynamite.cca-test";
import "./test_cca_minor_verbs.cca-test";
import "./test_cca_verb_defaults.cca-test";
import "./test_cca_credit_splash.cca-test";
import "./test_cca_pdp10_easter_eggs.cca-test";
import "./test_cca_playthrough.cca-test";
import "./test_cca_full.cca-test";
import "./test_cca_canon.cca-test";
import "./test_cca_death_journeys.cca-test";
import "./test_cca_affordance_fsm_agree.cca-test";
import "./test_cca_retry_gate.cca-test";
import "./test_cca_maze_sweep.cca-test";
import "./test_cca_restore_soundness_milestones.cca-test";
import "./test_cca_frame_checker_demo.cca-test";

import { summary } from "./_harness";

declare const process: { exit(code: number): void };
process.exit(summary());
