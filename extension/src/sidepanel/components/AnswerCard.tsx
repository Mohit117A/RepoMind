import React from 'react';
import { AskResponse } from '../../types';
import { Sources } from './Sources';
import { CheckCircle2, HelpCircle } from 'lucide-react';

interface AnswerCardProps {
  response: AskResponse;
}

export const AnswerCard: React.FC<AnswerCardProps> = ({ response }) => {
  const isSupported = response.evidenceStatus === 'supported';

  return (
    <div className="flex flex-col space-y-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between border-b border-gray-100 pb-2.5">
        <h3 className="text-[14px] font-bold text-navy">Answer</h3>
        <span
          className={`inline-flex items-center space-x-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold border ${
            isSupported
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-orange/30 bg-orange/10 text-rust'
          }`}
        >
          {isSupported ? (
            <>
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              <span>Supported</span>
            </>
          ) : (
            <>
              <HelpCircle className="h-3.5 w-3.5 text-rust" />
              <span>Insufficient evidence</span>
            </>
          )}
        </span>
      </div>

      {/* Answer rendered purely as plain text to prevent XSS */}
      <div className="whitespace-pre-wrap text-[13px] leading-relaxed text-gray-800 font-normal">
        {response.answer}
      </div>

      {response.sources && response.sources.length > 0 && (
        <Sources sources={response.sources} />
      )}
    </div>
  );
};
