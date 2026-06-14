// ─── Audio Setup ─────────────────────────────────────────────────────────────

// Create a single shared audio context for the whole page
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

// Plays a single beep/tone using the Web Audio API (no external sound files needed)
// frequency = pitch in Hz, duration = how long in seconds, type = wave shape, volume = loudness
function playTone(frequency, duration = 0.15, type = 'sine', volume = 0.3) {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, audioCtx.currentTime);
    gain.gain.setValueAtTime(volume, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
    osc.start(audioCtx.currentTime);
    osc.stop(audioCtx.currentTime + duration);
}

// Plays a rising 4-note chime when someone wins
function playWinChime() {
    [523, 659, 784, 1047].forEach((freq, i) => {
        setTimeout(() => playTone(freq, 0.4, 'sine', 0.25), i * 120);
    });
}

// Plays two descending mellow tones when the game ends in a draw
function playDrawSound() {
    playTone(330, 0.3, 'triangle', 0.2);
    setTimeout(() => playTone(294, 0.4, 'triangle', 0.15), 200);
}


// ─── Game State ───────────────────────────────────────────────────────────────

// 9-cell board — null means empty, 'X' or 'O' means taken
let tttBoard = Array(9).fill(null);

// Becomes true once the game ends (win or draw) to stop further clicks
let tttGameOver = false;

// Used in 1-player mode to block clicks while the computer is thinking
let isPlayerTurn = true;

// '1p' = one player vs computer | '2p' = two players on same device
let gameMode = '1p';

// Tracks whose turn it is in 2-player mode
let tttCurrentPlayer = 'X';

// All 8 possible winning combinations (rows, columns, diagonals)
const winPatterns = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
    [0, 3, 6], [1, 4, 7], [2, 5, 8], // columns
    [0, 4, 8], [2, 4, 6]              // diagonals
];


// ─── Visual Effects ───────────────────────────────────────────────────────────

// Creates a coloured glassmorphism wave that expands from the clicked cell
// into the page background (blue for X, green for O)
function spawnWave(index, player) {
    const cr = document.querySelectorAll('.cell')[index].getBoundingClientRect();
    const wave = document.createElement('div');
    wave.className = `wave wave-${player.toLowerCase()}`;
    wave.style.left = (cr.left + cr.width / 2) + 'px';
    wave.style.top  = (cr.top  + cr.height / 2) + 'px';
    document.body.appendChild(wave);
    wave.addEventListener('animationend', () => wave.remove());
}


// ─── Game Logic ───────────────────────────────────────────────────────────────

// Checks a given board array for a winner
// Returns { winner: 'X'|'O', cells: [a,b,c] } or null if no winner yet
function checkWinnerForBoard(board) {
    for (const [a, b, c] of winPatterns) {
        if (board[a] && board[a] === board[b] && board[a] === board[c]) {
            return { winner: board[a], cells: [a, b, c] };
        }
    }
    return null;
}

// Minimax algorithm — recursively scores every possible future game state
// O is the maximizing player (wants the highest score)
// X is the minimizing player (wants the lowest score)
// Returns +10 if O wins, -10 if X wins, 0 for a draw
function minimax(board, isMaximizing) {
    const result = checkWinnerForBoard(board);
    if (result) return result.winner === 'O' ? 10 : -10;
    if (board.every(c => c)) return 0;

    if (isMaximizing) {
        let best = -Infinity;
        for (let i = 0; i < 9; i++) {
            if (!board[i]) {
                board[i] = 'O';
                best = Math.max(best, minimax(board, false));
                board[i] = null;
            }
        }
        return best;
    } else {
        let best = Infinity;
        for (let i = 0; i < 9; i++) {
            if (!board[i]) {
                board[i] = 'X';
                best = Math.min(best, minimax(board, true));
                board[i] = null;
            }
        }
        return best;
    }
}

// Finds the best possible move for the computer (O) using minimax
// Tries every empty cell, scores it, and returns the index with the highest score
function getBestMove() {
    let bestVal = -Infinity, bestMove = -1;
    for (let i = 0; i < 9; i++) {
        if (!tttBoard[i]) {
            tttBoard[i] = 'O';
            const val = minimax(tttBoard, false);
            tttBoard[i] = null;
            if (val > bestVal) { bestVal = val; bestMove = i; }
        }
    }
    return bestMove;
}

// Places a move on the board: updates state, renders the symbol, triggers wave + sound
function placeMove(index, player) {
    tttBoard[index] = player;
    const cell = document.querySelectorAll('.cell')[index];
    cell.textContent = player;
    cell.classList.add(player.toLowerCase());
    spawnWave(index, player);
    playTone(player === 'X' ? 523 : 392, 0.18, 'sine', 0.25);
}

// Checks if the current board has a winner or is a draw
// Highlights winning cells, updates the status text, and returns true if the game ended
function handleResult(statusEl) {
    const cells = document.querySelectorAll('.cell');
    const result = checkWinnerForBoard(tttBoard);
    if (result) {
        result.cells.forEach(i => cells[i].classList.add('win'));
        if (gameMode === '1p') {
            statusEl.textContent = result.winner === 'X' ? 'You win! 🎉' : 'Computer wins! 🤖';
        } else {
            statusEl.textContent = `Player ${result.winner} wins! 🎉`;
        }
        tttGameOver = true;
        setTimeout(playWinChime, 100);
        return true;
    }
    if (tttBoard.every(c => c)) {
        statusEl.textContent = "It's a draw!";
        tttGameOver = true;
        setTimeout(playDrawSound, 100);
        return true;
    }
    return false;
}


// ─── Mode & Controls ──────────────────────────────────────────────────────────

// Switches between 1-player and 2-player mode, updates the toggle button styles,
// and resets the board so the new mode starts fresh
function setMode(mode) {
    gameMode = mode;
    document.getElementById('btn-1p').classList.toggle('active', mode === '1p');
    document.getElementById('btn-2p').classList.toggle('active', mode === '2p');
    tttReset();
}

// Called when a player clicks a cell
// In 1-player mode: human plays X, then computer responds as O after a short delay
// In 2-player mode: X and O alternate on the same device
function tttClick(index) {
    if (tttGameOver || tttBoard[index]) return;

    const statusEl = document.getElementById('ttt-status');

    if (gameMode === '1p') {
        if (!isPlayerTurn) return;
        placeMove(index, 'X');
        if (handleResult(statusEl)) return;

        isPlayerTurn = false;
        statusEl.textContent = 'Computer is thinking...';
        setTimeout(() => {
            placeMove(getBestMove(), 'O');
            if (!handleResult(statusEl)) {
                isPlayerTurn = true;
                statusEl.textContent = 'Your turn (X)';
            }
        }, 500);
    } else {
        placeMove(index, tttCurrentPlayer);
        if (handleResult(statusEl)) return;
        tttCurrentPlayer = tttCurrentPlayer === 'X' ? 'O' : 'X';
        statusEl.textContent = `Player ${tttCurrentPlayer}'s turn`;
    }
}

// Resets everything back to the start of a fresh game
function tttReset() {
    tttBoard = Array(9).fill(null);
    tttGameOver = false;
    isPlayerTurn = true;
    tttCurrentPlayer = 'X';
    const statusEl = document.getElementById('ttt-status');
    statusEl.textContent = gameMode === '1p' ? 'Your turn (X)' : "Player X's turn";
    document.querySelectorAll('.cell').forEach(cell => {
        cell.textContent = '';
        cell.className = 'cell';
    });
}
