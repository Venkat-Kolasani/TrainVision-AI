# Testing TrainVision AI

## Backend (pytest)

```bash
chmod +x scripts/test-backend.sh
./scripts/test-backend.sh
```

Covers greedy/ILP optimizers, conflict detection, read-only `/schedule`, `/analytics/trends`, and `/track-status`.

## Frontend (Vitest)

```bash
cd rail-frontend && npm run test
```

## E2E smoke (API + unit tests)

Start the backend first (`cd backend && python3 main.py`), then:

```bash
chmod +x scripts/e2e-smoke.sh
./scripts/e2e-smoke.sh
```

## Manual OCC checklist

1. Operations → verify Context strip shows live/polling and sync age
2. Select train on platform board or map → drawer opens
3. Manual override uses selected train (not first row)
4. Timeline tab shows Train graph with NOW line and live head markers
5. Schedule tab → conflict badge on rows involved in active conflicts
6. Simulation → run scenario → side-by-side compare → promote requires confirmation
7. Analytics → Refresh → KPI cards, trends chart, station heatmap populate

## Dev diagnostics

`SimulationDiagnostics` and `ConflictTestingPanel` render only when `import.meta.env.DEV` or `VITE_ENABLE_DIAGNOSTICS=true`.
