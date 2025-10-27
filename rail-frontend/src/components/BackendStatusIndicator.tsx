import { useState, useEffect } from 'react';
import { CheckCircle, Loader, XCircle, Server } from 'lucide-react';

type BackendStatus = 'checking' | 'connected' | 'starting' | 'offline';

interface BackendStatusIndicatorProps {
  apiBase: string;
}

export function BackendStatusIndicator({ apiBase }: BackendStatusIndicatorProps) {
  const [status, setStatus] = useState<BackendStatus>('checking');
  const [countdown, setCountdown] = useState(60);
  const [showTooltip, setShowTooltip] = useState(false);

  const checkBackendHealth = async (): Promise<boolean> => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      const response = await fetch(`${apiBase}/health`, {
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return response.ok;
    } catch (error) {
      return false;
    }
  };

  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval>;
    let countdownId: ReturnType<typeof setInterval>;

    const monitorBackend = async () => {
      console.log(`🔍 Checking backend health... (current status: ${status})`);
      const isHealthy = await checkBackendHealth();

      if (isHealthy) {
        // Backend is healthy - set to connected
        if (status !== 'connected') {
          setStatus('connected');
          setCountdown(60);
          console.log('✅ Backend connected successfully');
        }
      } else {
        // Backend not responding
        if (status === 'checking') {
          // First check failed - backend is starting
          setStatus('starting');
          setCountdown(60);
          console.log('⏳ Backend starting (cold start detected)...');
        } else if (status === 'connected') {
          // Was connected, now not responding - backend went down
          setStatus('starting');
          setCountdown(60);
          console.log('⚠️ Backend connection lost, attempting to reconnect...');
        }
        // If already 'starting' or 'offline', keep polling
      }
    };

    // Initial check
    monitorBackend();

    // Set up polling based on current status
    if (status === 'starting' || status === 'checking' || status === 'offline') {
      // Poll every 3 seconds when starting, checking, or offline
      intervalId = setInterval(monitorBackend, 3000);

      // Countdown timer only when starting
      if (status === 'starting') {
        countdownId = setInterval(() => {
          setCountdown((prev) => {
            if (prev <= 1) {
              console.log('⏱️ Countdown reached 0, but continuing to poll...');
              return 60; // Reset countdown instead of going offline
            }
            return prev - 1;
          });
        }, 1000);
      }
    } else if (status === 'connected') {
      // Check less frequently when connected (every 30 seconds)
      intervalId = setInterval(monitorBackend, 30000);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
      if (countdownId) clearInterval(countdownId);
    };
  }, [status, apiBase]);

  const getStatusConfig = () => {
    switch (status) {
      case 'connected':
        return {
          icon: <CheckCircle className="w-4 h-4" />,
          text: 'Connected',
          color: 'bg-green-500/20 border-green-500 text-green-400',
          iconColor: 'text-green-400',
          pulse: false,
        };
      case 'starting':
        return {
          icon: <Loader className="w-4 h-4 animate-spin" />,
          text: countdown > 0 ? `Starting... (~${countdown}s)` : 'Starting...',
          color: 'bg-orange-500/20 border-orange-500 text-orange-400',
          iconColor: 'text-orange-400',
          pulse: true,
        };
      case 'offline':
        return {
          icon: <XCircle className="w-4 h-4" />,
          text: 'Offline',
          color: 'bg-red-500/20 border-red-500 text-red-400',
          iconColor: 'text-red-400',
          pulse: false,
        };
      default:
        return {
          icon: <Server className="w-4 h-4 animate-pulse" />,
          text: 'Checking...',
          color: 'bg-blue-500/20 border-blue-500 text-blue-400',
          iconColor: 'text-blue-400',
          pulse: true,
        };
    }
  };

  const config = getStatusConfig();

  return (
    <div className="relative">
      <div
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${config.color} text-sm font-medium transition-all cursor-pointer ${config.pulse ? 'animate-pulse' : ''}`}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        role="status"
        aria-live="polite"
        aria-label={`Backend status: ${config.text}`}
      >
        <span className={config.iconColor}>{config.icon}</span>
        <span className="hidden sm:inline">{config.text}</span>
      </div>

      {/* Tooltip */}
      {showTooltip && (
        <div className="absolute top-full right-0 mt-2 w-72 bg-slate-800 border border-slate-700 rounded-lg shadow-xl p-4 z-50">
          <div className="flex items-start gap-3">
            <Server className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="font-semibold text-white mb-1">Backend Status</h4>
              {status === 'starting' && (
                <p className="text-sm text-slate-300 mb-2">
                  The backend is waking up from sleep (Render free tier). This typically takes 50-60 seconds on first load.
                </p>
              )}
              {status === 'connected' && (
                <p className="text-sm text-slate-300 mb-2">
                  Backend is active and responding quickly. All features are available.
                </p>
              )}
              {status === 'offline' && (
                <p className="text-sm text-slate-300 mb-2">
                  Unable to connect to backend. Please check your internet connection or try again.
                </p>
              )}
              {status === 'starting' && (
                <div className="mt-3">
                  <div className="flex justify-between text-xs text-slate-400 mb-1">
                    <span>Progress</span>
                    <span>{Math.max(0, 60 - countdown)}s / ~60s</span>
                  </div>
                  <div className="w-full bg-slate-700 rounded-full h-1.5">
                    <div
                      className="bg-orange-400 h-1.5 rounded-full transition-all duration-1000"
                      style={{ width: `${((60 - countdown) / 60) * 100}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
