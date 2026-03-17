export function ChipStack(props: { amount: number }) {
  const n = Math.min(10, Math.max(0, Math.floor(props.amount / 10)))
  return (
    <div className="flex items-end gap-3">
      <div className="relative h-14 w-14">
        {Array.from({ length: n }).map((_, i) => (
          <div
            key={i}
            className="absolute left-0 right-0 mx-auto h-10 w-10 rounded-full border border-gold/40 bg-burgundy shadow-felt"
            style={{ bottom: i * 4 }}
          >
            <div className="absolute inset-1 rounded-full border border-gold/30" />
            <div className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-black/40" />
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-gold/30 bg-black/40 px-3 py-2 text-sm">
        <div className="text-xs font-semibold tracking-wide text-gray-300">
          Bet
        </div>
        <div className="font-[Playfair_Display] text-xl font-semibold text-gold">
          ${props.amount}
        </div>
      </div>
    </div>
  )
}

