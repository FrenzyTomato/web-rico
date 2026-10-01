# Release Candidate Checklist — PR-063

**Status: PENDING.** No deployment target has been chosen and no real game has been played at a target URL. Nothing here may be marked passed until the steps below are performed by people (EXECUTION.md: unperformed playtests are never passed).

## Candidate

| Item | Value |
| --- | --- |
| Branch | `prototype/pr-036-048` (local; no remote yet) |
| Commit | the commit tagged for release (`git tag rc-1` when accepted) |
| Ruleset | `puerto-rico-1897-special-edition-base-en` 1.0.0 |
| Protocol / snapshot schema | protocol `1`, snapshot schema `1.0.0`, engine `0.0.0` |
| Automated evidence | `pnpm check`, `pnpm test:db`, `pnpm test:e2e` all passing (see BACKLOG.md PR-062) |

## Acceptance steps (people)

1. Deploy per `docs/DEPLOYMENT.md` on the chosen host, behind TLS. Record the URL.
2. Take a backup before play (`docs/RECOVERY.md`).
3. Three to five friends, each on their own device, open the invite link and play a **complete** game to final scoring.
4. During the game:
   - one player refreshes the page;
   - one player loses the network briefly (Wi-Fi off and on);
   - the host restarts the service once (`docker compose restart app`).

   Everyone must resume their own seat with no duplicated or lost actions.
5. Record the session in `docs/PLAYTEST.md` (template there): players, devices, duration, version, ending, final scores, every issue with its 版本 revision.
6. Release only if no blocking issue is open. Then tag the commit and note the release here.

## Known limitations (V1)

- **Rules:** base game only (no expansions); 3–5 players; Chinese UI text.
- **Seats:** one browser profile holds one seat. Several players in one browser take over each other's seat (use separate devices or profiles).
- **Hosting:** single instance, with no horizontal scaling. Rooms survive restarts only with PostgreSQL (`DATABASE_URL`); the in-memory mode is for development.
- **Performance:** measured on the agreed Apple M4 / Chrome device (`docs/PERFORMANCE.md`); other GPUs and browsers are not measured.
- **Open rule question:** AUD-06 (`docs/RULE_AUDIT.md`). After a City-full trigger, remaining Builder players who can't afford anything decline by hand instead of being skipped. The outcome is correct.
- **Playtests:** PR-048 friend playtests were waived; this checklist is the first real multiplayer validation.

## Rollback

1. Keep the previous image: before upgrading, run `docker tag vibe-rico-app:latest vibe-rico-app:previous`, or check out the previous commit.
2. If the new version misbehaves:
   - `docker compose stop app`
   - restore the pre-upgrade backup if data changed (`docs/RECOVERY.md`)
   - check out the previous commit
   - `docker compose up -d --build app`
3. Saves from a newer snapshot schema are isolated by the version guard (`VERSION_MISMATCH`) instead of being misread, so roll back data together with code.
