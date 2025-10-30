import { PublicKey } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";

// ============================================================================
// ARCIUM MXE CONFIGURATION
// ============================================================================

const MXE_PROGRAM_ID = new PublicKey("BKck65TgoKRokMjQM3datB9oRwJ8rAj2jxPXvHXUvcL6");
const COMP_DEF_OFFSET = 1;

/**
 * Derive the Computation Definition PDA
 * Seeds: ["ComputationDefinitionAccount", mxe_program, comp_def_offset (u32 LE)]
 */
function getCompDefPDA(): PublicKey {
  const offsetBytes = Buffer.alloc(4);
  offsetBytes.writeUInt32LE(COMP_DEF_OFFSET);

  const [compDefPDA] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("ComputationDefinitionAccount"),
      MXE_PROGRAM_ID.toBuffer(),
      offsetBytes,
    ],
    MXE_PROGRAM_ID
  );

  return compDefPDA;
}

/**
 * Complete Arcium MXE configuration for Arcium Poker
 *
 * Program ID: B5E1V3DJsjMPzQb4QyMUuVhESqnWMXVcead4AEBvJB4W
 * Network: Devnet
 * Cluster Offset: 1078779259 (Arcium devnet)
 * Comp Def Offset: 1 (shuffle_deck computation)
 *
 * ✅ CORRECT MXE accounts (comp_def is now a derived PDA!)
 * Transaction: dpLXtdGR1bdnjzSPdcN5k1DDTtG46ZmCKLPwRguWstEdZap49Y3bVgZYRg3bmtvv7621Sw4sBB1kcesxbJHLoXk
 */
export const ARCIUM_CONFIG = {
  // Program IDs
  programId: new PublicKey("B5E1V3DJsjMPzQb4QyMUuVhESqnWMXVcead4AEBvJB4W"),
  mxeProgram: MXE_PROGRAM_ID,

  // Cluster Configuration
  clusterOffset: 1078779259,
  compDefOffset: COMP_DEF_OFFSET,

  // ✅ CORRECT MXE Accounts (comp_def is now derived as a PDA!)
  accounts: {
    mxeAccount: new PublicKey("HyEnFUXebxGdJLoaTq2cfRtKht7Ke6gkMNrsBx8vBHMo"),
    compDef: getCompDefPDA(), // ← DERIVED PDA: 2ySMsfh6YDwwDQMZPikbVNtcgGNwFauGR5HYEdZonWwF
    mempool: new PublicKey("CaTxKKfdaoCM7ZzLj5dLzrrmnsg9GJb5iYzRzCk8VEu3"),
    executingPool: new PublicKey("94ZeSmg21ktsHWPbRSYqtu77T4SUKNoEj9qn8c6zjLxH"),
    cluster: new PublicKey("XEDRk3i1BK9vwU4tnaBQRG2bi77QCxtBHhsbSLqXD6z"),
    signSeed: new PublicKey("855kV52vroBmanfaL2QLcoPyioGPd12USBcFAsibtJnP"),
    stakingPool: new PublicKey("xVwyypubQUe6rrgKPXXZDSDbJzRZH67cSKgdsGaE6oD"),
  },
};

// ============================================================================
// COMPUTATION ACCOUNT (Dynamic per game)
// ============================================================================

/**
 * Get the computation account for a specific game
 * This account is unique per game and stores the MPC computation state
 *
 * Seeds: ["computation", mxe_account, game_id]
 *
 * @param gameId - The unique game ID
 * @returns The computation account PublicKey
 */
export function getComputationAccount(gameId: number | anchor.BN): PublicKey {
  const gameIdBN = typeof gameId === "number" ? new anchor.BN(gameId) : gameId;

  const [computationAccount] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("computation"),
      ARCIUM_CONFIG.accounts.mxeAccount.toBuffer(),
      gameIdBN.toArrayLike(Buffer, "le", 8),
    ],
    ARCIUM_CONFIG.mxeProgram
  );

  return computationAccount;
}

// ============================================================================
// HELPER: Get all MXE accounts for a game
// ============================================================================

/**
 * Get all MXE accounts needed for a game's start_game instruction
 *
 * @param gameId - The unique game ID
 * @returns Object containing all MXE account addresses
 */
export function getMXEAccountsForGame(gameId: number) {
  return {
    mxeProgram: ARCIUM_CONFIG.mxeProgram,
    mxeAccount: ARCIUM_CONFIG.accounts.mxeAccount,
    compDef: ARCIUM_CONFIG.accounts.compDef,
    mempool: ARCIUM_CONFIG.accounts.mempool,
    executingPool: ARCIUM_CONFIG.accounts.executingPool,
    cluster: ARCIUM_CONFIG.accounts.cluster,
    computationAccount: getComputationAccount(gameId),
    signSeed: ARCIUM_CONFIG.accounts.signSeed,
    stakingPool: ARCIUM_CONFIG.accounts.stakingPool,
  };
}

// ============================================================================
// LOGGING HELPER
// ============================================================================

/**
 * Log all MXE accounts for debugging purposes
 */
export function logMXEAccounts(gameId: number) {
  const accounts = getMXEAccountsForGame(gameId);

  console.log('🔐 Arcium MXE Accounts:');
  console.log('  MXE Program:', accounts.mxeProgram.toBase58());
  console.log('  MXE Account:', accounts.mxeAccount.toBase58());
  console.log('  Comp Def:', accounts.compDef.toBase58());
  console.log('  Mempool:', accounts.mempool.toBase58());
  console.log('  Executing Pool:', accounts.executingPool.toBase58());
  console.log('  Cluster:', accounts.cluster.toBase58());
  console.log('  Computation:', accounts.computationAccount.toBase58());
  console.log('  Sign Seed:', accounts.signSeed.toBase58());
  console.log('  Staking Pool:', accounts.stakingPool.toBase58());

  return accounts;
}
