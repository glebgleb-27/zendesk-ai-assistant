# Zendesk AI Sidebar App

Private Zendesk Support sidebar app that lets agents chat with AI while viewing a ticket.

The MVP is split into two parts:

- `zendesk-app/`: a client-side Zendesk sidebar app that runs inside the ticket sidebar
- `backend/`: a Node.js + TypeScript API that receives the agent prompt plus ticket context and calls OpenAI

## MVP features

- Appears in the Zendesk `ticket_sidebar`
- Reads the current ticket context before each AI request
- Shows a chat UI in the sidebar
- Supports freeform prompts plus `Summarize`, `Draft reply`, and `Next steps`
- Sends prompt + ticket context to a backend API
- Shows AI output without touching the ticket reply box
- Keeps the agent in control at all times

## Project structure

```text
zendesk-ai-sidebar-app/
|-- backend/
|   |-- .env.example
|   |-- Dockerfile
|   |-- package.json
|   |-- tsconfig.json
|   `-- src/
|       |-- app.ts
|       |-- config.ts
|       |-- index.ts
|       |-- types.ts
|       |-- lib/
|       |   |-- auth.ts
|       |   `-- logger.ts
|       |-- routes/
|       |   `-- chat.ts
|       `-- services/
|           |-- ai/
|           |   |-- ai-provider.ts
|           |   |-- openai-service.ts
|           |   `-- prompts.ts
|           |-- knowledge/
|           |   |-- knowledge-source.ts
|           |   `-- notion-knowledge-source.ts
|           `-- tickets/
|               `-- context-formatter.ts
|-- zendesk-app/
|   |-- manifest.json
|   |-- assets/
|   |   |-- app.css
|   |   |-- app.js
|   |   `-- iframe.html
|   `-- translations/
|       `-- en.json
`-- DEPLOYMENT.md
```

## Architecture

1. Agent opens a ticket in Zendesk Support.
2. The sidebar app loads inside the `ticket_sidebar` location.
3. The app reads ticket data with the Zendesk Apps Framework client.
4. The app calls your backend with `client.request()` and injects a secure install setting into the `Authorization` header.
5. The backend validates the shared secret, builds an AI prompt, and calls OpenAI.
6. The backend returns plain-text AI output for the sidebar to display.

## Backend setup

From [`backend/`](/Users/user/Documents/Playground/zendesk-ai-sidebar-app/backend):

```bash
npm install
cp .env.example .env
npm run dev
```

Required environment variables live in [`backend/.env.example`](/Users/user/Documents/Playground/zendesk-ai-sidebar-app/backend/.env.example).

## Zendesk app install settings

When installing the private app in Zendesk, configure:

- `backend_origin`: full HTTPS origin of your backend, such as `https://ai-support.example.com`
- `backend_domain`: hostname only, such as `ai-support.example.com`
- `backend_api_key`: the same shared secret value as `BACKEND_SHARED_SECRET` in the backend

`backend_api_key` is marked secure and is only used in the request header scope.

## Packaging the Zendesk app

Package the contents of [`zendesk-app/`](/Users/user/Documents/Playground/zendesk-ai-sidebar-app/zendesk-app), with `manifest.json` at the zip root.

Example:

```bash
cd zendesk-app
zip -r zendesk-ai-sidebar-app.zip .
```

You can also use Zendesk tooling such as `zcli apps:create` or `zat create` if that fits your deployment flow.

## Production deployment

Production notes are in [`DEPLOYMENT.md`](/Users/user/Documents/Playground/zendesk-ai-sidebar-app/DEPLOYMENT.md).

## Future extensions

- Notion: scaffolded backend interfaces are ready for ticket-aware knowledge lookups later
- Slack: not included in the MVP, but the backend and prompt layer are separated so a Slack delivery step can be added later
