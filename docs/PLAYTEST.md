# Friend Playtests — PR-048

Status: **no playtest has been performed yet.** Nothing here may be marked passed until real sessions are recorded below (EXECUTION.md: never mark unperformed playtests as passed).

## Running a session (host)

Players connect to the host's machine over the local network. Remote players need a deployment (PR-061), which is not available yet.

1. `pnpm install --frozen-lockfile && pnpm build`
2. Start the server **without** dev tools. Player sessions must never see full state:
   `pnpm --filter @vibe-rico/server start` (listens on 127.0.0.1:3000).
3. Serve the production web build, which has no developer panel, to the LAN:
   `pnpm --filter @vibe-rico/web exec vite preview --host 0.0.0.0 --port 4173`
4. Players open `http://<host-LAN-IP>:4173`. The host creates the room and shares the invite link. Each player uses their own device or browser: tabs in one browser share a seat.
5. Keep the server running for the whole game. Rooms are in memory only until M11, so a server restart loses the game.

## During play

- Note the **版本 N** (revision) shown on screen whenever something is confusing or wrong, plus a screenshot.
- Try at least one refresh and one network interruption (for example, Wi-Fi off and on) per session.
- Do not use the developer panel: it appears only under `vite dev`, which playtests must not use.

## Record template (copy one block per session)

```
### Session N — YYYY-MM-DD
- Version: <git commit or working-tree note>, protocol 1, ruleset 1.0.0
- Players: <count> (<names or seats>), devices/browsers: <list>
- Duration: <start–end, minutes>
- Ending: <worker-shortage | city-full | vp-exhausted | abandoned (why)>; final ranks/totals: <…>
- Refresh / disconnect tried: <who, when (revision), outcome>
- Issues (one line each: revision, who, what happened, what they expected, severity blocker/major/minor):
  - …
- Decisions players could not understand, or controls they could not find:
  - …
```

## Sessions

None yet.
