# Plan: Supabase Accounts and Game History

Status: Part 1 built (2026-10-29); Part 2 not started.

## Why

**Today:** a seat is a reconnect token stored in one browser's localStorage (`vibe-rico.seat`). The server keeps only its SHA-256 hash (`seats.token_hash`) and checks it on `resume`.

**What goes wrong:**
- **Lost seats:** clearing site data, a private window, switching browsers or picking up a phone all lose the seat for that game.
- **One game at a time:** only the latest seat is remembered, so a player can't keep track of several games.
- **No identity across games:** there's no history or stats.

**Goals, in order:**
1. Optional accounts, so a signed-in player can see and rejoin their games from any device (Part 1).
2. Game history and stats per account (Part 2).

Moving a game to another device is done by signing in there: "My games" rejoins it. A separate transfer code without accounts was considered and dropped.

**Non-goals:**
- **Guests stay:** accounts are never required, and joining from an invite link must keep working without one.
- **Game state stays put:** rooms, moves and history remain in the Droplet's Postgres. Supabase only handles sign-in.

---

## Part 1 — Supabase accounts (optional sign-in)

### Architecture
```
Browser ──(Supabase JS: sign in)──▶ Supabase Auth ──▶ access token (JWT)
Browser ──(Socket.IO + token)─────▶ Game server ──verify JWT (JWKS)──▶ user id
Game server ──▶ Droplet Postgres: profiles, seats.user_id, rooms, history
```
- **Supabase Auth only:** email one-time code plus Google sign-in. Apple can come later if there's an iOS-heavy audience.
- **Email first:** it works where Google is blocked (mainland China). Show Google as an extra option.
- **No Supabase database use:** no row-level-security setup, no second data store, no client writes to Supabase.
- **Verification on the server:** the game server checks tokens locally against Supabase's public signing keys (JWKS, cached), with no per-request call to Supabase.

### Data (Droplet Postgres, migration `0002_account_seats`)
- **`seats.user_id`:** nullable, indexed. Set when a signed-in user creates, joins or claims a seat.
- **No profiles table yet:** the nickname is pre-filled from the Supabase account (Google name, else the start of the email). A table can come with Part 2 if needed.
- **No emails:** none are copied into our database; Supabase holds them.

### Protocol
- **Handshake:** Socket.IO `auth: { accessToken }`. The server verifies it on connect and again on each `room` request, since tokens expire and the client refreshes them. The verified `userId` is kept on `socket.data`.
- **New room requests:**
  - `my-games {}` → rooms with a seat whose `user_id` is mine, with code, status (lobby / playing / ended), my seat name and the last move time.
  - `resume-account {roomId}` → like `resume`, but authenticated by `user_id` instead of the seat token. The server rotates and returns a fresh seat token, so the existing reconnect path keeps working.
  - `claim-seat {roomId}` → links the current guest seat (proven by a live session) to my account.
  - `delete-account {}` → clears `user_id` on my seats and soft-deletes my profile. The client then calls Supabase to delete the auth user, or this goes through a server function holding the service key.
- **Existing behaviour:** create and join while signed in also set `seats.user_id`. Guests are unchanged.

### Client
- **Library:** `@supabase/supabase-js`, configured with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (Vercel env vars). Both are public by design.
- **Lobby:**
  - **Signed out:** a "Sign in" button opening the email code or Google options.
  - **Signed in:** an avatar initial plus a menu (My games, Sign out, Delete account).
  - **Nickname:** pre-filled from the profile.
- **"My games" list:** each entry rejoins via `resume-account`. The single saved seat in localStorage stays as the guest fallback.
- **In game:** while signed in, a guest seat offers "Save this game to my account" (`claim-seat`).

### Configuration and operations
- **Supabase project:** enable Email OTP and Google, and set the Site URL and redirect URLs to `https://webri.co` (plus `http://localhost:5173` for development).
- **Droplet `.env`:** `SUPABASE_URL` (for the JWKS endpoint and token issuer check). A `SUPABASE_SERVICE_ROLE_KEY` is only needed if account deletion runs on the server; keep it server-side only.
- **Docs:** `docs/DEPLOYMENT.md` lists the new variables, and a short privacy note in the lobby says what's stored (email at Supabase, display name and game seats here) and how to delete it.

### Security notes
- **Untrusted client identity:** the client never sends a user ID, only the token. The server checks signature, expiry, issuer (`SUPABASE_URL`) and audience (`authenticated`).
- **Rotation on rejoin:** account rejoin rotates the seat token, so a stolen old localStorage token stops working after the owner signs in elsewhere.
- **Bots:** bot seats never have a `user_id`.

### Tests
- **Unit:** token verification with a local test key pair: valid, expired, wrong issuer, tampered.
- **Server:** create or join while signed in links the seat; `my-games` lists only my rooms; `resume-account` refuses rooms I'm not seated in; `claim-seat` requires a live session for that seat; delete-account unlinks.
- **e2e:** stub the Supabase client with a fake token signed by the test key, so CI doesn't depend on Supabase.

**Estimate:** 3–4 days, including the lobby UI and tests.

---

## Part 2 — Game history and stats (on top of accounts)

### Data (migration `0003_game_results`)
- **`game_results`:** one row per seat when a game ends: `room_id`, `game_id`, `user_id` (nullable for guests and bots), `display_name`, `bot`, `rank`, `total_vp`, `earned_vp`, `building_vp`, `bonus_vp`, `tiebreak`, `players`, `ended_at`.
- **Written once at game over:** inside the same commit that produces the `game-scored` event, so it survives the room being swept later (rooms are deleted after 24 h empty).
- **Claimed later:** a guest who signs in and claims a seat also gets that row's `user_id`.

### Server
- **`my-history {cursor?}`:** my finished games, newest first, 20 per page: date, players, my rank and score, the winner.
- **`my-stats {}`:** games played, wins, win rate, average and best score, average rank. Computed with SQL over `game_results`, no separate counters to keep in sync.

### Client
- **"My games" gets two tabs:** **Playing** (from Part 1) and **Finished** (history).
- **Finished entry:** date, players, my place and score; tapping it opens the same final-score card the game shows at the end.
- **Profile header:** games played, wins, best score.

### Tests
- **Server:** a game reaching game over writes one row per seat; bots and guests have no `user_id`; claiming links the row; history pages and stats match the rows.
- **e2e:** play a bot game to the end while signed in (stub token), then check Finished and the stats.

**Estimate:** about 2 days.

### Later ideas
- **Friends and rematch:** invite recent opponents into a new room.
- **Strategy stats:** favourite first role, most-bought building.

## Order and decisions
1. **Part 1:** accounts, "My games" and rejoin from any device.
2. **Part 2:** history and stats, built on Part 1's `user_id`.

**Decisions (2026-10-28):**
- **Sign-in:** email one-time code and Google.
- **Supabase region:** Sydney (`ap-southeast-2`), closest to the players and the Droplet.
- **Account deletion:** server-side, using `SUPABASE_SERVICE_ROLE_KEY` in the Droplet's `.env`.
