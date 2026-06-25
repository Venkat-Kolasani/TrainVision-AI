import { useEffect, useState } from 'react';
import { Info, X } from 'lucide-react';
import { CONTEXT_DISMISS_KEY, PRODUCT_COPY } from '../../lib/productCopy';

export function ContextStrip() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(localStorage.getItem(CONTEXT_DISMISS_KEY) !== '1');
  }, []);

  if (!visible) return null;

  return (
    <div className="mb-4 flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
      <p className="flex-1 text-sm text-slate-300">{PRODUCT_COPY.contextStrip}</p>
      <button
        type="button"
        onClick={() => {
          localStorage.setItem(CONTEXT_DISMISS_KEY, '1');
          setVisible(false);
        }}
        className="rounded p-1 text-slate-400 hover:bg-slate-700 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
        aria-label="Dismiss introduction"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
