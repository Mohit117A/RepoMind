import React, { useState, KeyboardEvent } from 'react';
import { Send, Loader2 } from 'lucide-react';

interface QuestionFormProps {
  disabled: boolean;
  loading: boolean;
  onSubmit: (question: string) => void;
}

const MAX_CHARS = 500;
const MIN_CHARS = 3;

export const QuestionForm: React.FC<QuestionFormProps> = ({
  disabled,
  loading,
  onSubmit,
}) => {
  const [question, setQuestion] = useState('');

  const trimmed = question.trim();
  const isValid = trimmed.length >= MIN_CHARS && trimmed.length <= MAX_CHARS;
  const canSubmit = !disabled && !loading && isValid;

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!canSubmit) return;
    onSubmit(trimmed);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col space-y-2">
      <div className="relative">
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value.slice(0, MAX_CHARS))}
          onKeyDown={handleKeyDown}
          disabled={disabled || loading}
          rows={3}
          placeholder={
            disabled
              ? 'Open a public GitHub repository to ask a question...'
              : 'Why was this change made? (e.g., Why was the auth token refresh flow updated?)'
          }
          className="w-full resize-none rounded-lg border border-gray-300 bg-white p-3 text-[13px] text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500"
        />
        <div className="flex items-center justify-between px-1 pt-1 text-[11px] text-gray-500">
          <span>Press Enter to send, Shift+Enter for new line</span>
          <span
            className={
              question.length >= MAX_CHARS
                ? 'font-semibold text-rust'
                : 'text-gray-400'
            }
          >
            {question.length}/{MAX_CHARS}
          </span>
        </div>
      </div>

      <button
        type="submit"
        disabled={!canSubmit}
        className="flex items-center justify-center space-x-2 rounded-lg bg-navy px-4 py-2.5 text-[14px] font-semibold text-white shadow transition hover:bg-navy-light active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500 disabled:shadow-none"
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin text-orange" />
            <span>Searching history...</span>
          </>
        ) : (
          <>
            <span>Ask RepoMind</span>
            <Send className="h-3.5 w-3.5 text-orange" />
          </>
        )}
      </button>
    </form>
  );
};
