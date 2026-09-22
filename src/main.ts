import {
  HEX_COORDINATES,
  WILDCARD,
  areAdjacent,
  createDictionaryIndex,
  createGame,
  parseDictionary,
  selectPuzzle,
  submitWord,
  type DictionaryIndex,
  type GameState,
  type GeneratedPuzzle,
} from "./game.js";

const DAILY_MODE = false;
const SHARE_URL = "https://blendletan.github.io/Beeline/";
const TUTORIAL_STORAGE_KEY = "beelineTutorialSeenV2";

const TUTORIAL_BOARD = [
  ..."htaoinohrdlucnfwypvbgejqxzetao?nshrdlucefwypvbgljqxzetloinshw",
];
const TUTORIAL_HONEY_PATH = [0, 6, 13, 21, 30];
const TUTORIAL_BELL_PATH = [30, 39, 47, 54];
const TUTORIAL_LOW_PATH = [54, 55, 60];
const TUTORIAL_YELLOW_PATH = [30, 39, 47, 54, 55, 60];
const TUTORIAL_HONEY_BELL = [
  ...new Set([...TUTORIAL_HONEY_PATH, ...TUTORIAL_BELL_PATH]),
];
const TUTORIAL_COMPLETE_PATH = [
  ...new Set([...TUTORIAL_HONEY_PATH, ...TUTORIAL_YELLOW_PATH]),
];

type TutorialStep = {
  readonly title: string;
  readonly description: string;
  readonly score: number;
  readonly active: readonly number[];
  readonly highlighted: readonly number[];
  readonly highlightTone?: "selection" | "solution";
  readonly currentWord: string;
  readonly wildcardLetter?: string;
  readonly words: readonly string[];
  readonly connected?: boolean;
  readonly comparison?: boolean;
};

const TUTORIAL_STEPS: readonly TutorialStep[] = [
  {
    title: "Welcome to Beeline",
    description:
      "Build valid words into one connected network from an edge to the edge directly opposite it. Any of the three directions can win; this example uses the softly marked edges.",
    score: 0,
    active: [],
    highlighted: [],
    currentWord: "No words played yet",
    words: [],
  },
  {
    title: "Make a word",
    description:
      "Select HONEY through five touching tiles from the edge to the center. A tile cannot repeat within one word, and the ? stands for Y here.",
    score: 0,
    active: [],
    highlighted: TUTORIAL_HONEY_PATH,
    highlightTone: "selection",
    currentWord: "HONEY · ? = Y",
    wildcardLetter: "y",
    words: [],
  },
  {
    title: "Active tiles stay connected",
    description:
      "After submission, HONEY stays green. Its tiles are now part of your network and may be reused in later words.",
    score: 1,
    active: TUTORIAL_HONEY_PATH,
    highlighted: [],
    currentWord: "HONEY accepted",
    words: ["HONEY"],
  },
  {
    title: "Reuse tiles and the wildcard",
    description:
      "Select BELL from the active center tile to extend the network. The same ? can change between words; here it stands for B.",
    score: 1,
    active: TUTORIAL_HONEY_PATH,
    highlighted: TUTORIAL_BELL_PATH,
    highlightTone: "selection",
    currentWord: "BELL · ? = B",
    wildcardLetter: "b",
    words: ["HONEY"],
  },
  {
    title: "Grow one network",
    description:
      "HONEY and BELL now form one connected chain. A word does not need to reach an edge by itself; all active touching tiles work together.",
    score: 2,
    active: TUTORIAL_HONEY_BELL,
    highlighted: [],
    currentWord: "2 words played",
    words: ["HONEY", "BELL"],
  },
  {
    title: "Reach the other edge",
    description:
      "Select LOW from the final active L in BELL to reach the opposite edge. Submitting it will connect the two marked edges.",
    score: 2,
    active: TUTORIAL_HONEY_BELL,
    highlighted: TUTORIAL_LOW_PATH,
    highlightTone: "selection",
    currentWord: "LOW",
    words: ["HONEY", "BELL"],
  },
  {
    title: "A valid solution",
    description:
      "The puzzle is solved in 3 words. Perfect is 2, so this route works—but there is a shorter beeline.",
    score: 3,
    active: TUTORIAL_COMPLETE_PATH,
    highlighted: [],
    currentWord: "Connected in 3 words",
    words: ["HONEY", "BELL", "LOW"],
    connected: true,
  },
  {
    title: "The missed shortcut",
    description:
      "YELLOW replaces BELL plus LOW and reaches the same edge in one word. HONEY + YELLOW is the Perfect 2-word solution.",
    score: 2,
    active: TUTORIAL_COMPLETE_PATH,
    highlighted: TUTORIAL_YELLOW_PATH,
    highlightTone: "solution",
    currentWord: "YELLOW · ? = Y",
    wildcardLetter: "y",
    words: ["HONEY", "YELLOW"],
    connected: true,
    comparison: true,
  },
  {
    title: "Ready to play",
    description:
      "Make touching-letter words, reuse active tiles, and connect an edge to the one directly opposite it. Lower word counts are better; Reveal Answer ends an unfinished run.",
    score: 2,
    active: TUTORIAL_COMPLETE_PATH,
    highlighted: [],
    currentWord: "Perfect: 2 words",
    words: ["HONEY", "YELLOW"],
    connected: true,
  },
];

const loadingElement = requiredElement<HTMLElement>("loading");
const gameElement = requiredElement<HTMLElement>("game");
const boardElement = requiredElement<HTMLDivElement>("board");
const scoreElement = requiredElement<HTMLElement>("score-value");
const perfectElement = requiredElement<HTMLElement>("perfect-value");
const currentWordElement = requiredElement<HTMLDivElement>("current-word");
const wildcardControl = requiredElement<HTMLLabelElement>("wildcard-control");
const wildcardInput = requiredElement<HTMLInputElement>("wildcard-letter");
const clearButton = requiredElement<HTMLButtonElement>("clear-path");
const submitButton = requiredElement<HTMLButtonElement>("submit-word");
const newPuzzleButton = requiredElement<HTMLButtonElement>("new-puzzle");
const showTutorialButton = requiredElement<HTMLButtonElement>("show-tutorial");
const messageElement = requiredElement<HTMLParagraphElement>("message");
const noWordsElement = requiredElement<HTMLParagraphElement>("no-words");
const playedWordsElement = requiredElement<HTMLOListElement>("played-words");
const revealAnswerButton = requiredElement<HTMLButtonElement>("reveal-answer");
const showResultButton = requiredElement<HTMLButtonElement>("show-result");
const revealedAnswerElement = requiredElement<HTMLElement>("revealed-answer");
const solutionWordsElement = requiredElement<HTMLOListElement>("solution-words");
const tutorialDialog = requiredElement<HTMLDialogElement>("tutorial-dialog");
const closeTutorialButton = requiredElement<HTMLButtonElement>("close-tutorial");
const tutorialTitleElement = requiredElement<HTMLHeadingElement>("tutorial-title");
const tutorialDescriptionElement = requiredElement<HTMLParagraphElement>(
  "tutorial-description",
);
const tutorialExampleElement = requiredElement<HTMLElement>("tutorial-example");
const tutorialScoreElement = requiredElement<HTMLElement>("tutorial-score");
const tutorialBoardElement = requiredElement<HTMLDivElement>("tutorial-board");
const tutorialCurrentWordElement = requiredElement<HTMLParagraphElement>(
  "tutorial-current-word",
);
const tutorialWordsElement = requiredElement<HTMLDivElement>("tutorial-words");
const tutorialStepCountElement = requiredElement<HTMLElement>("tutorial-step-count");
const tutorialProgressElement = requiredElement<HTMLDivElement>("tutorial-progress");
const tutorialBackButton = requiredElement<HTMLButtonElement>("tutorial-back");
const tutorialNextButton = requiredElement<HTMLButtonElement>("tutorial-next");
const revealWarningDialog = requiredElement<HTMLDialogElement>("reveal-warning");
const cancelRevealButton = requiredElement<HTMLButtonElement>("cancel-reveal");
const confirmRevealButton = requiredElement<HTMLButtonElement>("confirm-reveal");
const resultDialog = requiredElement<HTMLDialogElement>("result-dialog");
const closeResultDialogButton = requiredElement<HTMLButtonElement>(
  "close-result-dialog",
);
const resultDialogSummaryElement = requiredElement<HTMLParagraphElement>(
  "result-dialog-summary",
);
const copyResultButton = requiredElement<HTMLButtonElement>("copy-result");
const resultShareStatusElement = requiredElement<HTMLParagraphElement>(
  "result-share-status",
);
const manualShareElement = requiredElement<HTMLDivElement>("manual-share");
const manualShareTextElement = requiredElement<HTMLTextAreaElement>(
  "manual-share-text",
);

let dictionary: DictionaryIndex;
let puzzle: GeneratedPuzzle;
let game: GameState;
let selectedPath: number[] = [];
let revealedPath: readonly number[] = [];
let playedWords: string[] = [];
let answerRevealed = false;
let gaveUp = false;
let tutorialStepIndex = 0;

clearButton.addEventListener("click", clearSelection);
submitButton.addEventListener("click", submitSelection);
newPuzzleButton.addEventListener("click", () => void startPuzzle());
showTutorialButton.addEventListener("click", openTutorial);
closeTutorialButton.addEventListener("click", () => tutorialDialog.close());
tutorialBackButton.addEventListener("click", () => {
  tutorialStepIndex = Math.max(0, tutorialStepIndex - 1);
  renderTutorial();
});
tutorialNextButton.addEventListener("click", () => {
  if (tutorialStepIndex === TUTORIAL_STEPS.length - 1) {
    tutorialDialog.close();
    return;
  }
  tutorialStepIndex += 1;
  renderTutorial();
});
tutorialDialog.addEventListener("close", rememberTutorialSeen);
revealAnswerButton.addEventListener("click", requestRevealAnswer);
showResultButton.addEventListener("click", openResultDialog);
cancelRevealButton.addEventListener("click", () => revealWarningDialog.close());
confirmRevealButton.addEventListener("click", revealAnswer);
closeResultDialogButton.addEventListener("click", () => resultDialog.close());
copyResultButton.addEventListener("click", () => void copyShareResult());
wildcardInput.addEventListener("input", () => {
  wildcardInput.value = wildcardInput.value.replace(/[^a-z]/gi, "").slice(0, 1);
  renderSelection();
});
document.addEventListener("keydown", (event) => {
  if (
    event.key === "Enter" &&
    !event.repeat &&
    !submitButton.disabled &&
    !tutorialDialog.open &&
    !revealWarningDialog.open &&
    !resultDialog.open &&
    event.target !== newPuzzleButton
  ) {
    submitSelection();
  }
});

void loadGame();

async function loadGame(): Promise<void> {
  try {
    const response = await fetch("./cleanedDictionary.txt");
    if (!response.ok) {
      throw new Error(`Dictionary request failed with status ${response.status}.`);
    }

    dictionary = createDictionaryIndex(parseDictionary(await response.text()));
    await startPuzzle();
    if (!hasSeenTutorial()) {
      openTutorial();
    }
  } catch (error) {
    console.error(error);
    loadingElement.textContent =
      "The dictionary could not be loaded. Run Beeline from a local web server.";
    loadingElement.classList.add("error");
  }
}

async function startPuzzle(): Promise<void> {
  if (resultDialog.open) {
    resultDialog.close();
  }
  if (revealWarningDialog.open) {
    revealWarningDialog.close();
  }
  newPuzzleButton.disabled = true;
  revealAnswerButton.disabled = true;
  gameElement.hidden = true;
  loadingElement.hidden = false;
  loadingElement.textContent = DAILY_MODE
    ? "Loading today’s verified puzzle…"
    : "Generating and solving a fresh puzzle…";

  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

  const generationStarted = performance.now();
  puzzle = selectPuzzle(dictionary, DAILY_MODE);
  const generationMilliseconds = Math.round(performance.now() - generationStarted);
  game = createGame(puzzle.board);
  selectedPath = [];
  revealedPath = [];
  playedWords = [];
  answerRevealed = false;
  gaveUp = false;
  wildcardInput.value = "";

  loadingElement.hidden = true;
  gameElement.hidden = false;
  newPuzzleButton.textContent = DAILY_MODE ? "Restart puzzle" : "New puzzle";
  newPuzzleButton.disabled = false;
  revealAnswerButton.disabled = false;
  renderSolution();
  render();
  showMessage(
    `Verified in ${puzzle.attempts} ${puzzle.attempts === 1 ? "attempt" : "attempts"} (${generationMilliseconds.toLocaleString()} ms).`,
    "neutral",
  );
}

function chooseTile(tileIndex: number): void {
  if (runEnded()) {
    return;
  }

  revealedPath = [];
  const previousIndex = selectedPath.at(-1);
  const existingPosition = selectedPath.indexOf(tileIndex);

  if (existingPosition !== -1) {
    if (existingPosition === selectedPath.length - 1) {
      selectedPath.pop();
      showMessage("Removed the last tile.", "neutral");
    } else {
      showMessage("A tile cannot be used twice in the same word.", "error");
    }
  } else if (previousIndex !== undefined && !areAdjacent(previousIndex, tileIndex)) {
    showMessage("The next tile must touch the previous tile.", "error");
  } else {
    selectedPath.push(tileIndex);
    showMessage("", "neutral");
  }

  if (!selectedPath.some((index) => game.board[index] === WILDCARD)) {
    wildcardInput.value = "";
  }
  render();
}

function clearSelection(): void {
  selectedPath = [];
  revealedPath = [];
  wildcardInput.value = "";
  render();
  showMessage("Selection cleared.", "neutral");
}

function submitSelection(): void {
  const word = selectedWord();
  const result = submitWord(game, selectedPath, word, dictionary.words);

  if (!result.accepted) {
    selectedPath = [];
    wildcardInput.value = "";
    render();
    showMessage(
      word ? `${word.toUpperCase()} is not in the dictionary.` : "That is not a valid word.",
      "error",
    );
    return;
  }

  game = result.state;
  playedWords.push(word);
  selectedPath = [];
  wildcardInput.value = "";
  render();

  if (game.completed) {
    const comparison =
      game.wordsUsed === puzzle.perfect
        ? "Perfect score!"
        : `${game.wordsUsed - puzzle.perfect} over Perfect.`;
    showMessage(
      `Opposite sides connected in ${game.wordsUsed} words. ${comparison}`,
      "success",
    );
    openResultDialog();
  } else {
    showMessage(`${word.toUpperCase()} accepted.`, "success");
  }
}

function selectedWord(): string {
  const wildcardLetter = wildcardInput.value.toLowerCase();
  return selectedPath
    .map((tileIndex) => {
      const tile = game.board[tileIndex];
      return tile === WILDCARD ? wildcardLetter : tile;
    })
    .join("");
}

function render(): void {
  boardElement.replaceChildren(
    ...game.board.map((tile, tileIndex) => {
      const coordinate = HEX_COORDINATES[tileIndex];
      const selectedPosition = selectedPath.indexOf(tileIndex);
      const revealedPosition = revealedPath.indexOf(tileIndex);
      const button = document.createElement("button");
      const x = coordinate.q * 0.75;
      const y = (coordinate.r + coordinate.q / 2) * 0.8660254;

      button.type = "button";
      button.dataset.tileIndex = String(tileIndex);
      button.className = "tile";
      button.style.setProperty("--left", `${50 + x * 11.5}%`);
      button.style.setProperty("--top", `${50 + y * 11.5}%`);
      button.classList.toggle("active", game.active[tileIndex]);
      button.classList.toggle("selected", selectedPosition !== -1);
      button.classList.toggle(
        "revealed",
        selectedPosition === -1 && revealedPosition !== -1,
      );
      button.classList.toggle("wildcard", tile === WILDCARD);
      button.disabled = runEnded();
      button.setAttribute("aria-pressed", String(selectedPosition !== -1));
      button.setAttribute(
        "aria-label",
        `${tile === WILDCARD ? "Wildcard" : tile.toUpperCase()} tile${
          game.active[tileIndex] ? ", active" : ", inactive"
        }${selectedPosition === -1 ? "" : ", selected"}`,
      );

      const letter = document.createElement("span");
      letter.textContent = tile;
      button.append(letter);

      button.addEventListener("click", () => chooseTile(tileIndex));
      return button;
    }),
  );

  scoreElement.textContent = String(game.wordsUsed);
  perfectElement.textContent = String(puzzle.perfect);
  revealAnswerButton.disabled = answerRevealed;
  showResultButton.hidden = !runEnded();
  revealedAnswerElement.hidden = !answerRevealed;

  noWordsElement.hidden = playedWords.length > 0;
  playedWordsElement.replaceChildren(
    ...playedWords.map((word) => {
      const item = document.createElement("li");
      item.textContent = word.toUpperCase();
      return item;
    }),
  );
  renderSelection();
}

function renderSelection(): void {
  if (gaveUp) {
    currentWordElement.textContent = "Answer revealed";
    wildcardControl.hidden = true;
    clearButton.disabled = true;
    submitButton.disabled = true;
    return;
  }

  if (game.completed) {
    currentWordElement.textContent = "Puzzle complete";
    wildcardControl.hidden = true;
    clearButton.disabled = true;
    submitButton.disabled = true;
    return;
  }

  const usesWildcard = selectedPath.some(
    (tileIndex) => game.board[tileIndex] === WILDCARD,
  );
  wildcardControl.hidden = !usesWildcard;
  const word = selectedWord();

  currentWordElement.textContent =
    selectedPath.length === 0
      ? "Select a tile"
      : word.length === selectedPath.length
        ? word.toUpperCase()
        : selectedPath.map((index) => game.board[index].toUpperCase()).join("");

  clearButton.disabled = selectedPath.length === 0;
  submitButton.disabled =
    selectedPath.length < 2 || (usesWildcard && wildcardInput.value.length !== 1);
}

function renderSolution(): void {
  solutionWordsElement.replaceChildren(
    ...puzzle.solution.map(({ word, path }) => {
      const item = document.createElement("li");
      const button = document.createElement("button");
      button.type = "button";
      button.className = "solution-word";
      button.dataset.word = word;
      button.dataset.path = path.join(",");
      button.textContent = word.toUpperCase();
      button.addEventListener("click", () => {
        const alreadyRevealed =
          revealedPath.length === path.length &&
          revealedPath.every((tileIndex, index) => tileIndex === path[index]);
        selectedPath = [];
        wildcardInput.value = "";
        revealedPath = alreadyRevealed ? [] : path;
        render();
        showMessage(
          alreadyRevealed
            ? "Solution path hidden."
            : `${word.toUpperCase()} is traced on the board.`,
          "neutral",
        );
      });
      item.append(button);
      return item;
    }),
  );
}

function requestRevealAnswer(): void {
  if (answerRevealed) {
    return;
  }
  if (game.completed) {
    revealAnswer();
    return;
  }
  revealWarningDialog.showModal();
}

function revealAnswer(): void {
  if (answerRevealed) {
    return;
  }
  if (revealWarningDialog.open) {
    revealWarningDialog.close();
  }

  gaveUp = !game.completed;
  answerRevealed = true;
  selectedPath = [];
  wildcardInput.value = "";
  revealedPath = puzzle.solution[0]?.path ?? [];
  render();
  showMessage(
    gaveUp
      ? "Answer revealed. This run has ended."
      : "Perfect answer revealed. Your result is unchanged.",
    "neutral",
  );
  openResultDialog();
}

function runEnded(): boolean {
  return game.completed || gaveUp;
}

function resultSummary(): string {
  const perfectLabel = `${puzzle.perfect} ${puzzle.perfect === 1 ? "word" : "words"}`;
  if (gaveUp) {
    return `Answer revealed · Perfect was ${perfectLabel}`;
  }

  const scoreLabel = `${game.wordsUsed} ${game.wordsUsed === 1 ? "word" : "words"}`;
  if (game.wordsUsed === puzzle.perfect) {
    return `${scoreLabel} · Perfect score!`;
  }
  return `${scoreLabel} · +${game.wordsUsed - puzzle.perfect} over Perfect`;
}

function openResultDialog(): void {
  if (!runEnded()) {
    return;
  }
  resultDialogSummaryElement.textContent = resultSummary();
  resultShareStatusElement.textContent = "";
  manualShareElement.hidden = true;
  manualShareTextElement.value = "";
  if (!resultDialog.open) {
    resultDialog.showModal();
  }
  copyResultButton.focus();
}

function shareText(): string {
  if (gaveUp) {
    return `Beeline\n${resultSummary()}\n${SHARE_URL}`;
  }

  const perfectCells = "🟨".repeat(Math.min(game.wordsUsed, puzzle.perfect));
  const extraCells = "🟦".repeat(Math.max(0, game.wordsUsed - puzzle.perfect));
  return `Beeline\n${resultSummary()}\n${perfectCells}${extraCells}\n${SHARE_URL}`;
}

async function copyShareResult(): Promise<void> {
  const text = shareText();
  try {
    await navigator.clipboard.writeText(text);
    resultShareStatusElement.textContent = "Copied! Paste it anywhere.";
    manualShareElement.hidden = true;
  } catch {
    resultShareStatusElement.textContent = "Copy the text below to share your result.";
    manualShareTextElement.value = text;
    manualShareElement.hidden = false;
    manualShareTextElement.focus();
    manualShareTextElement.select();
  }
}

function openTutorial(): void {
  tutorialStepIndex = 0;
  renderTutorial();
  tutorialDialog.showModal();
}

function renderTutorial(): void {
  const step = TUTORIAL_STEPS[tutorialStepIndex];
  tutorialTitleElement.textContent = step.title;
  tutorialDescriptionElement.textContent = step.description;
  tutorialScoreElement.textContent = String(step.score);
  tutorialExampleElement.classList.toggle("connected", step.connected === true);
  renderTutorialBoard(step);
  tutorialCurrentWordElement.textContent = step.currentWord;
  tutorialWordsElement.replaceChildren(
    ...(step.comparison
      ? [
          tutorialWordChip("HONEY"),
          tutorialWordChip("BELL", "replaced"),
          tutorialWordChip("+", "operator"),
          tutorialWordChip("LOW", "replaced"),
          tutorialWordChip("→", "operator"),
          tutorialWordChip("YELLOW", "better"),
        ]
      : step.words.length === 0
        ? [tutorialWordChip("Words will appear here", "empty")]
        : step.words.map((word) => tutorialWordChip(word))),
  );
  tutorialWordsElement.setAttribute(
    "aria-label",
    step.words.length === 0
      ? "No example words played yet"
      : `Example words played: ${step.words.join(", ")}`,
  );
  tutorialStepCountElement.textContent = `Step ${tutorialStepIndex + 1} of ${TUTORIAL_STEPS.length}`;
  tutorialProgressElement.replaceChildren(
    ...TUTORIAL_STEPS.map((_, index) => {
      const dot = document.createElement("span");
      dot.className = "tutorial-dot";
      dot.classList.toggle("current", index === tutorialStepIndex);
      return dot;
    }),
  );
  tutorialBackButton.disabled = tutorialStepIndex === 0;
  tutorialNextButton.textContent =
    tutorialStepIndex === TUTORIAL_STEPS.length - 1 ? "Start playing" : "Next";
}

function renderTutorialBoard(step: TutorialStep): void {
  const active = new Set(step.active);
  const highlighted = new Set(step.highlighted);

  tutorialBoardElement.replaceChildren(
    ...TUTORIAL_BOARD.map((tile, tileIndex) => {
      const coordinate = HEX_COORDINATES[tileIndex];
      const x = coordinate.q * 0.75;
      const y = (coordinate.r + coordinate.q / 2) * 0.8660254;
      const cell = document.createElement("span");
      const isHighlighted = highlighted.has(tileIndex);
      const shownLetter =
        tile === WILDCARD && isHighlighted && step.wildcardLetter
          ? step.wildcardLetter
          : tile;

      cell.className = "tutorial-tile";
      cell.setAttribute("aria-hidden", "true");
      cell.style.setProperty("--left", `${50 + x * 11.5}%`);
      cell.style.setProperty("--top", `${50 + y * 11.5}%`);
      cell.classList.toggle("active", active.has(tileIndex));
      cell.classList.toggle(
        "selected",
        isHighlighted && step.highlightTone === "selection",
      );
      cell.classList.toggle(
        "revealed",
        isHighlighted && step.highlightTone === "solution",
      );
      cell.classList.toggle("wildcard", tile === WILDCARD);
      cell.classList.toggle(
        "target-edge",
        coordinate.q === -4 || coordinate.q === 4,
      );
      cell.textContent = shownLetter;
      return cell;
    }),
  );

  const highlightedWord =
    step.highlighted.length === 0
      ? ""
      : ` ${step.currentWord.split(" · ")[0]} is highlighted.`;
  tutorialBoardElement.setAttribute(
    "aria-label",
    `Example board with ${step.active.length} active tiles.${highlightedWord}${
      step.connected ? " Opposite edges are connected." : ""
    }`,
  );
}

function tutorialWordChip(
  text: string,
  tone: "normal" | "replaced" | "better" | "operator" | "empty" = "normal",
): HTMLSpanElement {
  const chip = document.createElement("span");
  chip.className = `tutorial-word ${tone}`;
  chip.textContent = text;
  return chip;
}

function hasSeenTutorial(): boolean {
  try {
    return localStorage.getItem(TUTORIAL_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function rememberTutorialSeen(): void {
  try {
    localStorage.setItem(TUTORIAL_STORAGE_KEY, "1");
  } catch {
    // The tutorial remains available even when storage is blocked.
  }
}

function showMessage(
  message: string,
  tone: "neutral" | "error" | "success",
): void {
  messageElement.textContent = message;
  messageElement.className = `message ${tone}`;
}

function requiredElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Missing required element #${id}.`);
  }
  return element as T;
}
