import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { usePlayer } from '../hooks/usePlayer'
import { supabase } from '../lib/supabase'
import { playSound } from '../useSound'

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

  const balance = localBalance ?? player?.balance ?? 0

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
      return { reels: newReels, payout, netChange, newBalance: data.balance }
    },
    onSuccess: ({ reels: newReels, payout, newBalance }) => {
      setReels(newReels)
      setLocalBalance(newBalance)
      qc.invalidateQueries({ queryKey: ['player'] })

      if (payout > 0) {
        setMessage(`You won $${payout}!`)
        playSound('win')
      } else {
        setMessage('Try again!')
      }
    },
    onError: (error) => {
      setMessage(error.message)
    },
    onSettled: () => {
      setSpinning(false)
    }
  })

  const handleSpin = () => {
    if (spinning || bet > balance) return
    setSpinning(true)
    setMessage(null)
    spinMutation.mutate(bet)
  }

  if (!player) return <Navigate to="/" replace />

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-8 font-[Playfair_Display] text-3xl font-semibold text-gold">
        Slot Machine
      </h1>

      <div className="rounded-2xl border border-gold/30 bg-black/40 p-6 shadow-felt">
        <div className="mb-6 flex justify-center">
          <div className="flex gap-4 rounded-lg border-2 border-gold/50 bg-black p-6">
            {reels.map((symbol, i) => (
              <div
                key={i}
                className={`flex h-16 w-16 items-center justify-center rounded border text-4xl ${
                  spinning ? 'animate-spin' : ''
                }`}
              >
                {symbol}
              </div>
            ))}
          </div>
        </div>

        <div className="mb-6 flex items-center justify-center gap-4">
          <label className="text-gray-200">Bet:</label>
          <input
            type="number"
            value={bet}
            onChange={(e) => setBet(Math.max(1, parseInt(e.target.value) || 1))}
            className="w-20 rounded border border-gold/30 bg-black/40 px-2 py-1 text-center text-white"
            min="1"
            max={balance}
          />
          <span className="text-gray-400">chips</span>
        </div>

        <div className="mb-4 text-center">
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

        <div className="text-center text-gray-400">
          Balance: ${balance.toLocaleString()}
        </div>
      </div>

      <div className="mt-8 rounded-lg border border-gold/20 bg-black/20 p-4">
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