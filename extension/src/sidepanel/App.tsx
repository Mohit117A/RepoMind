import React, { useState, useEffect, useRef } from 'react';
import { Header } from './components/Header';
import { RepoChip } from './components/RepoChip';
import { QuestionForm } from './components/QuestionForm';
import { StatusBanner } from './components/StatusBanner';
import { AnswerCard } from './components/AnswerCard';
import { useActiveRepo } from './hooks/useActiveRepo';
import { askQuestion, BackendError } from './api';
import { AskResponse } from '../types';

export const App: React.FC = () => {
  const { repoInfo, refreshActiveTab } = useActiveRepo();
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<BackendError | null>(null);
  const [response, setResponse] = useState<AskResponse | null>(null);
  const [lastQuestion, setLastQuestion] = useState<string>('');

  const previousRepoKey = useRef<string | null>(null);
  const currentRepoKey = repoInfo ? `${repoInfo.owner}/${repoInfo.repo}` : null;

  // Clear answer and errors if the active repository changes
  useEffect(() => {
    if (previousRepoKey.current !== currentRepoKey) {
      previousRepoKey.current = currentRepoKey;
      setResponse(null);
      setError(null);
      setLoading(false);
    }
  }, [currentRepoKey]);

  const handleAsk = async (questionText: string) => {
    if (!repoInfo) return;

    setLoading(true);
    setError(null);
    setResponse(null);
    setLastQuestion(questionText);

    try {
      const result = await askQuestion({
        owner: repoInfo.owner,
        repo: repoInfo.repo,
        question: questionText,
      });
      setResponse(result);
    } catch (err: unknown) {
      if (err instanceof BackendError) {
        setError(err);
      } else {
        setError(
          new BackendError(
            err instanceof Error ? err.message : 'An unexpected error occurred',
            'unknown_error'
          )
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = () => {
    if (lastQuestion && repoInfo) {
      handleAsk(lastQuestion);
    } else {
      setError(null);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-soft text-gray-900 font-sans antialiased">
      <Header />

      <main className="flex-1 flex flex-col p-4 space-y-4 max-w-md mx-auto w-full">
        {/* Detected repository chip */}
        <RepoChip repoInfo={repoInfo} onRefresh={refreshActiveTab} />

        {/* Question form (disabled if no repo is detected) */}
        <QuestionForm
          disabled={!repoInfo}
          loading={loading}
          onSubmit={handleAsk}
        />

        {/* Error or Not Implemented status */}
        <StatusBanner error={error} onRetry={handleRetry} />

        {/* Render answer when available */}
        {response && <AnswerCard response={response} />}
      </main>

      <footer className="border-t border-gray-200/60 bg-white/50 px-4 py-2.5 text-center text-[11px] text-gray-400">
        Answers are grounded exclusively in GitHub pull requests, issues, reviews, and commits.
      </footer>
    </div>
  );
};
