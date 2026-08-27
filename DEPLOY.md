# Putting Nearby online

The page itself is fully static: HTML, CSS and four ES modules. Any host that
serves files will do. There is nothing to build and nothing to install.

The chat is not static. It calls an API that has to run somewhere else, and the
page is useless without it — so a static host alone is half the deployment.

## Before any public deploy

1. Set `CONFIG.apiBase` in `js/copy.js` to the API origin. Empty means
   same-origin, which for a Pages deploy means nothing answers.
2. On the API: `WEB_CHAT_ENABLED=true` and `WEB_CHAT_ALLOWED_ORIGINS` set to
   this page's exact origin. Both default to off, and the second must never be
   `*`.
3. The API needs HTTPS. A page served over HTTPS cannot call a plain-HTTP
   endpoint; the browser blocks it as mixed content.
4. Delete `robots.txt` and the `<meta name="robots" content="noindex">` line in
   `index.html`. They exist so a half-finished preview does not get indexed.

**No key belongs in this repository.** The provider key stays on the API host.
Nothing in `js/` should ever contain a credential — this repository is public.

## Why this page has its own repository

The landing page was written inside a private product repository, and Pages on
a private repository needs a paid plan. Publishing that repository is not an
option, so the page lives on its own instead. It carries no secrets, which is
why this one can be public.

## Option A — this repository, GitHub Pages (in use)

Free, no card, and nothing outside the landing page is exposed.

```bash
cd web
git init -b main
git add .
git commit -m "Nearby landing page"
gh repo create nearby-site --public --source=. --push
echo '{"source":{"branch":"main","path":"/"}}' \
  | gh api -X POST repos/<owner>/nearby-site/pages --input -
```

Live within a minute or two. To update: commit and push from inside `web/`.

`web/` holds its own `.git` and is listed in the outer repository's
`.gitignore`, so there is exactly one copy of these files and exactly one
history. The product repository ignores the folder entirely.

## Option B — Netlify Drop, no repository at all

Fastest way to get a link to send someone: open <https://app.netlify.com/drop>
and drag the `web` folder onto the page. A URL appears in seconds. Free, and
Netlify never sees this repository.

Good for showing the page to a few people. Weaker for anything ongoing: every
update means dragging the folder again.

## Option C — Cloudflare Pages or Vercel from the private repository

Both are free, both give a custom domain with SSL, and both can be pointed at
the `web/` subdirectory of a private repository so the source stays private.
The cost is that the service gets read access to this entire repository —
including everything listed above. Prefer Option A unless a custom domain and
automatic deploys are needed now.

## About a domain

Not yet. `*.github.io` and `*.netlify.app` are enough to show the page and to
learn whether the name survives contact with real people.

When it is time: `nearby.com` is long gone and generic one-word `.com` domains
in this space run into five figures. Realistic candidates are `nearby.chat`,
`nearby.bot`, `benearby.app`, `nearby.so`. Buy the domain after the name is
settled, not before — a rename is free today and expensive later.
