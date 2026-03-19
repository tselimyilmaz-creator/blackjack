export function playSound(src: string, volume = 0.6) {
    const audio = new Audio(src)
    audio.volume = volume
    audio.play().catch(() => {})
  }