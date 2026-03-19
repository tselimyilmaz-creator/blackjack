import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getSavedUsername, saveUsername } from '../lib/storage'
import { getOrCreatePlayerByUsername, restartBrokePlayer } from '../lib/players'
import type { PlayerRow } from '../lib/types'

const playerKey = (username: string | null) => ['player', username] as const

export function usePlayer() {
  const qc = useQueryClient()
  const username = getSavedUsername()

  const playerQuery = useQuery({
    queryKey: playerKey(username),
    enabled: !!username,
    queryFn: async () =>
      getOrCreatePlayerByUsername({
        username: username!,
        startingBalance: 1000,
      }),
  })

  const login = useMutation({
    mutationFn: async (newUsername: string) => {
      const u = newUsername.trim()
      if (!u) throw new Error('Enter a username')
      saveUsername(u)
      return await getOrCreatePlayerByUsername({
        username: u,
        startingBalance: 1000,
      })
    },
    onSuccess: (p) => {
      qc.setQueryData(playerKey(p.username), p)
    },
  })

  const restart = useMutation({
    mutationFn: async (balance: number) => {
      if (!username) throw new Error('Not logged in')
      return await restartBrokePlayer({ username, balance })
    },
    onSuccess: (p) => {
      qc.setQueryData(playerKey(p.username), p)
    },
  })

  const player = (playerQuery.data ??
    login.data ??
    undefined) as PlayerRow | undefined

  // Özel kullanıcılar için sınırsız para özelliği
  const isSpecialUser = player?.username?.toLowerCase() === 'admin' ||
                       player?.username?.toLowerCase() === 'developer' ||
                       player?.username?.toLowerCase() === 'godmode'

  const effectivePlayer = player ? {
    ...player,
    balance: isSpecialUser ? 999999999 : player.balance // Özel kullanıcılar için sınırsız para
  } : undefined

  return {
    username,
    player: effectivePlayer,
    isLoading: playerQuery.isLoading,
    error: (playerQuery.error ?? login.error) as Error | null,
    login,
    restart,
    refetch: () => playerQuery.refetch(),
    isSpecialUser,
  }
}

