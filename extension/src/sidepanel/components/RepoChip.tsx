import React from 'react';
import { RepoIdentifier } from '../../lib/parseGithubUrl';
import { GitBranch, AlertCircle, RefreshCw } from 'lucide-react';

interface RepoChipProps {
  repoInfo: RepoIdentifier | null;
  onRefresh: () => void;
}

export const RepoChip: React.FC<RepoChipProps> = ({ repoInfo, onRefresh }) => {
  if (!repoInfo) {
    return (
      <div className="flex items-start space-x-2 rounded-lg border border-amber-200 bg-amber-50/80 p-3 text-[13px] text-amber-900">
        <AlertCircle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
        <div className="flex-1">
          <p className="font-medium">No GitHub repository detected</p>
          <p className="text-amber-700 text-[13px] mt-0.5">
            Open a public GitHub repository, then ask RepoMind.
          </p>
        </div>
        <button
          onClick={onRefresh}
          title="Refresh active tab detection"
          className="rounded p-1 text-amber-700 hover:bg-amber-100/80 active:scale-95 transition"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between rounded-lg border border-navy/15 bg-white px-3 py-2.5 shadow-sm">
      <div className="flex items-center space-x-2 overflow-hidden">
        <GitBranch className="h-4 w-4 shrink-0 text-navy" />
        <div className="truncate">
          <span className="text-[13px] text-gray-500 font-normal">{repoInfo.owner} / </span>
          <span className="text-[14px] font-bold text-navy truncate">{repoInfo.repo}</span>
        </div>
      </div>
      <button
        onClick={onRefresh}
        title="Check current tab again"
        className="rounded p-1 text-gray-400 hover:text-navy hover:bg-gray-100 transition"
      >
        <RefreshCw className="h-3.5 w-3.5" />
      </button>
    </div>
  );
};
