import { useEffect, useRef, useState } from 'react'
import { BrowserRouter, Link, Navigate, Route, Routes } from 'react-router-dom'
import { usePlayer } from './hooks/usePlayer'
import { GamePage } from './pages/GamePage'
import { LeaderboardPage } from './pages/LeaderboardPage'
import { RoulettePage } from './pages/RoulettePage'
import { SlotMachinePage } from './pages/SlotMachinePage'

function App() {
  const { player } = usePlayer()
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [playing, setPlaying] = useState(false)

  useEffect(() => {
    audioRef.current = new Audio('/casino-music.mp3')
    audioRef.current.loop = true
    audioRef.current.volume = 0.015
    return () => { audioRef.current?.pause() }
  }, [])

  const toggleMusic = () => {
    if (!audioRef.current) return
    if (playing) {
      audioRef.current.pause()
      setPlaying(false)
    } else {
      audioRef.current.play()
      setPlaying(true)
    }
  }

  return (
    <BrowserRouter>
      <div className="min-h-dvh">
        <header className="sticky top-0 z-20 border-b border-gold/30 bg-black/50 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
            <Link to="/" className="font-[Playfair_Display] text-lg font-semibold tracking-wide text-gold">
              Luxury Blackjack
            </Link>
            <nav className="flex items-center gap-3 text-sm">
              {player ? (
                <div className="hidden items-center gap-2 rounded-md border border-gold/20 bg-black/40 px-3 py-1.5 text-xs text-gray-200 sm:flex">
                  <span className="text-gold">{player.username}</span>
                  <span className="text-gray-400">•</span>
                  <span>${player.balance.toLocaleString()} chips</span>
                </div>
              ) : null}
              <Link to="/game" className="rounded-md border border-gold/30 bg-burgundy/40 px-3 py-1.5 text-gray-100 hover:bg-burgundy/60">
                Table
              </Link>
              <Link to="/roulette" className="rounded-md border border-gold/30 px-3 py-1.5 text-gray-100 hover:bg-white/5">
                Roulette
              </Link>
              <Link to="/slots" className="rounded-md border border-gold/30 px-3 py-1.5 text-gray-100 hover:bg-white/5">
                Slots
              </Link>
              <Link to="/leaderboard" className="rounded-md border border-gold/30 px-3 py-1.5 text-gray-100 hover:bg-white/5">
                Leaderboard
              </Link>
            </nav>
          </div>
        </header>

        <main className="mx-auto max-w-6xl px-4 py-8">
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/game" element={<GamePage />} />
            <Route path="/roulette" element={<RoulettePage />} />
            <Route path="/slots" element={<SlotMachinePage />} />
            <Route path="/leaderboard" element={<LeaderboardPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>

        <button
          onClick={toggleMusic}
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            background: '#C9A84C',
            border: 'none',
            borderRadius: '50%',
            width: '48px',
            height: '48px',
            fontSize: '22px',
            cursor: 'pointer',
            zIndex: 999
          }}
        >
          {playing ? '🔊' : '🔇'}
        </button>
      </div>
    </BrowserRouter>
  )
}

function Landing() {
  const { player, login, username, isLoading, error } = usePlayer()

  return (
    <div className="mx-auto max-w-xl rounded-2xl border border-gold/30 bg-black/40 p-6 shadow-felt">
      <h1 className="font-[Playfair_Display] text-3xl font-semibold text-gold">
        Enter the Table
      </h1>
      <p className="mt-2 text-sm text-gray-300">
        No password. Just pick a username and play.
      </p>
      <form
        className="mt-6 flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault()
          const fd = new FormData(e.currentTarget)
          const u = String(fd.get('username') ?? '')
          login.mutate(u)
        }}
      >
        <label className="text-xs font-semibold tracking-wide text-gray-200">
          Username
        </label>
        <input
          name="username"
          defaultValue={username ?? ''}
          placeholder="e.g. velvet_ace"
          className="w-full rounded-lg border border-gold/30 bg-black/50 px-4 py-3 text-sm text-gray-100 outline-none ring-0 placeholder:text-gray-500 focus:border-gold/60"
          autoComplete="nickname"
          inputMode="text"
          maxLength={24}
        />
        {error ? (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-xs text-red-200">
            {error.message}
          </div>
        ) : null}
        {player ? (
          <div className="rounded-lg border border-gold/20 bg-black/40 px-4 py-3 text-sm text-gray-200">
            Welcome back, <span className="text-gold">{player.username}</span>.
            Balance: <span className="font-semibold">${player.balance}</span>
          </div>
        ) : null}
        <div className="mt-2 flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={isLoading || login.isPending}
            className="rounded-lg bg-burgundy px-4 py-2 text-sm font-semibold text-gold shadow-felt hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {login.isPending ? 'Entering…' : 'Enter the Table'}
          </button>
          <Link to="/leaderboard" className="rounded-lg border border-gold/30 px-4 py-2 text-sm font-semibold text-gray-100 hover:bg-white/5">
            View leaderboard
          </Link>
          <Link to="/game" className="rounded-lg border border-gold/30 px-4 py-2 text-sm font-semibold text-gray-100 hover:bg-white/5">
            Go to table
          </Link>
          <Link to="/slots" className="rounded-lg border border-gold/30 px-4 py-2 text-sm font-semibold text-gray-100 hover:bg-white/5">
            Go to slots
          </Link>
        </div>
      </form>
    </div>
  )
}

export default App