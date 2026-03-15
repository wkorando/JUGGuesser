import { useEffect, useMemo, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import './App.css'
import type { GameStateResponse, LocationGuess, PlayerId } from './types'

const API_BASE_URL = 'http://localhost:3001/api/game'
const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN

const formatDistance = (distance: number) => `${distance.toFixed(2)} km`

function App() {
  const [game, setGame] = useState<GameStateResponse | null>(null)
  const [selectedGuess, setSelectedGuess] = useState<LocationGuess | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const selectionMarkerRef = useRef<mapboxgl.Marker | null>(null)
  const resultMarkersRef = useRef<mapboxgl.Marker[]>([])

  const fetchGameState = async () => {
    const response = await fetch(API_BASE_URL)
    const data = (await response.json()) as GameStateResponse
    setGame(data)
  }

  useEffect(() => {
    void fetchGameState()
    const interval = window.setInterval(() => {
      void fetchGameState()
    }, 1500)

    return () => window.clearInterval(interval)
  }, [])

  useEffect(() => {
    if (!mapContainerRef.current || !MAPBOX_TOKEN || mapRef.current) {
      return
    }

    mapboxgl.accessToken = MAPBOX_TOKEN
    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: 'mapbox://styles/mapbox/outdoors-v12',
      center: [0, 20],
      zoom: 1.2,
    })

    map.addControl(new mapboxgl.NavigationControl(), 'top-right')
    map.on('click', (event) => {
      if (game?.phase !== 'playing') {
        return
      }

      const guess = { lat: event.lngLat.lat, lng: event.lngLat.lng }
      setSelectedGuess(guess)

      if (!selectionMarkerRef.current) {
        selectionMarkerRef.current = new mapboxgl.Marker({ color: '#f97316' })
      }

      selectionMarkerRef.current.setLngLat([guess.lng, guess.lat]).addTo(map)
    })

    mapRef.current = map

    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [game?.phase])

  useEffect(() => {
    const map = mapRef.current
    if (!map) {
      return
    }

    resultMarkersRef.current.forEach((marker) => marker.remove())
    resultMarkersRef.current = []

    if (game?.phase === 'results' || game?.phase === 'finished') {
      const guesses = game.round?.guesses
      const actual = game.round?.summary?.actualLocation

      if (guesses?.player1) {
        resultMarkersRef.current.push(
          new mapboxgl.Marker({ color: '#2563eb' })
            .setLngLat([guesses.player1.lng, guesses.player1.lat])
            .addTo(map),
        )
      }

      if (guesses?.player2) {
        resultMarkersRef.current.push(
          new mapboxgl.Marker({ color: '#16a34a' })
            .setLngLat([guesses.player2.lng, guesses.player2.lat])
            .addTo(map),
        )
      }

      if (actual) {
        resultMarkersRef.current.push(
          new mapboxgl.Marker({ color: '#dc2626' })
            .setLngLat([actual.lng, actual.lat])
            .addTo(map),
        )
      }
    }

    if (game?.phase === 'playing' && selectionMarkerRef.current && selectedGuess) {
      selectionMarkerRef.current.setLngLat([selectedGuess.lng, selectedGuess.lat]).addTo(map)
    }
  }, [game, selectedGuess])

  const currentPlayerLabel = useMemo(() => {
    if (!game) {
      return 'Player 1'
    }

    return game.currentPlayer === 'player1' ? 'Player 1' : 'Player 2'
  }, [game])

  const postAction = async (endpoint: string, body?: object) => {
    setError(null)
    setIsSubmitting(true)

    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      })

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string }
        throw new Error(payload.error ?? 'Request failed')
      }

      setSelectedGuess(null)
      selectionMarkerRef.current?.remove()
      await fetchGameState()
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unexpected error')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSubmitGuess = async () => {
    if (!selectedGuess || !game) {
      return
    }

    await postAction('/guess', {
      player: game.currentPlayer,
      lat: selectedGuess.lat,
      lng: selectedGuess.lng,
    })
  }

  const winnerLabel = (winner: PlayerId | 'tie' | null | undefined) => {
    if (!winner) return '—'
    if (winner === 'tie') return 'Tie'
    return winner === 'player1' ? 'Player 1' : 'Player 2'
  }

  return (
    <main className="app-shell">
      <section className="hero-panel">
        <div>
          <p className="eyebrow">JUGGuesser</p>
          <h1>Battle to place the closest pin.</h1>
          <p className="subtitle">
            Two local players, one image, one map. Win rounds on accuracy and track
            total distance over the whole game.
          </p>
        </div>

        <div className="scoreboard-grid">
          <article className="score-card">
            <span>Player 1</span>
            <strong>{game?.scoreboard.player1Points ?? 0} pts</strong>
            <small>{formatDistance(game?.scoreboard.player1TotalDistanceKm ?? 0)}</small>
          </article>
          <article className="score-card">
            <span>Player 2</span>
            <strong>{game?.scoreboard.player2Points ?? 0} pts</strong>
            <small>{formatDistance(game?.scoreboard.player2TotalDistanceKm ?? 0)}</small>
          </article>
        </div>
      </section>

      {!MAPBOX_TOKEN && (
        <section className="status-card error-card">
          Add <code>VITE_MAPBOX_ACCESS_TOKEN</code> to <code>client/.env</code> to enable the map.
        </section>
      )}

      {error && <section className="status-card error-card">{error}</section>}

      <section className="game-layout">
        <div className="image-panel">
          <div className="panel-header">
            <div>
              <p className="panel-label">Current Round</p>
              <h2>
                {game?.round
                  ? `${game.round.roundNumber} / ${game.round.totalRounds}: ${game.round.title}`
                  : 'Ready to start'}
              </h2>
            </div>
            <span className="phase-pill">{game?.phase ?? 'setup'}</span>
          </div>

          {game?.round ? (
            <img className="round-image" src={game.round.imageUrl} alt={game.round.title} />
          ) : (
            <div className="image-placeholder">Start a new game to load the first location.</div>
          )}

          <div className="controls">
            {game?.phase === 'setup' && (
              <button onClick={() => void postAction('/start')} disabled={isSubmitting}>
                Start New Game
              </button>
            )}

            {game?.phase === 'playing' && (
              <>
                <p className="turn-indicator">{currentPlayerLabel}, place your pin and confirm.</p>
                <button onClick={() => void handleSubmitGuess()} disabled={!selectedGuess || isSubmitting}>
                  Lock in guess for {currentPlayerLabel}
                </button>
              </>
            )}

            {game?.phase === 'results' && (
              <button onClick={() => void postAction('/next')} disabled={isSubmitting}>
                {game.round?.roundNumber === game.round?.totalRounds ? 'Finish Game' : 'Next Round'}
              </button>
            )}

            {game?.phase === 'finished' && (
              <button onClick={() => void postAction('/start')} disabled={isSubmitting}>
                Play Again
              </button>
            )}

            <button className="secondary-button" onClick={() => void postAction('/reset')} disabled={isSubmitting}>
              Reset
            </button>
          </div>

          {(game?.phase === 'results' || game?.phase === 'finished') && game.round?.summary && (
            <div className="results-grid">
              <article>
                <span>Round winner</span>
                <strong>{winnerLabel(game.round.summary.pointWinner)}</strong>
              </article>
              <article>
                <span>Player 1 distance</span>
                <strong>{formatDistance(game.round.summary.player1DistanceKm)}</strong>
              </article>
              <article>
                <span>Player 2 distance</span>
                <strong>{formatDistance(game.round.summary.player2DistanceKm)}</strong>
              </article>
              {game.phase === 'finished' && (
                <article>
                  <span>Overall winner</span>
                  <strong>{winnerLabel(game.winner)}</strong>
                </article>
              )}
            </div>
          )}
        </div>

        <div className="map-panel">
          <div className="panel-header">
            <div>
              <p className="panel-label">Map</p>
              <h2>Place your guess</h2>
            </div>
          </div>
          <div ref={mapContainerRef} className="map-container" />
          <div className="legend">
            <span><i className="legend-dot player1"></i> Player 1</span>
            <span><i className="legend-dot player2"></i> Player 2</span>
            <span><i className="legend-dot actual"></i> Actual location</span>
            <span><i className="legend-dot selected"></i> Current selection</span>
          </div>
        </div>
      </section>
    </main>
  )
}

export default App
