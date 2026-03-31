import { useEffect, useMemo, useState } from 'react';
import './App.css';

const HISTORY_KEY = 'remi-history-v1';

const initialPlayer = (name, index) => ({
  id: `${Date.now()}-${index}-${name}`,
  name: name.trim() || `Player ${index + 1}`,
  score: 0,
  lastRoundScore: 0,
});

function formatDate(value) {
  const date = new Date(value);
  return date.toLocaleString('hr-HR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function App() {
  const [step, setStep] = useState('setup');
  const [gameView, setGameView] = useState('roundSetup');
  const [numPlayers, setNumPlayers] = useState(2);
  const [playerNames, setPlayerNames] = useState(['', '']);
  const [players, setPlayers] = useState([]);
  const [currentShufflerIndex, setCurrentShufflerIndex] = useState(0);
  const [winnerId, setWinnerId] = useState(null);
  const [winnerType, setWinnerType] = useState('regular');
  const [roundScores, setRoundScores] = useState({});
  const [roundNumber, setRoundNumber] = useState(1);
  const [gameWinner, setGameWinner] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [expandedHistoryId, setExpandedHistoryId] = useState(null);
  const [pendingPlayers, setPendingPlayers] = useState([]);
  const [openMenuPlayerId, setOpenMenuPlayerId] = useState(null);
  const [gameHistory, setGameHistory] = useState(() => {
    try {
      const stored = localStorage.getItem(HISTORY_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(gameHistory));
  }, [gameHistory]);

  useEffect(() => {
    setPlayerNames((prev) => {
      const next = [...prev];
      while (next.length < numPlayers) next.push('');
      return next.slice(0, numPlayers);
    });
  }, [numPlayers]);

  const currentShuffler = players[currentShufflerIndex] ?? null;

  const sortedLeaderboard = useMemo(
    () => [...players].sort((a, b) => a.score - b.score),
    [players],
  );

  const resetRoundInputs = () => {
    setWinnerId(null);
    setWinnerType('regular');
    setRoundScores({});
    setOpenMenuPlayerId(null);
  };

  const clearGameState = () => {
    setStep('setup');
    setGameView('roundSetup');
    setPlayers([]);
    setPendingPlayers([]);
    setCurrentShufflerIndex(0);
    setRoundNumber(1);
    setGameWinner(null);
    resetRoundInputs();
  };

  const confirmGoHome = () => {
    const confirmed = window.confirm('Are you sure you want to go home? Current game progress will stay only if you finish the game first.');
    if (!confirmed) return;
    clearGameState();
  };

  const beginGameSetup = () => {
    const trimmedPlayers = playerNames
      .slice(0, numPlayers)
      .map((name, index) => initialPlayer(name, index));

    if (trimmedPlayers.some((player) => !player.name.trim())) {
      alert('Please enter all player names before starting.');
      return;
    }

    setPendingPlayers(trimmedPlayers);
    setStep('chooseShuffler');
  };

  const confirmFirstShuffler = (playerIndex) => {
    setPlayers(pendingPlayers);
    setCurrentShufflerIndex(playerIndex);
    setRoundNumber(1);
    resetRoundInputs();
    setGameView('roundSetup');
    setStep('game');
  };

  const proceedToRoundScores = () => {
    if (!winnerId) {
      alert('Select the winner first.');
      return;
    }

    setGameView('roundScores');
  };

  const setScoreForPlayer = (playerId, value) => {
    setRoundScores((prev) => ({ ...prev, [playerId]: value }));
  };

  const applyRound = () => {
    if (!winnerId) {
      alert('Select the winner first.');
      setGameView('roundSetup');
      return;
    }

    const nextPlayers = players.map((player) => {
      if (player.id === winnerId) {
        const winnerPoints = winnerType === 'hand' ? -100 : -40;
        return {
          ...player,
          score: player.score + winnerPoints,
          lastRoundScore: winnerPoints,
        };
      }

      const enteredScore = Number(roundScores[player.id] || 0);
      const appliedScore = winnerType === 'hand' ? enteredScore * 2 : enteredScore;

      return {
        ...player,
        score: player.score + appliedScore,
        lastRoundScore: appliedScore,
      };
    });

    setPlayers(nextPlayers);
    setCurrentShufflerIndex((prev) => (prev + 1) % nextPlayers.length);
    setRoundNumber((prev) => prev + 1);
    resetRoundInputs();
    setGameView('roundSetup');
  };

  const removePlayer = (playerId) => {
    const player = players.find((item) => item.id === playerId);
    if (!player) return;

    const confirmed = window.confirm(
      `Are you sure you want to remove ${player.name} from this game?`,
    );

    if (!confirmed) return;

    const removedIndex = players.findIndex((item) => item.id === playerId);
    const remainingPlayers = players.filter((item) => item.id !== playerId);

    if (remainingPlayers.length === 0) {
      clearGameState();
      return;
    }

    if (remainingPlayers.length === 1) {
      const winner = remainingPlayers[0];
      setPlayers(remainingPlayers);
      setGameWinner({ name: winner.name, score: winner.score });
      setGameHistory((prev) => [
        {
          id: Date.now(),
          createdAt: new Date().toISOString(),
          winner: winner.name,
          players: remainingPlayers.map((item) => ({ name: item.name, score: item.score })),
        },
        ...prev,
      ]);
      setStep('end');
      return;
    }

    let nextShufflerIndex = currentShufflerIndex;
    if (removedIndex < currentShufflerIndex) {
      nextShufflerIndex -= 1;
    } else if (removedIndex === currentShufflerIndex) {
      nextShufflerIndex = currentShufflerIndex % remainingPlayers.length;
    }

    setPlayers(remainingPlayers);
    setCurrentShufflerIndex(nextShufflerIndex);
    setOpenMenuPlayerId(null);

    if (winnerId === playerId) {
      setWinnerId(null);
      setGameView('roundSetup');
    }

    setRoundScores((prev) => {
      const next = { ...prev };
      delete next[playerId];
      return next;
    });
  };

  const endGame = () => {
    if (!players.length) return;

    const winner = players.reduce(
      (best, player) => (player.score < best.score ? { name: player.name, score: player.score } : best),
      {
        name: players[0].name,
        score: players[0].score,
      },
    );

    setGameWinner(winner);
    setGameHistory((prev) => [
      {
        id: Date.now(),
        createdAt: new Date().toISOString(),
        winner: winner.name,
        players: players.map((player) => ({ name: player.name, score: player.score })),
      },
      ...prev,
    ]);
    setStep('end');
  };

  if (showHistory) {
    return (
      <div className="app-shell">
        <div className="screen-card history-screen">
          <div className="history-header">
            <div>
              <p className="eyebrow">Archive</p>
              <h1>Game history</h1>
            </div>
            <button className="secondary-button" onClick={() => setShowHistory(false)}>
              Back
            </button>
          </div>

          {gameHistory.length === 0 ? (
            <div className="empty-state">No archived games yet.</div>
          ) : (
            <div className="history-list">
              {gameHistory.map((game) => {
                const expanded = expandedHistoryId === game.id;
                return (
                  <div key={game.id} className="history-item">
                    <button
                      className="history-item__summary"
                      onClick={() => setExpandedHistoryId(expanded ? null : game.id)}
                    >
                      <div>
                        <div className="history-item__winner">Winner: {game.winner}</div>
                        <div className="history-item__date">{formatDate(game.createdAt)}</div>
                      </div>
                      <span>{expanded ? 'Hide' : 'Show'}</span>
                    </button>
                    {expanded && (
                      <div className="history-item__details">
                        {game.players.map((player) => (
                          <div key={`${game.id}-${player.name}`} className="history-player-row">
                            <span>{player.name}</span>
                            <strong>{player.score}</strong>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (step === 'setup') {
    return (
      <div className="app-shell">
        <div className="screen-card setup-screen">
          <p className="eyebrow">Score tracker</p>
          <h1>Remi</h1>
          <p className="subtitle">Create the table, pick the first shuffler, and track every round cleanly.</p>

          <div className="top-actions">
            <button className="secondary-button" onClick={() => setShowHistory(true)}>
              View history
            </button>
          </div>

          <label className="field-label">
            Players
            <select
              className="app-select"
              value={numPlayers}
              onChange={(event) => setNumPlayers(Number(event.target.value))}
            >
              {[2, 3, 4, 5, 6].map((count) => (
                <option key={count} value={count}>
                  {count} players
                </option>
              ))}
            </select>
          </label>

          <div className="name-grid">
            {Array.from({ length: numPlayers }).map((_, index) => (
              <label key={index} className="field-label">
                Player {index + 1}
                <input
                  className="app-input"
                  type="text"
                  placeholder={`Enter player ${index + 1} name`}
                  value={playerNames[index] || ''}
                  onChange={(event) => {
                    const next = [...playerNames];
                    next[index] = event.target.value;
                    setPlayerNames(next);
                  }}
                />
              </label>
            ))}
          </div>

          <button className="primary-button" onClick={beginGameSetup}>
            Start game
          </button>
        </div>
      </div>
    );
  }

  if (step === 'chooseShuffler') {
    return (
      <div className="app-shell">
        <div className="screen-card choose-screen">
          <p className="eyebrow">Before round 1</p>
          <h1>Choose the first shuffler</h1>
          <p className="subtitle">
            The shuffler will then rotate in the same order as the player list for every next round.
          </p>

          <div className="shuffler-picker">
            {pendingPlayers.map((player, index) => (
              <button
                key={player.id}
                className="picker-button"
                onClick={() => confirmFirstShuffler(index)}
              >
                {player.name}
              </button>
            ))}
          </div>

          <button className="secondary-button" onClick={() => setStep('setup')}>
            Back
          </button>
        </div>
      </div>
    );
  }

  if (step === 'end' && gameWinner) {
    return (
      <div className="app-shell">
        <div className="screen-card end-screen">
          <p className="eyebrow">Game finished</p>
          <h1>{gameWinner.name} wins</h1>
          <p className="winner-score">Best score: {gameWinner.score}</p>

          <div className="leaderboard">
            {sortedLeaderboard.map((player, index) => (
              <div key={player.id} className={`leaderboard-row ${index === 0 ? 'leaderboard-row--winner' : ''}`}>
                <span>
                  {index + 1}. {player.name}
                </span>
                <strong>{player.score}</strong>
              </div>
            ))}
          </div>

          <div className="end-actions end-actions--spaced">
            <button className="secondary-button" onClick={() => setStep('game')}>
              Back to game
            </button>
            <button className="primary-button" onClick={confirmGoHome}>
              End and go home
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (gameView === 'roundSetup') {
    return (
      <div className="app-shell">
        <div className="screen-card round-setup-screen">
          <div className="game-header game-header--stacked">
            <div>
              <p className="eyebrow">Round {roundNumber}</p>
              <h1>Choose winner</h1>
              <p className="subtitle">Shuffler: <strong>{currentShuffler?.name}</strong></p>
            </div>
            <button className="danger-primary-button" onClick={endGame}>
              Game Status
            </button>
          </div>

          <div className="winner-panel winner-panel--compact">
            <div className="winner-panel__section">
              <span className="section-title">Who won this round?</span>
              <div className="chip-list">
                {players.map((player) => (
                  <button
                    key={player.id}
                    className={`chip-button ${winnerId === player.id ? 'chip-button--active' : ''}`}
                    onClick={() => setWinnerId(player.id)}
                  >
                    {player.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="winner-panel__section">
              <span className="section-title">Finish type</span>
              <div className="chip-list">
                <button
                  className={`chip-button ${winnerType === 'regular' ? 'chip-button--active' : ''}`}
                  onClick={() => setWinnerType('regular')}
                >
                  Regular (-40)
                </button>
                <button
                  className={`chip-button ${winnerType === 'hand' ? 'chip-button--active' : ''}`}
                  onClick={() => setWinnerType('hand')}
                >
                  Hand (-100, others x2)
                </button>
              </div>
            </div>
          </div>

          <button className="primary-button primary-button--wide" onClick={proceedToRoundScores}>
            Continue
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell app-shell--scores">
      <div className="screen-card game-screen game-screen--scores">
        <div className="round-summary-card">
          <div>
            <p className="eyebrow">Round {roundNumber}</p>
            <h2>{players.find((player) => player.id === winnerId)?.name || 'Winner'}</h2>
            <p className="subtitle subtitle--dark">
              {winnerType === 'hand' ? 'Hand finish (-100, others x2)' : 'Regular finish (-40)'}
            </p>
          </div>
          <div className="round-summary-card__shuffler">
            Shuffler<br />
            <strong>{currentShuffler?.name}</strong>
          </div>
        </div>

        <div className={`player-grid ${players.length >= 6 ? 'player-grid--scroll' : 'player-grid--fit'}`}>
          {players.map((player) => {
            const isWinner = player.id === winnerId;
            const winnerPreview = isWinner ? (winnerType === 'hand' ? '-100' : '-40') : '—';
            const roundPreview = !isWinner
              ? Number(roundScores[player.id] || 0) * (winnerType === 'hand' ? 2 : 1)
              : winnerPreview;

            return (
              <section key={player.id} className="player-card player-card--compact">
                <div className="player-card__top">
                  <div className="player-card__heading">
                    <h2>{player.name}</h2>
                    <p className="player-meta">Total: {player.score}</p>
                    <p className="player-meta">Last: {player.lastRoundScore}</p>
                  </div>

                  <div className="player-menu">
                    <button
                      className="menu-trigger"
                      aria-label={`Open player actions for ${player.name}`}
                      onClick={() => setOpenMenuPlayerId((current) => (current === player.id ? null : player.id))}
                    >
                      ⋯
                    </button>
                    {openMenuPlayerId === player.id && (
                      <div className="player-menu__dropdown">
                        <button
                          className="player-menu__delete"
                          onClick={() => removePlayer(player.id)}
                        >
                          Remove player
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <label className="field-label field-label--compact">
                  Score
                  <input
                    className="score-input score-input--compact"
                    type="number"
                    inputMode="numeric"
                    placeholder={isWinner ? 'Auto' : 'Enter'}
                    disabled={isWinner}
                    value={isWinner ? '' : roundScores[player.id] || ''}
                    onChange={(event) => setScoreForPlayer(player.id, event.target.value)}
                  />
                </label>

                <div className="round-preview round-preview--compact">
                  <span>This round</span>
                  <strong>{roundPreview}</strong>
                </div>
              </section>
            );
          })}
        </div>

        <div className="bottom-actions bottom-actions--centered bottom-actions--spaced">
          <button className="primary-button" onClick={applyRound}>
            Apply round
          </button>
        </div>
      </div>
    </div>
  );
}
