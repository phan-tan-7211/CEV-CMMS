# Parallel Web / Mobile Development Workflow

This repository is developed directly through GitHub by separate ChatGPT sessions. The human operator normally **pulls the integration branch locally to test** and does not need to push development commits.

## Branch roles

- `main` — production/release branch. Do not develop directly on it.
- `feat/cmms-workflow-next` — integration/test branch. This is the branch the operator normally pulls for combined local testing.
- `feat/cmms-workflow-next-web` — Web development lane.
- `feat/cmms-workflow-next-mobile` — Expo/React Native development lane.

## Mandatory session startup

Before any edit, every development session must:

1. Read `AGENTS.md`.
2. Read this file.
3. Fetch the current HEAD of `feat/cmms-workflow-next`.
4. Fetch the current HEAD of its own lane branch.
5. Inspect the sibling lane branch / open PR if the planned change could touch shared files.
6. Identify its lane before editing:
   - Web, or
   - Mobile.
7. State the immediate batch scope and planned file area.

If the user did not make the lane clear, ask **“Web hay Mobile?”** before editing.

## Lane ownership

### Web lane

Normal write scope:

- `src/**`
- `public/**`
- web-only tests/configuration
- web UI and browser behavior

Must not modify `apps/mobile/**` unless the task is explicitly reassigned.

### Mobile lane

Normal write scope:

- `apps/mobile/**`

Must not modify Web presentation files unless the task is explicitly reassigned.

## Shared / coordination-sensitive files

The following require explicit ownership for the current batch and must not be edited concurrently by both lanes:

- `AGENTS.md`
- `.github/workflows/**`
- root `package.json` / lockfiles / root tooling config
- `supabase/**`
- shared domain contracts, RPC assumptions, database schema, generated types
- cross-platform business-rule docs
- any file already being changed by the sibling lane

If a lane discovers that it needs a shared file currently owned by the other lane, it must stop at a safe checkpoint, report the dependency, and wait for that shared change to be integrated. Do not solve coordination by force-pushing or overwriting the sibling change.

## Synchronization rule

Before the first write of a batch, the lane branch must be based on the latest integration HEAD whenever it has no unmerged lane work.

After a batch has been integrated, fast-forward the lane branch to the newest `feat/cmms-workflow-next` before starting the next batch.

Never force-update a lane branch that contains unmerged work.

## Batch completion

Each lane works in small, reviewable batches.

Before claiming a batch complete:

1. Push/commit all changes to the lane branch.
2. Wait for the GitHub `Quality Gate` run for that lane HEAD to finish.
3. Do not claim PASS while the run is queued/in progress.
4. If CI fails, read the failing job/log and fix it on the same lane branch.
5. Only after `Quality Gate = success`, merge the lane batch into `feat/cmms-workflow-next`.
6. Re-check integration HEAD after merge.

Physical Android/iPhone device gates remain separate. CI/browser success does not prove camera, QR, keyboard, safe-area, touch, or native-device behavior.

## Integration and production

Normal flow:

`Web lane` → `feat/cmms-workflow-next`

`Mobile lane` → `feat/cmms-workflow-next`

Operator local test → pull `feat/cmms-workflow-next`

Release candidate → PR `feat/cmms-workflow-next` → `main`

Merge to `main` only after required quality gates are green and the combined integration state is accepted for release.

## Operator local test

Typical command:

```powershell
git switch feat/cmms-workflow-next
git pull --ff-only origin feat/cmms-workflow-next
```

The operator does not need to coordinate ChatGPT development by pushing local commits. GitHub branches and PRs are the coordination source of truth.

## Conflict prevention rules

- Never let Web and Mobile sessions push to the same development branch.
- Never let both lanes edit the same shared file concurrently.
- Never use `main` as a scratch/integration branch.
- Never overwrite a newer remote file without re-fetching it first.
- Never force-push to hide a conflict.
- A lane that sees unexpected remote movement must re-fetch and re-evaluate before editing.
- A session must distinguish clearly between **ĐÃ LÀM** and **CHƯA LÀM / KẾ HOẠCH**.
