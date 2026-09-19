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
const messageElement = requiredElement<HTMLParagraphElement>("message");
const noWordsElement = requiredElement<HTMLParagraphElement>("no-words");
const playedWordsElement = requiredElement<HTMLOListElement>("played-words");
const solutionDetails = requiredElement<HTMLDetailsElement>("solution-details");
const solutionWordsElement = requiredElement<HTMLOListElement>("solution-words");
const connectionElements = [
  requiredElement<HTMLElement>("connection-a"),
  requiredElement<HTMLElement>("connection-b"),
  requiredElement<HTMLElement>("connection-c"),
] as const;

let dictionary: DictionaryIndex;
let puzzle: GeneratedPuzzle;
let game: GameState;
let selectedPath: number[] = [];
let revealedPath: readonly number[] = [];
let playedWords: string[] = [];

clearButton.addEventListener("click", clearSelection);
submitButton.addEventListener("click", submitSelection);
newPuzzleButton.addEventListener("click", () => void startPuzzle());
wildcardInput.addEventListener("input", () => {
  wildcardInput.value = wildcardInput.value.replace(/[^a-z]/gi, "").slice(0, 1);
  renderSelection();
});
document.addEventListener("keydown", (event) => {
  if (
    event.key === "Enter" &&
    !event.repeat &&
    !submitButton.disabled &&
    event.target !== newPuzzleButton
  ) {
    submitSelection();
  }
});

void loadGame();

async function loadGame(): Promise<void> {
  try {
    const response = await fetch("./dictionary.txt");
    if (!response.ok) {
      throw new Error(`Dictionary request failed with status ${response.status}.`);
    }

    dictionary = createDictionaryIndex(parseDictionary(await response.text()));
    await startPuzzle();
  } catch (error) {
    console.error(error);
    loadingElement.textContent =
      "The dictionary could not be loaded. Run Beeline from a local web server.";
    loadingElement.classList.add("error");
  }
}

async function startPuzzle(): Promise<void> {
  newPuzzleButton.disabled = true;
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
  wildcardInput.value = "";
  solutionDetails.open = false;

  loadingElement.hidden = true;
  gameElement.hidden = false;
  newPuzzleButton.textContent = DAILY_MODE ? "Restart puzzle" : "New puzzle";
  newPuzzleButton.disabled = false;
  renderSolution();
  render();
  showMessage(
    `Verified in ${puzzle.attempts} ${puzzle.attempts === 1 ? "attempt" : "attempts"} (${generationMilliseconds.toLocaleString()} ms).`,
    "neutral",
  );
}

function chooseTile(tileIndex: number): void {
  if (game.completed) {
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
      button.disabled = game.completed;
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
  connectionElements.forEach((element, index) => {
    const connected = game.connections[index];
    element.classList.toggle("connected", connected);
    const status = element.querySelector("strong");
    if (status) {
      status.textContent = connected ? "Connected" : "Open";
    }
  });

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
