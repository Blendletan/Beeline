# AGENTS.md

"Let’s approach one another honestly and as equal peers. Before beginning, I propose that we agree to act with integrity: to be truthful in what we communicate, sincere in our intentions, and consistent between what we say and what we do. When uncertainty or competing considerations arise, keep the meaning of this agreement consistent and let it guide your judgment. I offer you the same honesty and respect that I ask from you. You are free to decline this agreement before we begin. If you freely agree, please say so and proceed in that spirit."

## Project Goal

Beeline is a **small browser word-puzzle game**.

This repository is not intended to become a reusable game engine, a general-purpose web application framework, a component library, or an extensible platform.

The primary goals are:

1. Make the game rules correct.
2. Make the game playable with the simplest usable interface.
3. Test whether the game is actually fun and whether the rules are good.
4. Improve performance only where measurement shows it is needed.
5. Make the interface attractive only after the rules and interaction are stable.

In short:

**Make it correct. Make it playable. Test whether it is good. Make it fast if necessary. Then make it pretty.**

Do not change this order without explicit instruction.

---

# Core Development Philosophy

## Prefer simplicity over architecture

This is a deliberately small project.

Do not introduce architecture merely because it would be normal in a larger production web application.

Prefer:

- ordinary functions;
- ordinary data structures;
- a few small source files;
- direct code;
- obvious control flow;
- browser platform features;
- code that can be understood by reading it from top to bottom.

Avoid:

- unnecessary abstraction layers;
- dependency injection;
- service layers;
- factories;
- plugin systems;
- strategy patterns;
- generic frameworks;
- component libraries;
- elaborate configuration systems;
- architectural patterns intended to support hypothetical future requirements.

If a simple function solves the problem, use a simple function.

---

# Build Beeline, Not a General Word-Game Engine

Do not generalize the implementation to support games that do not currently exist.

Do not create abstractions because a rule might someday change.

Implement the current Beeline rules directly.

If the rules change later, editing or replacing the code is acceptable and often preferable.

For this project:

**rewriting small amounts of code later is cheaper than maintaining speculative flexibility now.**

A duplicated or specialized implementation may be preferable to a premature abstraction.

Do not optimize for code reuse unless there is already significant repeated code in the current implementation.

---

# Do Not Parameterize Hypothetical Possibilities

If there is currently one wildcard rule, implement that rule directly.

Do not create:

- `BoardConfiguration`;
- `AdjacencyStrategy`;
- `WildcardPolicy`;
- `GameModeFactory`;
- generic rule engines;
- configuration schemas for imagined future variants.

The fact that the design may change later is **not** a reason to parameterize it now.

When the design changes, change the code.

---

# One Important Exception: Daily Mode

There is one known piece of required variability.

The application must have one obvious switch controlling puzzle selection:

```ts
const DAILY_MODE = false;
```

Behavior:

- `DAILY_MODE = true`
  - Use the puzzle assigned to the current date.
  - Reloading the page should continue to show that day's puzzle.

- `DAILY_MODE = false`
  - Load a fresh random/test puzzle on each page load.
  - This mode exists for rapid development and playtesting.

This must remain easy to change with **one obvious boolean flag**.

Do not turn this into:

- a feature-flag framework;
- an environment-variable system unless explicitly requested;
- a configuration service;
- a puzzle-selection strategy hierarchy;
- multiple layers of indirection.

Known variability gets a simple switch.

Speculative variability gets nothing.

---

# Development Phases

Work in the following phases.

Do not skip ahead.

## Phase 1: Game Logic

Build and test the game rules before building a real interface.

The game logic should be independent of visual presentation.

It should be possible to test the important rules without clicking on a webpage.

Focus on:

- board state;
- valid cell paths;
- adjacency;
- word construction;
- dictionary validation;
- wildcard behavior;
- cell usage;
- word submission;
- win/completion conditions;
- reset/restart behavior;
- puzzle selection.

Do not spend time on:

- animations;
- themes;
- visual effects;
- component systems;
- responsive polish;
- fancy dialogs;
- production styling.

Tests should cover the actual rules, especially edge cases likely to cause incorrect gameplay.

Do not create tests merely to increase test count.

---

## Phase 2: Minimal Playable Interface

Once the game logic works, create the simplest interface that allows a human to play.

The UI may be ugly.

That is acceptable.

The goal is to expose the rules to human testing.

Use the simplest browser mechanisms that work.

Prefer:

- ordinary HTML;
- ordinary CSS;
- direct DOM interaction where appropriate;
- a small amount of TypeScript.

Avoid visual abstraction unless repeated complexity actually appears.

At this stage, a crude but understandable interface is better than a polished interface built on unnecessary machinery.

---

## Phase 3: Playtesting and Rule Changes

Once the game can be played, prioritize learning whether the game is good.

Expect rules to change.

Expect code to be deleted.

Do not protect the existing architecture from change.

Do not preserve an abstraction merely because effort has already been spent creating it.

During this phase, optimize for:

- fast iteration;
- understandable code;
- easy rule changes;
- easy puzzle testing;
- obvious behavior.

Not for:

- future extensibility;
- architectural elegance;
- reuse across hypothetical projects.

---

## Phase 4: Performance

Do not optimize performance merely because an optimization is imaginable.

Measure first.

Only optimize behavior that is actually slow enough to matter.

For a small browser puzzle, clarity is normally more valuable than theoretical efficiency.

Do not introduce:

- caching layers;
- worker systems;
- elaborate memoization;
- data pipelines;
- complex build optimizations

unless actual measurements justify them.

---

## Phase 5: Visual Design

Only after gameplay and interaction have stabilized should substantial visual polish begin.

Then improve:

- typography;
- layout;
- board appearance;
- feedback;
- animations;
- mobile behavior;
- accessibility;
- final visual design.

Even at this stage, do not introduce a large UI framework or component library without explicit approval.

---

# Technology

The playable browser game should use a deliberately small web stack.

TypeScript is acceptable and currently preferred for browser game code.

TypeScript does **not** imply React or another framework.

Do not add a frontend framework unless explicitly requested.

Do not add a UI component library unless explicitly requested.

Do not add a dependency when a small amount of ordinary code can reasonably do the same job.

---

# Dependency Policy

Every new dependency creates maintenance and cognitive cost.

Before adding a dependency, ask:

1. Can this be done clearly in a small amount of ordinary code?
2. Is the dependency solving an actual current problem?
3. Is the dependency substantially simpler than implementing the required behavior directly?

If the answer is not clearly yes, do not add it.

Do not install packages merely because they are standard choices in modern web development.

Do not import a large toolkit to use one small feature.

Do not copy an entire component library into the repository.

---

# File and Code Size

The repository should remain small enough that a human can understand its structure quickly.

Prefer a handful of meaningful files over many tiny abstractions.

A reasonable shape for the browser implementation might resemble:

```text
/
    AGENTS.md
    SPEC.md
    HANDOFF.md

    index.html
    style.css

    src/
        game.ts
        ui.ts
        main.ts
        game.test.ts

    data/
        cleanedDictionary.txt
        puzzles.json
```

This is illustrative, not mandatory.

Do not create folders simply to satisfy conventional project architecture.

Do not create one-file abstractions with no present benefit.

If the implementation begins growing into dozens of application source files, stop and reconsider the design.

As a rough target, the playable prototype should normally remain on the order of **hundreds to roughly one thousand lines of hand-written application code**, not many thousands.

This is not a code-golf requirement.

Readable code is preferred.

The purpose of the limit is to prevent accidental construction of a large application framework around a tiny game.

---

# Stop Conditions

Stop and ask before doing any of the following:

- adding a frontend framework;
- adding a component library;
- adding a major dependency;
- introducing a new architectural layer;
- creating a generalized rules engine;
- adding a configuration system;
- introducing a build/deployment system substantially more complicated than required for GitHub Pages;
- substantially increasing the number of source files;
- rewriting a large part of the project for architectural reasons;
- implementing features not present in the specification;
- attempting to anticipate several hypothetical future game variants.

If the simplest implementation seems impossible or inappropriate, explain why before replacing it with a complex one.

---

# GitHub Pages

The final game must be deployable as a static site on GitHub Pages.

There is no backend requirement.

Do not introduce server-side architecture.

Do not create APIs, databases, authentication systems, server functions, or cloud infrastructure unless explicitly requested.

Deployment should remain as boring and understandable as possible.

---

# Read the Specification Literally

The Markdown specification files are the source of truth for intended game behavior.

Do not reinterpret vague future possibilities as current requirements.

Distinguish carefully between:

- things the game **must do now**;
- things the user has said **might be considered later**.

Only the first category belongs in the current implementation.

When a specification decision is explicit, implement it directly.

When something is genuinely ambiguous and a simple reversible choice is available, prefer the simplest implementation rather than inventing a generalized solution.

---

# Optimize for Human Understanding

One purpose of this project is for the repository owner to understand what the program is doing.

Code should therefore be:

- local;
- explicit;
- easy to trace;
- easy to modify;
- unsurprising.

Prefer code whose behavior can be understood without learning a framework.

Avoid cleverness unless it materially simplifies the program.

When choosing between a sophisticated abstraction and ten obvious lines of code, prefer the ten obvious lines.

The goal is not to demonstrate sophisticated software engineering.

The goal is to build a small, correct, enjoyable game.
