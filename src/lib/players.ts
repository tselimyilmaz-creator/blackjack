import { supabase } from './supabase'
import type { PlayerRow } from './types'

export async function getOrCreatePlayerByUsername(args: {
  username: string
  startingBalance: number
}): Promise<PlayerRow> {
  const username = args.username.trim()
  if (!username) throw new Error('Username is required')

  const existing = await supabase
    .from('players')
    .select('*')
    .eq('username', username)
    .maybeSingle()

  if (existing.error) throw existing.error
  if (existing.data) return existing.data as PlayerRow

  const created = await supabase
    .from('players')
    .insert({
      username,
      balance: args.startingBalance,
      games_played: 0,
    })
    .select('*')
    .single()

  if (created.error) throw created.error
  return created.data as PlayerRow
}

export async function restartBrokePlayer(args: {
  username: string
  balance: number
}): Promise<PlayerRow> {
  const username = args.username.trim()
  const updated = await supabase
    .from('players')
    .update({ balance: args.balance })
    .eq('username', username)
    .select('*')
    .single()

  if (updated.error) throw updated.error
  return updated.data as PlayerRow
}

