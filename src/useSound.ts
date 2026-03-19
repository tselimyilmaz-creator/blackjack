export function playSound(src: string, volume = 0.6) {
  const audio = new Audio(src)
  audio.volume = Math.min(1, Math.max(0, volume))
  audio.play().catch(() => {})
}