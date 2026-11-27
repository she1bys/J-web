# Gracia

A pixel-art block game that runs in the browser, on computers and phones. The name is inspired by
Joana: her name means "God is gracious", and *gracia* means grace.
Tap the title to open the menu, create or load a world, and play in
**Survival** (health, hunger, gather, craft) or **Creative** (every block, flying).

## Tech stack

| Part | Choice | Why |
| --- | --- | --- |
| Language | **TypeScript** | JavaScript with type checking, so mistakes are caught before the game runs |
| 3D engine | **[three.js](https://threejs.org)** | The standard WebGL library for 3D in the browser |
| Build tool | **[Vite](https://vite.dev)** | Instant reloads while developing, small optimised builds |
| Tests | **[Vitest](https://vitest.dev)** | Fast unit tests for the world, physics, maps and font |
| Font | **Silkscreen** (via Fontsource) | Pixel font for menus and HUD, bundled locally |

Everything else (textures, sound effects, the character, the maps) is made in code. The only media files are the songs you add.

## Getting started

You need [Node.js](https://nodejs.org) 20.19 or newer.

```bash
npm install
npm run dev
```

Then open the address Vite prints (usually http://localhost:5173).

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the development server with live reload |
| `npm run build` | Type-check and build the site into `dist/` |
| `npm run preview` | Serve the built `dist/` folder locally |
| `npm test` | Run the unit tests |
| `npm run typecheck` | Check types without building |
| `npm run check` | Type-check, test and build: run this before pushing |

> The game must be served over http(s). Opening `index.html` directly from disk won't work.

## Project structure

```
├── index.html                 Page shell (viewport, manifest, app root)
├── public/                    Static files copied as-is (icon, web app manifest)
├── src/
│   ├── main.ts                Entry point: styles + starts the App
│   ├── app/App.ts             The flow: title → menus → intro → game → pause
│   ├── config/
│   │   ├── game.ts            Title text and credits  ← rename the game here
│   │   └── settings.ts        Player settings and their defaults
│   ├── audio/                 Sound: engine (3D, reverb, limiter), sound designs, ambience
│   ├── core/                  Small shared building blocks
│   │   ├── MusicPlayer.ts     Plays your songs, shuffled
│   │   ├── songStore.ts       Songs added from a device (kept in the browser)
│   │   ├── noise.ts           Terrain noise
│   │   ├── random.ts          Seeded random numbers
│   │   ├── storage.ts         Safe localStorage access
│   │   ├── timeline.ts        Animation timing helpers
│   │   ├── viewport.ts        Landscape handling on phones
│   │   └── mobile.ts          Blocks pinch/double-tap zoom
│   ├── assets/music/          Drop song files here to bundle them with the game
│   ├── fonts/pixelFont.ts     The 6×7 pixel font (A–Z, 0–9)
│   ├── title/                 Title screen: pixel name, debris, cursor trail
│   ├── cinematic/             The sunset intro movie
│   ├── ui/Menu.ts             Menu rendering and keyboard navigation
│   ├── styles/                CSS, one file per area
│   └── game/
│       ├── Game.ts            Runs a world: blocks, player, inventory, survival, commands, saving
│       ├── modes.ts           Survival / creative rules
│       ├── world/             Blocks, world grid, lighting, chunk meshing, raycasting, saves, world files
│       ├── items/             Item list, icons, inventory, crafting recipes, block drops
│       ├── survival/          Health, hunger and air
│       ├── entities/          Dropped items lying in the world
│       ├── commands/          The command system (/give, /tp, …), one registry + built-ins
│       ├── textures/          Pixel-art texture atlas painted in code
│       ├── player/            Physics, camera rig, character model, item in hand
│       ├── input/             Keyboard + mouse, and touch controls
│       ├── hud/               Item bar, vitals, inventory screen, command bar, death screen
│       ├── effects/           Sky + day/night, clouds, debris, block selection
│       └── maps/              One file per map type, plus shared/ helpers
├── tests/                     Unit tests
├── docs/                      Guides for extending the game
└── .github/workflows/         CI: type-check, test, build, deploy to GitHub Pages
```

## Worlds and game modes

**Play** opens your worlds: load a saved one, or **Create new world** with a name, a map type,
a mode and an optional seed (same seed = same terrain). Worlds are saved in the browser,
including everything built, your inventory, health and position.

| | Survival | Creative |
| --- | --- | --- |
| Health, hunger, air | Yes: fall damage, drowning, starving | No |
| Mining | Takes time; tools speed it up; stone needs a pickaxe | Instant |
| Blocks | Mined blocks drop as items; placing uses them up | Unlimited, from the palette |
| Flying | No | Double-tap jump, or `/fly` |
| Inventory | Backpack + crafting list | Backpack + every item |

### Survival guide

1. Punch trees for **wood** → craft **planks**, **sticks** and a **crafting table** (by hand).
2. Next to the table: **wooden pickaxe** → mine stone for **cobblestone** → **stone tools** and a **furnace**.
3. Dig into caves for **coal** and **iron ore**. Coal + stick = **torches** (caves are dark at night and underground).
4. In the furnace (fuel: coal or planks): iron ore → **iron ingots** → **iron tools**; sand → glass; raw meat → cooked.
5. **Farming:** a hoe turns grass or dirt into farmland; plant **seeds** (they drop from grass); ripe wheat → **bread**.
6. **Saplings** (from leaves) grow into trees. **Chests** store 27 stacks. A **bed** sets your respawn point and skips the night.

Food: apples, bread, cooked meat. Select it and press *use* to eat.
Switch any time with `/gamemode survival` or `/gamemode creative`.

## Commands

Press **T** or **/** (or **CMD** on a phone). Tab completes; ↑/↓ recalls earlier commands.

| Command | What it does |
| --- | --- |
| `/help [command]` | List commands or explain one |
| `/gamemode <survival\|creative>` | Switch mode (`/gm s`, `/gm c`) |
| `/give <item> [count]` | Get items: `/give stone_pickaxe`, `/give planks 64` |
| `/items` | List every item name |
| `/tp <x> <y> <z>` | Teleport; `~` is relative: `/tp ~ ~10 ~` |
| `/spawn`, `/setspawn [x y z]` | Go to / set the respawn point |
| `/time <set\|add\|query> …` | `sunrise`, `noon`, `sunset`, `midnight`, or hours (0–24) |
| `/setblock x y z <block>` | Place or remove one block |
| `/fill x1 y1 z1 x2 y2 z2 <block>` | Fill a box (up to 32,768 blocks) |
| `/gamerule <keepInventory\|dayCycle> [true\|false]` | World rules |
| `/heal`, `/feed`, `/kill`, `/clear`, `/fly`, `/pos`, `/seed` | Handy extras |

Adding a command: write a `Command` in `src/game/commands/builtin.ts` (or a new file) and register it.
Commands only use the `CommandContext` interface, so they'll also work on a multiplayer server later.

## Maps

| Map | File | Highlights |
| --- | --- | --- |
| Meadow | `src/game/maps/meadow.ts` | Hills, pond, cabin, oak trees |
| Desert | `src/game/maps/desert.ts` | Dunes, cacti, palm oasis, stepped pyramid |
| Snowy Peaks | `src/game/maps/snowyPeaks.ts` | Mountains, pines, frozen lake |
| Sunset Islands | `src/game/maps/sunsetIslands.ts` | Islands in a warm sea, golden-hour sky |
| Flatlands | `src/game/maps/flatlands.ts` | Flat and open, suggested for creative |

To add one, see [docs/ADDING_A_MAP.md](docs/ADDING_A_MAP.md). Planning for online play is in
[docs/MULTIPLAYER.md](docs/MULTIPLAYER.md).

## Sound

All sound effects are designed in code (`src/audio/sounds.ts`) and rendered once when the game
starts, several variations each, so repeated sounds like footsteps never sound identical.

- **Materials:** wood, stone and glass ring at their own resonant frequencies; grass, sand, snow
  and leaves are built from many tiny grains of crunch.
- **3D:** blocks you break or place are heard from where they are, and footsteps from your feet.
- **Mix:** light outdoor reverb, a limiter so nothing distorts, muffled sound under water.
- **Ambience:** each map has its own soundscape: wind, birdsong by day, crickets at night, surf
  on the islands (`ambience` in each map file).
- **Settings:** separate volumes for sound effects, ambience and music.

## Music

The game plays your own songs, shuffled. There are two ways to add them:

1. **For everyone:** put audio files (`.mp3`, `.m4a`, `.ogg`, `.wav`…) in
   [`src/assets/music/`](src/assets/music/). On GitHub you can use *Add file → Upload files* in that
   folder. They're picked up automatically on the next deploy. Only add music you have the right to
   share, because it's published on the public site.
2. **Just for you:** in the game, open *Settings → Music → Add songs from device*. Those songs are
   saved in that browser only and never uploaded.

*Settings → Music* also has on/off, volume and *Next song*.

## Renaming the game

Change `title` in [`src/config/game.ts`](src/config/game.ts): it's only shown on the title screen.
Also update `<title>` in `index.html` and the names in `public/manifest.webmanifest`.

## Controls

**Computer:** WASD move · mouse look · Space jump (double-tap to fly in creative) · Shift sprint ·
hold left click to mine · right click to build or eat · 1–9 or wheel to pick · E inventory ·
T or / commands · Q drop (Ctrl+Q whole stack) · V camera · Esc pause.

**Phone / tablet (landscape):** left thumb anywhere for the joystick (push to the edge to sprint) ·
drag on the right to look · hold MINE · tap USE to build or eat · JUMP (double-tap to fly in creative) ·
BAG inventory · CMD commands · CAM switches view.

On Android the game goes fullscreen and locks to landscape when you press Play. iPhones don't
allow websites to lock orientation, so the game view rotates itself while the phone is upright.
Adding the site to the home screen opens it fullscreen in landscape.

## Deploying

- **GitHub Pages:** in the repository settings, go to *Pages* and set *Source* to **GitHub Actions**.
  Every push to `main` then runs the checks and publishes the site.
- **Vercel / Netlify:** import the repository; they detect Vite automatically
  (build command `npm run build`, output folder `dist`).

## Credits and licences

- three.js: MIT licence
- Silkscreen font by Jason Kottke: SIL Open Font License
