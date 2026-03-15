import cors from 'cors'
import express from 'express'

type PlayerId = 'player1' | 'player2'

interface Coordinates {
  lat: number
  lng: number
}

interface RoundSeed {
  id: string
  title: string
  imageUrl: string
  actualLocation: Coordinates
}

interface Scoreboard {
  player1Points: number
  player2Points: number
  player1TotalDistanceKm: number
  player2TotalDistanceKm: number
}

interface GameRoundState {
  roundNumber: number
  totalRounds: number
  title: string
  imageUrl: string
  guesses: Partial<Record<PlayerId, Coordinates>>
  isRoundComplete: boolean
  summary?: {
    player1DistanceKm: number
    player2DistanceKm: number
    pointWinner: PlayerId | 'tie'
    actualLocation: Coordinates
  }
}

interface GameState {
  phase: 'setup' | 'playing' | 'results' | 'finished'
  currentRoundIndex: number
  currentPlayer: PlayerId
  rounds: RoundSeed[]
  scoreboard: Scoreboard
  currentRound: GameRoundState | null
  winner: PlayerId | 'tie' | null
}

const rounds: RoundSeed[] = [
  {
    id: 'round-1',
    title: '',
    imageUrl: '/kcjug.avif',
    actualLocation: { lat: 37.8199, lng: -122.4783 },
  },
  {
    id: 'eiffel-tower',
    title: 'Eiffel Tower',
    imageUrl: '/eiffel-tower.png',
    actualLocation: { lat: 48.8584, lng: 2.2945 },
  },
  {
    id: 'tokyo-tower',
    title: 'Tokyo Tower',
    imageUrl: '/tokyo-tower.png',
    actualLocation: { lat: 35.6586, lng: 139.7454 },
  },
]

const createRoundState = (seed: RoundSeed, roundNumber: number): GameRoundState => ({
  roundNumber,
  totalRounds: rounds.length,
  title: seed.title,
  imageUrl: seed.imageUrl,
  guesses: {},
  isRoundComplete: false,
})

const createInitialGameState = (): GameState => ({
  phase: 'setup',
  currentRoundIndex: 0,
  currentPlayer: 'player1',
  rounds,
  scoreboard: {
    player1Points: 0,
    player2Points: 0,
    player1TotalDistanceKm: 0,
    player2TotalDistanceKm: 0,
  },
  currentRound: null,
  winner: null,
})

let gameState = createInitialGameState()

const toRadians = (degrees: number) => (degrees * Math.PI) / 180

const haversineDistanceKm = (from: Coordinates, to: Coordinates): number => {
  const earthRadiusKm = 6371
  const dLat = toRadians(to.lat - from.lat)
  const dLng = toRadians(to.lng - from.lng)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(from.lat)) *
      Math.cos(toRadians(to.lat)) *
      Math.sin(dLng / 2) ** 2

  return 2 * earthRadiusKm * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

const roundDistance = (value: number) => Number(value.toFixed(2))

const syncWinner = () => {
  const { player1Points, player2Points, player1TotalDistanceKm, player2TotalDistanceKm } = gameState.scoreboard

  if (player1Points > player2Points) {
    gameState.winner = 'player1'
    return
  }

  if (player2Points > player1Points) {
    gameState.winner = 'player2'
    return
  }

  if (player1TotalDistanceKm < player2TotalDistanceKm) {
    gameState.winner = 'player1'
    return
  }

  if (player2TotalDistanceKm < player1TotalDistanceKm) {
    gameState.winner = 'player2'
    return
  }

  gameState.winner = 'tie'
}

const startRound = () => {
  const seed = gameState.rounds[gameState.currentRoundIndex]
  gameState.currentRound = createRoundState(seed, gameState.currentRoundIndex + 1)
  gameState.currentPlayer = 'player1'
  gameState.phase = 'playing'
}

const resolveRound = () => {
  if (!gameState.currentRound) {
    return
  }

  const seed = gameState.rounds[gameState.currentRoundIndex]
  const player1Guess = gameState.currentRound.guesses.player1
  const player2Guess = gameState.currentRound.guesses.player2

  if (!player1Guess || !player2Guess) {
    return
  }

  const player1DistanceKm = roundDistance(haversineDistanceKm(player1Guess, seed.actualLocation))
  const player2DistanceKm = roundDistance(haversineDistanceKm(player2Guess, seed.actualLocation))

  let pointWinner: PlayerId | 'tie' = 'tie'
  if (player1DistanceKm < player2DistanceKm) {
    pointWinner = 'player1'
    gameState.scoreboard.player1Points += 1
  } else if (player2DistanceKm < player1DistanceKm) {
    pointWinner = 'player2'
    gameState.scoreboard.player2Points += 1
  }

  gameState.scoreboard.player1TotalDistanceKm = roundDistance(
    gameState.scoreboard.player1TotalDistanceKm + player1DistanceKm,
  )
  gameState.scoreboard.player2TotalDistanceKm = roundDistance(
    gameState.scoreboard.player2TotalDistanceKm + player2DistanceKm,
  )

  gameState.currentRound.isRoundComplete = true
  gameState.currentRound.summary = {
    player1DistanceKm,
    player2DistanceKm,
    pointWinner,
    actualLocation: seed.actualLocation,
  }
  gameState.phase = 'results'
}

const app = express()
app.use(cors())
app.use(express.json())

app.get('/api/game', (_req, res) => {
  res.json({
    phase: gameState.phase,
    currentPlayer: gameState.currentPlayer,
    round: gameState.currentRound,
    scoreboard: gameState.scoreboard,
    winner: gameState.winner,
  })
})

app.post('/api/game/start', (_req, res) => {
  gameState = createInitialGameState()
  startRound()
  res.json({ ok: true })
})

app.post('/api/game/guess', (req, res) => {
  if (!gameState.currentRound || gameState.phase !== 'playing') {
    res.status(400).json({ error: 'No active round.' })
    return
  }

  const { player, lat, lng } = req.body as { player?: PlayerId; lat?: number; lng?: number }

  if (!player || typeof lat !== 'number' || typeof lng !== 'number') {
    res.status(400).json({ error: 'Invalid guess payload.' })
    return
  }

  if (player !== gameState.currentPlayer) {
    res.status(400).json({ error: 'It is not that player turn.' })
    return
  }

  gameState.currentRound.guesses[player] = { lat, lng }
  gameState.currentPlayer = player === 'player1' ? 'player2' : 'player1'

  if (gameState.currentRound.guesses.player1 && gameState.currentRound.guesses.player2) {
    resolveRound()
  }

  res.json({ ok: true })
})

app.post('/api/game/next', (_req, res) => {
  if (gameState.phase !== 'results') {
    res.status(400).json({ error: 'Round is not ready to advance.' })
    return
  }

  if (gameState.currentRoundIndex === gameState.rounds.length - 1) {
    syncWinner()
    gameState.phase = 'finished'
    res.json({ ok: true })
    return
  }

  gameState.currentRoundIndex += 1
  startRound()
  res.json({ ok: true })
})

app.post('/api/game/reset', (_req, res) => {
  gameState = createInitialGameState()
  res.json({ ok: true })
})

const port = 3001
app.listen(port, () => {
  console.log(`JUGGuesser server listening on http://localhost:${port}`)
})