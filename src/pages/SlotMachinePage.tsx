import { useEffect, useRef, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { usePlayer } from '../hooks/usePlayer'
import { supabase } from '../lib/supabase'
import { playSound } from '../useSound'
import { ChipStack } from '../ui/ChipStack'

const SYMBOLS = ['🍒', '🍋', '🍊', '🔔', '⭐', '💎']
const PAYOUTS: Record<string, number> = {
  '🍒🍒🍒': 50, // 3 cherries
  '🍋🍋🍋': 20,
  '🍊🍊🍊': 15,
  '🔔🔔🔔': 30,
  '⭐⭐⭐': 40,
  '💎💎💎': 100,
  '🍒🍒': 5, // 2 cherries
  '🍋🍋': 3,
  '🍊🍊': 2,
  '🔔🔔': 4,
  '⭐⭐': 5,
  '💎💎': 10,
}

const MIN_SPIN_MS = 1300

function getRandomSymbol(): string {
  return SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]
}

function calculatePayout(reels: string[]): number {
  const combo = reels.join('')
  if (PAYOUTS[combo]) return PAYOUTS[combo]

  // Check for any 3 matching
  if (reels[0] === reels[1] && reels[1] === reels[2]) {
    return PAYOUTS[reels[0] + reels[0] + reels[0]] || 10
  }

  // Check for any 2 matching
  if (reels[0] === reels[1] || reels[1] === reels[2] || reels[0] === reels[2]) {
    const matching = reels[0] === reels[1] ? reels[0] : reels[1] === reels[2] ? reels[1] : reels[0]
    return PAYOUTS[matching + matching] || 2
  }

  return 0
}

export function SlotMachinePage() {
  const qc = useQueryClient()
  const { player, username } = usePlayer()
  const [bet, setBet] = useState(10)
  const [reels, setReels] = useState(['🍒', '🍒', '🍒'])
  const [spinning, setSpinning] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [localBalance, setLocalBalance] = useState<number | null>(null)

  const spinIntervalRef = useRef<number | null>(null)
  const spinStartRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (spinIntervalRef.current) window.clearInterval(spinIntervalRef.current)
    }
  }, [])

  if (!username) return <Navigate to="/" replace />
  if (!player) {
    return (
      <div className="rounded-2xl border border-gold/30 bg-black/40 p-6 shadow-felt">
        <div className="text-sm text-gray-300">Loading player…</div>
      </div>
    )
  }

  const balance = localBalance ?? player?.balance ?? 0

  const stopSpinAnimation = () => {
    if (spinIntervalRef.current) {
      window.clearInterval(spinIntervalRef.current)
      spinIntervalRef.current = null
    }
  }

  const startSpinAnimation = () => {
    stopSpinAnimation()
    spinStartRef.current = Date.now()
    spinIntervalRef.current = window.setInterval(() => {
      setReels([getRandomSymbol(), getRandomSymbol(), getRandomSymbol()])
    }, 80)
  }

  const finishSpin = (finalReels: string[], payout: number, newBalance: number) => {
    const elapsed = Date.now() - (spinStartRef.current ?? 0)
    const delay = Math.max(0, MIN_SPIN_MS - elapsed)

    setTimeout(() => {
      stopSpinAnimation()
      // Stop reels sequentially for a more realistic feel
      setReels([finalReels[0], getRandomSymbol(), getRandomSymbol()])
      setTimeout(() => setReels([finalReels[0], finalReels[1], getRandomSymbol()]), 120)
      setTimeout(() => setReels(finalReels), 240)

      setTimeout(() => {
        setLocalBalance(newBalance)
        qc.invalidateQueries({ queryKey: ['player'] })
        setSpinning(false)

        if (payout > 0) {
          setMessage(`You won $${payout}!`)
          playSound('win')
        } else {
          setMessage('Try again!')
        }
      }, 260)
    }, delay)
  }

  const spinMutation = useMutation({
    mutationFn: async (betAmount: number) => {
      if (!player) throw new Error('Not logged in')
      if (betAmount > balance) throw new Error('Insufficient balance')

      const newReels = [getRandomSymbol(), getRandomSymbol(), getRandomSymbol()]
      const payout = calculatePayout(newReels)
      const netChange = payout - betAmount

      const { data, error } = await supabase
        .from('players')
        .update({ balance: balance + netChange })
        .eq('username', username)
        .select()
        .single()

      if (error) throw error
      return { reels: newReels, payout, newBalance: data.balance }
    },
    onSuccess: ({ reels: newReels, payout, newBalance }) => {
      finishSpin(newReels, payout, newBalance)
    },
    onError: (error) => {
      setMessage(error.message)
      setSpinning(false)
    },
  })

  const handleSpin = () => {
    if (spinning || bet > balance) return
    setSpinning(true)
    setMessage(null)
    startSpinAnimation()
    spinMutation.mutate(bet)
  }

  if (!player) return <Navigate to="/" replace />

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-[Playfair_Display] text-3xl font-semibold text-gold">
            Slot Machine
          </h1>
          <div className="mt-1 text-sm text-gray-300">
            Balance: <span className="text-gold">${balance.toLocaleString()}</span>
          </div>
        </div>

        <div className="hidden sm:block">
          <ChipStack amount={bet} />
        </div>
      </div>

      <div className="rounded-2xl border border-gold/30 bg-black/40 p-6 shadow-felt">
        <div className="mb-6 flex justify-center">
          <div className="flex gap-4 rounded-lg border-2 border-gold/50 bg-black p-6">
            {reels.map((symbol, i) => (
              <div
                key={i}
                className={`flex h-16 w-16 items-center justify-center rounded border text-4xl ${
                  spinning ? 'animate-reel' : ''
                }`}
              >
                {symbol}
              </div>
            ))}
          </div>
        </div>

        <div className="mb-6 flex flex-wrap items-center justify-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-gray-200">Bet</label>
            <input
              type="number"
              value={bet}
              onChange={(e) => setBet(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-20 rounded border border-gold/30 bg-black/40 px-2 py-1 text-center text-white"
              min="1"
              max={balance}
              disabled={spinning}
            />
            <span className="text-gray-400">chips</span>
          </div>

          <button
            onClick={handleSpin}
            disabled={spinning || bet > balance}
            className="rounded-lg border border-gold/30 bg-burgundy px-6 py-2 text-white hover:bg-burgundy/80 disabled:opacity-50"
          >
            {spinning ? 'Spinning...' : 'Spin'}
          </button>
        </div>

        {message && (
          <div className="mb-4 text-center text-lg font-semibold text-gold">
            {message}
          </div>
        )}
      </div>

      <div className="rounded-lg border border-gold/20 bg-black/20 p-4">
        <h2 className="mb-2 font-semibold text-gold">Payouts</h2>
        <div className="grid grid-cols-2 gap-2 text-sm text-gray-300">
          <div>3 🍒: $50</div>
          <div>3 💎: $100</div>
          <div>3 🍋: $20</div>
          <div>3 ⭐: $40</div>
          <div>3 🍊: $15</div>
          <div>3 🔔: $30</div>
          <div>2 matching: $2-10</div>
          <div>Any 3 same: $10</div>
        </div>
      </div>
    </div>
  )
}
