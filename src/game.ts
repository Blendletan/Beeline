export const SIDE_LENGTH = 5;
export const BOARD_RADIUS = SIDE_LENGTH - 1;
export const TILE_COUNT = 1 + 3 * BOARD_RADIUS * (BOARD_RADIUS + 1);
export const WILDCARD = "?";

export type HexCoordinate = Readonly<{
  q: number;
  r: number;
  s: number;
}>;

export type Board = readonly string[];

export type ConnectionStatus = readonly [boolean, boolean, boolean];

export type GameState = Readonly<{
  board: Board;
  active: readonly boolean[];
  wordsUsed: number;
  connections: ConnectionStatus;
  completed: boolean;
}>;

export type Submission = Readonly<{
  accepted: boolean;
  state: GameState;
}>;

export type DictionaryIndex = Readonly<{
  words: ReadonlySet<string>;
  prefixes: ReadonlySet<string>;
  maxWordLength: number;
}>;

export type WordPath = Readonly<{
  word: string;
  path: readonly number[];
}>;

export type SolverResult = Readonly<{
  solution: readonly WordPath[] | null;
  rawCandidateCount: number;
  reducedCandidateCount: number;
  statesByDepth: readonly number[];
}>;

export type GeneratedPuzzle = Readonly<{
  board: Board;
  solution: readonly WordPath[];
  perfect: number;
  attempts: number;
  rawCandidateCount: number;
  reducedCandidateCount: number;
  statesByDepth: readonly number[];
}>;

export type RandomSource = () => number;

type WordCandidate = Readonly<{
  word: string;
  path: readonly number[];
  mask: bigint;
  key: string;
  size: number;
  sideTouches: number;
  completedConnections: number;
}>;

const ALPHABET = "abcdefghijklmnopqrstuvwxyz";
const LETTER_FREQUENCIES: readonly (readonly [string, number])[] = [
  ["a", 8.167],
  ["b", 1.492],
  ["c", 2.782],
  ["d", 4.253],
  ["e", 12.702],
  ["f", 2.228],
  ["g", 2.015],
  ["h", 6.094],
  ["i", 6.966],
  ["j", 0.153],
  ["k", 0.772],
  ["l", 4.025],
  ["m", 2.406],
  ["n", 6.749],
  ["o", 7.507],
  ["p", 1.929],
  ["q", 0.095],
  ["r", 5.987],
  ["s", 6.327],
  ["t", 9.056],
  ["u", 2.758],
  ["v", 0.978],
  ["w", 2.36],
  ["x", 0.15],
  ["y", 1.974],
  ["z", 0.074],
];
const TOTAL_LETTER_WEIGHT = LETTER_FREQUENCIES.reduce(
  (total, [, weight]) => total + weight,
  0,
);

export const HEX_DIRECTIONS: readonly HexCoordinate[] = [
  { q: 1, r: 0, s: -1 },
  { q: 1, r: -1, s: 0 },
  { q: 0, r: -1, s: 1 },
  { q: -1, r: 0, s: 1 },
  { q: -1, r: 1, s: 0 },
  { q: 0, r: 1, s: -1 },
];

export const HEX_COORDINATES: readonly HexCoordinate[] = createCoordinates();

const TILE_INDEX_BY_COORDINATE = new Map(
  HEX_COORDINATES.map(({ q, r }, index) => [coordinateKey(q, r), index]),
);

export const WILDCARD_INDEX = requiredTileIndex(0, 0);

// Sides are ordered q-, q+, r-, r+, s-, s+.
export const SIDE_TILE_INDEXES: readonly (readonly number[])[] = [
  sideIndexes((coordinate) => coordinate.q === -BOARD_RADIUS),
  sideIndexes((coordinate) => coordinate.q === BOARD_RADIUS),
  sideIndexes((coordinate) => coordinate.r === -BOARD_RADIUS),
  sideIndexes((coordinate) => coordinate.r === BOARD_RADIUS),
  sideIndexes((coordinate) => coordinate.s === -BOARD_RADIUS),
  sideIndexes((coordinate) => coordinate.s === BOARD_RADIUS),
];

export const OPPOSITE_SIDE_PAIRS: readonly (readonly [number, number])[] = [
  [0, 1],
  [2, 3],
  [4, 5],
];

const SIDE_MASKS: readonly bigint[] = SIDE_TILE_INDEXES.map(maskFromIndexes);

export const NEIGHBORS: readonly (readonly number[])[] = HEX_COORDINATES.map(
  ({ q, r }) =>
    HEX_DIRECTIONS.flatMap((direction) => {
      const neighbor = tileIndexAt(q + direction.q, r + direction.r);
      return neighbor === undefined ? [] : [neighbor];
    }),
);

if (HEX_COORDINATES.length !== TILE_COUNT) {
  throw new Error(`Expected ${TILE_COUNT} hex coordinates.`);
}

export function tileIndexAt(q: number, r: number): number | undefined {
  return TILE_INDEX_BY_COORDINATE.get(coordinateKey(q, r));
}

export function areAdjacent(firstIndex: number, secondIndex: number): boolean {
  return (
    isTileIndex(firstIndex) &&
    isTileIndex(secondIndex) &&
    NEIGHBORS[firstIndex].includes(secondIndex)
  );
}

export function isValidPath(path: readonly number[]): boolean {
  const visited = new Set<number>();

  for (let pathIndex = 0; pathIndex < path.length; pathIndex += 1) {
    const tileIndex = path[pathIndex];
    if (!isTileIndex(tileIndex) || visited.has(tileIndex)) {
      return false;
    }

    if (pathIndex > 0 && !areAdjacent(path[pathIndex - 1], tileIndex)) {
      return false;
    }

    visited.add(tileIndex);
  }

  return true;
}

export function assertValidBoard(board: Board): void {
  if (board.length !== TILE_COUNT) {
    throw new Error(`A Beeline board must contain ${TILE_COUNT} tiles.`);
  }

  for (let index = 0; index < board.length; index += 1) {
    const tile = board[index];
    if (index === WILDCARD_INDEX) {
      if (tile !== WILDCARD) {
        throw new Error("The center tile must be the wildcard.");
      }
    } else if (!/^[a-z]$/.test(tile)) {
      throw new Error("Every non-center tile must be one lowercase letter.");
    }
  }
}

export function createGame(board: Board): GameState {
  assertValidBoard(board);

  return {
    board: [...board],
    active: Array(TILE_COUNT).fill(false),
    wordsUsed: 0,
    connections: [false, false, false],
    completed: false,
  };
}

export function parseDictionary(text: string): Set<string> {
  return new Set(
    text
      .split(/\r?\n/)
      .map((word) => word.trim().toLowerCase())
      .filter((word) => word.length >= 2 && /^[a-z]+$/.test(word)),
  );
}

export function createDictionaryIndex(
  sourceWords: ReadonlySet<string>,
): DictionaryIndex {
  const words = new Set<string>();
  const prefixes = new Set<string>();
  let maxWordLength = 0;

  for (const sourceWord of sourceWords) {
    const word = sourceWord.trim().toLowerCase();
    if (word.length < 2 || !/^[a-z]+$/.test(word)) {
      continue;
    }

    words.add(word);
    maxWordLength = Math.max(maxWordLength, word.length);
    for (let length = 1; length <= word.length; length += 1) {
      prefixes.add(word.slice(0, length));
    }
  }

  return { words, prefixes, maxWordLength };
}

export function pathPattern(board: Board, path: readonly number[]): string {
  if (!isValidPath(path)) {
    throw new Error("Cannot form a word from an invalid path.");
  }

  return path.map((tileIndex) => board[tileIndex]).join("");
}

export function wordMatchesPath(
  board: Board,
  path: readonly number[],
  submittedWord: string,
): boolean {
  if (path.length < 2 || !isValidPath(path)) {
    return false;
  }

  const word = submittedWord.trim().toLowerCase();
  if (word.length !== path.length || !/^[a-z]+$/.test(word)) {
    return false;
  }

  return path.every((tileIndex, wordIndex) => {
    const tile = board[tileIndex];
    return tile === WILDCARD || tile === word[wordIndex];
  });
}

export function isValidWord(
  board: Board,
  path: readonly number[],
  submittedWord: string,
  dictionary: ReadonlySet<string>,
): boolean {
  const word = submittedWord.trim().toLowerCase();
  return dictionary.has(word) && wordMatchesPath(board, path, word);
}

export function submitWord(
  state: GameState,
  path: readonly number[],
  submittedWord: string,
  dictionary: ReadonlySet<string>,
): Submission {
  if (
    state.completed ||
    !isValidWord(state.board, path, submittedWord, dictionary)
  ) {
    return { accepted: false, state };
  }

  const active = [...state.active];
  for (const tileIndex of path) {
    active[tileIndex] = true;
  }

  const connections = connectionStatus(active);
  return {
    accepted: true,
    state: {
      ...state,
      active,
      wordsUsed: state.wordsUsed + 1,
      connections,
      completed: connections.some(Boolean),
    },
  };
}

export function activeMask(active: readonly boolean[]): bigint {
  if (active.length !== TILE_COUNT) {
    throw new Error(`Active state must contain ${TILE_COUNT} entries.`);
  }

  let mask = 0n;
  for (let index = 0; index < active.length; index += 1) {
    if (active[index]) {
      mask |= tileBit(index);
    }
  }
  return mask;
}

export function connectionStatus(
  active: readonly boolean[],
): ConnectionStatus {
  return connectionStatusForMask(activeMask(active));
}

export function connectionStatusForMask(mask: bigint): ConnectionStatus {
  return [
    sidesAreConnected(mask, 0, 1),
    sidesAreConnected(mask, 2, 3),
    sidesAreConnected(mask, 4, 5),
  ];
}

export function isWinningMask(mask: bigint): boolean {
  return connectionStatusForMask(mask).some(Boolean);
}

export function visitValidWordPaths(
  board: Board,
  dictionary: DictionaryIndex,
  visit: (wordPath: WordPath) => void,
): void {
  assertValidBoard(board);

  if (dictionary.maxWordLength < 2) {
    return;
  }

  const path: number[] = [];

  function search(tileIndex: number, prefix: string, visited: bigint): void {
    const nextVisited = visited | tileBit(tileIndex);
    path.push(tileIndex);

    const tile = board[tileIndex];
    const possibleLetters = tile === WILDCARD ? ALPHABET : tile;

    for (const letter of possibleLetters) {
      const nextPrefix = prefix + letter;
      if (!dictionary.prefixes.has(nextPrefix)) {
        continue;
      }

      if (nextPrefix.length >= 2 && dictionary.words.has(nextPrefix)) {
        visit({ word: nextPrefix, path: [...path] });
      }

      if (
        nextPrefix.length < dictionary.maxWordLength &&
        path.length < TILE_COUNT
      ) {
        for (const neighbor of NEIGHBORS[tileIndex]) {
          if ((nextVisited & tileBit(neighbor)) === 0n) {
            search(neighbor, nextPrefix, nextVisited);
          }
        }
      }
    }

    path.pop();
  }

  for (let tileIndex = 0; tileIndex < TILE_COUNT; tileIndex += 1) {
    search(tileIndex, "", 0n);
  }
}

export function enumerateWordPaths(
  board: Board,
  dictionary: DictionaryIndex,
): readonly WordPath[] {
  const paths: WordPath[] = [];
  visitValidWordPaths(board, dictionary, (wordPath) => paths.push(wordPath));
  return paths;
}

export function playableMask(
  board: Board,
  dictionary: DictionaryIndex,
): bigint {
  let mask = 0n;
  visitValidWordPaths(board, dictionary, ({ path }) => {
    mask |= maskFromIndexes(path);
  });
  return mask;
}

export function isSolvableBoard(
  board: Board,
  dictionary: DictionaryIndex,
): boolean {
  return isWinningMask(playableMask(board, dictionary));
}

export function findMinimumWordSolution(
  board: Board,
  dictionary: DictionaryIndex,
): SolverResult {
  return minimumConnectionSolution(enumerateWordPaths(board, dictionary));
}

export function minimumConnectionSolution(
  wordPaths: readonly WordPath[],
): SolverResult {
  const candidates = reduceCandidates(wordPaths);
  const allCandidateMask = candidates.reduce(
    (mask, candidate) => mask | candidate.mask,
    0n,
  );
  const statesByDepth = [1];

  if (!isWinningMask(allCandidateMask)) {
    return {
      solution: null,
      rawCandidateCount: wordPaths.length,
      reducedCandidateCount: candidates.length,
      statesByDepth,
    };
  }

  const suffixUnion = Array(candidates.length + 1).fill(0n) as bigint[];
  for (let index = candidates.length - 1; index >= 0; index -= 1) {
    suffixUnion[index] = suffixUnion[index + 1] | candidates[index].mask;
  }

  for (let targetDepth = 1; targetDepth <= candidates.length; targetDepth += 1) {
    let examinedStates = 0;
    const chosen: WordCandidate[] = [];

    function search(
      startIndex: number,
      remainingWords: number,
      mask: bigint,
    ): readonly WordCandidate[] | null {
      if (!isWinningMask(mask | suffixUnion[startIndex])) {
        return null;
      }

      const finalStartIndex = candidates.length - remainingWords;
      for (
        let candidateIndex = startIndex;
        candidateIndex <= finalStartIndex;
        candidateIndex += 1
      ) {
        const candidate = candidates[candidateIndex];
        const nextMask = mask | candidate.mask;
        if (nextMask === mask) {
          continue;
        }

        examinedStates += 1;
        chosen.push(candidate);

        if (remainingWords === 1) {
          if (isWinningMask(nextMask)) {
            return [...chosen];
          }
        } else {
          const solution = search(
            candidateIndex + 1,
            remainingWords - 1,
            nextMask,
          );
          if (solution) {
            return solution;
          }
        }

        chosen.pop();
      }

      return null;
    }

    const solution = search(0, targetDepth, 0n);
    statesByDepth.push(examinedStates);
    if (solution) {
      return {
        solution: solution.map(({ word, path }) => ({ word, path })),
        rawCandidateCount: wordPaths.length,
        reducedCandidateCount: candidates.length,
        statesByDepth,
      };
    }
  }

  throw new Error("A solvable candidate union produced no finite solution.");
}

export function generateCandidateBoard(
  random: RandomSource = Math.random,
): Board {
  return Array.from({ length: TILE_COUNT }, (_, index) =>
    index === WILDCARD_INDEX ? WILDCARD : randomLetter(random),
  );
}

export function generateVerifiedPuzzle(
  dictionary: DictionaryIndex,
  random: RandomSource = Math.random,
): GeneratedPuzzle {
  let attempts = 0;

  while (true) {
    attempts += 1;
    const board = generateCandidateBoard(random);
    const wordPaths = enumerateWordPaths(board, dictionary);
    const allCandidateMask = wordPaths.reduce(
      (mask, { path }) => mask | maskFromIndexes(path),
      0n,
    );

    if (!isWinningMask(allCandidateMask)) {
      continue;
    }

    const result = minimumConnectionSolution(wordPaths);
    if (!result.solution) {
      throw new Error("A board passed the solvability check without a solution.");
    }

    return {
      board,
      solution: result.solution,
      perfect: result.solution.length,
      attempts,
      rawCandidateCount: result.rawCandidateCount,
      reducedCandidateCount: result.reducedCandidateCount,
      statesByDepth: result.statesByDepth,
    };
  }
}

export function localDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function seededRandom(seedText: string): RandomSource {
  let seed = 2166136261;
  for (let index = 0; index < seedText.length; index += 1) {
    seed ^= seedText.charCodeAt(index);
    seed = Math.imul(seed, 16777619);
  }

  return () => {
    seed += 0x6d2b79f5;
    let value = seed;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function selectPuzzle(
  dictionary: DictionaryIndex,
  dailyMode: boolean,
  now = new Date(),
  random: RandomSource = Math.random,
): GeneratedPuzzle {
  return generateVerifiedPuzzle(
    dictionary,
    dailyMode ? seededRandom(localDateKey(now)) : random,
  );
}

function createCoordinates(): HexCoordinate[] {
  const coordinates: HexCoordinate[] = [];

  for (let q = -BOARD_RADIUS; q <= BOARD_RADIUS; q += 1) {
    const minimumR = Math.max(-BOARD_RADIUS, -q - BOARD_RADIUS);
    const maximumR = Math.min(BOARD_RADIUS, -q + BOARD_RADIUS);
    for (let r = minimumR; r <= maximumR; r += 1) {
      const derivedS = -q - r;
      coordinates.push({ q, r, s: derivedS === 0 ? 0 : derivedS });
    }
  }

  return coordinates;
}

function coordinateKey(q: number, r: number): string {
  return `${q},${r}`;
}

function requiredTileIndex(q: number, r: number): number {
  const index = tileIndexAt(q, r);
  if (index === undefined) {
    throw new Error(`Missing required tile at (${q}, ${r}).`);
  }
  return index;
}

function sideIndexes(
  belongsToSide: (coordinate: HexCoordinate) => boolean,
): number[] {
  return HEX_COORDINATES.flatMap((coordinate, index) =>
    belongsToSide(coordinate) ? [index] : [],
  );
}

function isTileIndex(index: number): boolean {
  return Number.isInteger(index) && index >= 0 && index < TILE_COUNT;
}

function tileBit(index: number): bigint {
  return 1n << BigInt(index);
}

function maskFromIndexes(indexes: readonly number[]): bigint {
  let mask = 0n;
  for (const index of indexes) {
    if (!isTileIndex(index)) {
      throw new Error(`Invalid tile index ${index}.`);
    }
    mask |= tileBit(index);
  }
  return mask;
}

function sidesAreConnected(
  active: bigint,
  firstSide: number,
  secondSide: number,
): boolean {
  const startMask = active & SIDE_MASKS[firstSide];
  const targetMask = active & SIDE_MASKS[secondSide];
  if (startMask === 0n || targetMask === 0n) {
    return false;
  }

  const pending = SIDE_TILE_INDEXES[firstSide].filter(
    (index) => (startMask & tileBit(index)) !== 0n,
  );
  let visited = startMask;

  while (pending.length > 0) {
    const tileIndex = pending.pop();
    if (tileIndex === undefined) {
      break;
    }
    if ((targetMask & tileBit(tileIndex)) !== 0n) {
      return true;
    }

    for (const neighbor of NEIGHBORS[tileIndex]) {
      const bit = tileBit(neighbor);
      if ((active & bit) !== 0n && (visited & bit) === 0n) {
        visited |= bit;
        pending.push(neighbor);
      }
    }
  }

  return false;
}

function reduceCandidates(wordPaths: readonly WordPath[]): WordCandidate[] {
  const candidateByMask = new Map<bigint, WordCandidate>();

  for (const wordPath of wordPaths) {
    const mask = maskFromIndexes(wordPath.path);
    const key = wordPathKey(wordPath);
    const candidate = {
      word: wordPath.word,
      path: [...wordPath.path],
      mask,
      key,
      size: bitCount(mask),
      sideTouches: SIDE_MASKS.filter((sideMask) => (mask & sideMask) !== 0n).length,
      completedConnections: connectionStatusForMask(mask).filter(Boolean).length,
    };
    const existing = candidateByMask.get(mask);
    if (!existing || key < existing.key) {
      candidateByMask.set(mask, candidate);
    }
  }

  const largestFirst = [...candidateByMask.values()].sort((first, second) => {
    const sizeDifference = second.size - first.size;
    return sizeDifference || first.key.localeCompare(second.key);
  });
  const nondominated: WordCandidate[] = [];

  for (const candidate of largestFirst) {
    const isSubset = nondominated.some(
      (kept) => (kept.mask & candidate.mask) === candidate.mask,
    );
    if (!isSubset) {
      nondominated.push(candidate);
    }
  }

  return nondominated.sort((first, second) =>
    second.completedConnections - first.completedConnections ||
    second.sideTouches - first.sideTouches ||
    second.size - first.size ||
    first.key.localeCompare(second.key),
  );
}

function wordPathKey({ word, path }: WordPath): string {
  return `${word}|${path
    .map((tileIndex) => String(tileIndex).padStart(2, "0"))
    .join(",")}`;
}

function bitCount(mask: bigint): number {
  let remaining = mask;
  let count = 0;
  while (remaining !== 0n) {
    remaining &= remaining - 1n;
    count += 1;
  }
  return count;
}

function randomLetter(random: RandomSource): string {
  let target = random() * TOTAL_LETTER_WEIGHT;

  for (const [letter, weight] of LETTER_FREQUENCIES) {
    target -= weight;
    if (target < 0) {
      return letter;
    }
  }

  return "z";
}
