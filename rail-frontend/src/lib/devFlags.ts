/** Dev-only diagnostics (inject conflict, force movements). */
export const diagnosticsEnabled =
  import.meta.env.DEV || import.meta.env.VITE_ENABLE_DIAGNOSTICS === 'true';
