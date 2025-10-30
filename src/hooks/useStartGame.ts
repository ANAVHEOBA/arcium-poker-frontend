import { useState } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PublicKey, SystemProgram, Transaction, SYSVAR_CLOCK_PUBKEY } from '@solana/web3.js';
import { AnchorProvider, Program } from '@coral-xyz/anchor';
import bs58 from 'bs58';
import idl from '@/arcium_poker.json';
import { PROGRAM_ID } from '@/lib/shared/constants';
import { getMXEAccountsForGame } from './useArciumMXE';

// MOCK MODE ENABLED - Deterministic Shuffling for Testing
// ✅ Program: B5E1V3DJsjMPzQb4QyMUuVhESqnWMXVcead4AEBvJB4W
// ✅ Network: Devnet
// ✅ Mode: MOCK (Deterministic shuffle - perfect for development and testing)
//
// How mock mode works:
// 1. We provide REAL MXE account addresses (that exist on-chain)
// 2. The smart contract detects circuits aren't uploaded/configured
// 3. It automatically falls back to deterministic Fisher-Yates shuffling
// This allows full game testing without requiring Arcium MPC circuits to be uploaded.

export function useStartGame() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startGame = async (gamePDA: PublicKey, gameId: number) => {
    try {
      if (!wallet.publicKey || !wallet.signTransaction) {
        throw new Error('Wallet not connected');
      }

      setLoading(true);
      setError(null);

      console.log('🎮 ========== START GAME (MOCK MODE) ==========');
      console.log('📝 Game PDA:', gamePDA.toBase58());
      console.log('🎲 Game ID:', gameId);
      console.log('👛 Authority:', wallet.publicKey.toBase58());
      console.log('🔐 Mode: MOCK (Deterministic Shuffle)');

      // Create provider
      const provider = new AnchorProvider(
        connection,
        wallet as any,
        { commitment: 'confirmed' }
      );

      // Create program instance
      const programId = new PublicKey(idl.address);
      const program = new Program(idl as any, provider);

      // Fetch all player states for this game using getProgramAccounts
      console.log('👥 Fetching player states...');
      
      // Get all accounts that are PlayerStates for this game
      // PlayerState discriminator from IDL: [56, 3, 60, 86, 174, 16, 244, 195]
      const playerStateDiscriminator = Buffer.from([56, 3, 60, 86, 174, 16, 244, 195]);
      
      // PlayerState layout: [discriminator(8)] [player(32)] [game(32)] [...]
      // So game field is at offset 8 + 32 = 40
      const accounts = await connection.getProgramAccounts(programId, {
        filters: [
          {
            memcmp: {
              offset: 0, // Check discriminator first
              bytes: bs58.encode(playerStateDiscriminator),
            }
          },
          {
            memcmp: {
              offset: 40, // After discriminator(8) + player pubkey(32)
              bytes: gamePDA.toBase58(),
            }
          }
        ]
      });
      
      console.log(`✅ Found ${accounts.length} player state(s)`);

      // Manually decode seat_index to sort (it's at offset 72, 1 byte)
      const playerStates = accounts.map(({ pubkey, account }) => {
        const seatIndex = account.data[72]; // seat_index is at byte 72
        console.log(`  Player ${pubkey.toBase58().slice(0, 8)}... seat: ${seatIndex}`);
        return {
          pubkey,
          seatIndex,
        };
      });
      
      // Sort by seat index (CRITICAL for the program)
      const sortedPlayers = playerStates.sort((a, b) => a.seatIndex - b.seatIndex);
      console.log('✅ Players sorted by seat index');

      // Build remaining accounts array (player states)
      const remainingAccounts = sortedPlayers.map((playerData: any) => ({
        pubkey: playerData.pubkey,
        isWritable: true,
        isSigner: false,
      }));

      console.log(`📝 Adding ${remainingAccounts.length} player account(s) as remaining accounts`);
      console.log('📝 Remaining accounts details:');
      remainingAccounts.forEach((acc: any, i: number) => {
        console.log(`  [${i}] ${acc.pubkey.toBase58()}`);
      });

      // Generate random entropy for each player (32 bytes each)
      const playerEntropy = sortedPlayers.map(() => {
        const entropy = new Uint8Array(32);
        crypto.getRandomValues(entropy);
        return Array.from(entropy);
      });

      console.log(`🎲 Generated entropy for ${playerEntropy.length} player(s)`);

      // Build start game instruction (MOCK MODE - real MXE accounts without circuits)
      console.log('🔨 Building start game instruction for MOCK mode...');
      console.log('⚠️  Using real MXE accounts (without circuits) - program will fall back to mock shuffle');

      // Get the real MXE account addresses (they exist but circuits aren't uploaded)
      // The smart contract will detect this and use mock mode
      const mxeAccounts = getMXEAccountsForGame(gameId);

      console.log('🔐 MXE Accounts:');
      console.log('  MXE Program:', mxeAccounts.mxeProgram.toBase58());
      console.log('  MXE Account:', mxeAccounts.mxeAccount.toBase58());
      console.log('  Comp Def:', mxeAccounts.compDef.toBase58());

      const instructionAccounts = {
        game: gamePDA,
        authority: wallet.publicKey,
        // Real MXE accounts (exist but circuits not uploaded = mock mode)
        mxeProgram: mxeAccounts.mxeProgram,
        mxeAccount: mxeAccounts.mxeAccount,
        compDefAccount: mxeAccounts.compDef,
        mempoolAccount: mxeAccounts.mempool,
        executingPoolAccount: mxeAccounts.executingPool,
        clusterAccount: mxeAccounts.cluster,
        computationAccount: mxeAccounts.computationAccount,
        signSeed: mxeAccounts.signSeed,
        stakingPool: mxeAccounts.stakingPool,
        systemProgram: SystemProgram.programId,
        clock: SYSVAR_CLOCK_PUBKEY,
      };

      const instruction = await program.methods
        .startGame(playerEntropy)
        .accounts(instructionAccounts)
        .remainingAccounts(remainingAccounts)
        .instruction();

      console.log('✅ Instruction built');

      // Create and sign transaction
      console.log('📝 Creating transaction...');
      const transaction = new Transaction().add(instruction);
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('finalized');
      transaction.recentBlockhash = blockhash;
      transaction.lastValidBlockHeight = lastValidBlockHeight;
      transaction.feePayer = wallet.publicKey;

      console.log('🔐 Requesting wallet signature...');
      const signedTx = await wallet.signTransaction(transaction);

      console.log('📤 Sending transaction...');
      const signature = await connection.sendRawTransaction(signedTx.serialize(), {
        skipPreflight: true,
        preflightCommitment: 'confirmed',
      });

      console.log('✅ Transaction sent:', signature);
      console.log('🎉 Game started with MOCK mode (deterministic shuffle)!');

      // Confirm transaction
      console.log('⏳ Confirming transaction...');
      const confirmation = await connection.confirmTransaction({
        signature,
        blockhash,
        lastValidBlockHeight,
      }, 'confirmed');

      // Check if transaction actually succeeded
      if (confirmation.value.err) {
        throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
      }

      console.log('✅ Transaction confirmed!');
      console.log('🎉 Game started successfully with MOCK mode!');

      return {
        success: true,
        signature,
        gameId,
      };
    } catch (err: any) {
      console.error('❌ Error starting game:', err);
      console.error('❌ Error message:', err.message);
      console.error('❌ Error logs:', err.logs);
      console.error('❌ Full error:', JSON.stringify(err, null, 2));
      
      // Decode custom error codes
      let errorMessage = err.message || 'Failed to start game';
      if (err.InstructionError) {
        const [_, errorInfo] = err.InstructionError;
        if (errorInfo?.Custom === 6021) {
          errorMessage = 'Not enough players to start game (minimum 2 required)';
        } else if (errorInfo?.Custom === 6000) {
          errorMessage = 'Game already started';
        } else if (errorInfo?.Custom) {
          errorMessage = `Smart contract error ${errorInfo.Custom}`;
        }
      }
      
      setError(errorMessage);
      return {
        success: false,
        error: errorMessage,
      };
    } finally {
      setLoading(false);
    }
  };

  return {
    startGame,
    loading,
    error,
  };
}
