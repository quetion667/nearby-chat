# Putting Nearby online

Two deployments, not one, and they are unrelated to each other.

| Piece | What it is | Where it runs |
| --- | --- | --- |
| This repository | Static HTML, CSS and six ES modules | Cloudflare Worker, assets only, at `talktonearby.com` |
| The chat API | `app/api/web_chat.py` in the private Ryadom repository — Python, FastAPI | A VPS at `api.talktonearby.com`; see `deploy/README.md` there |

The page is useless without the API. A static host alone is half a
deployment, and the visible half is the half that cannot answer.

## Why they are separate

The API is not a static thing that could ride along here. It imports the
prompt builder, the crisis gate and the output policy — most of the product —
and it is Python, so no edge runtime will take it. It also spends money on
anonymous traffic, which is a thing that needs ceilings and a process to
enforce them in.

This repository stays public because it carries no secrets. **No key belongs
in it.** Nothing under `js/` should ever contain a credential.

## Deploying this repository

```bash
npx wrangler deploy
```

`wrangler.jsonc` is committed, which matters: without it wrangler generates a
config from whatever it guesses, and its guess is `"directory": "."` with no
exclusions. That is how the first deploy uploaded `.git/` — every loose
object, `config` and `index` — into a public asset store. `.assetsignore` is
what stops that, and it also keeps `*.md` and `serve.py` off the live site.

Cloudflare happens to answer 404 for dot-paths today. That is luck, and the
exclusion is not written in the expectation of needing it.

## Before a public deploy

1. `CONFIG.apiBase` in `js/copy.js` must name the API origin. Empty means
   same-origin, which here means nothing answers.
2. On the API: `WEB_CHAT_ENABLED=true`, and `WEB_CHAT_ALLOWED_ORIGINS` set to
   this page's exact origin — no trailing slash, and never `*`.
3. The API must be HTTPS. A page served over HTTPS cannot call a plain-HTTP
   endpoint; the browser blocks it as mixed content, silently, and the chat
   fails with no visible cause.
4. Once `talktonearby.com` resolves, set `"workers_dev": false` and deploy
   again, so one page does not live at two addresses.

## The domain

`talktonearby.com`, registered through Cloudflare Registrar, which sells at
cost — about $10.50 a year, renewals at the same price, WHOIS privacy
included. The constraint is that the domain must use Cloudflare nameservers,
which is what we wanted anyway.

Records:

| Type | Name | Content | Proxy |
| --- | --- | --- | --- |
| — | `talktonearby.com` | Worker custom domain | managed by Cloudflare |
| A | `api` | the VPS address | **DNS only** |

`api` is grey-clouded on purpose: Caddy answers the ACME challenge on port 80
itself, and behind Cloudflare's proxy that challenge never reaches it.

The shortlist this was chosen from, for whenever the name is revisited:
`nearby.chat`, `nearby.io`, `nearby.co`, `nearby.ai` and every other one-word
form are long gone, most of them parked on marketplaces at five figures.
`benearby.app` and `benearby.io` were free at the time of writing.

## Alternatives, if this ever needs redoing

**Netlify Drop.** Drag the folder onto <https://app.netlify.com/drop> and a URL
appears in seconds. Good for showing one person one thing. Every update means
dragging the folder again, and the chat still needs the API elsewhere.

**GitHub Pages.** What this used before Cloudflare. Free and adequate, but the
custom domain and the deploy config are less direct, and there is no
`.assetsignore` equivalent — Pages publishes the branch.

**Cloudflare Pages or Vercel from the private repository.** Both work and both
give the service read access to the entire Ryadom repository — the persona
corpus, the roadmap, the 18+ policy tree. There are no secrets in git, so
nothing leaks a credential, but the product itself would sit on someone
else's build infrastructure. Not worth it to save a config file.
