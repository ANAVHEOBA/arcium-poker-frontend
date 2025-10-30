'use client';

import { useParams, useRouter } from 'next/navigation';
import { PublicKey } from '@solana/web3.js';
import { useEffect, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useJoinGame } from '@/hooks/useJoinGame';
import { useStartGame } from '@/hooks/useStartGame';
import { useAdvanceStage } from '@/hooks/useAdvanceStage';
import { useShowdown } from '@/hooks/useShowdown';
import { PlayerActionButtons } from '@/components/game/PlayerActionButtons';
import { PlayerHoleCards } from '@/components/game/PlayerHoleCards';
import { WinnerDisplay } from '@/components/game/WinnerDisplay';
import { DeckManager } from '@/lib/cards/deck';

export default function GamePage() {
  const params = useParams();
  const router = useRouter();
  const wallet = useWallet();
  const gamePDA = params.gamePDA as string;
  const [game, setGame] = useState<any>(null);
  const [players, setPlayers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [buyInAmount, setBuyInAmount] = useState<string>('');
  const [refreshKey, setRefreshKey] = useState(0);
  const { joinGame, loading: joining, error: joinError } = useJoinGame();
  const { startGame, loading: starting, error: startError } = useStartGame();
  const { advanceStage, loading: advancing, error: advanceError } = useAdvanceStage();
  const { executeShowdown, loading: showingDown, error: showdownError } = useShowdown();

  // Helper to refresh game data
  const refreshGame = () => {
    setRefreshKey(prev => prev + 1);
  };

  useEffect(() => {
    async function fetchGame() {
      try {
        setLoading(true);
        console.log('🎮 Fetching game:', gamePDA);

        // Initialize program with read-only provider
        const { Connection } = await import('@solana/web3.js');
        const { AnchorProvider, Program } = await import('@coral-xyz/anchor');
        const idl = (await import('@/arcium_poker.json')).default;

        const connection = new Connection(
          process.env.NEXT_PUBLIC_RPC_ENDPOINT || 'https://api.devnet.solana.com',
          'confirmed'
        );

        const provider = new AnchorProvider(
          connection,
          {} as any,
          { commitment: 'confirmed' }
        );

        const program = new Program(idl as any, provider);

        // Fetch the game account with retry logic (account may not be propagated yet)
        let gameAccount;
        let retries = 5;
        while (retries > 0) {
          try {
            gameAccount = await program.account.game.fetch(new PublicKey(gamePDA));
            console.log('✅ Game fetched:', gameAccount);
            break;
          } catch (err: any) {
            if (retries === 1) throw err; // Last retry, throw error
            console.log(`⏳ Waiting for account to propagate... (${retries} retries left)`);
            await new Promise(resolve => setTimeout(resolve, 1000));
            retries--;
          }
        }
        
        // Fetch all player states for this game
        console.log('👥 Fetching players...');
        const allPlayerStates = await program.account.playerState.all();
        const gamePlayers = allPlayerStates.filter((p: any) => 
          p.account.game.toBase58() === gamePDA
        );
        console.log(`✅ Found ${gamePlayers.length} player(s)`);
        
        setGame(gameAccount);
        setPlayers(gamePlayers);
        setError(null);
      } catch (err: any) {
        console.error('❌ Error fetching game:', err);
        setError(err.message || 'Failed to load game');
      } finally {
        setLoading(false);
      }
    }

    if (gamePDA) {
      fetchGame();
    }
  }, [gamePDA, refreshKey]);

  const handleJoinGame = async () => {
    if (!wallet.publicKey) {
      alert('Please connect your wallet first');
      return;
    }

    const amount = parseFloat(buyInAmount);
    if (isNaN(amount) || amount <= 0) {
      alert('Please enter a valid buy-in amount');
      return;
    }

    const minBuyIn = game?.minBuyIn?.toNumber() / 1e9 || 0;
    const maxBuyIn = game?.maxBuyIn?.toNumber() / 1e9 || 0;

    if (amount < minBuyIn || amount > maxBuyIn) {
      alert(`Buy-in must be between ${minBuyIn} and ${maxBuyIn} SOL`);
      return;
    }

    const result = await joinGame(new PublicKey(gamePDA), amount);
    
    if (result.success) {
      alert('Successfully joined the game! 🎉');
      // Refresh the game data to show updated player count
      window.location.reload();
    } else {
      alert(`Failed to join game: ${result.error}`);
    }
  };

  const handleStartGame = async () => {
    if (!wallet.publicKey) {
      alert('Please connect your wallet');
      return;
    }

    if (wallet.publicKey.toBase58() !== game?.authority?.toBase58()) {
      alert('Only the game creator can start the game');
      return;
    }

    if (players.length < 2) {
      alert('Need at least 2 players to start the game');
      return;
    }

    // Extract gameId from game account (it's a BN, convert to number)
    const gameId = game?.gameId?.toNumber();
    if (gameId === undefined) {
      alert('Failed to get game ID');
      return;
    }

    const result = await startGame(new PublicKey(gamePDA), gameId);
    
    if (result.success) {
      alert('Game started! 🎉 Let the poker begin!');
      // Wait a bit for blockchain state to finalize before refreshing
      await new Promise(resolve => setTimeout(resolve, 2000));
      await refreshGame();
      window.location.reload();
    } else {
      alert(`Failed to start game: ${result.error}`);
    }
  };

  const handleAdvanceStage = async () => {
    if (!wallet.publicKey) {
      alert('Please connect your wallet');
      return;
    }

    const result = await advanceStage(new PublicKey(gamePDA));
    
    if (result.success) {
      alert('✅ Stage advanced! Moving to next round...');
      refreshGame();
    } else {
      alert(`Failed to advance stage: ${result.error}`);
    }
  };

  const handleShowdown = async () => {
    if (!wallet.publicKey) {
      alert('Please connect your wallet');
      return;
    }

    // Get all player state PDAs (sorted by seat index)
    const sortedPlayers = [...players].sort((a: any, b: any) => 
      a.account.seatIndex - b.account.seatIndex
    );
    const playerStatePDAs = sortedPlayers.map((p: any) => p.publicKey);

    console.log('📝 Passing', playerStatePDAs.length, 'player state PDAs to showdown');

    const result = await executeShowdown(new PublicKey(gamePDA), playerStatePDAs);
    
    if (result.success) {
      alert('🏆 Showdown complete! Winner determined!');
      refreshGame();
    } else {
      alert(`Failed to execute showdown: ${result.error}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0b0d] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-[#00ff88] mx-auto mb-4"></div>
          <p className="text-gray-400 text-lg">Loading game...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0a0b0d] flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-4">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h1 className="text-white text-3xl font-bold mb-2">Game Not Found</h1>
          <p className="text-gray-400 mb-6">{error}</p>
          <a
            href="/lobby"
            className="inline-block px-6 py-3 bg-[#00ff88] text-black font-bold rounded-lg hover:bg-[#00dd77] transition shadow-lg shadow-[#00ff88]/20"
          >
            Back to Lobby
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0b0d] py-12 px-4">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <a
            href="/lobby"
            className="text-[#00ff88] hover:text-[#00dd77] mb-4 inline-flex items-center gap-2 transition"
          >
            <span>←</span>
            <span>Back to Lobby</span>
          </a>
          <h1 className="text-4xl font-bold text-white mb-2">
            Table #{game?.gameId?.toString() || 'Unknown'}
          </h1>
          <p className="text-gray-500 text-xs font-mono break-all">
            {gamePDA}
          </p>
        </div>

        {/* Game Status Banner */}
        {game?.stage && !game.stage.waiting && (
          <div className="bg-gradient-to-r from-[#00ff88]/20 to-purple-500/20 border border-[#00ff88]/30 rounded-xl p-4 mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-[#00ff88] rounded-full animate-pulse"></div>
                <div>
                  <h3 className="text-lg font-bold text-white">Game In Progress</h3>
                  <p className="text-sm text-gray-400">
                    Stage: {Object.keys(game.stage)[0].replace(/([A-Z])/g, ' $1').trim()}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-400">Current Pot</p>
                <p className="text-2xl font-bold text-[#00ff88]">
                  {(game?.pot?.toNumber() || 0) / 1e9} SOL
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Game Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {/* Status Card */}
          <div className="bg-[#1a1b1f] border border-gray-800 rounded-xl p-6 hover:border-gray-700 transition">
            <h2 className="text-lg font-bold text-white mb-4">Game Status</h2>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-400">Status:</span>
                <span className={`font-semibold ${
                  game?.stage?.waiting ? 'text-yellow-500' : 'text-[#00ff88]'
                }`}>
                  {game?.stage?.waiting ? 'Waiting' : 'Playing'}
                </span>
              </div>
              {!game?.stage?.waiting && (
                <>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Current Turn:</span>
                    <span className="text-white font-semibold">
                      Player {(game?.currentPlayerIndex || 0) + 1}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Current Bet:</span>
                    <span className="text-white font-semibold">
                      {(game?.currentBet?.toNumber() || 0) / 1e9} SOL
                    </span>
                  </div>
                </>
              )}
              <div className="flex justify-between">
                <span className="text-gray-400">Players:</span>
                <span className="text-white font-semibold">
                  {game?.playerCount || 0} / {game?.maxPlayers || 0}
                </span>
              </div>
            </div>
          </div>

          {/* Blinds Card */}
          <div className="bg-[#1a1b1f] border border-gray-800 rounded-xl p-6 hover:border-gray-700 transition">
            <h2 className="text-lg font-bold text-white mb-4">Blinds & Buy-in</h2>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-400">Small Blind:</span>
                <span className="text-white font-semibold">
                  {(game?.smallBlind?.toNumber() || 0) / 1e9} SOL
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Big Blind:</span>
                <span className="text-white font-semibold">
                  {(game?.bigBlind?.toNumber() || 0) / 1e9} SOL
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Min Buy-in:</span>
                <span className="text-white font-semibold">
                  {(game?.minBuyIn?.toNumber() || 0) / 1e9} SOL
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Max Buy-in:</span>
                <span className="text-white font-semibold">
                  {(game?.maxBuyIn?.toNumber() || 0) / 1e9} SOL
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Player Hole Cards */}
        {players.some((p: any) => p.account.player.toBase58() === wallet.publicKey?.toBase58()) && !game?.stage?.waiting && (
          <PlayerHoleCards
            playerState={players.find((p: any) => p.account.player.toBase58() === wallet.publicKey?.toBase58())?.account}
            game={game}
            isCurrentUser={true}
            showRevealed={game?.stage?.showdown || game?.stage?.finished}
          />
        )}

        {/* Winner Display (if game finished OR at showdown with no actions left) */}
        {(game?.stage?.finished || game?.stage?.showdown) && players.length > 0 && (
          <WinnerDisplay
            game={game}
            players={players}
            myPublicKey={wallet.publicKey?.toBase58()}
          />
        )}

        {/* Showdown Button (if at Showdown stage) */}
        {game?.stage?.showdown && wallet.connected && (
          <div className="bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border-2 border-yellow-500 rounded-xl p-6 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
                  <span>🏆</span>
                  Showdown!
                </h2>
                <p className="text-gray-300 text-sm">
                  All betting rounds complete. Reveal cards and determine the winner!
                </p>
                <p className="text-yellow-400 text-xs mt-2">
                  💡 <strong>Tip:</strong> Since cards are encrypted (MVP), we'll split the pot evenly for testing.
                </p>
              </div>
              <button
                onClick={handleShowdown}
                disabled={showingDown}
                className={`px-6 py-3 font-bold rounded-lg transition shadow-lg ${
                  showingDown
                    ? 'bg-gray-800 text-gray-600 cursor-not-allowed'
                    : 'bg-yellow-500 text-black hover:bg-yellow-400 shadow-yellow-500/20'
                }`}
              >
                {showingDown ? 'Revealing...' : '🎴 Reveal & Determine Winner'}
              </button>
            </div>
            {showdownError && (
              <div className="mt-3 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                <p className="text-red-400 text-sm">{showdownError}</p>
              </div>
            )}
          </div>
        )}

        {/* Advance Stage Button */}
        {!game?.stage?.waiting && !game?.stage?.showdown && !game?.stage?.finished && wallet.connected && (
          <div className="bg-[#1a1b1f] border border-gray-800 rounded-xl p-6 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white mb-2">Betting Round Complete</h2>
                <p className="text-gray-400 text-sm">
                  All players have acted. Advance to the next stage.
                </p>
              </div>
              <button
                onClick={handleAdvanceStage}
                disabled={advancing}
                className={`px-6 py-3 font-bold rounded-lg transition shadow-lg ${
                  advancing
                    ? 'bg-gray-800 text-gray-600 cursor-not-allowed'
                    : 'bg-purple-600 text-white hover:bg-purple-500 shadow-purple-500/20'
                }`}
              >
                {advancing ? 'Advancing...' : '➡️ Next Stage'}
              </button>
            </div>
            {advanceError && (
              <div className="mt-3 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                <p className="text-red-400 text-sm">{advanceError}</p>
              </div>
            )}
          </div>
        )}

        {/* Community Cards (if game started) */}
        {!game?.stage?.waiting && (
          <div className="bg-[#1a1b1f] border border-gray-800 rounded-xl p-6 mb-6">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <span>🃏</span>
              Community Cards
            </h2>
            <div className="flex items-center justify-center gap-3 py-6">
              {game?.communityCards && game.communityCardsRevealed > 0 ? (
                game.communityCards.slice(0, game.communityCardsRevealed).map((cardIndex: number, index: number) => {
                  const cardInfo = DeckManager.getCardInfoFromIndex(cardIndex);
                  return (
                    <div
                      key={index}
                      className="w-16 h-24 bg-white rounded-lg border-2 border-gray-300 flex items-center justify-center shadow-lg"
                    >
                      <span className={`text-2xl font-bold ${cardInfo.color === 'red' ? 'text-red-500' : 'text-gray-800'}`}>
                        {cardInfo.display}
                      </span>
                    </div>
                  );
                })
              ) : (
                <p className="text-gray-500 text-sm">No cards revealed yet</p>
              )}
            </div>
            <div className="flex items-center justify-center gap-2 text-xs text-gray-500">
              <span className={game?.communityCardsRevealed >= 3 ? 'text-[#00ff88]' : ''}>Flop (3)</span>
              <span>•</span>
              <span className={game?.communityCardsRevealed >= 4 ? 'text-[#00ff88]' : ''}>Turn (4)</span>
              <span>•</span>
              <span className={game?.communityCardsRevealed === 5 ? 'text-[#00ff88]' : ''}>River (5)</span>
            </div>
          </div>
        )}

        {/* Players List */}
        <div className="bg-[#1a1b1f] border border-gray-800 rounded-xl p-6 mb-6">
          <h2 className="text-lg font-bold text-white mb-4">
            Players ({players.length}/{game?.maxPlayers || 0})
          </h2>
          
          {players.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">No players yet. Be the first to join!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {players.map((playerData: any, index: number) => {
                const player = playerData.account;
                const isCurrentUser = wallet.publicKey?.toBase58() === player.player.toBase58();
                const isCurrentTurn = !game?.stage?.waiting && game?.currentPlayerIndex === player.seatIndex;
                
                return (
                  <div
                    key={playerData.publicKey.toBase58()}
                    className={`flex items-center justify-between p-4 rounded-lg border transition ${
                      isCurrentTurn
                        ? 'bg-[#00ff88]/20 border-[#00ff88] ring-2 ring-[#00ff88]/50'
                        : isCurrentUser
                        ? 'bg-[#00ff88]/10 border-[#00ff88]/30'
                        : 'bg-[#0a0b0d] border-gray-800'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                        isCurrentUser ? 'bg-[#00ff88] text-black' : 'bg-gray-700 text-white'
                      }`}>
                        {index + 1}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-white font-medium">
                            {player.player.toBase58().slice(0, 4)}...{player.player.toBase58().slice(-4)}
                          </p>
                          {isCurrentUser && (
                            <span className="text-xs bg-[#00ff88] text-black px-2 py-0.5 rounded font-bold">
                              YOU
                            </span>
                          )}
                          {isCurrentTurn && (
                            <span className="text-xs bg-yellow-500 text-black px-2 py-0.5 rounded font-bold animate-pulse">
                              TURN
                            </span>
                          )}
                        </div>
                        <p className="text-gray-500 text-sm">
                          Seat {player.seatIndex !== null ? player.seatIndex + 1 : 'TBD'}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-white font-bold">
                        {(player.chipStack?.toNumber() || 0) / 1e9} SOL
                      </p>
                      <p className="text-gray-500 text-xs">Chips</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Arcium MPC Badge */}
        {game?.deck_initialized && (
          <div className="bg-gradient-to-r from-purple-600/20 to-blue-600/20 border-2 border-purple-500 rounded-xl p-4 mb-6">
            <div className="flex items-center gap-3">
              <div className="bg-purple-600 p-2 rounded-lg">
                🔐
              </div>
              <div>
                <div className="font-bold text-white">Secured by Arcium MPC</div>
                <div className="text-sm text-gray-400">
                  Deck shuffled using multi-party computation
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Game Info */}
        <div className="bg-[#1a1b1f] border border-gray-800 rounded-xl p-6 mb-6">
          <h2 className="text-xl font-bold mb-4">Game Information</h2>
          <div className="flex justify-between">
            <span className="text-gray-400">Min Buy-in:</span>
            <span className="text-white font-semibold">
              {(game?.minBuyIn?.toNumber() || 0) / 1e9} SOL
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Max Buy-in:</span>
            <span className="text-white font-semibold">
              {(game?.maxBuyIn?.toNumber() || 0) / 1e9} SOL
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="bg-[#1a1b1f] border border-gray-800 rounded-xl p-6 mb-6">
          <h2 className="text-lg font-bold text-white mb-4">
            {players.some((p: any) => p.account.player.toBase58() === wallet.publicKey?.toBase58()) 
              ? 'Game Actions' 
              : 'Join Game'}
          </h2>
          
          {!wallet.connected ? (
            <div className="text-center py-4">
              <p className="text-gray-400 mb-4">Connect your wallet to join this game</p>
            </div>
          ) : players.some((p: any) => p.account.player.toBase58() === wallet.publicKey?.toBase58()) ? (
            // Player is in the game
            (() => {
              const currentPlayer = players.find((p: any) => p.account.player.toBase58() === wallet.publicKey?.toBase58());
              const isMyTurn = !game?.stage?.waiting && game?.currentPlayerIndex === currentPlayer?.account.seatIndex;
              const gameIsPlaying = !game?.stage?.waiting && !game?.stage?.finished;

              // If game is playing and it's the player's turn, show action buttons
              if (gameIsPlaying && isMyTurn) {
                return (
                  <PlayerActionButtons
                    gamePDA={gamePDA}
                    game={game}
                    playerState={currentPlayer?.account}
                    isMyTurn={isMyTurn}
                    onActionComplete={refreshGame}
                  />
                );
              }

              // Otherwise show waiting state or start button
              return (
                <div className="text-center py-8">
                  <div className="text-[#00ff88] text-5xl mb-4">✓</div>
                  <h3 className="text-xl font-bold text-white mb-2">You're In!</h3>
                  {!gameIsPlaying ? (
                    <>
                      <p className="text-gray-400 mb-6">
                        Waiting for {game?.maxPlayers - players.length} more player(s) to join...
                      </p>
                      {wallet.publicKey?.toBase58() === game?.authority?.toBase58() && players.length >= 2 && game?.stage?.waiting && (
                        <div className="space-y-3">
                          {startError && (
                            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                              <p className="text-red-400 text-sm">{startError}</p>
                            </div>
                          )}
                          <button
                            onClick={handleStartGame}
                            disabled={starting}
                            className={`px-6 py-3 font-bold rounded-lg transition shadow-lg shadow-[#00ff88]/20 ${
                              starting
                                ? 'bg-gray-800 text-gray-600 cursor-not-allowed'
                                : 'bg-[#00ff88] text-black hover:bg-[#00dd77]'
                            }`}
                          >
                            {starting ? 'Starting...' : 'Start Game'}
                          </button>
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-gray-400 mb-6">
                      Game in progress. Waiting for your turn...
                    </p>
                  )}
                </div>
              );
            })()
          ) : game?.playerCount >= game?.maxPlayers ? (
            <div className="text-center py-4">
              <p className="text-yellow-500 mb-4">⚠️ Game is full</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Buy-in Amount (SOL)
                </label>
                <input
                  type="number"
                  value={buyInAmount}
                  onChange={(e) => setBuyInAmount(e.target.value)}
                  placeholder={`${(game?.minBuyIn?.toNumber() / 1e9 || 0)} - ${(game?.maxBuyIn?.toNumber() / 1e9 || 0)}`}
                  className="w-full px-4 py-3 bg-[#0a0b0d] border border-gray-800 rounded-lg text-white placeholder-gray-600 focus:border-[#00ff88] focus:outline-none transition"
                  min={game?.minBuyIn?.toNumber() / 1e9 || 0}
                  max={game?.maxBuyIn?.toNumber() / 1e9 || 0}
                  step="0.1"
                />
                <p className="text-xs text-gray-600 mt-2">
                  Min: {(game?.minBuyIn?.toNumber() / 1e9 || 0)} SOL • Max: {(game?.maxBuyIn?.toNumber() / 1e9 || 0)} SOL
                </p>
              </div>

              {joinError && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                  <p className="text-red-400 text-sm">{joinError}</p>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={handleJoinGame}
                  disabled={joining || !buyInAmount}
                  className={`flex-1 px-6 py-3 font-bold rounded-lg transition ${
                    joining || !buyInAmount
                      ? 'bg-gray-800 text-gray-600 cursor-not-allowed'
                      : 'bg-[#00ff88] text-black hover:bg-[#00dd77] shadow-lg shadow-[#00ff88]/20'
                  }`}
                >
                  {joining ? 'Joining...' : 'Join Game'}
                </button>
                <button
                  className="px-6 py-3 bg-gray-800 text-gray-300 font-medium rounded-lg hover:bg-gray-700 border border-gray-700 transition"
                  onClick={() => window.open(`https://explorer.solana.com/address/${gamePDA}?cluster=devnet`, '_blank')}
                >
                  Explorer
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Raw Data (Debug) */}
        <div className="bg-[#1a1b1f] border border-gray-800 rounded-xl p-6">
          <h2 className="text-lg font-bold text-white mb-4">Debug Info</h2>
          <pre className="text-gray-400 text-xs overflow-auto max-h-96 bg-[#0a0b0d] p-4 rounded-lg border border-gray-800">
            {JSON.stringify(game, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
}
