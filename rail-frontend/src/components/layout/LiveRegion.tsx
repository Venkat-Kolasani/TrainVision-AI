interface LiveRegionProps {
  message: string;
  politeness?: 'polite' | 'assertive';
}

export function LiveRegion({ message, politeness = 'polite' }: LiveRegionProps) {
  return (
    <div className="sr-only" role="status" aria-live={politeness} aria-atomic="true">
      {message}
    </div>
  );
}
