const DIFFICULTIES = { easy: 39, medium: 47, hard: 54 };
const LEADERBOARD_KEY = "seiduko-leaderboard-v2";
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
  startDifficulty: "easy",
  playerName: "",
  givens: new Set(),
  locked: new Set(),
  completedNumbers: new Set()
};

const boardElement = document.querySelector("#board");
const timerElement = document.querySelector("#timer");
const messageElement = document.querySelector("#boardMessage");
const leaderboardElement = document.querySelector("#leaderboardList");
const startLeaderboardElement = document.querySelector("#startLeaderboardList");
const startMenuElement = document.querySelector("#startMenu");
const gameScreenElement = document.querySelector("#gameScreen");
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

function highlightCells() {
  document.querySelectorAll(".cell").forEach((cell, index) => {
    const sameRow = state.selected !== null && Math.floor(index / 9) === Math.floor(state.selected / 9);
    const sameColumn = state.selected !== null && index % 9 === state.selected % 9;
    const sameBox = state.selected !== null && Math.floor(Math.floor(index / 9) / 3) === Math.floor(Math.floor(state.selected / 9) / 3) && Math.floor((index % 9) / 3) === Math.floor((state.selected % 9) / 3);
    cell.classList.toggle("selected", index === state.selected);
    cell.classList.toggle("related", index !== state.selected && (sameRow || sameColumn || sameBox));
  });
}

function enterNumber(number) {
  if (state.selected === null || state.completed) return;
  const row = Math.floor(state.selected / 9);
  const column = state.selected % 9;
  if (state.givens.has(state.selected) || state.locked.has(state.selected)) return;
  state.entries[state.selected] = number || undefined;
  state.puzzle[row][column] = number;
  const cell = document.querySelector(`[data-index="${state.selected}"]`);
  cell.classList.remove("conflict", "correct");
  if (number && number === state.solution[row][column]) {
    state.locked.add(state.selected);
    state.completedNumbers.add(number);
    cell.classList.add("correct");
  } else if (number) {
    cell.classList.add("conflict");
  }
  cell.textContent = number || "";
  cell.setAttribute("aria-label", `Row ${row + 1}, column ${column + 1}${number ? `, ${number}` : ", empty"}`);
  messageElement.textContent = "";
  messageElement.className = "board-message";
  highlightCells();
  updateNumberPad();
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
  saveScore(state.difficulty, time);
  renderLeaderboard();
  updateBestTime();
}

function loadScores() {
  try { return JSON.parse(localStorage.getItem(LEADERBOARD_KEY)) || {}; } catch { return {}; }
}

function saveScore(difficulty, time) {
  const scores = loadScores();
  scores[difficulty] = [...(scores[difficulty] || []), { name: state.playerName, time, current: true }].sort((a, b) => a.time - b.time).slice(0, 5);
  localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(scores));
}

function renderLeaderboard() {
  const scores = loadScores()[state.leaderboardDifficulty] || [];
  const markup = scores.length ? scores.map((score, index) => `<div class="leaderboard-row${score.current ? " current" : ""}"><span class="leaderboard-rank">${String(index + 1).padStart(2, "0")}</span><span class="leaderboard-name">${score.name}</span><span class="leaderboard-time">${formatTime(score.time)}</span></div>`).join("") : `<div class="leaderboard-empty">No wins recorded yet.</div>`;
  leaderboardElement.innerHTML = markup;
  startLeaderboardElement.innerHTML = markup;
  document.querySelectorAll(".leaderboard-tab").forEach((tab) => tab.classList.toggle("active", tab.dataset.leaderboard === state.leaderboardDifficulty));
}

function updateBestTime() {
  const scores = loadScores();
  const allScores = Object.entries(scores).flatMap(([difficulty, entries]) => entries.map((entry) => ({ ...entry, difficulty })));
  const best = allScores.filter((entry) => entry.name === state.playerName).sort((a, b) => a.time - b.time)[0];
  document.querySelector("#bestTime").textContent = best ? formatTime(best.time) : "--:--";
  document.querySelector("#bestDifficulty").textContent = best ? best.difficulty : "Play a round";
}

function newGame(difficulty = state.difficulty) {
  state.difficulty = difficulty;
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
  updateNumberPad();
  document.querySelectorAll(".difficulty-tab").forEach((tab) => {
    const active = tab.dataset.difficulty === difficulty;
    tab.classList.toggle("active", active);
    tab.setAttribute("aria-selected", active);
  });
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
  newGame(state.startDifficulty);
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
playerNameElement.addEventListener("input", () => { startErrorElement.textContent = ""; });
document.querySelector("#startGame").addEventListener("click", startGame);
document.querySelector("#backToMenu").addEventListener("click", returnToMenu);

document.querySelectorAll(".difficulty-tab").forEach((tab) => tab.addEventListener("click", () => newGame(tab.dataset.difficulty)));
document.querySelectorAll(".leaderboard-tab").forEach((tab) => tab.addEventListener("click", () => {
  state.leaderboardDifficulty = tab.dataset.leaderboard;
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
