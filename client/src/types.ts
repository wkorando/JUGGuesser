export type PlayerId = 'player1' | 'player2'

export interface LocationGuess {
  lat: number
  lng: number
}

export interface RoundSummary {
  player1DistanceKm: number
  player2DistanceKm: number
  pointWinner: PlayerId | 'tie'
  actualLocation: LocationGuess
}

export interface Scoreboard {
  player1Points: number
  player2Points: number
  player1TotalDistanceKm: number
  player2TotalDistanceKm: number
}

export interface PublicRoundState {
  roundNumber: number
  totalRounds: number
  imageUrl: string
  title: string
  guesses: Partial<Record<PlayerId, LocationGuess>>
  isRoundComplete: boolean
  summary?: RoundSummary
}

export interface GameStateResponse {
  phase: 'setup' | 'playing' | 'results' | 'finished'
  currentPlayer: PlayerId
  round: PublicRoundState | null
  scoreboard: Scoreboard
  winner: PlayerId | 'tie' | null
}