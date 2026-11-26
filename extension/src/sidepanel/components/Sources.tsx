import React from 'react';
import { SourceCitation } from '../../types';
import { ExternalLink, GitPullRequest, AlertCircle, GitCommit, MessageSquare, Eye } from 'lucide-react';

interface SourcesProps {
  sources: SourceCitation[];
}

export const Sources: React.FC<SourcesProps> = ({ sources }) => {
  if (!sources || sources.length === 0) {
    return null;
  }

  const getSourceIcon = (type: SourceCitation['type']) => {
    switch (type) {
      case 'pull_request':
        return <GitPullRequest className="h-3.5 w-3.5 text-purple-600" />;
      case 'issue':
        return <AlertCircle className="h-3.5 w-3.5 text-green-600" />;
      case 'commit':
        return <GitCommit className="h-3.5 w-3.5 text-blue-600" />;
      case 'review':
        return <Eye className="h-3.5 w-3.5 text-amber-600" />;
      case 'comment':
        return <MessageSquare className="h-3.5 w-3.5 text-gray-600" />;
      default:
        return <ExternalLink className="h-3.5 w-3.5 text-gray-500" />;
    }
  };

  const getBadgeStyle = (type: SourceCitation['type']) => {
    switch (type) {
      case 'pull_request':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'issue':
        return 'bg-green-50 text-green-700 border-green-200';
      case 'commit':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'review':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'comment':
        return 'bg-gray-100 text-gray-700 border-gray-200';
      default:
        return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  const formatSourceLabel = (type: SourceCitation['type']) => {
    switch (type) {
      case 'pull_request':
        return 'Pull Request';
      case 'issue':
        return 'Issue';
      case 'commit':
        return 'Commit';
      case 'review':
        return 'Review';
      case 'comment':
        return 'Discussion Comment';
      default:
        return type;
    }
  };

  return (
    <div className="mt-4 flex flex-col space-y-2.5">
      <h3 className="text-[13px] font-bold text-navy flex items-center justify-between">
        <span>Grounded Sources ({sources.length})</span>
        <span className="text-[11px] font-normal text-gray-500">Verified GitHub links</span>
      </h3>
      <div className="flex flex-col space-y-2">
        {sources.map((source, index) => (
          <a
            key={index}
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group block rounded-lg border border-gray-200 bg-white p-3 shadow-sm hover:border-navy/40 hover:shadow transition"
          >
            <div className="flex items-center justify-between space-x-2">
              <span
                className={`inline-flex items-center space-x-1.5 rounded-md border px-1.5 py-0.5 text-[11px] font-medium ${getBadgeStyle(
                  source.type
                )}`}
              >
                <span className="font-bold text-[10px] opacity-80">[{index + 1}]</span>
                {getSourceIcon(source.type)}
                <span>{formatSourceLabel(source.type)}</span>
              </span>
              <ExternalLink className="h-3 w-3 text-gray-400 group-hover:text-navy transition" />
            </div>

            <p className="mt-1.5 text-[13px] font-semibold text-gray-900 group-hover:text-navy line-clamp-1">
              {source.title}
            </p>

            {source.excerpt && (
              <blockquote className="mt-1 border-l-2 border-gray-200 pl-2 text-[12px] italic text-gray-600 line-clamp-3">
                "{source.excerpt}"
              </blockquote>
            )}
          </a>
        ))}
      </div>
    </div>
  );
};
