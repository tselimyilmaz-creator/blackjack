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

      if (multiplier >