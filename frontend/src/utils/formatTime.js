export function formatTime(value) {
  if (!value) return '--:--:--'
  return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}
