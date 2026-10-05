import { io } from 'socket.io-client'

const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000'

async function request(path, options = {}) {
  const response = await fetch(`${apiBaseUrl}${path}`, options)
  const payload = await response.json()

  if (!response.ok) {
    const error = new Error(payload.error || 'The request could not be completed')
    error.status = response.status
    error.code = payload.code
    throw error
  }

  return payload
}

function jsonRequest(method, body) {
  return {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }
}

function authorization(token) {
  return { Authorization: `Bearer ${token}` }
}

export const authApi = {
  authenticate(mode, credentials) {
    return request(`/api/auth/${mode}`, jsonRequest('POST', credentials))
  },

  reapply(credentials) {
    return request('/api/auth/reapply', jsonRequest('POST', credentials))
  },
}

export const dashboardApi = {
  getDashboard(token) {
    return request('/api/dashboard', { headers: authorization(token) })
  },
}

export const adminApi = {
  async getRequests(token) {
    const payload = await request('/api/admin/requests', { headers: authorization(token) })
    return payload.requests ?? []
  },

  decideRequest(token, requestId, decision) {
    return request(
      `/api/admin/requests/${requestId}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authorization(token) },
        body: JSON.stringify({ decision }),
      },
    )
  },
}

export function subscribeToDashboard(token, handlers) {
  const socket = io(apiBaseUrl, {
    transports: ['websocket'],
    autoConnect: false,
    auth: { token },
  })

  socket.on('connect', handlers.onConnect)
  socket.on('disconnect', handlers.onDisconnect)
  socket.on('dashboard:update', handlers.onUpdate)
  socket.connect()

  return () => {
    socket.off('connect', handlers.onConnect)
    socket.off('disconnect', handlers.onDisconnect)
    socket.off('dashboard:update', handlers.onUpdate)
    socket.disconnect()
  }
}
