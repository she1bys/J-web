# Multiplayer plan

How online play can be added later, and what's already in place for it.

## The short version

- **Keep GitHub Pages for the game itself.** It only serves files; it can't run a server.
- **Add one small server** that holds each shared world and passes messages between players.
  Recommended: **Cloudflare Workers + Durable Objects** (one object per world, built-in
  WebSockets and storage, generous free tier, no machines to manage).
  Alternative: a Node.js server with WebSockets (e.g. on Fly.io or Render) if we'd rather run
  our own process.
- **The server is in charge** ("authoritative"): players send *requests* ("break block at x,y,z"),
  the server checks them and tells everyone what happened. That keeps worlds in sync and stops
  cheating.

## Why it fits this game well

Worlds are generated from a **seed**, and the generator is deterministic (the tests check that the
same seed always builds the same world). So joining a world never means downloading the whole map:
the server sends the seed plus the list of player changes (`edits`), and each player's browser
builds the rest itself, exactly as loading a saved world already works today.

## What's already set up for it

| Already done | Why it matters |
| --- | --- |
| Every block change goes through one function (`Game.editBlocks`) | One place to send edits to the server and apply edits from it |
| Commands only use the `CommandContext` interface | The same commands can run on the server against the shared world |
| World, blocks, items, recipes, drops, vitals and commands have no browser dependencies | They can be shared between the game and the server unchanged |
| Saves are plain data (`WorldSave`: seed, edits, inventory…) | The same shape can be stored by the server |
| The `Character` model is separate from the player | Other players can be drawn with it |

## Steps

1. **Split the repo into packages** (npm workspaces):
   `packages/shared` (world, items, commands, maps), `packages/client` (today's game),
   `packages/server`.
2. **Server:** a room per world holding the seed, edits, and each player's position and inventory.
   Save to storage every few seconds.
3. **Messages** (JSON at first, compact binary later if needed):
   - client → server: `join`, `move` (position, ~10 times a second), `break`, `place`, `use`, `command`, `chat`
   - server → clients: `welcome` (seed, edits, players), `blocks` (changes), `players` (positions), `chat`, `vitals`
4. **Smooth movement:** your own player moves immediately (client-side prediction); other players
   are drawn slightly in the past and interpolated, so they glide instead of jumping.
5. **Joining:** a world gets a short room code or link ("Invite"). Opening the link joins the world.
6. **Chat:** the command bar already shows messages; add `/say` and plain-text chat.
7. **Later:** names and skins, permissions (who can build), kicking, and a proper account sign-in if needed.

## Costs and limits to expect

- Cloudflare's free tier covers small groups of friends comfortably; a busy public server would
  need the paid plan (a few dollars a month to start).
- World size stays the same (up to ~128×128); larger, endless worlds would need chunk streaming,
  which is a bigger change.
