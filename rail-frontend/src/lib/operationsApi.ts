const getBase = () => import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export async function injectConflict(): Promise<Record<string, unknown>> {
  const response = await fetch(`${getBase()}/inject-conflict`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.detail || `HTTP ${response.status}`);
  return result;
}

export async function injectDelay(body: {
  train_id: string;
  delay_type: string;
  delay_minutes: number;
  reason?: string;
}): Promise<Record<string, unknown>> {
  const response = await fetch(`${getBase()}/inject-delay`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.detail || `HTTP ${response.status}`);
  return result;
}

export async function startMovementSimulation(): Promise<void> {
  const response = await fetch(`${getBase()}/start-movement-simulation`, { method: 'POST' });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
}

export async function createTestMovements(): Promise<{ message?: string }> {
  const response = await fetch(`${getBase()}/create-test-movements`, { method: 'POST' });
  const data = await response.json();
  if (!response.ok) throw new Error(data.detail || `HTTP ${response.status}`);
  return data;
}

export async function forceConflict(): Promise<{ message?: string }> {
  const response = await fetch(`${getBase()}/force-conflict`, { method: 'POST' });
  const data = await response.json();
  if (!response.ok) throw new Error(data.detail || `HTTP ${response.status}`);
  return data;
}
