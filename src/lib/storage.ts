const USERNAME_KEY = 'bj_username'

export function getSavedUsername(): string | null {
  const raw = localStorage.getItem(USERNAME_KEY)
  const v = raw?.trim()
  return v ? v : null
}

export function saveUsername(username: string) {
  localStorage.setItem(USERNAME_KEY, username.trim())
}

export function clearUsername() {
  localStorage.removeItem(USERNAME_KEY)
}

