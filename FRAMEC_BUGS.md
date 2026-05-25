# framec bugs found while building frame-arcade-js

Tracks framec codegen issues hit while porting the arcade games to the
JavaScript target. (Mirrors the convention in the Godot `frame-arcade` repo.)

framec version: **4.2.1** (`framec --version`).

---

## BUG-1 — `push$ -> $State` is broken on the JavaScript target

**Status:** ✅ FIXED in framec (`fix(codegen js/ts)`, commit `26dcf12` on
branch `fix-js-pushpop`; installed as framec 4.2.3). The JS/TS arm of
`expand_stack_push` now emits the compartment model (`__prepareEnter` +
`__transition` + return) like a normal transition. Asteroids is un-parked and
pause/resume now use `push$ -> $Paused` / `-> pop$` across all games.
Remaining: the `W414` reachability false-positive for `push$ -> $State` targets
(cosmetic) is still open. Filed in framec's tracker as Issue #42.

<details><summary>Original report</summary>

**Blocks:** Asteroids (state-stack / hyperspace showcase)

A `push$ -> $State` transition generates a call to a non-existent method and
never touches the state stack, so it throws at runtime.

### Minimal repro

```frame
@@[target("javascript")]
@@system Repro {
    operations: state(): string { @@:(@@:system.state) }
    interface: go() back()
    machine:
        $A { go() { push$ -> $B } }
        $B { back() { -> pop$ } }
}
```

`framec -l javascript` emits, in the `go()` handler:

```js
this._transition("B", null, null);   // ❌ wrong
```

But the class only defines `__transition(next_compartment)` (double underscore,
takes a prepared compartment) and a `_state_stack` array that this code never
pushes onto. A normal transition correctly emits:

```js
const __compartment = this.__prepareEnter("B", [], []);
this.__transition(__compartment);    // ✅ correct
```

At runtime: `TypeError: this._transition is not a function`.

### Expected

`push$ -> $State` should push the current compartment onto `_state_stack`, then
`__transition(__prepareEnter("B", …))` — and `-> pop$` should pop from
`_state_stack`. (Likely both `push$` and `pop$` need fixing on the JS backend;
the error surfaces at `push$` first.)

### Also seen

`W414: State 'B' is not reachable from start state` — the reachability pass
doesn't appear to count `push$ -> $State` as reaching the target state.

### Workaround

None applied. Asteroids is parked until this is fixed in framec — faking
hyperspace with a plain transition would misrepresent the state-stack feature
the chapter is meant to demonstrate.

</details>
