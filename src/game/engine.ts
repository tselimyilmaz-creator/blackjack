import type { Card } from './cards'
import { makeDeck } from './cards'
import { canSplit, evaluateHand, isBlackjack } from './hand'

export type RoundStage =
  | 'betting'
  | 'player_turn'
  | 'dealer_turn'
  | 'settled'

export type PlayerHand = {
  id: string
  cards: Card[]
  bet: number
  outcome?: HandOutcome
  payout?: number
}

export type HandOutcome =
  | 'blackjack'
  | 'win'
  | 'lose'
  | 'push'
  | 'bust'
  | 'dealer_bust'

export type RoundState = {
  stage: RoundStage
  deck: Card[]
  dealer: {
    cards: Card[]
    hideHoleCard: boolean
  }
  hands: PlayerHand[]
  activeHandIndex: number
  message?: string
}

export type DealOptions = {
  bet: number
  seed?: number
}

export function newRound(): RoundState {
  return {
    stage: 'betting',
    deck: [],
    dealer: { cards: [], hideHoleCard: true },
    hands: [],
    activeHandIndex: 0,
  }
}

export function deal(_state: RoundState, opts: DealOptions): RoundState {
  const deck = makeDeck(opts.seed)
  const [p1, d1, p2, d2, ...rest] = deck
  const hands: PlayerHand[] = [
    { id: cryptoId(), cards: [p1, p2], bet: opts.bet },
  ]
  const dealer = { cards: [d1, d2], hideHoleCard: true }

  // Instant resolution for natural blackjacks (no split/hit).
  const playerBJ = isBlackjack(hands[0].cards)
  const dealerBJ = isBlackjack(dealer.cards)

  let next: RoundState = {
    stage: 'player_turn',
    deck: rest,
    dealer,
    hands,
    activeHandIndex: 0,
    message: undefined,
  }

  if (playerBJ || dealerBJ) {
    next = revealDealer(next)
    next = settle(next)
  }

  return next
}

export function revealDealer(state: RoundState): RoundState {
  return { ...state, dealer: { ...state.dealer, hideHoleCard: false } }
}

export function availableActions(state: RoundState) {
  if (state.stage !== 'player_turn') {
    return { canHit: false, canStand: false, canSplit: false }
  }
  const hand = state.hands[state.activeHandIndex]
  const value = evaluateHand(hand.cards).total
  const canHit = value < 21
  const canStand = true
  const canSplitAction = canSplit(hand.cards) && state.hands.length === 1
  return { canHit, canStand, canSplit: canSplitAction }
}

export function hit(state: RoundState): RoundState {
  if (state.stage !== 'player_turn') return state
  const hand = state.hands[state.activeHandIndex]
  const [nextCard, ...rest] = state.deck
  if (!nextCard) return state
  const updatedHand: PlayerHand = {
    ...hand,
    cards: [...hand.cards, nextCard],
  }
  const hands = state.hands.map((h, idx) =>
    idx === state.activeHandIndex ? updatedHand : h,
  )
  const value = evaluateHand(updatedHand.cards).total
  let next: RoundState = { ...state, deck: rest, hands }
  if (value > 21) {
    next = stand(next) // auto-advance on bust
  }
  return next
}

export function stand(state: RoundState): RoundState {
  if (state.stage !== 'player_turn') return state
  const nextIndex = state.activeHandIndex + 1
  if (nextIndex < state.hands.length) {
    return { ...state, activeHandIndex: nextIndex }
  }

  const afterReveal = revealDealer(state)
  const afterDealer = playDealer({ ...afterReveal, stage: 'dealer_turn' })
  return settle(afterDealer)
}

export function split(state: RoundState): RoundState {
  if (state.stage !== 'player_turn') return state
  if (state.hands.length !== 1) return state
  const hand = state.hands[0]
  if (!canSplit(hand.cards)) return state

  const [c1, c2] = hand.cards
  const [draw1, draw2, ...rest] = state.deck
  if (!draw1 || !draw2) return state

  const hands: PlayerHand[] = [
    { id: cryptoId(), cards: [c1, draw1], bet: hand.bet },
    { id: cryptoId(), cards: [c2, draw2], bet: hand.bet },
  ]

  return {
    ...state,
    deck: rest,
    hands,
    activeHandIndex: 0,
    message: 'Split!',
  }
}

export function playDealer(state: RoundState): RoundState {
  let deck = [...state.deck]
  let dealerCards = [...state.dealer.cards]

  while (true) {
    const { total, isSoft } = evaluateHand(dealerCards)
    // Dealer stands on all 17s, hits on 16 or less.
    if (total > 17) break
    if (total === 17) break
    if (total === 16 && isSoft) {
      // soft 16 => hit (also covered by total < 17, but kept explicit per requirement)
    }
    const next = deck.shift()
    if (!next) break
    dealerCards.push(next)
  }

  return {
    ...state,
    deck,
    dealer: { cards: dealerCards, hideHoleCard: false },
  }
}

export type Settlement = {
  net: number // how many chips change for player (positive or negative)
  results: PlayerHand[]
}

export function settle(state: RoundState): RoundState {
  const dealerTotal = evaluateHand(state.dealer.cards).total
  const dealerBust = dealerTotal > 21
  const dealerBJ = isBlackjack(state.dealer.cards)

  const results: PlayerHand[] = state.hands.map((hand) => {
    const total = evaluateHand(hand.cards).total
    const bust = total > 21
    const bj = isBlackjack(hand.cards)

    let outcome: HandOutcome
    let payout = 0

    if (bust) {
      outcome = 'bust'
      payout = 0
    } else if (bj && !dealerBJ) {
      outcome = 'blackjack'
      payout = hand.bet + Math.floor(hand.bet * 1.5) // return bet + winnings 3:2
    } else if (dealerBJ && bj) {
      outcome = 'push'
      payout = hand.bet
    } else if (dealerBJ && !bj) {
      outcome = 'lose'
      payout = 0
    } else if (dealerBust) {
      outcome = 'dealer_bust'
      payout = hand.bet * 2
    } else if (total > dealerTotal) {
      outcome = 'win'
      payout = hand.bet * 2
    } else if (total < dealerTotal) {
      outcome = 'lose'
      payout = 0
    } else {
      outcome = 'push'
      payout = hand.bet
    }

    return { ...hand, outcome, payout }
  })

  const totalBet = state.hands.reduce((sum, h) => sum + h.bet, 0)
  const totalPayout = results.reduce((sum, h) => sum + (h.payout ?? 0), 0)
  const net = totalPayout - totalBet

  return {
    ...state,
    stage: 'settled',
    hands: results,
    activeHandIndex: 0,
    message: net >= 0 ? 'You win.' : 'Dealer wins.',
  }
}

export function needsSplitBalance(state: RoundState): boolean {
  if (state.stage !== 'player_turn') return false
  if (state.hands.length !== 1) return false
  return canSplit(state.hands[0].cards)
}

function cryptoId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (crypto as any).randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

