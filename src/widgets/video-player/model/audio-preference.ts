const key = 'lordfilm.audio-preferences.v1'
interface Preference {
  id: string
  name: string
}
let memory: Preference[] = []
let memoryOnly = false
const normalize = (name: string) =>
  name.trim().replace(/\s+/g, ' ').toLocaleLowerCase('ru')
function read(): Preference[] {
  if (memoryOnly) return memory
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(key) ?? '[]')
    if (!Array.isArray(value)) return []
    return value
      .slice(0, 20)
      .filter(
        (item): item is Preference =>
          item !== null &&
          typeof item === 'object' &&
          typeof item.id === 'string' &&
          /^\d{1,64}$/.test(item.id) &&
          typeof item.name === 'string' &&
          item.name.trim().length > 0 &&
          item.name.length <= 300,
      )
  } catch {
    return memory
  }
}
export function readAudioPreference(id: string): string | null {
  return read().find((item) => item.id === id)?.name ?? null
}
export function saveAudioPreference(id: string, name: string) {
  if (!/^\d{1,64}$/.test(id) || !name.trim() || name.length > 300) return
  memory = [{ id, name }, ...read().filter((item) => item.id !== id)].slice(
    0,
    20,
  )
  try {
    window.localStorage.setItem(key, JSON.stringify(memory))
  } catch {
    memoryOnly = true
    /* Keep the session preference when storage is unavailable. */
  }
}
export function preferredAudioIndex(
  names: string[],
  preferred: string | null,
): number {
  if (!preferred) return -1
  return names.findIndex((name) => normalize(name) === normalize(preferred))
}
