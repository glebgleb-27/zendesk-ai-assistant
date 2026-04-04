# Production Deployment Notes

## 1. Deploy the backend

Deploy [`backend/`](/Users/user/Documents/Playground/zendesk-ai-sidebar-app/backend) to a public HTTPS service.

Requirements:

- Node.js 20+ runtime
- Public HTTPS endpoint
- Environment variables from [`backend/.env.example`](/Users/user/Documents/Playground/zendesk-ai-sidebar-app/backend/.env.example)

Recommended minimum production settings:

- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `BACKEND_SHARED_SECRET`
- `PORT`
- platform logging enabled

The backend exposes:

- `GET /health`
- `POST /api/chat`

## 2. Set the shared secret

Generate a strong random secret and use the same value in both places:

- backend env var: `BACKEND_SHARED_SECRET`
- Zendesk app install setting: `backend_api_key`

This keeps the secret out of the browser and lets the backend reject unauthorized calls.

## 3. Package the Zendesk app

Create a zip whose root contains:

- `manifest.json`
- `assets/`
- `translations/`

From [`zendesk-app/`](/Users/user/Documents/Playground/zendesk-ai-sidebar-app/zendesk-app):

```bash
zip -r zendesk-ai-sidebar-app.zip .
```

Zendesk documents a 2 MB limit for private app zip uploads, so keep the app assets lean.

## 4. Upload and install in Zendesk Support

Zendesk's current private-app flow is:

1. In Admin Center, open `Apps and integrations`.
2. Go to `Apps > Zendesk Support apps`.
3. Click `Upload App`.
4. Upload the zip file.
5. Install the app and fill in the install settings.

Install settings for this app:

- `backend_origin`: `https://your-backend.example.com`
- `backend_domain`: `your-backend.example.com`
- `backend_api_key`: same value as `BACKEND_SHARED_SECRET`

## 5. Validate in production

Open a real ticket and verify:

- the app appears in the right sidebar
- `Summarize`, `Draft reply`, and `Next steps` work
- freeform prompts work
- no ticket comment is inserted automatically
- backend logs show authenticated requests

## 6. Operational notes

- If your backend is behind a firewall, allow the Zendesk app proxy to reach it.
- Use TLS everywhere.
- Rotate `BACKEND_SHARED_SECRET` periodically.
- Add request logging, uptime checks, and alerting before broader rollout.
- Consider rate limiting on `/api/chat` once usage grows.
- If you add Notion later, keep its credentials server-side only.
