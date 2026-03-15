# JUGGuesser

JUGGuesser is a two-player local quiz game where both players see the same image and try to place the closest pin on a Mapbox map. Each round awards one point to the closer player, while also tracking cumulative total distance across all rounds for tie-breaking.

## Stack

- React + Vite + TypeScript frontend
- Node + Express + TypeScript backend
- In-memory game state
- Mapbox GL JS for the interactive map

## Features

- Single-machine two-player flow
- Built-in seeded rounds
- Round-by-round scoring
- Total distance tracking across the full game
- Final winner determined by points, then total distance as tie-breaker

## Setup

1. Create a Mapbox token at https://www.mapbox.com/
2. Copy the example env file:

   ```bash
   cp client/.env.example client/.env
   ```

3. Edit `client/.env` and set:

   ```bash
   VITE_MAPBOX_ACCESS_TOKEN=your_actual_token_here
   ```

4. Install dependencies if needed:

   ```bash
   npm install
   npm install --prefix client
   npm install --prefix server
   ```

## Run locally

```bash
npm run dev
```

This starts:
- frontend at http://localhost:5173
- backend at http://localhost:3001

## Build

```bash
npm run build
```

## Gameplay

1. Start a new game
2. Player 1 places a pin and locks the guess
3. Player 2 places a pin and locks the guess
4. The game reveals the true location and both distances
5. Continue through all rounds
6. View the final winner based on points, with total distance as the tie-breaker

## Notes

- Game state is stored in memory and resets when the server restarts
- The included image assets are placeholder sample files; you can replace them in `client/public/`
- Seeded round coordinates live in `server/src/index.ts`
