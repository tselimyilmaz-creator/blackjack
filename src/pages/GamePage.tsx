import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { usePlayer } from '../hooks/usePlayer'
import type { PlayerRow } from '../lib/types'
import { supabase } from '../lib/supabase'
import {
  availableActions,
  deal,
  hit,
  newRound,
  revealDealer,
  split,
  stand,
  type RoundState,
} from '../game/engine'
import { evaluateHand, isBlackjack } from '../game/hand'
import { CardView } from '../ui/CardView'
import { ChipStack } from '../ui/ChipStack'
import { playSound } from '../useSound'

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

export function GamePage() {
  const qc = useQueryClient()
  const { player, username, restart } = usePlayer()
  const [bet, setBet] = useState<number>(50)
  const [round, setRound] = useState<RoundState>(() => newRound())
  const [localBalance, setLocalBalance] = useState<number | null>(null)

  const displayBalance = localBalance ?? player?.balance ?? 0
  const effectiveBalance = displayBalance

  // If the server-side balance changes (restart or external update), clear any in-flight local balance so the UI uses the latest value.
  useEffect(() => {
    setLocalBalance(null)
  }, [player?.balance])

  const saveRoundResult = useMutation({
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

  const minBet = 10
  const maxBet = Math.max(minBet, effectiveBalance)

  const totalBet = useMemo(
    () => round.hands.reduce((s, h) => s + h.bet, 0),
    [round.hands],
  )

  if (!username) return <Navigate to="/" replace />
  if (!player) {
    return (
      <div className="rounded-2xl border border-gold/30 bg-black/40 p-6 shadow-felt">
        <div className="text-sm text-gray-300">Loading player…</div>
      </div>
    )
  }

  const isBroke = round.stage === 'betting' && displayBalance <= 0
  const needsRestart = round.stage === 'betting' && displayBalance > 0 && displayBalance < minBet

  if (isBroke) {
    return (
      <div className="mx-auto max-w-xl rounded-2xl border border-gold/30 bg-black/40 p-6 shadow-felt">
        <h1 className="font-[Playfair_Display] text-3xl font-semibold text-gold">
          You're broke!
        </h1>
        <p className="mt-2 text-sm text-gray-300">
          The house always wins… eventually.
        </p>
        <button
          className="mt-6 rounded-lg bg-burgundy px-4 py-2 text-sm font-semibold text-gold shadow-felt hover:brightness-110 disabled:opacity-60"
          disabled={restart.isPending}
          onClick={() => restart.mutate(200)}
        >
          {restart.isPending ? 'Restarting…' : 'Restart with $200'}
        </button>
        <div className="mt-4 text-xs text-gray-400">
          Or check the <Link className="text-gold underline" to="/leaderboard">leaderboard</Link>.
        </div>
      </div>
    )
  }

  if (needsRestart) {
    return (
      <div className="mx-auto max-w-xl rounded-2xl border border-gold/30 bg-black/40 p-6 shadow-felt">
        <h1 className="font-[Playfair_Display] text-3xl font-semibold text-gold">
          Low balance
        </h1>
        <p className="mt-2 text-sm text-gray-300">
          Your balance is below the minimum bet ({minBet}).
        </p>
        <button
          className="mt-6 rounded-lg bg-burgundy px-4 py-2 text-sm font-semibold text-gold shadow-felt hover:brightness-110 disabled:opacity-60"
          disabled={restart.isPending}
          onClick={() => restart.mutate(200)}
        >
          {restart.isPending ? 'Restarting…' : 'Restart with $200'}
        </button>
        <div className="mt-4 text-xs text-gray-400">
          Or check the <Link className="text-gold underline" to="/leaderboard">leaderboard</Link>.
        </div>
      </div>
    )
  }

  const actions = availableActions(round)
  const canDeal =
    round.stage === 'betting' && bet >= minBet && bet <= effectiveBalance
  const canSplitNow =
    actions.canSplit &&
    round.stage === 'player_turn' &&
    effectiveBalance - totalBet >= bet

  // Ensure bet never exceeds the available balance (e.g. after a restart or balance update)
  useEffect(() => {
    const maxBet = Math.max(minBet, effectiveBalance)
    if (bet > maxBet) setBet(maxBet)
  }, [effectiveBalance, minBet, bet])

  const startDeal = () => {
    const b = clamp(bet, minBet, effectiveBalance)
    setBet(b)
    setLocalBalance(effectiveBalance - b)
    playSound('/card-shuffle.mp3')
    setRound(deal(newRound(), { bet: b }))
  }

  const doSplit = () => {
    if (!canSplitNow) return
    setLocalBalance((v) => (v == null ? player.balance - bet * 2 : v - bet))
    setRound((s) => split(s))
  }

  const finishIfSettled = (next: RoundState) => {
    setRound(next)
    if (next.stage !== 'settled') return

    const totalBet = next.hands.reduce((sum, h) => sum + h.bet, 0)
    const totalPayout = next.hands.reduce((sum, h) => sum + (h.payout ?? 0), 0)
    const net = totalPayout - totalBet

    const nextBalance = player.balance + net
    setLocalBalance(nextBalance)
    saveRoundResult.mutate(nextBalance)
  }

  const doHit = () => finishIfSettled(hit(round))
  const doStand = () => finishIfSettled(stand(round))

  const resetToBetting = () => {
    setRound(newRound())
    setLocalBalance(null)
  }

  const dealerCards = round.dealer.cards
  const dealerShown = round.dealer.hideHoleCard
    ? [dealerCards[0], undefined]
    : dealerCards
  const dealerTotal = round.dealer.hideHoleCard
    ? undefined
    : evaluateHand(dealerCards).total

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-[Playfair_Display] text-3xl font-semibold text-gold">
            The Table
          </h1>
          <div className="mt-1 text-sm text-gray-300">
            Balance: <span className="text-gold">${displayBalance}</span>
            <span className="mx-2 text-gray-600">•</span>
            Min bet $10
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/leaderboard"
            className="rounded-lg border border-gold/30 px-4 py-2 text-sm font-semibold text-gray-100 hover:bg-white/5"
          >
            Leaderboard
          </Link>
        </div>
      </div>

      <div className="rounded-3xl border border-gold/30 bg-black/30 p-5 shadow-felt">
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="space-y-5">
            <section className="rounded-2xl border border-gold/20 bg-black/40 p-4">
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold tracking-wide text-gray-300">
                  Dealer {dealerTotal != null ? `( ${dealerTotal} )` : ''}
                </div>
                {round.stage !== 'betting' ? (
                  <button
                    className="rounded-md border border-gold/30 px-3 py-1.5 text-xs font-semibold text-gray-100 hover:bg-white/5"
                    onClick={() => setRound((s) => revealDealer(s))}
                    disabled={!round.dealer.hideHoleCard}
                  >
                    Reveal (debug)
                  </button>
                ) : null}
              </div>
              <div className="mt-3 flex flex-wrap gap-3">
                {dealerShown.map((c, idx) => (
                  <CardView
                    key={idx}
                    card={c}
                    faceDown={idx === 1 && round.dealer.hideHoleCard}
                    className="animate-deal-in"
                    style={{ animationDelay: `${idx * 80}ms` }}
                  />
                ))}
                {round.dealer.hideHoleCard ? null : (
                  <>
                    {dealerCards.slice(2).map((c, idx) => (
                      <CardView
                        key={c.id}
                        card={c}
                        className="animate-deal-in"
                        style={{ animationDelay: `${(idx + 2) * 80}ms` }}
                      />
                    ))}
                  </>
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-gold/20 bg-black/40 p-4">
              <div className="text-xs font-semibold tracking-wide text-gray-300">
                Your hands
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                {round.hands.length === 0 ? (
                  <div className="text-sm text-gray-400">Place a bet and deal.</div>
                ) : null}
                {round.hands.map((h, idx) => {
                  const v = evaluateHand(h.cards).total
                  const active = round.stage === 'player_turn' && idx === round.activeHandIndex
                  const bj = isBlackjack(h.cards)
                  return (
                    <div
                      key={h.id}
                      className={[
                        'rounded-2xl border bg-black/30 p-4',
                        active ? 'border-gold/60' : 'border-gold/15',
                      ].join(' ')}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-sm font-semibold text-gray-100">
                          Hand {idx + 1}{' '}
                          <span className="text-gray-400">•</span>{' '}
                          <span className="text-gold">${h.bet}</span>
                        </div>
                        <div className="text-sm font-semibold text-gray-200">
                          {bj ? 'Blackjack' : v}
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-3">
                        {h.cards.map((c, cIdx) => (
                          <CardView
                            key={c.id}
                            card={c}
                            className="animate-deal-in"
                            style={{ animationDelay: `${cIdx * 80}ms` }}
                          />
                        ))}
                      </div>
                      {round.stage === 'settled' ? (
                        <div className="mt-3 text-xs text-gray-300">
                          {h.outcome?.replaceAll('_', ' ') ?? '—'} • payout:{' '}
                          <span className="text-gold">${h.payout}</span>
                        </div>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            </section>
          </div>

          <aside className="space-y-4">
            <div className="rounded-2xl border border-gold/20 bg-black/40 p-4">
              <div className="text-xs font-semibold tracking-wide text-gray-300">Betting</div>
              <div className="mt-4 flex items-center justify-between gap-3">
                <ChipStack amount={bet} />
              </div>
              <div className="mt-4">
                <input
                  type="range"
                  min={minBet}
                  max={maxBet}
                  step={10}
                  value={clamp(bet, minBet, maxBet)}
                  onChange={(e) => setBet(Number(e.target.value))}
                  className="w-full accent-[#C9A84C]"
                  disabled={round.stage !== 'betting'}
                />
                <div className="mt-2 flex justify-between text-xs text-gray-400">
                  <span>${minBet}</span>
                  <span>${maxBet}</span>
                </div>
              </div>
              <button
                className="mt-5 w-full rounded-lg bg-burgundy px-4 py-2 text-sm font-semibold text-gold shadow-felt hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={!canDeal}
                onClick={startDeal}
              >
                Deal
              </button>
            </div>

            <div className="rounded-2xl border border-gold/20 bg-black/40 p-4">
              <div className="text-xs font-semibold tracking-wide text-gray-300">Actions</div>
              <div className="mt-4 grid grid-cols-3 gap-3">
                <button
                  className="rounded-lg border border-gold/30 px-3 py-2 text-sm font-semibold text-gray-100 hover:bg-white/5 disabled:opacity-50"
                  disabled={!actions.canHit}
                  onClick={doHit}
                >
                  Hit
                </button>
                <button
                  className="rounded-lg border border-gold/30 px-3 py-2 text-sm font-semibold text-gray-100 hover:bg-white/5 disabled:opacity-50"
                  disabled={!actions.canStand}
                  onClick={doStand}
                >
                  Stand
                </button>
                <button
                  className="rounded-lg border border-gold/30 px-3 py-2 text-sm font-semibold text-gray-100 hover:bg-white/5 disabled:opacity-50"
                  disabled={!canSplitNow}
                  onClick={doSplit}
                >
                  Split
                </button>
              </div>
              {round.stage === 'settled' ? (
                <button
                  className="mt-4 w-full rounded-lg border border-gold/30 px-4 py-2 text-sm font-semibold text-gray-100 hover:bg-white/5"
                  onClick={resetToBetting}
                >
                  Next round
                </button>
              ) : null}
              {saveRoundResult.isPending ? (
                <div className="mt-3 text-xs text-gray-400">Saving result…</div>
              ) : null}
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}