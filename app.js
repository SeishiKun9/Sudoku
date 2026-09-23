const DIFFICULTIES = { easy: 39, medium: 47, hard: 54 };
const GAME_MODES = {
  hardcore: { label: "Hardcore", lives: 1 },
  standard: { label: "Standard", lives: 3 },
  baby: { label: "Baby", lives: Infinity }
};
const LEADERBOARD_KEY = "seiduko-leaderboard-v3";
const NAMES = ["You", "Aster", "Mika", "Rowan", "June"];

const state = {
  difficulty: "easy",
  solution: [],
  puzzle: [],
  entries: [],
  selected: null,
  seconds: 0,
  timerId: null,
  running: false,
  completed: false,
  leaderboardDifficulty: "easy",
  leaderboardMode: "standard",
  startDifficulty: "easy",
  startMode: "standard",
  mode: "standard",
  lives: 3,
  playerName: "",
  givens: new Set(),
  locked: new Set(),
  completedNumbers: new Set()
};

const boardElement = document.querySelector("#board");
const timerElement = document.querySelector("#timer");
const livesElement = document.querySelector("#lives");
const gameDifficultyLabelElement = document.querySelector("#gameDifficultyLabel");
const gameModeLabelElement = document.querySelector("#gameModeLabel");
const messageElement = document.querySelector("#boardMessage");
const leaderboardElement = document.querySelector("#leaderboardList");
const startLeaderboardElement = document.querySelector("#startLeaderboardList");
const startMenuElement = document.querySelector("#startMenu");
const gameScreenElement = document.querySelector("#gameScreen");
const gameDialogElement = document.querySelector("#gameDialog");
const gameDialogTitleElement = document.querySelector("#gameDialogTitle");
const gameDialogMessageElement = document.querySelector("#gameDialogMessage");
const playerNameElement = document.querySelector("#playerName");
const startErrorElement = document.querySelector("#startError");

function shuffle(values) {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

function buildSolution() {
  const grid = Array.from({ length: 9 }, () => Array(9).fill(0));
  const pattern = (row, column) => (row * 3 + Math.floor(row / 3) + column) % 9;
  const numbers = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  const rows = shuffle([0, 1, 2]).flatMap((group) => shuffle([0, 1, 2]).map((row) => group * 3 + row));
  const columns = shuffle([0, 1, 2]).flatMap((group) => shuffle([0, 1, 2]).map((column) => group * 3 + column));
  rows.forEach((row, rowIndex) => columns.forEach((column, columnIndex) => {
    grid[row][column] = numbers[pattern(rowIndex, columnIndex)];
  }));
  return grid;
}

function makePuzzle(solution, difficulty) {
  const puzzle = solution.map((row) => [...row]);
  const cellsToRemove = DIFFICULTIES[difficulty];
  shuffle(Array.from({ length: 81 }, (_, index) => index)).slice(0, cellsToRemove).forEach((index) => {
    puzzle[Math.floor(index / 9)][index % 9] = 0;
  });
  return puzzle;
}

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, "0");
  const remainder = (seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${remainder}`;
}

function startTimer() {
  clearInterval(state.timerId);
  state.timerId = setInterval(() => {
    if (!state.completed) {
      state.seconds += 1;
      timerElement.textContent = formatTime(state.seconds);
    }
  }, 1000);
}

function updateLives() {
  const lives = state.lives === Infinity ? "INF" : state.lives;
  livesElement.textContent = lives;
  livesElement.setAttribute("aria-label", state.lives === Infinity ? "Unlimited lives" : `${state.lives} lives remaining`);
}

function loseLife() {
  if (state.lives === Infinity) return true;
  state.lives -= 1;
  updateLives();
  if (state.lives > 0) return true;
  state.completed = true;
  clearInterval(state.timerId);
  messageElement.className = "board-message error";
  messageElement.textContent = "Out of lives. Start a new puzzle to try again.";
  showGameDialog(false);
  return false;
}

function showGameDialog(won) {
  gameDialogTitleElement.textContent = won ? "Puzzle solved." : "Out of lives.";
  gameDialogMessageElement.textContent = won
    ? `Solved in ${formatTime(state.seconds)}. Would you like to try another puzzle?`
    : "Would you like to try another puzzle or return to the menu?";
  gameDialogElement.classList.remove("hidden");
  document.querySelector("#dialogRetry").focus();
}

function hideGameDialog() {
  gameDialogElement.classList.add("hidden");
}

function renderBoard() {
  boardElement.innerHTML = "";
  state.puzzle.forEach((row, rowIndex) => row.forEach((value, columnIndex) => {
    const cell = document.createElement("button");
    const index = rowIndex * 9 + columnIndex;
    cell.className = "cell";
    cell.type = "button";
    cell.dataset.index = index;
    cell.setAttribute("role", "gridcell");
    cell.setAttribute("aria-label", `Row ${rowIndex + 1}, column ${columnIndex + 1}${value ? `, ${value}` : ", empty"}`);
    cell.textContent = value || "";
    if (state.givens.has(index)) cell.classList.add("given");
    if (state.locked.has(index)) cell.classList.add("correct");
    cell.addEventListener("click", () => selectCell(index));
    boardElement.appendChild(cell);
  }));
  highlightCells();
}

function selectCell(index) {
  if (state.completed) return;
  state.selected = index;
  highlightCells();
  updateNumberPad();
}

function updateNumberPad() {
  document.querySelectorAll(".number-button").forEach((button) => {
    const isCorrect = state.completedNumbers.has(Number(button.dataset.number));
    button.textContent = isCorrect ? "✓" : button.dataset.number === "0" ? "x" : button.dataset.number;
    button.classList.toggle("correct", isCorrect);
  });
}

function isNumberComplete(number) {
  let correctCount = 0;
  state.puzzle.forEach((row, rowIndex) => row.forEach((value, columnIndex) => {
    if (value === number && state.solution[rowIndex][columnIndex] === number) correctCount += 1;
  }));
  return correctCount === 9;
}

function highlightCells() {
  const selectedValue = state.selected === null ? 0 : state.puzzle[Math.floor(state.selected / 9)][state.selected % 9];
  document.querySelectorAll(".cell").forEach((cell, index) => {
    const sameRow = state.selected !== null && Math.floor(index / 9) === Math.floor(state.selected / 9);
    const sameColumn = state.selected !== null && index % 9 === state.selected % 9;
    const sameBox = state.selected !== null && Math.floor(Math.floor(index / 9) / 3) === Math.floor(Math.floor(state.selected / 9) / 3) && Math.floor((index % 9) / 3) === Math.floor((state.selected % 9) / 3);
    const sameNumber = selectedValue !== 0 && state.puzzle[Math.floor(index / 9)][index % 9] === selectedValue;
    cell.classList.toggle("selected", index === state.selected);
    cell.classList.toggle("related", index !== state.selected && (sameRow || sameColumn || sameBox));
    cell.classList.toggle("same-number", index !== state.selected && sameNumber);
  });
}

function selectNextEditableCell(startIndex) {
  for (let offset = 1; offset <= state.puzzle.length * state.puzzle.length; offset += 1) {
    const index = (startIndex + offset) % 81;
    if (!state.givens.has(index) && !state.locked.has(index) && !state.puzzle[Math.floor(index / 9)][index % 9]) {
      selectCell(index);
      return;
    }
  }
}

function enterNumber(number) {
  if (state.selected === null || state.completed || (number && state.completedNumbers.has(number))) return;
  const row = Math.floor(state.selected / 9);
  const column = state.selected % 9;
  if (state.givens.has(state.selected) || state.locked.has(state.selected)) return;
  state.entries[state.selected] = number || undefined;
  state.puzzle[row][column] = number;
  const cell = document.querySelector(`[data-index="${state.selected}"]`);
  cell.classList.remove("conflict", "correct");
  if (number && number === state.solution[row][column]) {
    state.locked.add(state.selected);
    if (isNumberComplete(number)) state.completedNumbers.add(number);
    cell.classList.add("correct");
  } else if (number) {
    cell.classList.add("conflict");
    if (!loseLife()) {
      highlightCells();
      updateNumberPad();
      return;
    }
  }
  cell.textContent = number || "";
  cell.setAttribute("aria-label", `Row ${row + 1}, column ${column + 1}${number ? `, ${number}` : ", empty"}`);
  messageElement.textContent = "";
  messageElement.className = "board-message";
  highlightCells();
  updateNumberPad();
  if (number && number === state.solution[row][column]) selectNextEditableCell(state.selected);
}

function checkPuzzle() {
  const hasEmpty = state.puzzle.some((row) => row.some((value) => !value));
  const hasWrong = state.puzzle.some((row, rowIndex) => row.some((value, columnIndex) => value !== state.solution[rowIndex][columnIndex]));
  document.querySelectorAll(".cell").forEach((cell, index) => {
    const row = Math.floor(index / 9);
    const column = index % 9;
    cell.classList.toggle("conflict", state.puzzle[row][column] !== 0 && state.puzzle[row][column] !== state.solution[row][column]);
  });
  if (hasWrong) {
    messageElement.className = "board-message error";
    messageElement.textContent = "A few numbers need another look.";
    return;
  }
  if (hasEmpty) {
    messageElement.className = "board-message error";
    messageElement.textContent = "The grid still has a few open squares.";
    return;
  }
  finishGame();
}

function finishGame() {
  state.completed = true;
  clearInterval(state.timerId);
  const time = state.seconds;
  messageElement.className = "board-message";
  messageElement.textContent = `Solved in ${formatTime(time)}. Nice work.`;
  saveScore(state.difficulty, state.mode, time);
  renderLeaderboard();
  updateBestTime();
  showGameDialog(true);
}

function loadScores() {
  try { return JSON.parse(localStorage.getItem(LEADERBOARD_KEY)) || {}; } catch { return {}; }
}

function saveScore(difficulty, mode, time) {
  const scores = loadScores();
  const key = `${difficulty}:${mode}`;
  scores[key] = [...(scores[key] || []), { name: state.playerName, time, current: true }].sort((a, b) => a.time - b.time).slice(0, 5);
  localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(scores));
}

function renderLeaderboard() {
  const scores = loadScores()[`${state.leaderboardDifficulty}:${state.leaderboardMode}`] || [];
  const markup = scores.length ? scores.map((score, index) => `<div class="leaderboard-row${score.current ? " current" : ""}"><span class="leaderboard-rank">${String(index + 1).padStart(2, "0")}</span><span class="leaderboard-name">${score.name}</span><span class="leaderboard-time">${formatTime(score.time)}</span></div>`).join("") : `<div class="leaderboard-empty">No wins recorded yet.</div>`;
  leaderboardElement.innerHTML = markup;
  startLeaderboardElement.innerHTML = markup;
  document.querySelectorAll(".leaderboard-difficulty-tab").forEach((tab) => tab.classList.toggle("active", tab.dataset.leaderboard === state.leaderboardDifficulty));
  document.querySelectorAll(".leaderboard-mode-tab").forEach((tab) => tab.classList.toggle("active", tab.dataset.leaderboardMode === state.leaderboardMode));
}

function updateBestTime() {
  const scores = loadScores();
  const allScores = Object.entries(scores).flatMap(([key, entries]) => {
    const [difficulty, mode] = key.split(":");
    return entries.map((entry) => ({ ...entry, difficulty, mode }));
  });
  const best = allScores.filter((entry) => entry.name === state.playerName).sort((a, b) => a.time - b.time)[0];
  document.querySelector("#bestTime").textContent = best ? formatTime(best.time) : "--:--";
  document.querySelector("#bestDifficulty").textContent = best ? `${best.difficulty} / ${GAME_MODES[best.mode].label}` : "Play a round";
}

function newGame(difficulty = state.difficulty, mode = state.mode) {
  hideGameDialog();
  state.difficulty = difficulty;
  state.mode = mode;
  state.lives = GAME_MODES[mode].lives;
  state.solution = buildSolution();
  state.puzzle = makePuzzle(state.solution, difficulty);
  state.givens = new Set(state.puzzle.flatMap((row, rowIndex) => row.map((value, columnIndex) => value ? rowIndex * 9 + columnIndex : null).filter((index) => index !== null)));
  state.locked = new Set();
  state.completedNumbers = new Set();
  state.entries = Array(81);
  state.selected = null;
  state.seconds = 0;
  state.completed = false;
  timerElement.textContent = "00:00";
  messageElement.textContent = "";
  messageElement.className = "board-message";
  updateLives();
  updateNumberPad();
  gameDifficultyLabelElement.textContent = difficulty[0].toUpperCase() + difficulty.slice(1);
  gameModeLabelElement.textContent = GAME_MODES[mode].label;
  renderBoard();
  startTimer();
}

function startGame() {
  const playerName = playerNameElement.value.trim();
  if (!playerName) {
    startErrorElement.textContent = "Enter your name to start the timer.";
    playerNameElement.focus();
    return;
  }
  state.playerName = playerName;
  startErrorElement.textContent = "";
  startMenuElement.classList.add("hidden");
  gameScreenElement.classList.remove("hidden");
  newGame(state.startDifficulty, state.startMode);
}

function returnToMenu() {
  clearInterval(state.timerId);
  state.completed = true;
  gameScreenElement.classList.add("hidden");
  startMenuElement.classList.remove("hidden");
  renderLeaderboard();
}

document.querySelectorAll(".start-difficulty").forEach((button) => button.addEventListener("click", () => {
  state.startDifficulty = button.dataset.startDifficulty;
  document.querySelectorAll(".start-difficulty").forEach((item) => {
    const selected = item === button;
    item.classList.toggle("selected", selected);
    item.setAttribute("aria-checked", selected);
  });
}));
document.querySelectorAll(".start-mode").forEach((button) => button.addEventListener("click", () => {
  state.startMode = button.dataset.startMode;
  document.querySelectorAll(".start-mode").forEach((item) => {
    const selected = item === button;
    item.classList.toggle("selected", selected);
    item.setAttribute("aria-checked", selected);
  });
}));
playerNameElement.addEventListener("input", () => { startErrorElement.textContent = ""; });
document.querySelector("#startGame").addEventListener("click", startGame);
document.querySelector("#backToMenu").addEventListener("click", returnToMenu);
document.querySelector("#dialogRetry").addEventListener("click", () => newGame());
document.querySelector("#dialogMenu").addEventListener("click", () => {
  hideGameDialog();
  returnToMenu();
});

document.querySelectorAll(".leaderboard-difficulty-tab").forEach((tab) => tab.addEventListener("click", () => {
  state.leaderboardDifficulty = tab.dataset.leaderboard;
  renderLeaderboard();
}));
document.querySelectorAll(".leaderboard-mode-tab").forEach((tab) => tab.addEventListener("click", () => {
  state.leaderboardMode = tab.dataset.leaderboardMode;
  renderLeaderboard();
}));
document.querySelectorAll(".number-button").forEach((button) => button.addEventListener("click", () => enterNumber(Number(button.dataset.number))));
document.querySelector("#newGame").addEventListener("click", () => newGame());
document.querySelector("#checkPuzzle").addEventListener("click", checkPuzzle);
document.addEventListener("keydown", (event) => {
  if (event.key >= "1" && event.key <= "9") enterNumber(Number(event.key));
  if (event.key === "Backspace" || event.key === "Delete" || event.key === "0") enterNumber(0);
});

renderLeaderboard();
updateBestTime();
