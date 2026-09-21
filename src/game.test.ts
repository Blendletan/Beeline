import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  BOARD_RADIUS,
  HEX_COORDINATES,
  NEIGHBORS,
  SIDE_TILE_INDEXES,
  TILE_COUNT,
  WILDCARD_INDEX,
  areAdjacent,
  assertValidBoard,
  connectionStatus,
  createDictionaryIndex,
  createGame,
  enumerateWordPaths,
  findMinimumWordSolution,
  generateCandidateBoard,
  generateVerifiedPuzzle,
  isSolvableBoard,
  isValidPath,
  isValidWord,
  localDateKey,
  minimumConnectionSolution,
  parseDictionary,
  seededRandom,
  selectPuzzle,
  submitWord,
  tileIndexAt,
  type WordPath,
} from "./game.ts";

function indexAt(q: number, r: number): number {
  const index = tileIndexAt(q, r);
  assert.notEqual(index, undefined, `Expected a tile at (${q}, ${r}).`);
  return index as number;
}

function boardWith(
  overrides: Readonly<Record<number, string>> = {},
): string[] {
  const board = Array(TILE_COUNT).fill("z");
  board[WILDCARD_INDEX] = "?";

  for (const [index, letter] of Object.entries(overrides)) {
    board[Number(index)] = letter;
  }
  return board;
}

function pathFromCoordinates(
  coordinates: readonly (readonly [number, number])[],
): number[] {
  return coordinates.map(([q, r]) => indexAt(q, r));
}

function qDiameter(): number[] {
  return Array.from({ length: 9 }, (_, offset) =>
    indexAt(offset - BOARD_RADIUS, 0),
  );
}

function rDiameter(): number[] {
  return Array.from({ length: 9 }, (_, offset) =>
    indexAt(0, offset - BOARD_RADIUS),
  );
}

function perimeterPath(): number[] {
  const coordinates: [number, number][] = [[0, -4]];
  const directions: readonly (readonly [number, number])[] = [
    [1, 0],
    [0, 1],
    [-1, 1],
    [-1, 0],
    [0, -1],
    [1, -1],
  ];
  let q = 0;
  let r = -4;

  directions.forEach(([dq, dr], directionIndex) => {
    const steps = directionIndex === directions.length - 1 ? 3 : 4;
    for (let step = 0; step < steps; step += 1) {
      q += dq;
      r += dr;
      coordinates.push([q, r]);
    }
  });

  return pathFromCoordinates(coordinates);
}

function twoLineBoard(): {
  board: string[];
  firstPath: number[];
  secondPath: number[];
} {
  const board = boardWith();
  const firstPath = qDiameter();
  const secondPath = rDiameter();

  for (const index of firstPath) {
    board[index] = "a";
  }
  for (const index of secondPath) {
    board[index] = "b";
  }
  board[WILDCARD_INDEX] = "?";

  return { board, firstPath, secondPath };
}

test("the radius-4 axial board contains 61 unique coordinates", () => {
  assert.equal(TILE_COUNT, 61);
  assert.equal(HEX_COORDINATES.length, 61);
  assert.equal(
    new Set(HEX_COORDINATES.map(({ q, r }) => `${q},${r}`)).size,
    61,
  );
  assert.deepEqual(HEX_COORDINATES[WILDCARD_INDEX], { q: 0, r: 0, s: 0 });

  for (const { q, r, s } of HEX_COORDINATES) {
    assert.equal(q + r + s, 0);
    assert.ok(Math.max(Math.abs(q), Math.abs(r), Math.abs(s)) <= 4);
  }
});

test("center, edge, and corner tiles have the expected neighbors", () => {
  assert.equal(NEIGHBORS[WILDCARD_INDEX].length, 6);
  assert.equal(NEIGHBORS[indexAt(-4, 2)].length, 4);
  assert.equal(NEIGHBORS[indexAt(-4, 0)].length, 3);

  for (const [tileIndex, neighbors] of NEIGHBORS.entries()) {
    for (const neighbor of neighbors) {
      assert.equal(NEIGHBORS[neighbor].includes(tileIndex), true);
      assert.notEqual(neighbor, tileIndex);
    }
  }
});

test("each side has five tiles and corners belong to two sides", () => {
  assert.deepEqual(SIDE_TILE_INDEXES.map((side) => side.length), [5, 5, 5, 5, 5, 5]);

  const corner = indexAt(-4, 0);
  const memberships = SIDE_TILE_INDEXES.flatMap((side, sideIndex) =>
    side.includes(corner) ? [sideIndex] : [],
  );
  assert.deepEqual(memberships, [0, 5]);
});

test("paths use the six hex directions without jumps or repeated tiles", () => {
  const center = WILDCARD_INDEX;
  const neighbors = NEIGHBORS[center];
  assert.equal(neighbors.every((neighbor) => areAdjacent(center, neighbor)), true);
  assert.equal(isValidPath([neighbors[0], center, neighbors[3]]), true);
  assert.equal(isValidPath([center, indexAt(2, 0)]), false);
  assert.equal(isValidPath([center, neighbors[0], center]), false);
  assert.equal(isValidPath([center, TILE_COUNT]), false);
});

test("a board requires 61 letters and a center wildcard", () => {
  assert.doesNotThrow(() => assertValidBoard(boardWith()));
  assert.throws(() => assertValidBoard(boardWith().slice(0, -1)));
  assert.throws(() => assertValidBoard(boardWith({ [WILDCARD_INDEX]: "a" })));
  assert.throws(() => assertValidBoard(boardWith({ 0: "zz" })));
});

test("dictionary parsing allows two-letter words and rejects one-letter entries", () => {
  assert.deepEqual(
    [...parseDictionary("At\r\nA\n bee \ncan't\nBEE\n")],
    ["at", "bee"],
  );

  const dictionary = parseDictionary(
    readFileSync(new URL("../cleanedDictionary.txt", import.meta.url), "utf8"),
  );
  assert.equal(dictionary.size, 64_342);
  assert.equal(dictionary.has("aah"), true);
});

test("two-letter words are valid and the wildcard can change between words", () => {
  const path = pathFromCoordinates([
    [-1, 0],
    [0, 0],
    [1, 0],
  ]);
  const board = boardWith({ [path[0]]: "c", [path[2]]: "t" });
  const dictionary = new Set(["cat", "cot", "cut", "at", "a"]);

  assert.equal(isValidWord(board, path, "cat", dictionary), true);
  assert.equal(isValidWord(board, path, "cot", dictionary), true);
  assert.equal(isValidWord(board, path, "cut", dictionary), true);
  assert.equal(isValidWord(board, path.slice(1), "at", dictionary), true);
  assert.equal(isValidWord(board, [path[1]], "a", dictionary), false);
});

test("invalid submissions have no effect and repeated valid words still count", () => {
  const path = pathFromCoordinates([
    [-2, 0],
    [-1, 0],
  ]);
  const board = boardWith({ [path[0]]: "a", [path[1]]: "t" });
  const game = createGame(board);
  const invalid = submitWord(game, path, "an", new Set(["at"]));

  assert.equal(invalid.accepted, false);
  assert.equal(invalid.state, game);

  const first = submitWord(game, path, "at", new Set(["at"]));
  const repeated = submitWord(first.state, path, "at", new Set(["at"]));
  assert.equal(first.accepted, true);
  assert.equal(first.state.wordsUsed, 1);
  assert.equal(first.state.completed, false);
  assert.deepEqual(
    first.state.active.flatMap((isActive, index) => (isActive ? [index] : [])),
    path,
  );
  assert.equal(repeated.accepted, true);
  assert.equal(repeated.state.wordsUsed, 2);
  assert.equal(repeated.state.completed, false);
  assert.deepEqual(repeated.state.active, first.state.active);
});

test("a diameter connects two side pairs because its endpoints are corners", () => {
  const active = Array(TILE_COUNT).fill(false) as boolean[];
  for (const index of qDiameter()) {
    active[index] = true;
  }

  assert.deepEqual(connectionStatus(active), [true, false, true]);
});

test("accepted words combine and complete after any opposite-side pair connects", () => {
  const diameter = qDiameter();
  const firstPath = diameter.slice(0, 5);
  const secondPath = diameter.slice(4);
  const board = boardWith(
    Object.fromEntries([
      ...firstPath.map((index) => [index, "a"]),
      ...secondPath.map((index) => [index, "b"]),
      [WILDCARD_INDEX, "?"],
    ]),
  );
  const dictionary = new Set(["aaaaa", "bbbbb"]);
  const first = submitWord(createGame(board), firstPath, "aaaaa", dictionary);
  const second = submitWord(first.state, secondPath, "bbbbb", dictionary);

  assert.equal(first.accepted, true);
  assert.deepEqual(first.state.connections, [false, false, false]);
  assert.equal(first.state.completed, false);
  assert.equal(second.accepted, true);
  assert.deepEqual(second.state.connections, [true, false, true]);
  assert.equal(second.state.completed, true);
  assert.equal(second.state.wordsUsed, 2);

  const afterCompletion = submitWord(
    second.state,
    firstPath,
    "aaaaa",
    dictionary,
  );
  assert.equal(afterCompletion.accepted, false);
  assert.equal(afterCompletion.state, second.state);
});

test("word enumeration follows wildcard interpretations and legal paths", () => {
  const path = pathFromCoordinates([
    [-1, 0],
    [0, 0],
    [1, 0],
  ]);
  const board = boardWith({ [path[0]]: "c", [path[2]]: "t" });
  const dictionary = createDictionaryIndex(new Set(["cat", "cot", "cut"]));
  const paths = enumerateWordPaths(board, dictionary);

  assert.deepEqual(new Set(paths.map(({ word }) => word)), new Set(["cat", "cot", "cut"]));
  assert.equal(paths.every(({ path: foundPath }) => isValidPath(foundPath)), true);
});

test("the exact solver finds a one-word perimeter solution", () => {
  const path = perimeterPath();
  const board = boardWith(
    Object.fromEntries(path.map((index) => [index, "a"])),
  );
  const word = "a".repeat(path.length);
  const dictionary = createDictionaryIndex(new Set([word]));
  const result = findMinimumWordSolution(board, dictionary);

  assert.equal(path.length, 24);
  assert.equal(isValidPath(path), true);
  assert.equal(result.solution?.length, 1);
  assert.equal(result.reducedCandidateCount, 1);
  assert.equal(isValidWord(board, result.solution![0].path, word, dictionary.words), true);
});

test("the exact solver finds and verifies a one-pair crossing solution", () => {
  const { board } = twoLineBoard();
  const dictionary = createDictionaryIndex(
    new Set(["aaaaaaaaa", "bbbbbbbbb"]),
  );
  const result = findMinimumWordSolution(board, dictionary);

  assert.equal(result.solution?.length, 1);
  let game = createGame(board);
  for (const { word, path } of result.solution ?? []) {
    assert.equal(isValidWord(board, path, word, dictionary.words), true);
    const submission = submitWord(game, path, word, dictionary.words);
    assert.equal(submission.accepted, true);
    game = submission.state;
  }
  assert.equal(game.completed, true);
  assert.equal(game.wordsUsed, 1);
});

test("the solver reports a board whose playable union cannot win as unsolvable", () => {
  const board = boardWith();
  const dictionary = createDictionaryIndex(new Set(["aa"]));

  assert.equal(isSolvableBoard(board, dictionary), false);
  assert.equal(findMinimumWordSolution(board, dictionary).solution, null);
});

test("minimum search deterministically chooses one winning pair and ignores a decoy", () => {
  const first: WordPath = { word: "alpha", path: qDiameter() };
  const second: WordPath = { word: "beta", path: rDiameter() };
  const interior = HEX_COORDINATES.flatMap(({ q, r, s }, index) =>
    Math.max(Math.abs(q), Math.abs(r), Math.abs(s)) <= 2 ? [index] : [],
  );
  const decoy: WordPath = { word: "decoy", path: interior };

  const forward = minimumConnectionSolution([decoy, second, first]);
  const reverse = minimumConnectionSolution([first, second, decoy]);
  const winningTiles = new Set(first.path);

  assert.deepEqual(forward.solution, [first]);
  assert.deepEqual(reverse.solution, forward.solution);
  assert.equal(forward.solution?.includes(decoy), false);
  assert.deepEqual(
    connectionStatus(
      Array.from({ length: TILE_COUNT }, (_, index) => winningTiles.has(index)),
    ),
    [true, false, true],
  );
});

test("candidate boards use weighted letters and always center the wildcard", () => {
  const lowest = generateCandidateBoard(() => 0);
  const highest = generateCandidateBoard(() => 0.999999);

  assert.equal(lowest[WILDCARD_INDEX], "?");
  assert.equal(highest[WILDCARD_INDEX], "?");
  assert.equal(lowest.filter((tile) => tile === "?").length, 1);
  assert.equal(
    lowest.every((tile, index) => index === WILDCARD_INDEX || tile === "a"),
    true,
  );
  assert.equal(
    highest.every((tile, index) => index === WILDCARD_INDEX || tile === "z"),
    true,
  );
});

test("verified generation rejects an impossible candidate before solving", () => {
  const { board: solvableBoard } = twoLineBoard();
  const firstBoardValues = Array(TILE_COUNT - 1).fill(0.999999);
  const secondBoardValues = solvableBoard.flatMap((letter, index) => {
    if (index === WILDCARD_INDEX) {
      return [];
    }
    return [letter === "a" ? 0 : letter === "b" ? 0.09 : 0.999999];
  });
  const values = [...firstBoardValues, ...secondBoardValues];
  let valueIndex = 0;
  const dictionary = createDictionaryIndex(
    new Set(["aaaaaaaaa", "bbbbbbbbb"]),
  );
  const puzzle = generateVerifiedPuzzle(
    dictionary,
    () => values[valueIndex++] ?? 0.999999,
  );

  assert.equal(puzzle.attempts, 2);
  assert.deepEqual(puzzle.board, solvableBoard);
  assert.equal(puzzle.perfect, 1);
  assert.equal(puzzle.solution.length, 1);
});

test("seeded random values and daily puzzle selection are reproducible", () => {
  const firstRandom = seededRandom("2026-09-18");
  const secondRandom = seededRandom("2026-09-18");
  assert.deepEqual(
    [firstRandom(), firstRandom(), firstRandom()],
    [secondRandom(), secondRandom(), secondRandom()],
  );

  const date = new Date(2026, 8, 18, 23, 59, 59);
  assert.equal(localDateKey(date), "2026-09-18");
  const expectedBoard = generateCandidateBoard(
    seededRandom(localDateKey(date)),
  );
  const perimeterWord = perimeterPath()
    .map((index) => expectedBoard[index])
    .join("");
  const dictionary = createDictionaryIndex(new Set([perimeterWord]));
  const firstPuzzle = selectPuzzle(dictionary, true, date);
  const secondPuzzle = selectPuzzle(dictionary, true, date);

  assert.deepEqual(firstPuzzle.board, expectedBoard);
  assert.deepEqual(secondPuzzle, firstPuzzle);
  assert.equal(firstPuzzle.perfect, 1);
});

test("development selection honors its supplied fresh random source", () => {
  const firstBoard = generateCandidateBoard(seededRandom("development-one"));
  const secondBoard = generateCandidateBoard(seededRandom("development-two"));
  const ring = perimeterPath();
  const dictionary = createDictionaryIndex(
    new Set([
      ring.map((index) => firstBoard[index]).join(""),
      ring.map((index) => secondBoard[index]).join(""),
    ]),
  );
  const date = new Date(2026, 8, 18, 12);
  const firstPuzzle = selectPuzzle(
    dictionary,
    false,
    date,
    seededRandom("development-one"),
  );
  const secondPuzzle = selectPuzzle(
    dictionary,
    false,
    date,
    seededRandom("development-two"),
  );

  assert.notDeepEqual(firstPuzzle.board, secondPuzzle.board);
  assert.deepEqual(firstPuzzle.board, firstBoard);
  assert.deepEqual(secondPuzzle.board, secondBoard);
  assert.equal(firstPuzzle.perfect, 1);
  assert.equal(secondPuzzle.perfect, 1);
});
