# HeavenxCRM (standalone frontend)

This is the CRM half of the HeavenxCRM frontend, split out of `../heavenxcrm`
so it can be built and hosted on its own domain/subdomain (e.g. `crm.heavenxcrm.com`)
independently of the public student site. All the CRM page/component/lib code was copied
over unchanged; only the app shell (`App.tsx`, `main.tsx`, config files) is new, since a
standalone app needs its own entry point and routes.

It talks to the same Django backend (`heavenxcrm_api`) as before — no backend/API changes
were made or are required. Point `VITE_API_BASE_URL` at that backend's `/api` URL.

## Routes

- `/login`, `/password-reset`, `/reset-password/:uidb64/:token` — auth
- `/crm/*` — the CRM app (dashboard, pipeline, students, communications, universities, counselors, tasks)
- `/call-window` — the popup window used for counselor audio/video calls
- `/` and any unknown path redirect to `/crm`

## Develop

```bash
npm install
npm run dev   # http://localhost:5174 (main site uses 5173, so both can run together)
```

## Build / deploy

```bash
npm run build   # outputs to dist/
npm run preview
```

Deploy `dist/` to its own static host (Nginx, Vercel, Netlify, etc.), same as `heavenxcrm`.
Configure `VITE_API_BASE_URL` in `.env.production` (or your host's env vars) to point at the
live Django API, and make sure that API's CORS/CSRF trusted origins include this app's domain.

## Note

`CrmLayout`'s sidebar has an "Admin Dashboard" link to `/admin`, which lives in the main
`heavenxcrm` app, not here — that's carried over as-is from the original code. If this CRM
app is deployed on a different domain than the main site, that link won't resolve; point it at
the main site's full URL if you want it to keep working, or remove it if CRM staff shouldn't see it.
