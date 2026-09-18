# Beeline Implementation Milestones

This document is the implementation roadmap and continuation record for Beeline. It should contain enough context for a later work session to resume without reconstructing earlier conversations.

Keep it current as work proceeds:

- Check an item only after its completion criteria have actually been verified.
- Record important implementation results, measurements, and rule changes under the relevant milestone.
- Prefer revising this roadmap over silently departing from it.
- Keep the project small and direct. This is a roadmap for one browser game, not a proposal for a general game engine.

The required order from `AGENTS.md` remains:

1. Make the rules correct.
2. Make the game playable.
3. Playtest and revise the rules.
4. Optimize only measured problems.
5. Polish the presentation.

The early milestones deliberately use a small number of focused tests, then move quickly to a playable version. The exact solver is early work rather than a deferred enhancement because it verifies that generated boards are solvable, establishes the Perfect score, and supplies a known solution for debugging.

---

## Current Project State

Recorded September 18, 2026.

The repository currently contains:

- `AGENTS.md`: development philosophy and project constraints;
- `BeelineRules.md`: current game rules;
- `dictionary.txt`: the authoritative word list;
- this roadmap;
- `package.json`, `pnpm-lock.yaml`, and `tsconfig.json`: the minimal TypeScript toolchain;
- `src/game.ts`: completed Milestones 1–3 game logic and exact solver;
- `src/game.test.ts`: 19 focused rule, solver, and generation tests;
- `scripts/benchmark.ts`: the reproducible full-dictionary solver benchmark;
- `build/game.js`: generated compiler output, ignored by `.gitignore`.

The directory is not currently a Git repository.

Milestones 0–3 are complete and Milestone 4's pure generation work is complete. All 19 tests pass, strict TypeScript compilation succeeds, and representative full-dictionary boards have exact, replay-verified solutions. The browser entry point, its `DAILY_MODE` switch, and the playable interface do not exist yet.

### SpellSweep relationship

Beeline shares most of its word-game anatomy with the previously completed SpellSweep project:

<https://github.com/Blendletan/SpellSweep>

The SpellSweep repository was inspected at commit `d59e37e92efc89a923dabb41489070cc6107263d` (`Improved SEO`, September 14, 2026).

Useful SpellSweep ideas and code shapes to adapt are:

- a pure `src/game.ts` containing ordinary data and functions;
- a direct-DOM `src/main.ts` rather than a UI framework;
- TypeScript compiled with `tsc` to a static `build/` directory;
- Node's built-in test runner for focused game tests;
- dictionary parsing plus full-word and prefix indexes;
- prefix-pruned enumeration of valid paths;
- center-wildcard handling;
- weighted random letter generation;
- seeded daily generation and unseeded development generation;
- click/touch-friendly tile buttons, explicit wildcard entry, clear, and submit controls.

Do not copy SpellSweep wholesale. Its square-board geometry, full-board coverage objective, 25-bit solver, tutorial, sharing, cookies, dialogs, and late-stage presentation work are not automatically Beeline requirements.

The Beeline and SpellSweep dictionary files contain the same 178,691 entries. Their byte-level difference is line endings only. Beeline's local `dictionary.txt` remains authoritative.

---

## Confirmed Rules and Decisions

These decisions should be treated as current requirements unless the user explicitly changes them.

### Board

- The board is a regular hexagon with side length 5 and 61 tiles.
- The center tile is the only wildcard.
- Every tile has up to six hexagonal neighbors.
- The six physical sides form three opposite pairs.
- A corner tile belongs to both sides that meet at that corner.

### Words

- A valid word contains at least **two letters**. Two-letter words are intentionally allowed; using many of them naturally produces a poor score.
- A word is an ordered path through adjacent tiles.
- A tile cannot appear twice within one submitted path.
- Tiles, including the wildcard, may be reused in later words.
- The wildcard represents exactly one letter in a word and may represent a different letter in another word.
- The submitted spelling must exist in `dictionary.txt`.
- Following SpellSweep's established behavior, the same word may be submitted again, along the same or a different legal path. Every accepted submission counts as another word. This has no special bonus and will usually worsen the score.
- An invalid submission must not change active tiles or the score.

### Active network and victory

- Every tile in an accepted word becomes active permanently.
- Adjacent active tiles are connected even when different words activated them.
- Victory requires an active path across each of the three opposite-side pairs.
- The three required crossings are checked independently. They may share a component, but they do not have to be three separate paths or three separate components.
- A submitted word can complete more than one side pair at once.

### Score and optimal solution

- Score is the number of accepted words used before victory.
- Lower is better.
- `Perfect` is the exact minimum number of valid word paths whose combined active tiles satisfy all three crossings.
- The implementation must find an exact solution, not merely a greedy or approximate one.
- If no collection of valid word paths can win, the board is unsolvable and must not be presented as a playable puzzle.
- The solver should return one deterministic optimal solution when several solutions tie.

### Puzzle modes

There will be one obvious switch in the browser code:

```ts
const DAILY_MODE = false;
```

- Keep it `false` during development and playtesting.
- When `false`, a page load generates a fresh random, verified-solvable test puzzle.
- When `true`, the local calendar date seeds puzzle generation so reloading produces that day's same puzzle.
- This must remain a plain boolean, not a feature-flag or configuration system.

### Initial interface scope

The first interface only needs to make the game understandable and playable:

- the 61-tile hex board;
- selected-path order and candidate word;
- wildcard letter entry when needed;
- clear and submit controls;
- visible active tiles;
- current word-count score and Perfect score;
- status for the three opposite-side connections;
- clear invalid-word and completion feedback;
- a simple restart/new-puzzle action in development mode.

Tutorials, result sharing, cookies, elaborate dialogs, animation, branding, and final visual polish are later decisions, not initial requirements.

---

## Intended Small Project Shape

This is a target, not a requirement to create empty files prematurely:

```text
/
    AGENTS.md
    BeelineRules.md
    MILESTONES.md
    dictionary.txt
    index.html
    style.css
    package.json
    tsconfig.json

    src/
        game.ts
        game.test.ts
        main.ts

    build/                 generated by TypeScript; do not hand-edit
```

Add `scripts/benchmark.ts` only if solver measurements are easier to perform outside the tests. Add puzzle data only if measurement eventually justifies pre-generating boards. Do not create either speculatively.

The expected dependency footprint is one TypeScript development dependency. Do not add a framework, component library, general graph library, state library, or solver package without first stopping and discussing why ordinary code is inadequate.

---

## Technical Design Notes

These notes establish the initial implementation direction. They may be simplified or replaced when measurement provides a concrete reason.

### Hex coordinates

Use axial coordinates `(q, r)` with the derived cube coordinate `s = -q - r`.

For radius 4, a coordinate is on the board when:

```text
max(abs(q), abs(r), abs(s)) <= 4
```

This produces exactly 61 coordinates. Generate them in one deterministic order and use their array positions as tile indexes throughout the game and UI.

The six neighbor offsets are:

```text
(+1,  0)
(+1, -1)
( 0, -1)
(-1,  0)
(-1, +1)
( 0, +1)
```

The six sides are the coordinates satisfying `q = -4`, `q = +4`, `r = -4`, `r = +4`, `s = -4`, and `s = +4`. Opposite pairs are the negative and positive extremes of the same coordinate. This definition naturally makes corners members of two sides.

Precompute each tile's neighbor indexes once. Keep the data as ordinary arrays rather than introducing board or graph classes.

### Core state

The likely state is deliberately small:

```ts
type GameState = Readonly<{
  board: readonly string[];
  active: readonly boolean[];
  wordsUsed: number;
  completed: boolean;
}>;
```

The current unsubmitted path and wildcard input belong to the browser interaction state, not the durable game rules.

A successful submission should:

1. validate the path and submitted spelling;
2. copy and update the active-tile array;
3. increment `wordsUsed` exactly once;
4. recompute the three connection results;
5. mark the game completed when all three are satisfied.

Do not mutate the prior `GameState`. This makes tests and UI updates straightforward without creating a state-management abstraction.

### Connectivity

Implement one simple breadth-first or depth-first traversal over active neighbor tiles for each opposite-side pair:

1. Start from every active tile on one side.
2. Traverse only active neighbors.
3. Succeed if any reached tile lies on the opposite side.
4. Win only if all three pair checks succeed.

Use the same win predicate for normal play and solver masks so the solver cannot silently disagree with the game.

### Dictionary and word-path enumeration

Adapt SpellSweep's proven approach:

- normalize `dictionary.txt` to lowercase alphabetic words of length 2 or more;
- store full words in a `Set<string>`;
- store every useful prefix in a second set;
- record the longest dictionary word;
- start a depth-first path search from each tile;
- stop a branch when its spelling is not a dictionary prefix;
- never revisit a tile within the same path;
- when the center wildcard is encountered, try `a` through `z` for that position;
- emit a candidate whenever the current spelling is a complete dictionary word.

The enumerator must retain different paths for the same spelling because their tile locations have different strategic value.

### Masks

JavaScript's normal bitwise operators are limited to 32 bits and cannot represent 61 tiles safely. Use a `bigint` bit mask for solver and connectivity work:

```ts
const tileBit = 1n << BigInt(tileIndex);
```

The ordinary browser-facing state may still use boolean arrays for readability. Provide small direct conversion helpers only where needed.

### Solvability precheck

Before exact search, union the masks of every valid word path. If that all-candidates mask does not satisfy the three connection checks, the board is impossible.

This precheck is exact for unsolvability: tiles persist, words may overlap, and every candidate word may be submitted independently. Therefore no solution can use a tile outside this union. Conversely, if the union wins, submitting a finite collection containing those candidates eventually activates that winning union, so a solution exists even before its minimum size is known.

### Exact minimum-word solver

Each candidate is a valid word, its ordered tile path, and its 61-bit mask.

Apply only reductions that preserve exactness. The initial implementation uses:

1. **Identical mask:** retain one deterministic representative, chosen by spelling and then path order.
2. **Single-word subset:** discard candidate A when its mask is a strict subset of candidate B's mask. Both cost one word, and B activates everything A does plus more; additional active tiles can never harm a monotone connection goal.
3. **No-op transition:** while searching, skip a candidate that adds no active tile to the current state.

The implemented exact search uses deterministic iterative deepening over combinations of the reduced candidates:

- search every one-word combination, then every two-word combination, and so on;
- consider candidates in a deterministic usefulness order, with a stable spelling/path tie-breaker;
- add candidates only at increasing indexes, so permutations of the same combination are never repeated;
- prune a branch when the current mask combined with every remaining candidate still cannot win;
- skip a candidate when it adds no active tile;
- stop at the first winning combination at the first successful depth.

Because every candidate costs one accepted word and every smaller combination size has already been exhausted, the first successful depth is the exact Perfect score. The chosen candidate objects already retain the actual spelling and ordered tile path, so the answer can be replayed through normal submission validation.

The first implementation used a breadth-first frontier with incremental subset/superset dominance checks. Measurement showed that maintaining the frontier dominated runtime and did not complete the first representative board in 90 seconds. It was replaced with iterative deepening, which solved that board in 82 ms. Identical-union memoization or safe state dominance remain possible future improvements if a measured board justifies them; they are not needed for the current solver.

Do not claim this will be fast enough before measuring it on 61-tile boards with the full dictionary. Record at least:

- path-enumeration time;
- raw and reduced candidate counts;
- candidate combinations examined at each word depth;
- exact-solver time;
- total puzzle-generation time;
- the resulting Perfect score.

If measurements show that the exact search is too slow on a later board, preserve exactness while adding the smallest justified improvement. Likely next options are identical-union memoization, safe state dominance, a greedy solution used only as an upper bound, or generating a small verified puzzle pool ahead of time. Do not introduce a worker, third-party optimizer, database, or elaborate generation pipeline without discussing it first.

---

## Milestone 0: Baseline and Small Toolchain

- [x] Read `AGENTS.md` and `BeelineRules.md`.
- [x] Inspect the repository contents and authoritative dictionary.
- [x] Inspect SpellSweep's current source and identify reusable ideas.
- [x] Confirm that two-letter words are allowed.
- [x] Confirm that exact optimal solving belongs before the playable interface.
- [x] Record the decisions, technical direction, and continuation notes in this file.
- [x] Add the minimal `package.json` and `tsconfig.json` needed to compile TypeScript and run focused tests.
- [x] Add `src/game.ts`, `src/game.test.ts`, and the generated-output ignore rule.
- [x] Confirm the initial build and test commands in this document.

Completion criteria: the project has a small, working TypeScript/test setup derived from the successful SpellSweep setup, with no runtime framework or unnecessary dependency.

Implementation result (September 18, 2026): added the same deliberately small toolchain shape that worked for SpellSweep: one TypeScript development dependency, Node's built-in test runner, strict `tsc` compilation, and no runtime dependencies. `pnpm-lock.yaml` records TypeScript 7.0.2. The commands are `pnpm test`, `pnpm build`, and `pnpm benchmark`; direct equivalents used during this sandboxed session were `node --test src/game.test.ts`, `node_modules/.bin/tsc.cmd -p tsconfig.json`, and `node scripts/benchmark.ts`.

---

## Milestone 1: Hex Geometry and Core State

- [x] Generate the 61 radius-4 axial coordinates in deterministic order.
- [x] Identify the center tile and require it to contain the wildcard.
- [x] Precompute all six-neighbor relationships.
- [x] Identify membership in each of the six sides, including dual membership at corners.
- [x] Validate that a board contains 61 entries, one wildcard at the center, and lowercase letters elsewhere.
- [x] Create the small immutable `GameState` representation.
- [x] Implement reset/restart state creation.
- [x] Add focused tests for tile count, center, neighbors, edges, corners, and opposite-side membership.

Completion criteria: board geometry and state can be inspected and tested without a browser, and the coordinate model is proven to contain 61 correctly connected cells.

Implementation result (September 18, 2026): complete. `src/game.ts` uses radius-4 axial coordinates, a deterministic tile-index order, precomputed neighbor arrays, and side lists ordered `q-`, `q+`, `r-`, `r+`, `s-`, `s+`. The center is index 30. Tests verify 61 unique coordinates, six center neighbors, four non-corner edge neighbors, three corner neighbors, symmetric adjacency, five tiles per side, and two side memberships at a corner.

---

## Milestone 2: Dictionary, Paths, and Submission Rules

- [x] Parse and normalize `dictionary.txt` with a two-letter minimum.
- [x] Build full-word and prefix indexes.
- [x] Validate adjacent, non-repeating tile paths.
- [x] Match an ordinary path against its letters.
- [x] Match the center wildcard to exactly one supplied letter.
- [x] Allow the wildcard to change between submissions.
- [x] Accept valid words and reject invalid words without changing state.
- [x] Activate every tile in an accepted path permanently.
- [x] Allow already-active tiles and repeated words to be played again.
- [x] Increment the score for every accepted submission, including one that adds no new active tile.
- [x] Enumerate every valid dictionary path needed by generation and solving, with prefix pruning.
- [x] Add focused tests for two-letter words, all movement directions, path reuse rules, wildcard behavior, duplicate submissions, and invalid submissions.

Completion criteria: legal word play and candidate enumeration work from pure functions, independent of the interface.

Implementation result (September 18, 2026): complete. The parser reads all 178,691 authoritative entries and intentionally drops one-letter/nonalphabetic input. The enumerator performs prefix-pruned depth-first search, expands the center wildcard through `a`–`z`, and retains distinct paths for the same spelling. Accepted submissions use immutable state updates; repeated valid plays count again even when they add no active tile.

---

## Milestone 3: Connections, Solvability, and Exact Perfect Solver

- [x] Implement the shared active-mask connection check for each opposite-side pair.
- [x] Implement completion when all three pair checks succeed.
- [x] Check the three pairs independently without imposing a separate-component or single-component rule.
- [x] Convert enumerated word paths to 61-bit `bigint` masks.
- [x] Implement identical-mask candidate reduction.
- [x] Implement safe single-word subset reduction.
- [x] Implement the all-candidates solvability precheck.
- [x] Implement exact iterative-deepening minimum-word search.
- [x] Reconstruct one deterministic optimal list of words and tile paths.
- [x] Return an explicit unsolvable result rather than looping indefinitely.
- [x] Add known one-word, multiword, overlapping-network, corner, and unsolvable fixtures.
- [x] Add a fixture where a tempting greedy choice is not optimal.
- [x] Verify every returned solver word/path through the same submission validation used by the game.
- [x] Record initial full-dictionary timings and search sizes here.

Completion criteria: for a supplied board, the program either proves it unsolvable or returns a verifiably legal solution with a proven minimum word count.

This is the main correctness gate before building the browser interface. Tests should be meaningful but compact; the goal is confidence in the rules and solver, not maximum test count.

Implementation result (September 18, 2026): complete. Fifteen focused core tests passed at this milestone; the suite now contains 19 tests after generation coverage was added. Strict TypeScript compilation succeeds. The test suite includes one-word and two-word exact solutions, an all-candidates-unsolvable board, a large greedy decoy, deterministic input-order-independent solving, and replay of returned paths through `submitWord` until the game reports completion.

Initial full-dictionary measurements used deterministic weighted-random boards. Dictionary parsing/indexing took 331–417 ms per fresh Node process, and path enumeration took 12–21 ms. Results:

| Board | Raw paths | Reduced candidates | Solver time | Combinations examined by depth | Perfect |
| --- | ---: | ---: | ---: | --- | ---: |
| benchmark-1 | 1,887 | 244 | 82 ms | 244 / 17,486 / 20,817 | 3 |
| benchmark-2 | 1,286 | 206 | 1,386 ms | 206 / 14,534 / 629,825 / 60,665 | 4 |
| benchmark-3 | 1,344 | 190 | 911 ms | 190 / 12,788 / 509,390 / 49,177 | 4 |
| benchmark-4 | 1,136 | 191 | 30 ms | 191 / 9,689 / 565 | 3 |
| benchmark-5 | 1,786 | 279 | 174 ms | 279 / 26,179 / 60,294 | 3 |
| benchmark-6 | 2,535 | 367 | 181 ms | 367 / 42,102 / 47,853 | 3 |

Every returned benchmark answer replayed as legal submissions and completed its board. The current exact solver is adequate for continuing to puzzle generation and a playable prototype. The Perfect-4 samples show that search cost varies substantially, so browser generation still needs measurement in Milestone 4 before performance is declared settled.

---

## Milestone 4: Verified Puzzle Generation and Modes

- [x] Adapt SpellSweep's explicit English letter-frequency table.
- [x] Generate 60 ordinary letters and put the wildcard at the center.
- [x] Reject candidates that fail the cheap solvability precheck.
- [x] Run the exact solver for accepted candidates and retain their Perfect score and one solution.
- [ ] Keep `const DAILY_MODE = false` as the sole mode switch.
- [ ] In development mode, generate a fresh verified puzzle on each page load.
- [x] In daily mode, seed generation from the local date and reproduce the same board and solution on reload.
- [x] Confirm that different development random inputs can produce different boards.
- [ ] Measure the complete generation pipeline in the target browser.
- [x] Measure the complete generation pipeline in Node before adding infrastructure.

Completion criteria: every presented board has a known exact solution, development reloads produce fresh puzzles, and daily reloads are stable for the same local date.

Implementation progress (September 18, 2026): `generateCandidateBoard`, `generateVerifiedPuzzle`, `seededRandom`, `localDateKey`, and `selectPuzzle` are implemented and tested. A constructed test proves that an impossible first candidate is rejected before a second board is exactly solved. Daily selection is reproducible, and injected development random sources produce different verified boards. The generated puzzle retains its board, Perfect score, optimal paths, attempt count, candidate counts, and search counts so the UI will not repeat solver work.

Six additional weighted-random generation samples all succeeded on their first candidate. Generation excluding dictionary parsing took 69, 75, 82, 85, 222, and 950 ms; the slower sample was Perfect 4 and took about 1,027 ms on a verification rerun. Fresh dictionary parsing/indexing took roughly another 320–346 ms. All recorded answers replayed legally to completion. Browser measurement and the actual `DAILY_MODE` constant remain unchecked because `src/main.ts` does not exist yet; they should be completed as part of Milestone 5 rather than by creating an unused placeholder.

---

## Milestone 5: Minimal Playable Interface

- [ ] Add `index.html`, `style.css`, and `src/main.ts` using ordinary browser APIs.
- [ ] Render all 61 tiles as a visibly hexagonal board.
- [ ] Make every tile a real accessible button.
- [ ] Support click/tap path construction using the same simple interaction as SpellSweep.
- [ ] Allow clicking the current final tile to remove it from the path.
- [ ] Reject a nonadjacent next tile and explain why.
- [ ] Show selection order and the candidate word.
- [ ] Show one-letter wildcard input only when the selected path uses the center.
- [ ] Provide clear-selection and submit controls.
- [ ] Distinguish inactive, active, selected, center-wildcard, and revealed-solution states.
- [ ] Show accepted words used, Perfect, and the status of all three side pairs.
- [ ] Announce invalid words, accepted words, and completion clearly.
- [ ] Provide a simple way to start a fresh development puzzle.
- [ ] Optionally expose the known optimal paths for developer verification; a polished Reveal Answer flow is not required yet.
- [ ] Verify the playable loop with mouse and touch-sized controls in a browser.

Completion criteria: a person can load a verified puzzle, form and submit words, see the network grow, understand the three connection goals, finish the puzzle, and compare the result with Perfect without using developer tools.

---

## Milestone 6: Playtesting and Rule Revision

- [ ] Play multiple generated boards without using the solver's answer.
- [ ] Record whether boards are too easy, too difficult, repetitive, or dominated by obscure dictionary words.
- [ ] Compare human scores with Perfect and assess whether Perfect feels plausible and useful.
- [ ] Observe whether two-letter words create interesting rescue plays or merely noise.
- [ ] Observe whether side/corner indicators make all three objectives understandable.
- [ ] Observe whether click-based path entry is comfortable on desktop and mobile.
- [ ] Record rule changes explicitly in `BeelineRules.md` and this roadmap before changing code.
- [ ] Prefer changing or deleting code over preserving an abstraction made obsolete by playtesting.

Completion criteria: there is concrete playtest evidence about whether Beeline is fun and which rules or generation choices need adjustment.

---

## Milestone 7: Measured Performance Work

Do not begin this milestone merely because optimization is imaginable.

- [ ] Review measurements captured during path enumeration, solving, generation, and rendering.
- [ ] Identify any delay that is actually noticeable or disruptive.
- [ ] Optimize only that demonstrated bottleneck.
- [ ] Re-run correctness tests after every solver or enumeration optimization.
- [ ] Confirm that optimizations do not change the generated daily puzzle for a fixed seed unless intentionally accepted.
- [ ] Document before-and-after measurements here.

Potential tools such as additional pruning, pre-generated verified puzzles, or a worker remain conditional on evidence. They are not approved architecture in advance.

Completion criteria: either the measured game already performs acceptably and no work is needed, or a specific bottleneck has been improved without changing the rules or exactness.

---

## Milestone 8: Visual Design, Accessibility, and Static Deployment

- [ ] Improve typography, spacing, board readability, and side-pair labeling.
- [ ] Refine active-network and completion feedback.
- [ ] Support narrow mobile screens and common desktop sizes.
- [ ] Verify keyboard operation, focus visibility, screen-reader labels, and reduced-motion behavior if motion is added.
- [ ] Add only those transitions or animations that make state changes easier to understand.
- [ ] Decide whether tutorial, answer reveal, persistence, and result sharing are worthwhile based on playtesting.
- [ ] Keep all asset and module paths compatible with a GitHub Pages project subdirectory.
- [ ] Add the smallest understandable GitHub Pages deployment workflow.
- [ ] Set the intended release value of `DAILY_MODE` with a one-line change.
- [ ] Build and test the deployed static site.

Completion criteria: the stable game is attractive, accessible, and deployed as a static site without a backend or unnecessary application framework.

---

## Explicit Non-Goals for the Initial Implementation

- No React, Vue, Svelte, or other frontend framework.
- No component library or CSS framework.
- No backend, database, accounts, or authentication.
- No generic hex-grid library.
- No general word-game engine or configurable rules framework.
- No generalized board-size or wildcard-policy system.
- No service layer, dependency injection, or state-management library.
- No approximate solver presented as Perfect.
- No speculative caching, worker, or puzzle-generation pipeline.
- No requirement to reproduce all of SpellSweep's final features.

---

## Next Work Session Starting Point

Begin with Milestone 4, then proceed directly to the minimal interface in Milestone 5:

1. Add `index.html`, `style.css`, and `src/main.ts` for the deliberately plain playable interface in Milestone 5.
2. Put the single `const DAILY_MODE = false` switch near the top of `src/main.ts` and pass it directly to `selectPuzzle`.
3. Load and index `dictionary.txt` once, generate one verified puzzle, retain its already-computed solution, and show a loading message while that work runs.
4. Render axial coordinates as 61 positioned hexagonal buttons and add the same simple click/tap path interaction that worked in SpellSweep.
5. Show active cells, selection order, wildcard input, score, Perfect, and the three connection statuses before adding any secondary feature.
6. Run the local static site and measure generation in the target browser to finish Milestone 4's remaining browser-specific items.

Do not begin with a tutorial, sharing, persistence, elaborate animation, branding, or deployment.
