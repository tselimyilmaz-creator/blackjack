import { useState, useRef } from 'react'
import { Navigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { usePlayer } from '../hooks/usePlayer'
import { supabase } from '../lib/supabase'
import type { PlayerRow } from '../lib/types'

const RED_NUMBERS = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]
const ALL_NUMBERS = [0,'00',1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36]

function getColor(n: number | string) {
  if (n === 0 || n === '00') return '#166534'
  if (typeof n === 'number' && RED_NUMBERS.includes(n)) return '#8B0000'
  return '#111'
}

type BetType = 'red' | 'black' | 'dozen1' | 'dozen2' | 'dozen3'

const BET_LABELS: Record<BetType, string> = {
  red: 'Red', black: 'Black', dozen1: '1st 12', dozen2: '2nd 12', dozen3: '3rd 12',
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

function playSound(src: string) {
  const audio = new Audio(src)
  audio.volume = 0.6
  audio.play().catch(() => {})
}

const WHEEL_SIZE = 300
const CENTER = WHEEL_SIZE / 2
const RADIUS = 130
const INNER_RADIUS = 60
const TOTAL = ALL_NUMBERS.length
const ANGLE_PER = (2 * Math.PI) / TOTAL

export function RoulettePage() {
  const qc = useQueryClient()
  const { player, username } = usePlayer()
  const [bet, setBet] = useState(50)
  const [selectedBet, setSelectedBet] = useState<BetType>('red')
  const [spinning, setSpinning] = useState(false)
  const [result, setResult] = useState<number | string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [localBalance, setLocalBalance] = useState<number | null>(null)
  const [rotation, setRotation] = useState(0)

  const effectiveBalance = localBalance ?? player?.balance ?? 0

  const saveResult = useMutation({
    mutationFn: async (nextBalance: number) => {
      if (!player) throw new Error('Not logged in')
      const updated = await supabase
        .from('players')
        .update({ balance: nextBalance, games_played: player.games_played + 1 })
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
    playSound('/roulette-ball.mp3')

    const idx = Math.floor(Math.random() * 38)
    const landed = idx < 37 ? idx : '00'
    const targetAngle = 360 * 8 + (idx / TOTAL) * 360
    setRotation(prev => prev + targetAngle)

    setTimeout(() => {
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
    }, 4000)
  }

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
          <div className="flex flex-col items-center gap-4">
            <div className="relative" style={{ width: WHEEL_SIZE, height: WHEEL_SIZE }}>
              <svg width={WHEEL_SIZE} height={WHEEL_SIZE}>
                <g style={{
                  transform: `rotate(${rotation}deg)`,
                  transformOrigin: `${CENTER}px ${CENTER}px`,
                  transition: spinning ? 'transform 4s cubic-bezier(0.17, 0.67, 0.12, 1)' : 'none'
                }}>
                  {ALL_NUMBERS.map((num, i) => {
                    const startAngle = i * ANGLE_PER - Math.PI / 2
                    const endAngle = startAngle + ANGLE_PER
                    const x1 = CENTER + RADIUS * Math.cos(startAngle)
                    const y1 = CENTER + RADIUS * Math.sin(startAngle)
                    const x2 = CENTER + RADIUS * Math.cos(endAngle)
                    const y2 = CENTER + RADIUS * Math.sin(endAngle)
                    const ix1 = CENTER + INNER_RADIUS * Math.cos(startAngle)
                    const iy1 = CENTER + INNER_RADIUS * Math.sin(startAngle)
                    const ix2 = CENTER + INNER_RADIUS * Math.cos(endAngle)
                    const iy2 = CENTER + INNER_RADIUS * Math.sin(endAngle)
                    const midAngle = startAngle + ANGLE_PER / 2
                    const tx = CENTER + (RADIUS - 22) * Math.cos(midAngle)
                    const ty = CENTER + (RADIUS - 22) * Math.sin(midAngle)
                    return (
                      <g key={i}>
                        <path
                          d={`M ${ix1} ${iy1} L ${x1} ${y1} A ${RADIUS} ${RADIUS} 0 0 1 ${x2} ${y2} L ${ix2} ${iy2} A ${INNER_RADIUS} ${INNER_RADIUS} 0 0 0 ${ix1} ${iy1}`}
                          fill={getColor(num)}
                          stroke="#C9A84C"
                          strokeWidth="0.5"
                        />
                        <text
                          x={tx} y={ty}
                          fill="#fff"
                          fontSize="7"
                          fontWeight="bold"
                          textAnchor="middle"
                          dominantBaseline="middle"
                          transform={`rotate(${(midAngle * 180) / Math.PI + 90}, ${tx}, ${ty})`}
                        >
                          {String(num)}
                        </text>
                      </g>
                    )
                  })}
                  <circle cx={CENTER} cy={CENTER} r={INNER_RADIUS} fill="#1a1a1a" stroke="#C9A84C" strokeWidth="2" />
                </g>
                <polygon
                  points={`${CENTER},${CENTER - RADIUS - 5} ${CENTER - 8},${CENTER - RADIUS + 12} ${CENTER + 8},${CENTER - RADIUS + 12}`}
                  fill="#C9A84C"
                />
              </svg>
            </div>

            {result !== null && (
              <div className="text-center">
                <div
                  className="mx-auto flex items-center justify-center rounded-full text-2xl font-bold"
                  style={{
                    width: 64, height: 64,
                    background: getColor(result),
                    border: '3px solid #C9A84C',
                    color: '#fff'
                  }}
                >
                  {result}
                </div>
                {message && <p className="mt-3 text-sm text-gray-200">{message}</p>}
              </div>
            )}

            {spinning && <p className="text-gold text-sm animate-pulse">Spinning...</p>}
          </div>

          <aside className="space-y-4">
            <div className="rounded-2xl border border-gold/20 bg-black/40 p-4">
              <div className="text-xs font-semibold tracking-wide text-gray-300 mb-3">Select Bet</div>
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
                type="range" min={10} max={Math.max(10, effectiveBalance)} step={10}
                value={bet} onChange={e => setBet(Number(e.target.value))}
                className="w-full accent-[#C9A84C]" disabled={spinning}
              />
              <div className="mt-2 flex justify-between text-xs text-gray-400">
                <span>$10</span><span>${Math.max(10, effectiveBalance)}</span>
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