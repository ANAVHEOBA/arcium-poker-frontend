# PlayerState Offset Fix - Error 6021

## ❌ Problem

```
✅ Found 0 player state(s)
❌ Error: InstructionError [0, { Custom: 6021 }]
```

**Error 6021** = "Not enough players to start game"

The filter found 0 PlayerState accounts when there should be 2.

---

## 🔍 Root Cause

### Wrong Offset in memcmp Filter

```typescript
// WRONG - Was using offset 8
memcmp: {
  offset: 8,  // ❌ This is the player field, not game!
  bytes: gamePDA.toBase58(),
}
```

### PlayerState Account Layout

```
[0-7]    Discriminator (8 bytes)
[8-39]   player: Pubkey (32 bytes)    ← We were filtering here!
[40-71]  game: Pubkey (32 bytes)      ← Should filter here!
[72]     seat_index: u8 (1 byte)
[73-80]  status: PlayerStatus (enum)
...
```

**The `game` field is at offset 40, not 8!**

---

## ✅ Solution

```typescript
// FIXED - Use offset 40
const accounts = await connection.getProgramAccounts(programId, {
  filters: [
    {
      memcmp: {
        offset: 40, // ✅ After discriminator(8) + player pubkey(32) = 40
        bytes: gamePDA.toBase58(),
      }
    }
  ]
});
```

### Calculation
```
Offset = discriminator + player_pubkey
       = 8 bytes + 32 bytes
       = 40 bytes
```

---

## 📊 What Each Offset Matches

| Offset | Field | What it filters |
|--------|-------|-----------------|
| 0 | Discriminator | Account type (PlayerState) |
| 8 | `player` | Player's wallet address |
| **40** | **`game`** | **Game PDA** ← **We want this!** |
| 72 | `seat_index` | Seat number (0-5) |

---

## 🎯 Expected Behavior Now

### Before (Wrong Offset 8):
```
👥 Fetching player states...
✅ Found 0 player state(s)  ← Wrong! Filtered by player field
❌ Error 6021: Not enough players
```

### After (Correct Offset 40):
```
👥 Fetching player states...
✅ Found 2 player state(s)  ← Correct! Filtered by game field
✅ Players sorted by seat index
🎲 Generated entropy for 2 player(s)
✅ Transaction sent successfully
```

---

## 🔧 Additional Improvements

### Better Error Messages

Added error decoding:
```typescript
if (errorInfo?.Custom === 6021) {
  errorMessage = 'Not enough players to start game (minimum 2 required)';
} else if (errorInfo?.Custom === 6000) {
  errorMessage = 'Game already started';
}
```

Now users see friendly error messages instead of error codes!

---

## 🧪 Testing

After this fix:
1. Join a game with 2 players
2. Click "Start Game"
3. Should see:
   ```
   ✅ Found 2 player state(s)
   🔐 Mode: REAL Arcium MPC
   ✅ Transaction sent: <signature>
   ✅ Transaction confirmed!
   ```

---

## 📝 Files Updated

1. ✅ `/src/hooks/useStartGame.ts` - Fixed offset from 8 → 40
2. ✅ `/src/hooks/useStartGame.ts` - Added error decoding

---

**Status**: ✅ **FIXED**  
**Issue**: PlayerState filter using wrong offset  
**Solution**: Changed from offset 8 (player) to offset 40 (game)  
**Date**: Oct 25, 2025
