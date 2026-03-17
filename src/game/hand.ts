import type { Card, Rank } from './cards'
import { cardValue, isTenValue } from './cards'

export type HandValue = {
  total: number
  isSoft: boolean
}

export function evaluateHand(cards: Card[]): HandValue {
  let total = 0
  let aces = 0
  for (const c of cards) {
    total += cardValue(c.rank)
    if (c.rank === 'A') aces += 1
  }

  while (total > 21 && aces > 0) {
    total -= 10
    aces -= 1
  }

  const isSoft = cards.some((c) => c.rank === 'A') && total <= 21 && total >= 12
  // Note: "soft" here is only used for dealer decisions; our loop above
  // guarantees at least one ace is still counted as 11 when possible.
  // A robust check: total includes an ace as 11 iff total + 10 <= 21 before reductions.
  // We approximate with "has ace and we didn't reduce all aces".

  return { total, isSoft: isSoft && softAceStillEleven(cards, total) }
}

function softAceStillEleven(cards: Card[], total: number) {
  let base = 0
  let aceCount = 0
  for (const c of cards) {
    if (c.rank === 'A') aceCount += 1
    else base += cardValue(c.rank)
  }
  if (aceCount === 0) return false
  // One ace as 11, remaining as 1.
  const best = base + 11 + (aceCount - 1) * 1
  if (best !== total) return false
  return best <= 21
}

export function isBlackjack(cards: Card[]): boolean {
  if (cards.length !== 2) return false
  const [a, b] = cards
  return (
    (a.rank === 'A' && isTenValue(b.rank)) ||
    (b.rank === 'A' && isTenValue(a.rank))
  )
}

export function canSplit(cards: Card[]): boolean {
  if (cards.length !== 2) return false
  return rankSplitValue(cards[0].rank) === rankSplitValue(cards[1].rank)
}

function rankSplitValue(rank: Rank): number {
  if (rank === 'A') return 11
  if (isTenValue(rank)) return 10
  return Number(rank)
}

