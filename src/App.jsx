import { useEffect, useMemo, useState } from 'react';
import './App.css';
import { deleteArchivedGame, saveArchivedGame, subscribeToArchivedGames } from './archiveService';
import {
  getFirebaseAuthErrorMessage,
  isFirebaseConfigured,
  onRemiAuthStateChange,
  signInAsGuest,
  signInWithGoogle,
  signOutFromRemi,
  waitForAuthInit,
} from './firebase';

const HISTORY_KEY = 'remi-history-v1';
const ACTIVE_GAME_KEY = 'remi-active-game-v1';

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

function buildArchivedGame(players, winnerName, roundNumber) {
  const now = Date.now();

  return {
    id: now,
    createdAt: new Date(now).toISOString(),
    createdAtMs: now,
    winner: winnerName,
    roundCount: Math.max(roundNumber - 1, 0),
    players: players.map((player) => ({
      name: player.name,
      score: player.score,
    })),
  };
}

function getArchiveSignature(game) {
  const timestamp = game.createdAtMs || Date.parse(game.createdAt || '') || 0;
  return `${timestamp}-${game.winner}-${game.players.length}`;
}

function normalizeRoundScoreInput(value) {
  return String(value || '')
    .replace(/[^0-9]/g, '')
    .slice(0, 4);
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
  const [activeScorePlayerId, setActiveScorePlayerId] = useState(null);
  const [roundNumber, setRoundNumber] = useState(1);
  const [gameWinner, setGameWinner] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [expandedHistoryId, setExpandedHistoryId] = useState(null);
  const [pendingPlayers, setPendingPlayers] = useState([]);
  const [openMenuPlayerId, setOpenMenuPlayerId] = useState(null);
  const [cloudHistory, setCloudHistory] = useState([]);
  const [cloudLoadState, setCloudLoadState] = useState(isFirebaseConfigured ? 'disabled' : 'disabled');
  const [cloudSaveState, setCloudSaveState] = useState('idle');
  const [cloudErrorMessage, setCloudErrorMessage] = useState('');
  const [authUser, setAuthUser] = useState(null);
  const [authState, setAuthState] = useState(isFirebaseConfigured ? 'loading' : 'disabled');
  const [authActionState, setAuthActionState] = useState('idle');
  const [showAccountSheet, setShowAccountSheet] = useState(false);
  const [hasLoadedActiveGame, setHasLoadedActiveGame] = useState(false);
  const [localHistory, setLocalHistory] = useState(() => {
    try {
      const stored = localStorage.getItem(HISTORY_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(localHistory));
  }, [localHistory]);


  useEffect(() => {
  try {
    const storedActiveGame = localStorage.getItem(ACTIVE_GAME_KEY);

    if (storedActiveGame) {
      const parsedGame = JSON.parse(storedActiveGame);

      setStep(parsedGame.step ?? 'setup');
      setGameView(parsedGame.gameView ?? 'roundSetup');
      setNumPlayers(parsedGame.numPlayers ?? 2);
      setPlayerNames(parsedGame.playerNames ?? ['', '']);
      setPlayers(parsedGame.players ?? []);
      setCurrentShufflerIndex(parsedGame.currentShufflerIndex ?? 0);
      setWinnerId(parsedGame.winnerId ?? null);
      setWinnerType(parsedGame.winnerType ?? 'regular');
      setRoundScores(parsedGame.roundScores ?? {});
      setActiveScorePlayerId(parsedGame.activeScorePlayerId ?? null);
      setRoundNumber(parsedGame.roundNumber ?? 1);
      setGameWinner(parsedGame.gameWinner ?? null);
      setPendingPlayers(parsedGame.pendingPlayers ?? []);
    }
  } catch (error) {
    console.error('Failed to load active game state', error);
  } finally {
    setHasLoadedActiveGame(true);
  }
}, []);

useEffect(() => {
  if (!hasLoadedActiveGame) {
    return;
  }

  const activeGameState = {
    step,
    gameView,
    numPlayers,
    playerNames,
    players,
    currentShufflerIndex,
    winnerId,
    winnerType,
    roundScores,
    activeScorePlayerId,
    roundNumber,
    gameWinner,
    pendingPlayers,
  };

  localStorage.setItem(ACTIVE_GAME_KEY, JSON.stringify(activeGameState));
}, [
  activeScorePlayerId,
  gameView,
  gameWinner,
  hasLoadedActiveGame,
  numPlayers,
  pendingPlayers,
  playerNames,
  players,
  currentShufflerIndex,
  roundNumber,
  roundScores,
  step,
  winnerId,
  winnerType,
]);
  
  useEffect(() => {
    if (!isFirebaseConfigured) {
      return undefined;
    }

    let active = true;
    let unsubscribeAuth = () => {};

    waitForAuthInit()
      .catch((error) => {
        if (!active) return;
        console.error('Firebase auth bootstrap failed', error);
        setAuthState('error');
        setCloudErrorMessage(`Firebase sign-in setup failed. ${getFirebaseAuthErrorMessage(error)}`);
      })
      .finally(() => {
        if (!active) return;
        unsubscribeAuth = onRemiAuthStateChange((user) => {
          if (!active) return;
          setAuthUser(user);
          setAuthState('ready');
          setCloudErrorMessage('');

          if (user) {
            setCloudLoadState('loading');
          } else {
            setCloudHistory([]);
            setCloudLoadState('disabled');
          }
        });
      });

    return () => {
      active = false;
      unsubscribeAuth();
    };
  }, []);

  useEffect(() => {
    if (!isFirebaseConfigured || !authUser) {
      if (!authUser) {
        setCloudHistory([]);
      }
      return undefined;
    }

    setCloudLoadState('loading');

    const unsubscribe = subscribeToArchivedGames(
      (games) => {
        setCloudHistory(games);
        setCloudLoadState('ready');
        setCloudErrorMessage('');
      },
      (error) => {
        console.error('Failed to load Firestore archive', error);
        setCloudLoadState('error');
        setCloudErrorMessage(`Firestore archive could not be loaded. ${getFirebaseAuthErrorMessage(error)}`);
      },
    );

    return unsubscribe;
  }, [authUser?.uid]);

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

  const authModeLabel = useMemo(() => {
    if (!isFirebaseConfigured) {
      return 'Cloud archive is disabled until Firebase is configured.';
    }

    if (authState === 'loading') {
      return 'Checking sign-in status...';
    }

    if (authState === 'error') {
      return 'Sign-in setup hit a problem. Local archive stays available.';
    }

    if (!authUser) {
      return 'Choose Guest first, or sign in with Google for cross-device archive sync.';
    }

    if (authUser.isAnonymous) {
      return 'Signed in as Guest. This device/browser will keep the same private archive.';
    }

    return `Signed in with Google as ${authUser.displayName || authUser.email || 'your account'}.`;
  }, [authState, authUser]);

  const gameHistory = useMemo(() => {
  const localGamesWithSource = localHistory.map((game) => ({
    ...game,
    source: 'local',
  }));

  if (cloudLoadState !== 'ready') {
    return localGamesWithSource.sort((a, b) => {
      const aTime = a.createdAtMs || Date.parse(a.createdAt || '') || 0;
      const bTime = b.createdAtMs || Date.parse(b.createdAt || '') || 0;
      return bTime - aTime;
    });
  }

  const cloudGamesWithSource = cloudHistory.map((game) => ({
    ...game,
    source: 'cloud',
  }));

  const merged = [...cloudGamesWithSource, ...localGamesWithSource];
  const seen = new Set();

  return merged
    .filter((game) => {
      const key = getArchiveSignature(game);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => {
      const aTime = a.createdAtMs || Date.parse(a.createdAt || '') || 0;
      const bTime = b.createdAtMs || Date.parse(b.createdAt || '') || 0;
      return bTime - aTime;
    });
}, [cloudHistory, cloudLoadState, localHistory]);

  const accountPrimaryLabel = useMemo(() => {
    if (!authUser) return 'Not signed in';
    if (authUser.isAnonymous) return 'Guest mode active';
    return authUser.displayName || authUser.email || 'Google account active';
  }, [authUser]);

  const archiveStatusLabel = useMemo(() => {
    if (!isFirebaseConfigured) {
      return 'Archive mode: local only';
    }

    if (authState === 'loading' || authActionState !== 'idle') {
      return 'Archive mode: preparing your private cloud archive...';
    }

    if (authState === 'error') {
      return 'Archive mode: sign-in setup failed, local backup only';
    }

    if (!authUser) {
      return 'Archive mode: local only until you choose Guest or Google';
    }

    if (cloudSaveState === 'saving') {
      return 'Archive mode: saving your private archive...';
    }

    if (cloudSaveState === 'error') {
      return 'Archive mode: Firestore save failed, local backup kept';
    }

    if (cloudLoadState === 'loading') {
      return 'Archive mode: connecting to your private Firestore archive...';
    }

    if (cloudLoadState === 'error') {
      return 'Archive mode: Firestore unavailable, local backup only';
    }

    return 'Archive mode: private Firestore archive live';
  }, [authActionState, authState, authUser, cloudLoadState, cloudSaveState]);

  const resetRoundInputs = () => {
    setWinnerId(null);
    setWinnerType('regular');
    setRoundScores({});
    setOpenMenuPlayerId(null);
    setActiveScorePlayerId(null);
  };

  const removeLocalArchivedGame = (gameToDelete) => {
  const signatureToDelete = getArchiveSignature(gameToDelete);

  setLocalHistory((prev) =>
    prev.filter((game) => getArchiveSignature(game) !== signatureToDelete),
  );
};
const clearSavedActiveGame = () => {
  localStorage.removeItem(ACTIVE_GAME_KEY);
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
  clearSavedActiveGame();
};

 const confirmGoHome = () => {
  if (!gameWinner) {
    clearGameState();
    return;
  }

  const confirmed = window.confirm(`Save finished game for ${gameWinner.name} and go home?`);
  if (!confirmed) return;

  archiveFinishedGame(players, gameWinner.name);
  clearGameState();
};
  const archiveFinishedGame = (finalPlayers, winnerName) => {
    const archiveEntry = buildArchivedGame(finalPlayers, winnerName, roundNumber);

    setLocalHistory((prev) => [archiveEntry, ...prev]);

    if (isFirebaseConfigured && authUser) {
      setCloudSaveState('saving');
      saveArchivedGame(archiveEntry)
        .then(() => {
          setCloudSaveState('idle');
          setCloudErrorMessage('');
        })
        .catch((error) => {
          console.error('Failed to save Firestore archive', error);
          setCloudSaveState('error');
          setCloudErrorMessage(`Game was saved locally, but Firestore save failed. ${getFirebaseAuthErrorMessage(error)}`);
        });
    }
  };

  const handleDeleteArchivedGame = async (game) => {
  const confirmed = window.confirm(`Are you sure you want to delete the archived game won by ${game.winner}?`);
  if (!confirmed) return;

  removeLocalArchivedGame(game);

  if (game.source === 'cloud') {
    try {
      await deleteArchivedGame(game.id);
      setCloudErrorMessage('');
    } catch (error) {
      console.error('Failed to delete Firestore archive', error);
      setCloudErrorMessage(`Archive delete failed. ${getFirebaseAuthErrorMessage(error)}`);
    }
  }

  setExpandedHistoryId((current) => (current === game.id ? null : current));
};

  const handleGuestLogin = async () => {
    setAuthActionState('guest');
    setCloudErrorMessage('');

    try {
      await signInAsGuest();
    } catch (error) {
      console.error('Guest sign-in failed', error);
      setCloudErrorMessage(`Guest sign-in failed. ${getFirebaseAuthErrorMessage(error)}`);
      setAuthState('error');
    } finally {
      setAuthActionState('idle');
    }
  };

  const handleGoogleLogin = async () => {
    setAuthActionState('google');
    setCloudErrorMessage('');

    try {
      await signInWithGoogle();
    } catch (error) {
      console.error('Google sign-in failed', error);
      setCloudErrorMessage(`Google sign-in failed. ${getFirebaseAuthErrorMessage(error)}`);
      setAuthState('error');
      setAuthActionState('idle');
      return;
    }

    setShowAccountSheet(false);
    setAuthActionState('idle');
  };

  const handleSignOut = async () => {
    const confirmed = window.confirm('Sign out and switch login mode? Your private cloud archive stays saved, but this device will stop showing it until you sign in again.');
    if (!confirmed) return;

    try {
      await signOutFromRemi();
      setCloudSaveState('idle');
      setCloudErrorMessage('');
      setShowAccountSheet(false);
    } catch (error) {
      console.error('Sign out failed', error);
      setCloudErrorMessage(`Sign out failed. ${getFirebaseAuthErrorMessage(error)}`);
    }
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
    setShowAccountSheet(false);
  };

  const proceedToRoundScores = () => {
    if (!winnerId) {
      alert('Select the winner first.');
      return;
    }

    setGameView('roundScores');
  };

  const setScoreForPlayer = (playerId, value) => {
    setRoundScores((prev) => ({ ...prev, [playerId]: normalizeRoundScoreInput(value) }));
  };

  const getScoreInputClassName = (playerId, isWinner) => {
    if (isWinner) {
      return 'score-input score-input--compact score-input--auto';
    }

    const hasValue = String(roundScores[playerId] ?? '').length > 0;

    if (activeScorePlayerId === playerId) {
      return `score-input score-input--compact ${hasValue ? 'score-input--editing score-input--editing-has-value' : 'score-input--editing'}`;
    }

    if (hasValue) {
      return 'score-input score-input--compact score-input--filled';
    }

    return 'score-input score-input--compact';
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
  setStep('end');
};

  const renderAccountControls = () => {
    if (!authUser) return null;

    return (
      <button
        className="account-menu-trigger"
        aria-label="Open account options"
        onClick={() => setShowAccountSheet(true)}
      >
        ⋯
      </button>
    );
  };


  if (showAccountSheet && authUser) {
    return (
      <div className="app-shell">
        <div className="screen-card account-screen">
          <div className="account-screen__header">
            <div>
              <p className="eyebrow">Account</p>
              <h1>{accountPrimaryLabel}</h1>
              <p className="subtitle">{authModeLabel}</p>
              <p className="archive-note">{archiveStatusLabel}</p>
              {cloudErrorMessage && <p className="archive-error">{cloudErrorMessage}</p>}
            </div>
            <button className="account-screen__close" onClick={() => setShowAccountSheet(false)} aria-label="Close account screen">
              ×
            </button>
          </div>

          <div className="account-screen__body">
            {authUser.isAnonymous ? (
              <div className="account-screen__card">
                <p className="eyebrow eyebrow--dark">Upgrade</p>
                <h2>Continue with Google</h2>
                <p className="subtitle subtitle--dark">
                  Keep your archive across devices by linking your current Guest profile to Google.
                </p>
                <button
                  className="auth-action-button auth-action-button--google"
                  onClick={handleGoogleLogin}
                  disabled={authActionState !== 'idle'}
                >
                  {authActionState === 'google' ? 'Opening Google sign-in…' : 'Upgrade guest to Google'}
                </button>
              </div>
            ) : (
              <div className="account-screen__card">
                <p className="eyebrow eyebrow--dark">Connected</p>
                <h2>Google account active</h2>
                <p className="subtitle subtitle--dark">
                  Your private archive will stay available anywhere you sign in with this Google account.
                </p>
              </div>
            )}

            <div className="account-screen__card">
              <p className="eyebrow eyebrow--dark">Switch account</p>
              <h2>Sign out</h2>
              <p className="subtitle subtitle--dark">
                Sign out if you want to switch between Guest mode and Google login.
              </p>
              <button
                className="auth-action-button auth-action-button--switch"
                onClick={handleSignOut}
                disabled={authActionState !== 'idle'}
              >
                Sign out / switch account
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (showHistory) {
    return (
      <div className="app-shell">
        {renderAccountControls()}
        <div className="screen-card history-screen">
          <div className="history-header">
            <div>
              <p className="eyebrow">Archive</p>
              <h1>Game history</h1>
              <p className="archive-note">{archiveStatusLabel}</p>
              {cloudErrorMessage && <p className="archive-error">{cloudErrorMessage}</p>}
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

    <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'flex-end' }}>
      <button
        className="secondary-button"
        onClick={() => handleDeleteArchivedGame(game)}
      >
        Delete
      </button>
    </div>
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
        {renderAccountControls()}
        <div className="screen-card setup-screen">
          <p className="eyebrow">Score tracker</p>
          <h1>Remi</h1>
          <p className="subtitle">Create the table, pick the first shuffler, and track every round cleanly.</p>
          <p className="archive-note archive-note--setup">{archiveStatusLabel}</p>
          {cloudErrorMessage && <p className="archive-error">{cloudErrorMessage}</p>}

          {!authUser && (
            <section className="auth-panel">
              <div className="auth-panel__copy">
                <p className="eyebrow eyebrow--dark">Private archive</p>
                <h2>1. Guest login</h2>
                <p className="subtitle subtitle--dark">Recommended first. Fast start, no account needed.</p>
                <button
                  className="primary-button auth-button"
                  onClick={handleGuestLogin}
                  disabled={authActionState !== 'idle'}
                >
                  {authActionState === 'guest' ? 'Signing in…' : 'Continue as Guest'}
                </button>

                <div className="auth-panel__divider">or</div>

                <h2>2. Google login</h2>
                <p className="subtitle subtitle--dark">Use Google if you want the same archive across devices.</p>
                <button
                  className="secondary-button auth-button auth-button--google auth-button--strong"
                  onClick={handleGoogleLogin}
                  disabled={authActionState !== 'idle'}
                >
                  {authActionState === 'google' ? 'Opening Google sign-in…' : 'Continue with Google'}
                </button>
              </div>

              <div className="auth-panel__status">
                <span className="auth-badge">Not signed in</span>
                <p className="auth-panel__hint">{authModeLabel}</p>
              </div>
            </section>
          )}

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
        {renderAccountControls()}
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
        {renderAccountControls()}
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
              End and save
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (gameView === 'roundSetup') {
    return (
      <div className="app-shell">
        {renderAccountControls()}
        <div className="screen-card round-setup-screen">
          <div className="game-header game-header--stacked">
            <div>
              <p className="eyebrow">Round {roundNumber}</p>
              <h1>Choose winner</h1>
              <p className="subtitle">Shuffler: <strong>{currentShuffler?.name}</strong></p>
            </div>
            <button className="danger-primary-button" onClick={endGame}>
              Status
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
      {renderAccountControls()}
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
                    className={getScoreInputClassName(player.id, isWinner)}
                    type="text"
                    inputMode="numeric"
                    placeholder={isWinner ? '' : 'Enter'}
                    disabled={isWinner}
                    readOnly={isWinner}
                    value={isWinner ? 'Auto' : roundScores[player.id] || ''}
                    onFocus={() => {
                      if (!isWinner) setActiveScorePlayerId(player.id);
                    }}
                    onBlur={() => {
                      if (activeScorePlayerId === player.id) {
                        setActiveScorePlayerId(null);
                      }
                    }}
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
