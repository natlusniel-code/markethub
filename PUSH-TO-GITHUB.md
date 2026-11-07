# Pushing MarketHub to GitHub

**Status: the remote repository already exists and is empty — only the push is left.**

- Repository: <https://github.com/natlusniel-code/markethub>
- Local repo: initialised, one commit (`7cc45c2`), working tree clean
- Remote `origin` is already configured to the URL above
- The push was attempted and refused: `remote: No anonymous write access.` — no
  GitHub token or SSH key exists in the build environment, so the push needs
  **your** credentials.

Everything below is ready to run as-is. Nothing else needs creating.

---

## Option A — push with a personal access token (fastest)

### 1. Create the token

1. Open <https://github.com/settings/tokens> → **Generate new token (classic)**
2. Note: `markethub push`
3. Expiration: 7 days is enough for a one-off push
4. Scope: tick **`repo`** (full control of private repositories)
5. **Generate token** and copy it — GitHub shows it only once

### 2. Push

From the project root (`app/`):

```bash
git push -u origin main
```

When prompted:

- **Username:** `natlusniel-code`
- **Password:** paste the token (not your account password — GitHub stopped
  accepting those for git operations in 2021)

### 3. Avoid re-typing it

```bash
git config --global credential.helper store
```

The token is then cached in `~/.git-credentials` in plain text. On a shared
machine, prefer `credential.helper cache` or skip this step.

---

## Option B — push with the GitHub CLI

```bash
gh auth login          # choose GitHub.com → HTTPS → paste token
git push -u origin main
```

---

## Option C — SSH instead of HTTPS

```bash
git remote set-url origin git@github.com:natlusniel-code/markethub.git
git push -u origin main
```

Requires an SSH key registered at <https://github.com/settings/keys>. If you
have none:

```bash
ssh-keygen -t ed25519 -C "you@example.com"
cat ~/.ssh/id_ed25519.pub     # paste into GitHub → Settings → SSH keys
ssh -T git@github.com         # expect "successfully authenticated"
```

---

## Option D — one command, token passed inline

Useful in CI or a throwaway shell. The token ends up in your shell history, so
clear it afterwards (`history -d` or `unset HISTFILE`).

```bash
git push https://natlusniel-code:<TOKEN>@github.com/natlusniel-code/markethub.git main
```

---

## Verify the push worked

```bash
git ls-remote origin          # should list refs/heads/main
git log --oneline -1          # 7cc45c2 MarketHub: complete e-commerce storefront and admin dashboard
```

Then open <https://github.com/natlusniel-code/markethub> — you should see 151
files and the commit.

---

## If the push is rejected

| Message | Cause | Fix |
|---|---|---|
| `No anonymous write access` | No credentials supplied | Use a token (Option A) |
| `Authentication failed` | Wrong password, or token lacks `repo` | Regenerate the token with `repo` scope |
| `non-fast-forward` / `fetch first` | Remote has commits you don't | `git pull --rebase origin main` then push |
| `remote: Permission denied` | Token belongs to a different account | Check `git config user.email`, use the right token |
| `src refspec main does not match any` | Not on `main` | `git branch -M main` |

The remote was created **without** a README, `.gitignore` or licence, so a
non-fast-forward error should not occur unless something was added on GitHub
afterwards.

---

## Before you push — secrets check

`.gitignore` excludes `.env`, `node_modules`, build output and logs. This was
verified against the committed tree:

```bash
git status --short                  # clean
git ls-files | grep -i "\.env$"     # prints nothing
```

`.env.example` **is** committed (it holds placeholders only, no real values).
The real `.env` is not tracked.

If `.env` is ever committed by accident, rotate `JWT_SECRET` and the database
password immediately — deleting the file in a later commit does not remove it
from history.

---

## After pushing — deploy

The app is a standard Node service and deploys to Vercel, Render, Railway or any
Node host. See `README.md` → *Deployment* for the build command, output
directory and the environment variables to set. At minimum you need
`DATABASE_URL` and `JWT_SECRET`; set `ADMIN_EMAILS` to your own address so your
account is granted admin on first sign-up.
