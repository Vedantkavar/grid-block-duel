# Deploying Grid Block Duel

Two free services, ~10 minutes total:

- **Render** — hosts the Node + Socket.IO server (supports WebSockets on free tier)
- **Vercel** — hosts the React client

You'll need a GitHub account and a repo containing this folder.

---

## 1. Push the project to GitHub

From the repo root:

```powershell
git init
git add .
git commit -m "Initial commit"
git branch -M main
# create an empty repo on github.com/<you>/grid-block-duel first, then:
git remote add origin https://github.com/<you>/grid-block-duel.git
git push -u origin main
```

> **Note:** If `npm` is blocked by PowerShell's execution policy on your machine,
> run `npm.cmd` instead of `npm` (e.g. `npm.cmd run build`). Render and Vercel
> won't have this issue — they run on Linux.

---

## 2. Deploy the server to Render

1. Go to https://render.com → **New +** → **Blueprint**.
2. Connect the GitHub repo. Render will detect [`render.yaml`](render.yaml) and
   propose a service called **grid-block-duel-server**.
3. Click **Apply**. Render will install, build, and start the server.
4. When it's live, copy the URL Render gives you. It looks like:
   `https://grid-block-duel-server.onrender.com`
5. Hit `https://<that-url>/health` in your browser — you should see
   `{"ok":true,"ts":...}`.

You'll set the `CORS_ORIGINS` env var **after** Vercel gives you a URL (step 4).

> **Free tier note:** Render's free web services sleep after ~15 minutes of
> inactivity. The first connection after sleep takes ~30 seconds while it spins
> up. Subsequent connections are instant.

---

## 3. Deploy the client to Vercel

1. Go to https://vercel.com → **Add New** → **Project**.
2. Import the same GitHub repo.
3. **Important — set the Root Directory to `client`** in the import screen.
   (Vercel will then auto-detect Vite.)
4. Under **Environment Variables**, add:
   - **Name:** `VITE_SERVER_URL`
   - **Value:** the Render URL from step 2 (e.g. `https://grid-block-duel-server.onrender.com`)
5. Click **Deploy**.
6. When it's done, you'll get a URL like `https://grid-block-duel.vercel.app`.

---

## 4. Tell the server which client URL to trust

Now go back to your Render service:

1. Open the service → **Environment** tab.
2. Add / edit `CORS_ORIGINS` and set it to the Vercel URL:
   ```
   https://grid-block-duel.vercel.app
   ```
   You can list multiple origins separated by commas, e.g. for preview deploys:
   ```
   https://grid-block-duel.vercel.app,https://grid-block-duel-git-main-yourname.vercel.app
   ```
3. Save changes — Render will redeploy automatically.

---

## 5. Test it

- Open your Vercel URL in two different browsers (or one normal + one incognito).
- Window A → **Play with friend** → **Create a room** → share the 5-letter code.
- Window B → **Play with friend** → **Join a room** → enter the code.
- Have fun. Share the Vercel URL with your friend — they can play from anywhere.

---

## Updating the game

Every push to `main` triggers a new deploy on both Render and Vercel
automatically. To update:

```powershell
git add .
git commit -m "Tweak walls"
git push
```

---

## Troubleshooting

- **Client connects but says "transport error"** — `CORS_ORIGINS` on Render
  doesn't include the exact Vercel URL (check trailing slashes, http vs https).
- **First connection after a while is slow** — Render free tier sleeping. Wait
  ~30 seconds, retry.
- **Want a custom domain?** Both Vercel and Render support custom domains for
  free; configure DNS in your domain registrar.
