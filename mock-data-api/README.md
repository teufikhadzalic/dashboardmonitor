# Mock Data API

This is a standalone HTTP application that simulates an external cybersecurity platform API. It is the single mock source for platform, instance, and telemetry data while the real external API is unavailable. It runs independently from the dashboard frontend and the main backend.

## Install and start

```sh
cd mock-data-api
npm install
cp .env.example .env
npm start
```

The server listens on `http://localhost:4000` by default. Set `PORT` in `.env` to use another port. Run `npm test` to execute the API and generator tests.

## Endpoints

All endpoints return JSON:

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/api/health` | API health |
| `GET` | `/api/platforms` | List available cybersecurity platforms |
| `GET` | `/api/platforms/:id` | Get a platform and its metadata |
| `GET` | `/api/platforms/:id/instances` | List that platform's instances |
| `GET` | `/api/platforms/:id/telemetry` | Get recent telemetry, newest first |

Telemetry accepts optional `instanceId` and `limit` query parameters. `limit` defaults to 50 and can be from 1 to 300.

Example platform response:

```json
{
  "platform": {
    "id": "iga",
    "name": "Identity Governance & Administration",
    "shortName": "IGA",
    "status": "UP"
  }
}
```

Example telemetry response:

```json
{
  "platformId": "iga",
  "telemetry": [
    {
      "timestamp": "2026-10-05T03:30:00.000Z",
      "platform": "iga",
      "instance": "IGA-01",
      "cpu_current": 48.7,
      "cpu_average": 48.7,
      "memory_current": 54.3,
      "memory_average": 54.3,
      "availability": 99.94
    }
  ]
}
```

## Telemetry generation

The generator creates an initial telemetry record for every instance when the API starts, then updates them periodically. `MOCK_DATA_INTERVAL_MS` controls the interval in milliseconds and defaults to `10000` (10 seconds). Intervals below one second are rejected. Metrics drift gradually around platform-specific baselines rather than being independently randomized on each request. The API keeps at most 300 recent records per instance; requests only read the generated history and never generate data.

## Architecture

The intended development request flow is:

```text
Frontend -> Main Backend -> Mock Data API -> Generated Mock Telemetry
```

The frontend should communicate with the main backend, not this application directly. The main backend is not connected to this API yet; that HTTP integration is a separate step. Later, the backend can replace this mock external API with the real cybersecurity API without requiring the frontend to communicate with either external service.

The existing backend's internal mock telemetry generation and serving were disabled for this step. Its generator implementation remains in place as reference, but the backend now returns an empty dashboard snapshot until its data source is integrated with this standalone API.
