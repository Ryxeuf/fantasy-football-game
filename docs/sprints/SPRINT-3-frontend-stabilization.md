# Sprint 3 — Frontend Stabilization

> Remaining bugs found by multi-agent analysis (2026-04-12).
> Sprint 1 fixed: duplicate WebSocket, normalizeState mutation, GameScoreboard hooks,
> drag-and-drop axis swap, InducementsPhaseUI stale closure, handleEndTurn deps,
> setState mutation, Tailwind dynamic classes.

## HIGH Priority

### 3.1 — useGameState initial load race condition

**Severity:** HIGH
**File:** `apps/web/app/play/[id]/hooks/useGameState.ts:145–196`

**Problem:** Dependency array is `[matchId, teamNameA, teamNameB]`. If team names load before the first fetch completes, the effect runs twice. The `initialLoadDone` ref guard only blocks the second run if the first succeeded. When the first fetch fails and falls to the fallback path using empty `teamNameA`/`teamNameB`, the real server state fetch is skipped permanently.

**Fix:** Separate the initial load effect from team name loading. Use a stable dependency array `[matchId]` only, and read team names from refs:
```typescript
const teamNameARef = useRef(teamNameA);
teamNameARef.current = teamNameA;
useEffect(() => {
  if (initialLoadDone.current) return;
  // ... use teamNameARef.current instead of teamNameA
}, [matchId]);
```

---

### 3.2 — useGameSocket returns stale socket reference

**Severity:** HIGH
**File:** `apps/web/app/play/[id]/hooks/useGameSocket.ts:376`

**Problem:** `socket: socketRef.current` is captured at render time (before the useEffect runs on mount), so the first render always receives `null`. Consumers like `useGameChat` only re-evaluate when the parent re-renders.

**Fix:** Return `socketRef` itself or use a state value:
```typescript
// Option 1: Return the ref
return { ..., socketRef };

// Option 2: Use useState that updates when socket connects
const [socket, setSocket] = useState<Socket | null>(null);
// In useEffect: setSocket(newSocket);
return { ..., socket };
```

---

### 3.3 — useTurnNotification doesn't reset document title on unmount

**Severity:** HIGH
**File:** `apps/web/app/play/[id]/hooks/useTurnNotification.ts:75–105`

**Problem:** Sets `document.title` but cleanup function is `undefined`. If the user navigates away while it's their turn, the tab title stays "Votre tour ! — Nuffle Arena" forever.

**Fix:** Save the original title and restore on cleanup:
```typescript
useEffect(() => {
  const originalTitle = document.title;
  if (isMyTurn) document.title = "Votre tour ! — Nuffle Arena";
  return () => { document.title = originalTitle; };
}, [isMyTurn]);
```

---

### 3.4 — AudioContext memory leak in useTurnNotification and useMatchmakingSocket

**Severity:** HIGH
**Files:**
- `apps/web/app/play/[id]/hooks/useTurnNotification.ts:16`
- `apps/web/app/play/hooks/useMatchmakingSocket.ts:25`

**Problem:** Each `playTurnSound()` / `playMatchFoundSound()` call creates a new `AudioContext` with no cleanup. Browsers limit concurrent instances. After many turns, audio breaks silently.

**Fix:** Reuse the `SoundManager` singleton from `sound-manager.ts` which already manages a single AudioContext, or create a module-level singleton:
```typescript
let sharedAudioCtx: AudioContext | null = null;
function getAudioContext() {
  if (!sharedAudioCtx) sharedAudioCtx = new AudioContext();
  return sharedAudioCtx;
}
```

---

### 3.5 — normalizeState still defined in two places

**Severity:** HIGH (maintenance)
**Files:**
- `apps/web/app/play/[id]/hooks/useGameState.ts:10–20`
- `apps/web/app/play/[id]/page.tsx:261–271`

**Problem:** Two identical but independent copies. Any future change to one will not reflect in the other.

**Fix:** Extract to a shared utility:
```typescript
// apps/web/app/play/[id]/utils/normalizeState.ts
export function normalizeState(state: any): ExtendedGameState { ... }
```

---

## MEDIUM Priority

### 3.6 — useGameState auth-check missing matchId dependency

**Severity:** MEDIUM
**File:** `apps/web/app/play/[id]/hooks/useGameState.ts:69–89`

**Problem:** Auth/join useEffect reads `matchId` but has `[]` dependency array. If `matchId` changes, the join call uses the stale first `matchId`.

**Fix:** Add `matchId` to dependency array: `}, [matchId]);`

---

### 3.7 — Polling interval resets on every isMyTurn change

**Severity:** MEDIUM
**File:** `apps/web/app/play/[id]/hooks/useGameState.ts:247–271`

**Problem:** `isMyTurn` is in the dependency array, causing the interval to be torn down and recreated on every state update. The timer restarts instead of counting from the last poll.

**Fix:** Use a ref for `isMyTurn` inside the interval callback:
```typescript
const isMyTurnRef = useRef(isMyTurn);
isMyTurnRef.current = isMyTurn;
useEffect(() => {
  const interval = setInterval(async () => {
    const rate = wsConnected ? 30000 : (isActiveMatch && !isMyTurnRef.current ? 3000 : 10000);
    // ...
  }, /* base rate */);
  return () => clearInterval(interval);
}, [matchId, isActiveMatch, wsConnected]); // isMyTurn removed
```

---

### 3.8 — useGameChat double listener registration

**Severity:** MEDIUM
**File:** `apps/web/app/play/[id]/hooks/useGameChat.ts:98–119`

**Problem:** `socket.off("game:chat-message")` removes ALL listeners for that event (not just the one this hook added), which is overly broad. If the socket reconnects, the effect re-fires, doubling up momentarily.

**Fix:** Use a named handler reference for targeted cleanup:
```typescript
const handler = (msg) => { ... };
socket.on("game:chat-message", handler);
return () => socket.off("game:chat-message", handler);
```

---

### 3.9 — GameLog isRecent never recomputes after first render

**Severity:** MEDIUM
**File:** `packages/ui/src/components/GameLog.tsx:56–60`

**Problem:** `Date.now()` is captured at render time. A score entry that was "recent" may keep its highlight forever, or lose it before the animation plays.

**Fix:** Use a state-based approach like `GameScoreboard`:
```typescript
const [recentIds, setRecentIds] = useState<Set<string>>(new Set());
useEffect(() => {
  if (newScoreId) {
    setRecentIds(prev => new Set([...prev, newScoreId]));
    const t = setTimeout(() => setRecentIds(prev => {
      const next = new Set(prev);
      next.delete(newScoreId);
      return next;
    }), 2500);
    return () => clearTimeout(t);
  }
}, [newScoreId]);
```

---

### 3.10 — usePushNotifications doesn't track runtime permission changes

**Severity:** MEDIUM
**File:** `apps/web/app/hooks/usePushNotifications.ts:97–100`

**Problem:** `Notification.permission` is read once on mount. If the user changes browser notification settings while mounted, `permission` state is stale.

**Fix:** Listen to the `change` event on the `PermissionStatus` object:
```typescript
useEffect(() => {
  navigator.permissions?.query({ name: 'notifications' }).then(status => {
    setPermission(status.state);
    status.addEventListener('change', () => setPermission(status.state));
  });
}, []);
```

---

### 3.11 — ForfeitWarning disappears before server confirms

**Severity:** MEDIUM
**File:** `apps/web/app/components/ForfeitWarning.tsx:38`

**Problem:** When `remainingSeconds <= 0`, the banner vanishes. But the server forfeit is async. The player sees nothing between countdown reaching zero and the server broadcasting.

**Fix:** Add a "processing" state when countdown hits zero:
```typescript
if (remainingSeconds <= 0 && opponentDisconnected) {
  return <div>Traitement de la victoire par forfait...</div>;
}
```

---

### 3.12 — ImageCarousel uses index as key

**Severity:** MEDIUM
**File:** `apps/web/app/components/ImageCarousel.tsx:27`

**Problem:** `key={i}` — fragile pattern if the image list ever becomes dynamic.

**Fix:** Use image URL or a stable identifier as key.

---

## LOW Priority

### 3.13 — console.log statements in production game page

**Severity:** LOW
**File:** `apps/web/app/play/[id]/page.tsx` (lines 576, 612, 648, 696, 753, 765, 1172, 1186, 1191, 1202, 1209)

**Problem:** 14 `console.log`/`console.error` calls in the game page. Noise in browser console, may expose internal state.

**Fix:** Remove all or replace with a configurable debug logger.

---

### 3.14 — normalizeState returns null typed as ExtendedGameState

**Severity:** LOW
**File:** `apps/web/app/play/[id]/hooks/useGameState.ts:11`

**Problem:** `if (!state) return state;` returns `null` typed as `ExtendedGameState`, breaking type safety.

**Fix:** Change return type to `ExtendedGameState | null` or `return state as unknown as ExtendedGameState`.

---

### 3.15 — DiceTestComponent / DiceNotificationDemo in production UI package

**Severity:** LOW
**Files:**
- `packages/ui/src/components/DiceTestComponent.tsx`
- `packages/ui/src/components/DiceNotificationDemo.tsx`

**Problem:** Test/demo components exported from the shared `@bb/ui` package. Should not ship to production.

**Fix:** Move to a `__dev__` or `__tests__` directory, or gate the export behind `NODE_ENV`.

---

## Checklist

- [ ] 3.1 — Initial load race condition
- [ ] 3.2 — Stale socket reference
- [ ] 3.3 — Title cleanup on unmount
- [ ] 3.4 — AudioContext memory leak
- [ ] 3.5 — normalizeState deduplication
- [ ] 3.6 — Auth-check matchId dependency
- [ ] 3.7 — Polling interval restart
- [ ] 3.8 — Chat double listener
- [ ] 3.9 — GameLog isRecent timing
- [ ] 3.10 — Push permission tracking
- [ ] 3.11 — ForfeitWarning UX gap
- [ ] 3.12 — ImageCarousel key
- [ ] 3.13 — Remove console.log
- [ ] 3.14 — normalizeState return type
- [ ] 3.15 — Remove test components from production
