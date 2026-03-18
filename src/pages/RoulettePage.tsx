import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { usePlayer } from '../hooks/usePlayer'
import { supabase } from '../lib/supabase'
import type { PlayerRow } from '../lib/types'

const RED_NUMBERS = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]

function getColor(n: number | string) {
  if (n === 0 || n === '00') return 'green'
  if (typeof n === 'number' && RED_NUMBERS.includes(n)) return 'red'
  return 'black'
}

type BetType = 'red' | 'black' | 'dozen1' | 'dozen2' | 'dozen3'

const BET_LABELS: Record<BetType, string> = {
  red: 'Red',
  black: 'Black',
  dozen1: '1st 12',
  dozen2: '2nd 12',
  dozen3: '3rd 12',
}

function checkWin(result: number | string, betType: BetType): number {
  if (result === 0 || result === '00') return 0
  const n = Number(result)
  if (betType === 'red') return RED_NUMBERS.includes(n) ? 2 : 0
  if (betType === 'black') return !RED_NUMBERS.includes(n) ? 2 : 0
  if (betType === 'dozen1') return n >= 1 && n <= 12 ? 3 : 0
  if (betType === 'dozen2') return n >= 13 && n <= 24 ? 3 : 0
  if (betType === 'dozen3') return n >= 25 && n <= 36 ? 3 : 0
  return 0
}

export function RoulettePage() {
  const qc = useQueryClient()
  const { player, username } = usePlayer()
  const [bet, setBet] = useState(50)
  const [selectedBet, setSelectedBet] = useState<BetType>('red')
  const [spinning, setSpinning] = useState(false)
  const [result, setResult] = useState<number | string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [localBalance, setLocalBalance] = useState<number | null>(null)

  const effectiveBalance = localBalance ?? player?.balance ?? 0

  const saveResult = useMutation({
    mutationFn: async (nextBalance: number) => {
      if (!player) throw new Error('Not logged in')
      const updated = await supabase
        .from('players')
        .update({
          balance: nextBalance,
          games_played: player.games_played + 1,
        })
        .eq('username', player.username)
        .select('*')
        .single()
      if (updated.error) throw updated.error
      return updated.data as PlayerRow
    },
    onSuccess: (p) => {
      qc.setQueryData(['player', p.username], p)
      setLocalBalance(null)
    },
  })

  if (!username) return <Navigate to="/" replace />
  if (!player) return <div className="text-gray-300 text-sm">Loading...</div>

  const spin = () => {
    if (spinning || bet > effectiveBalance || bet < 10) return
    setSpinning(true)
    setResult(null)
    setMessage(null)
    setLocalBalance(effectiveBalance - bet)

    setTimeout(() => {
      const idx = Math.floor(Math.random() * 38)
      const landed = idx < 37 ? idx : '00'
      const multiplier = checkWin(landed, selectedBet)
      const payout = bet * multiplier
      const nextBalance = (effectiveBalance - bet) + payout

      setResult(landed)
      setLocalBalance(nextBalance)

      if (multiplier > 0) {
        setMessage(`🎉 Kazandın $${payout - bet}! ${landed} — ${BET_LABELS[selectedBet]}!`)
      } else {
        setMessage(`😢 Kaybettin $${bet}. Top ${landed} üzerine düştü.`)
      }

      setSpinning(false)
      saveResult.mutate(nextBalance)
    }, 2000)
  }

  const resultColor = result !== null ? getColor(result) : null

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-[Playfair_Display] text-3xl font-semibold text-gold">
          American Roulette
        </h1>
        <div className="mt-1 text-sm text-gray-300">
          Balance: <span className="text-gold">${effectiveBalance.toLocaleString()}</span>
          <span className="mx-2 text-gray-600">•</span>
          Min bet $10
        </div>
      </div>

      <div className="rounded-3xl border border-gold/30 bg-black/30 p-5 shadow-felt">
        <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
          <div className="space-y-4">
            <div className="flex items-center justify-center rounded-2xl border border-gold/20 bg-black/40 p-8 min-h-[200px]">
              {spinning ? (
                <div className="text-center">
                  <div className="text-5xl animate-spin inline-block">🎡</div>
                  <p className="mt-4 text-gold text-sm">Spinning...</p>
                </div>
              ) : result !== null ? (
                <div className="text-center">
                  <div
                    className="mx-auto flex items-center justify-center rounded-full text-4xl font-bold"
                    style={{
                      width: 100,
                      height: 100,
                      background: resultColor === 'red' ? '#8B0000' : resultColor === 'green' ? '#166534' : '#111',
                      border: '3px solid #C9A84C',
                      color: '#fff'
                    }}
                  >
                    {result}
                  </div>
                  {message && (
                    <p className="mt-4 text-sm text-gray-200">{message}</p>
                  )}
                </div>
              ) : (
                <p className="text-gray-400 text-sm">Place your bet and spin!</p>
              )}
            </div>
          </div>

          <aside className="space-y-4">
            <div className="rounded-2xl border border-gold/20 bg-black/40 p-4">
              <div className="text-xs font-semibold tracking-wide text-gray-300 mb-3">
                Select Bet
              </div>
              <div className="grid grid-cols-2 gap-2">
                {(Object.keys(BET_LABELS) as BetType[]).map(type => (
                  <button
                    key={type}
                    onClick={() => setSelectedBet(type)}
                    className="rounded-lg border px-3 py-2 text-sm font-semibold transition-all"
                    style={{
                      borderColor: selectedBet === type ? '#C9A84C' : 'rgba(201,168,76,0.2)',
                      background: selectedBet === type ? 'rgba(201,168,76,0.15)' : 'transparent',
                      color: selectedBet === type ? '#C9A84C' : '#d1d5db'
                    }}
                  >
                    {type === 'red' ? '🔴 ' : type === 'black' ? '⚫ ' : ''}{BET_LABELS[type]}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-gold/20 bg-black/40 p-4">
              <div className="text-xs font-semibold tracking-wide text-gray-300 mb-3">
                Bet: <span className="text-gold">${bet}</span>
              </div>
              <input
                type="range"
                min={10}
                max={Math.max(10, effectiveBalance)}
                step={10}
                value={bet}
                onChange={e => setBet(Number(e.target.value))}
                className="w-full accent-[#C9A84C]"
                disabled={spinning}
              />
              <div className="mt-2 flex justify-between text-xs text-gray-400">
                <span>$10</span>
                <span>${Math.max(10, effectiveBalance)}</span>
              </div>
              <button
                onClick={spin}
                disabled={spinning || bet > effectiveBalance || bet < 10}
                className="mt-4 w-full rounded-lg bg-burgundy px-4 py-2 text-sm font-semibold text-gold shadow-felt hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {spinning ? 'Spinning...' : '🎡 Spin'}
              </button>
            </div>

            <div className="rounded-2xl border border-gold/20 bg-black/40 p-3 text-xs text-gray-400 space-y-1">
              <div className="text-gray-300 font-semibold mb-1">Payouts</div>
              <div className="flex justify-between"><span>Red / Black</span><span className="text-gold">2x</span></div>
              <div className="flex justify-between"><span>1st / 2nd / 3rd 12</span><span className="text-gold">3x</span></div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}