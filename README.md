# Bible Study Website (Audio streams from Google Drive)

This is the website version of your Bible study app. Audio now streams
directly from Google Drive using the file IDs already stored in
`audio_ids.js` — no download/import step, it just plays in the browser.

## 1. Before you upload: share the Drive files publicly

For a browser to stream an mp3 straight from Drive, each file must be
shared as **"Anyone with the link" → Viewer**. If your audio files are
still private, streaming will fail with a permission error.

- Select all the audio files/folders in Google Drive → **Share** →
  **General access: Anyone with the link**.
- This has to be done once for the whole folder (sharing a parent
  folder that way shares everything inside it too).

## 2. Put this on GitHub

This folder is too large (~280 MB) to drag-and-drop through the GitHub
website (that upload box only accepts files up to 25 MB each). Use
git from a computer instead:

```bash
cd bible-study-website   # this folder
git init
git add .
git commit -m "Initial website"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPO.git
git push -u origin main
```

(Don't have git installed? GitHub Desktop — desktop.github.com — does
the same thing with buttons instead of commands: "Add local
repository" → this folder → "Publish repository.")

## 3. Turn on GitHub Pages

In your repo on GitHub: **Settings → Pages → Source: Deploy from a
branch → Branch: main, folder: / (root) → Save**.

GitHub gives you a URL like:
`https://YOUR-USERNAME.github.io/YOUR-REPO/`

It can take a minute or two to go live after the first push.

## 4. A few things worth knowing

- **Streaming from Drive is not built for heavy traffic.** Google
  applies a per-file daily download quota; if a chapter gets hit hard
  in a short time, playback may briefly show "too many users have
  viewed this file today." Fine for personal or small-group use; for
  a public site with real traffic you'd eventually want to move the
  audio to real hosting (e.g. an S3/R2 bucket or a CDN).
- `index.html` is the whole app (single file, ~5.5 MB of code) plus
  the supporting data files (`*.js`, `interlinear/*.json`) sitting
  next to it — don't rename or move them relative to `index.html`.
- `audio_ids.js` already contains the Drive file ID for every
  chapter in all three languages (English, Myanmar, Tamil) — this is
  the same data as the `audio_ids.json` you gave me, just already
  wired into the app's code.
