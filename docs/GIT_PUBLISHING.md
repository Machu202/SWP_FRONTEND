# Git publishing guide

This frontend is ready to publish as a Git repository.

## First-time GitHub upload

```bash
git init
git add .
git commit -m "Initial React frontend"
git branch -M main
git remote add origin <your-github-repository-url>
git push -u origin main
```

## What should be committed

Commit these files:

- `src/`
- `public/`
- `index.html`
- `package.json`
- `package-lock.json`
- `.env.example`
- `.gitignore`
- `README.md`
- config files such as `vite.config.js`, `.editorconfig`, `.gitattributes`, `.nvmrc`

Do not commit:

- `node_modules/`
- `dist/`
- `.env`
- local IDE/cache/log files

## Local setup after cloning

```bash
npm install
cp .env.example .env
npm run dev
```

The default backend URL is:

```text
http://localhost:8080/api/v1
```
