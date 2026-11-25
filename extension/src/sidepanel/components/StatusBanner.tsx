import React from 'react';
import { AlertTriangle, Info, RefreshCw, ServerOff } from 'lucide-react';
import { BackendError } from '../api';

interface StatusBannerProps {
  error: BackendError | null;
  onRetry?: () => void;
}

export const StatusBanner: React.FC<StatusBannerProps> = ({ error, onRetry }) => {
  if (!error) return null;

  // Distinguish between different error codes
  const isOffline = error.code === 'network_error';
  const isNotImplemented = error.code === 'not_implemented';

  if (isNotImplemented) {
    return (
      <div className="rounded-lg border border-orange-200 bg-orange-50/70 p-3.5 shadow-sm text-gray-800">
        <div className="flex items-start space-x-2.5">
          <Info className="h-5 w-5 shrink-0 text-orange-dark mt-0.5" />
          <div className="flex-1">
            <h4 className="text-[13px] font-semibold text-gray-900">Feature not available yet</h4>
            <p className="text-[13px] text-gray-700 mt-1">
              {error.message}
            </p>
            <p className="text-[12px] text-gray-500 mt-1 italic">
              (Session 1: Backend skeleton and side panel setup. Retrieval and AI answering arrive in upcoming sessions).
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (isOffline) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-3.5 shadow-sm text-red-900">
        <div className="flex items-start space-x-2.5">
          <ServerOff className="h-5 w-5 shrink-0 text-red-600 mt-0.5" />
          <div className="flex-1">
            <h4 className="text-[13px] font-semibold">Backend offline</h4>
            <p className="text-[13px] text-red-700 mt-1">
              RepoMind couldn't reach its server. Is the backend running?
            </p>
            <p className="text-[12px] text-red-500 mt-1">
              Start the backend with <code className="bg-red-100 px-1 py-0.5 rounded font-mono">npm run dev:backend</code>.
            </p>
            {onRetry && (
              <button
                onClick={onRetry}
                className="mt-2.5 inline-flex items-center space-x-1.5 rounded-md bg-red-100 px-2.5 py-1 text-[12px] font-semibold text-red-800 hover:bg-red-200 transition"
              >
                <RefreshCw className="h-3 w-3" />
                <span>Retry connection</span>
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-3.5 shadow-sm text-red-900">
      <div className="flex items-start space-x-2.5">
        <AlertTriangle className="h-5 w-5 shrink-0 text-red-600 mt-0.5" />
        <div className="flex-1">
          <h4 className="text-[13px] font-semibold">Request failed</h4>
          <p className="text-[13px] text-red-700 mt-1">{error.message}</p>
          {onRetry && (
            <button
              onClick={onRetry}
              className="mt-2.5 inline-flex items-center space-x-1.5 rounded-md bg-red-100 px-2.5 py-1 text-[12px] font-semibold text-red-800 hover:bg-red-200 transition"
            >
              <RefreshCw className="h-3 w-3" />
              <span>Try again</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
