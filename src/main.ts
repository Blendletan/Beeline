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
const TUTORIAL_STORAGE_KEY = "beelineTutorialSeen";

const TUTORIAL_STEPS = [
  {
    title: "Welcome to Beeline",
    illustration: "B  E  E  L  I  N  E",
    description:
      "This quick tour explains the rules. Select Next to continue, or close it and start playing right away.",
  },
  {
    title: "Make a word",
    illustration: "B → E → E",
    description:
      "Select touching letter tiles in order to spell a valid word. A tile cannot be used twice in the same word.",
  },
  {
    title: "Build a network",
    illustration: "BEE + LINE",
    description:
      "Every accepted word permanently activates its tiles. Active tiles connect whenever they touch, even when different words activated them.",
  },
  {
    title: "Connect opposite edges",
    illustration: "EDGE  ⇢  EDGE",
    description:
      "Win by building one connected path from any board edge to the edge directly opposite it. You only need one crossing.",
  },
  {
    title: "Use the wildcard",
    illustration: "? = any letter",
    description:
      "The center ? can stand for one letter in a word. Enter that letter when you use it; the wildcard can change in later words.",
  },
  {
    title: "Use fewer words",
    illustration: "Words 3  ·  Perfect 2",
    description:
      "Your score is the number of accepted words. Perfect is the exact fewest words that can solve this board, so lower is better.",
  },
  {
    title: "Ready to play",
    illustration: "Find your beeline!",
    description:
      "Reuse active tiles when helpful and look for efficient crossings. Revealing the answer ends an unfinished run, and you can reopen this tutorial at any time.",
  },
] as const;

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
const tutorialIllustrationElement = requiredElement<HTMLDivElement>(
  "tutorial-illustration",
);
const tutorialDescriptionElement = requiredElement<HTMLParagraphElement>(
  "tutorial-description",
);
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
      const pathPosition =
        selectedPosition === -1 ? revealedPosition : selectedPosition;
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
        }${selectedPosition === -1 ? "" : `, selection ${selectedPosition + 1}`}`,
      );

      const letter = document.createElement("span");
      letter.textContent = tile;
      button.append(letter);

      if (pathPosition !== -1) {
        const order = document.createElement("span");
        order.className = "path-order";
        order.textContent = String(pathPosition + 1);
        button.append(order);
      }

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
  tutorialIllustrationElement.textContent = step.illustration;
  tutorialDescriptionElement.textContent = step.description;
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
