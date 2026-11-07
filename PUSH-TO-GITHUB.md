# MarketHub — GitHub repository

**Status: pushed and verified.** The full source, with both commits of history,
is live at:

**<https://github.com/natlusniel-code/markethub>**

| | |
|---|---|
| Branch | `main` |
| HEAD | `97e1f7d` — *docs: record the created GitHub remote and exact push steps* |
| Root commit | `7cc45c2` — *MarketHub: complete e-commerce storefront and admin dashboard* |
| Tracked files | 151 |
| Tree SHA | `2f47eecb6d3ff17d2454932c904756a826cf0f9c` |
| Visibility | public |

Verified by cloning the repository fresh and comparing it against the local
working copy: identical file list, identical tree SHA, both commits present.

---

## How it was pushed

The build environment had no GitHub token, no `gh` CLI and no SSH key, so a
plain `git push` over HTTPS failed with `No anonymous write access`.

The route that worked: an ed25519 keypair was generated in the sandbox and its
**public** half was registered on the repository as a **write-enabled deploy
key**. Git then pushed over SSH, which preserves the real commit history —
unlike the GitHub Contents API, which would have flattened everything into a
single synthetic commit.

```bash
ssh-keygen -t ed25519 -f ~/.ssh/markethub_deploy -N ""
# public key registered as a deploy key with write access
git remote set-url origin git@github.com:natlusniel-code/markethub.git
git push -u origin main
```

### Managing that deploy key

The key is scoped to this one repository and can only read and write its
contents — it cannot touch your account, your other repositories or your
settings. If you would rather not keep it:

**Settings → Deploy keys → `markethub-sandbox-push` → Delete.**

Deleting it does not affect the code that is already pushed. Your own machine
will keep working normally through your own credentials.

---

## Pushing future changes yourself

From the project root (`app/`):

```bash
git add -A
git commit -m "your message"
git push
```

If you clone the repository somewhere new, `origin` will already point at the
right place. If you are working from a copy that has no remote:

```bash
git remote add origin https://github.com/natlusniel-code/markethub.git
git branch -M main
git push -u origin main
```

### Authentication options

**Personal access token** — <https://github.com/settings/tokens> →
*Generate new token (classic)* → scope **`repo`**. Use it as the password when
git prompts (GitHub stopped accepting account passwords for git in 2021).

**GitHub CLI**

```bash
gh auth login          # GitHub.com → HTTPS → paste token
git push
```

**SSH** — requires a key registered at <https://github.com/settings/keys>:

```bash
git remote set-url origin git@github.com:natlusniel-code/markethub.git
ssh -T git@github.com  # expect "successfully authenticated"
git push
```

---

## If a push is rejected

| Message | Cause | Fix |
|---|---|---|
| `No anonymous write access` | No credentials supplied | Use a token or SSH key |
| `Authentication failed` | Wrong password, or token lacks `repo` | Regenerate the token with `repo` scope |
| `non-fast-forward` / `fetch first` | Remote has commits you don't | `git pull --rebase origin main` then push |
| `remote: Permission denied` | Token belongs to a different account | Check `git config user.email`, use the right token |
| `src refspec main does not match any` | Not on `main` | `git branch -M main` |

---

## Secrets

`.gitignore` excludes `.env`, `node_modules`, build output and logs. This was
verified against the pushed tree:

```bash
git ls-files | grep -i "\.env$"     # prints nothing
```

`.env.example` **is** committed — it holds placeholders only
(`JWT_SECRET=replace-me-with-a-long-random-string`,
`DATABASE_URL=postgresql://user:password@host:5432/...`). The real `.env` is
not tracked and never was.

If `.env` is ever committed by accident, rotate `JWT_SECRET` and the database
password immediately — deleting the file in a later commit does not remove it
from history.

---

## Deploying

The app is a standard Node service and deploys to Vercel, Render, Railway or any
Node host. See `README.md` → *Deployment* for the build command, output
directory and environment variables. At minimum you need `DATABASE_URL` and
`JWT_SECRET`; set `ADMIN_EMAILS` to your own address so your account is granted
admin on first sign-up.
