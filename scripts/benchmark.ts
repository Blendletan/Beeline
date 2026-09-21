import { readFileSync } from "node:fs";
import { performance } from "node:perf_hooks";

import {
  createDictionaryIndex,
  createGame,
  enumerateWordPaths,
  generateCandidateBoard,
  generateVerifiedPuzzle,
  minimumConnectionSolution,
  parseDictionary,
  seededRandom,
  submitWord,
} from "../src/game.ts";

const benchmarkSeed =
  process.argv.find((argument) => !argument.startsWith("--") && argument !== process.argv[0] && argument !== process.argv[1]) ??
  "beeline-solver-benchmark-1";

function benchmarkBoard(): string[] {
  return [...generateCandidateBoard(seededRandom(benchmarkSeed))];
}

const dictionaryStart = performance.now();
const dictionary = createDictionaryIndex(
  parseDictionary(
    readFileSync(new URL("../cleanedDictionary.txt", import.meta.url), "utf8"),
  ),
);
const dictionaryMilliseconds = performance.now() - dictionaryStart;

if (process.argv.includes("--generation")) {
  const generationStart = performance.now();
  const puzzle = generateVerifiedPuzzle(
    dictionary,
    seededRandom(benchmarkSeed),
  );
  const generationMilliseconds = performance.now() - generationStart;
  let game = createGame(puzzle.board);
  for (const { word, path } of puzzle.solution) {
    const submission = submitWord(game, path, word, dictionary.words);
    if (!submission.accepted) {
      throw new Error(`Generated solution contains an invalid path for ${word}.`);
    }
    game = submission.state;
  }
  if (!game.completed) {
    throw new Error("Generated solution did not complete its puzzle.");
  }

  console.log({
    phase: "verified generation",
    seed: benchmarkSeed,
    dictionaryMilliseconds: Math.round(dictionaryMilliseconds),
    generationMilliseconds: Math.round(generationMilliseconds),
    attempts: puzzle.attempts,
    rawCandidateCount: puzzle.rawCandidateCount,
    reducedCandidateCount: puzzle.reducedCandidateCount,
    statesByDepth: puzzle.statesByDepth,
    perfect: puzzle.perfect,
    solution: puzzle.solution.map(({ word }) => word),
    verified: game.completed,
  });
  process.exit(0);
}

const board = benchmarkBoard();
const enumerationStart = performance.now();
const paths = enumerateWordPaths(board, dictionary);
const enumerationMilliseconds = performance.now() - enumerationStart;

console.log({
  phase: "enumeration",
  board: board.join(""),
  dictionaryWords: dictionary.words.size,
  dictionaryMilliseconds: Math.round(dictionaryMilliseconds),
  rawCandidateCount: paths.length,
  enumerationMilliseconds: Math.round(enumerationMilliseconds),
});

const solverStart = performance.now();
const result = minimumConnectionSolution(paths);
const solverMilliseconds = performance.now() - solverStart;

let verified = result.solution !== null;
if (result.solution) {
  let game = createGame(board);
  for (const { word, path } of result.solution) {
    const submission = submitWord(game, path, word, dictionary.words);
    if (!submission.accepted) {
      throw new Error(`Solver returned an invalid path for ${word}.`);
    }
    game = submission.state;
  }
  verified = game.completed;
  if (!verified) {
    throw new Error("Solver answer did not complete the puzzle.");
  }
}

console.log({
  phase: "solver",
  rawCandidateCount: result.rawCandidateCount,
  reducedCandidateCount: result.reducedCandidateCount,
  enumerationMilliseconds: Math.round(enumerationMilliseconds),
  solverMilliseconds: Math.round(solverMilliseconds),
  statesByDepth: result.statesByDepth,
  perfect: result.solution?.length ?? null,
  solution: result.solution?.map(({ word }) => word) ?? null,
  verified,
});
