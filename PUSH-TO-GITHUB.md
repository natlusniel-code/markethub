# Pushing MarketHub to GitHub

The repository is already initialised and committed locally. Pushing to *your*
GitHub account needs your credentials, which I do not have — so run these
commands yourself.

## 1. Create an empty repository on GitHub

Go to <https://github.com/new>:

- **Repository name:** `markethub`
- **Visibility:** your choice
- **Do NOT** initialise with a README, .gitignore or licence — the repo already
  has all three, and an initialised remote causes a non-fast-forward push.

## 2. Point the local repo at it and push

From the project root:

```bash
git remote add origin https://github.com/<your-username>/markethub.git
git branch -M main
git push -u origin main
```

Replace `<your-username>` with your GitHub username.

## 3. If you use SSH instead of HTTPS

```bash
git remote add origin git@github.com:<your-username>/markethub.git
git branch -M main
git push -u origin main
```

## 4. If GitHub asks for a password

GitHub no longer accepts account passwords over HTTPS. Use a **personal access
token**:

1. <https://github.com/settings/tokens> → **Generate new token (classic)**
2. Scope: `repo`
3. Copy the token and paste it as the password when prompted.

Or authenticate once with the GitHub CLI:

```bash
gh auth login
gh repo create markethub --private --source=. --remote=origin --push
```

## 5. Verify

```bash
git remote -v
git log --oneline -1
```

You should see your remote and the initial commit.

## Before you push — check for secrets

`.gitignore` already excludes `.env`, `node_modules`, build output and logs.
Confirm nothing sensitive is staged:

```bash
git status --short
git ls-files | grep -i "\.env$"     # should print nothing
```

If `.env` ever was committed, rotate `JWT_SECRET` and your database password
before pushing — removing the file in a later commit does not remove it from
history.
