

## Plan: Fix 3 Urgent Issues + Improve Realtime Sync

### Problem Summary
1. **"Novo Oficio" button unresponsive** after saving — the full-screen dialog closes but focus/state isn't fully reset
2. **Tutorial opens too often** — currently shows on every first load per user, but should only show once (first login ever)
3. **Chat notifications missing** — no toast/sound when another operator sends a message
4. **Slow sync** — aggressive cache (5min staleTime) and incomplete realtime coverage

---

### 1. Fix "Novo Oficio" Button

**Root cause**: The dialog uses `onOpenChange` which calls `resetForm()` on close. The `autoOpenedRef` logic auto-opens the dialog on page load, but after closing+reopening the page component persists so the ref stays `true`. The real issue is likely focus trapped in the closed dialog or body overflow locked.

**Changes in `src/pages/Oficios.tsx`**:
- In `resetForm()`, add `document.activeElement.blur()` and `document.body.style.overflow = 'auto'`
- Add cleanup `useEffect` that resets body styles on unmount
- Remove the auto-open on page load (`autoOpenedRef` block) — let the user click "Novo Oficio" explicitly

### 2. Tutorial — Show Only on First Login Ever

**Changes in `src/components/AppLayout.tsx`**:
- Current logic already checks `tutorial_visto_{userId}` in localStorage and only shows if not set — this is correct for "first time only"
- The issue is the key may be getting cleared or the check is running before `user.id` is available
- Simplify: keep current logic as-is (it already only shows once per user), ensure no other code triggers `setTourOpen(true)` automatically

Actually the current code at lines 37-44 looks correct — it shows once per user ID and sets the flag. No change needed unless there's another trigger. Will verify no other auto-open exists.

### 3. Chat Notifications with Toast + Sound

**Changes in `src/components/AppLayout.tsx`**:
- Add a realtime subscription for `mensagens` table filtered by `para_user_id=eq.{user.id}` and `para_user_id=is.null`
- On new message (not from self): show toast notification with sender name and message preview
- Play notification sound (use Web Audio API beep, no external file needed)
- The sidebar badge already exists in `AppSidebar.tsx` — it already tracks unread count with realtime

### 4. Reduce Cache + Expand Realtime Sync

**Changes in `src/App.tsx`**:
- Reduce `staleTime` from 5 minutes to 0
- Set `refetchOnWindowFocus: true`
- Keep `gcTime` at 5 minutes (for memory, not staleness)

**Changes in `src/hooks/useGlobalSync.ts`**:
- Add listeners for `oficios`, `oficio_numeracao`, `mensagens`, `scripts`, `base_conhecimento` tables
- On change: invalidate relevant query keys

**Database migration**:
- Add tables to `supabase_realtime` publication: `oficios`, `oficio_numeracao`, `mensagens`, `scripts`, `base_conhecimento`

No polling/auto-refresh every 10 seconds — realtime + refetchOnWindowFocus is sufficient and more efficient.

---

### Technical Details

**Files to modify**:
- `src/pages/Oficios.tsx` — fix resetForm, remove auto-open
- `src/components/AppLayout.tsx` — add chat notification subscription
- `src/App.tsx` — reduce cache settings
- `src/hooks/useGlobalSync.ts` — expand realtime to all key tables
- Database migration — add tables to realtime publication

