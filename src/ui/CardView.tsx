import type { Card, Suit } from '../game/cards'
import type React from 'react'

const suitGlyph: Record<Suit, string> = {
  spades: '♠',
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
}

function suitColor(suit: Suit) {
  return suit === 'hearts' || suit === 'diamonds'
    ? 'text-red-600'
    : 'text-gray-950'
}

export function CardView(props: {
  card?: Card
  faceDown?: boolean
  className?: string
  style?: React.CSSProperties
}) {
  const { card, faceDown, className, style } = props

  if (faceDown) {
    return (
      <div
        className={[
          'relative h-28 w-20 rounded-xl border border-gold/40 bg-gradient-to-br from-[#4A0E1A]/80 to-black/80 shadow-felt',
          'overflow-hidden',
          className ?? '',
        ].join(' ')}
        style={style}
      >
        <div className="absolute inset-0 opacity-70 [background:repeating-linear-gradient(45deg,rgba(201,168,76,0.22),rgba(201,168,76,0.22)_6px,transparent_6px,transparent_14px)]" />
        <div className="absolute inset-2 rounded-lg border border-gold/30" />
      </div>
    )
  }

  if (!card) return null

  return (
    <div
      className={[
        'relative h-28 w-20 rounded-xl border border-black/15 bg-white shadow-felt',
        'select-none',
        className ?? '',
      ].join(' ')}
      style={style}
    >
      <div className="absolute left-2 top-2 flex flex-col items-start leading-none">
        <div className={['text-sm font-bold', suitColor(card.suit)].join(' ')}>
          {card.rank}
        </div>
        <div className={['text-sm', suitColor(card.suit)].join(' ')}>
          {suitGlyph[card.suit]}
        </div>
      </div>
      <div
        className={[
          'absolute inset-0 flex items-center justify-center text-4xl',
          suitColor(card.suit),
        ].join(' ')}
      >
        {suitGlyph[card.suit]}
      </div>
      <div className="absolute bottom-2 right-2 rotate-180 leading-none">
        <div className={['text-sm font-bold', suitColor(card.suit)].join(' ')}>
          {card.rank}
        </div>
        <div className={['text-sm', suitColor(card.suit)].join(' ')}>
          {suitGlyph[card.suit]}
        </div>
      </div>
    </div>
  )
}

