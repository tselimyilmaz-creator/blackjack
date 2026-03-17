import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { usePlayer } from '../hooks/usePlayer'
import { supabase } from '../lib/supabase'
import type { PlayerRow } from '../lib/types'

async function fetchLeaderboard(): Promise<PlayerRow[]> {
  const res = await supabase
    .from('players')
    .select('id,username,balance,games_played,created_at')
    .order('balance', { ascending: false })
    .order('games_played', { ascending: false })
    .order('created_at', { ascending: true })

  if (res.error) throw res.error
  return (res.data ?? []) as PlayerRow[]
}

export function LeaderboardPage() {
  const qc = useQueryClient()
  const { player } = usePlayer()
  const [q, setQ] = useState('')

  const leaderboard = useQuery({
    queryKey: ['leaderboard'],
    queryFn: fetchLeaderboard,
    refetchInterval: 30_000,
  })

  useEffect(() => {
    const channel = supabase
      .channel('players-leaderboard')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'players' },
        () => {
          qc.invalidateQueries({ queryKey: ['leaderboard'] })
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [qc])

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase()
    const data = leaderboard.data ?? []
    if (!term) return data
    return data.filter((p) => p.username.toLowerCase().includes(term))
  }, [leaderboard.data, q])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-[Playfair_Display] text-3xl font-semibold text-gold">
            Leaderboard
          </h1>
          <p className="mt-1 text-sm text-gray-300">
            Ranked by chip balance. Auto-refreshes every 30 seconds.
          </p>
        </div>

        <div className="w-full max-w-sm">
          <label className="text-xs font-semibold tracking-wide text-gray-200">
            Search username
          </label>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="type a username…"
            className="mt-2 w-full rounded-lg border border-gold/30 bg-black/50 px-4 py-2.5 text-sm text-gray-100 outline-none placeholder:text-gray-500 focus:border-gold/60"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gold/30 bg-black/40 shadow-felt">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-gold/20 bg-black/50 text-xs uppercase tracking-wider text-gray-300">
              <tr>
                <th className="px-4 py-3">Rank</th>
                <th className="px-4 py-3">Username</th>
                <th className="px-4 py-3">Balance</th>
                <th className="px-4 py-3">Games</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gold/10">
              {leaderboard.isLoading ? (
                <tr>
                  <td className="px-4 py-6 text-gray-300" colSpan={4}>
                    Loading…
                  </td>
                </tr>
              ) : leaderboard.error ? (
                <tr>
                  <td className="px-4 py-6 text-red-200" colSpan={4}>
                    {(leaderboard.error as Error).message}
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-gray-300" colSpan={4}>
                    No players found.
                  </td>
                </tr>
              ) : (
                filtered.map((p) => {
                  const fullRank =
                    (leaderboard.data ?? []).findIndex((x) => x.id === p.id) + 1
                  const isMe = player?.username === p.username
                  return (
                    <tr
                      key={p.id}
                      className={
                        isMe
                          ? 'bg-burgundy/30'
                          : 'hover:bg-white/5'
                      }
                    >
                      <td className="px-4 py-3 font-semibold text-gray-200">
                        {fullRank}
                      </td>
                      <td className="px-4 py-3">
                        <span className={isMe ? 'text-gold font-semibold' : ''}>
                          {p.username}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-semibold text-gray-200">
                        ${p.balance.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-gray-200">
                        {p.games_played}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="text-xs text-gray-400">
        Tip: your row is highlighted in burgundy.
      </div>
    </div>
  )
}

