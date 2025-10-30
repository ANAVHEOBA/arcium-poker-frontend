# CPI Authorization Fix - Oct 25, 2025

## 🐛 **The Bug**

**Error**: `Cross-program invocation with unauthorized signer or writable account`

### **Root Cause**

In `mpc_shuffle.rs` line 140-141, the code was passing:
```rust
&mxe_program.clone(), // computation_account - WRONG!
&mxe_program.clone(), // authority - WRONG! Not a signer!
```

When calling `queue_mxe_computation`, the **authority** parameter requires a **signer**, but `mxe_program` is NOT a signer in the transaction. This caused the CPI to fail.

---

## ✅ **The Fix**

### **1. Updated `MxeShuffleParams` struct**
Added two new fields:
```rust
pub struct MxeShuffleParams<'info> {
    // ... existing fields
    pub computation_account: Option<AccountInfo<'info>>,  // NEW
    pub authority: Option<AccountInfo<'info>>,             // NEW
}
```

### **2. Fixed `mpc_shuffle_deck_with_mxe`**
Now correctly passes the actual accounts:
```rust
let computation_id = queue_mxe_computation(
    mxe_program,
    comp_def,
    mempool,
    cluster,
    computation_account,  // ✅ Actual computation account from context
    authority,            // ✅ Actual authority signer (game creator)
    0,
    &encrypted_inputs,
    params.computation_offset,
)?;
```

### **3. Updated `start.rs` to pass accounts**
```rust
let mxe_shuffle_params = MxeShuffleParams {
    // ... existing fields
    computation_account: Some(ctx.accounts.computation_account.clone()),
    authority: Some(ctx.accounts.authority.to_account_info()),
    // ...
};
```

---

## 📊 **What Changed**

| Component | Before | After |
|-----------|--------|-------|
| **computation_account** | `mxe_program.clone()` ❌ | `ctx.accounts.computation_account` ✅ |
| **authority** | `mxe_program.clone()` ❌ | `ctx.accounts.authority` ✅ |
| **Authority is signer?** | No ❌ | Yes ✅ |

---

## 🎯 **Expected Behavior Now**

When you click "Start Game":

1. ✅ Transaction builds correctly
2. ✅ Authority (game creator) is passed as signer
3. ✅ CPI to MXE program succeeds
4. ✅ Computation queued to Arcium network
5. ✅ Game stage changes to **PreFlop**
6. ✅ Deck is shuffled via real MPC

---

## 🚀 **Test It Now**

1. Refresh your browser (Ctrl + Shift + R)
2. Join a game with 2 players
3. Click "Start Game"
4. Should succeed without CPI errors!

---

## 📝 **Files Modified**

1. ✅ `/programs/arcium_poker/src/arcium/mpc_shuffle.rs`
   - Added `computation_account` and `authority` to `MxeShuffleParams`
   - Updated `mpc_shuffle_deck_with_mxe` to use correct accounts
   - Fixed `mpc_shuffle_deck` legacy function

2. ✅ `/programs/arcium_poker/src/game/start.rs`
   - Pass `computation_account` and `authority` from context

3. ✅ Program redeployed: `Cm5y2aab75vj9dpRcyG1EeZNgeh4GZLRkN3BmmRVNEwZ`
   - Signature: `nBsVmG3JUhLSGJcwGG5bvavMxN2qAm1UXHEKZcYaSxseP1mZ8Rt8Cbj787FBVYR8oEL49Ubvc3FJJRWLAgJYHSW`

4. ✅ Frontend IDL updated

---

**Status**: ✅ **FIXED AND DEPLOYED**  
**Ready to test**: Real Arcium MPC on devnet!
