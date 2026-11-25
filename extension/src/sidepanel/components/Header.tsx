import React from 'react';

export const Header: React.FC = () => {
  return (
    <header className="flex items-center justify-between border-b border-gray-200/80 bg-white px-4 py-3 shadow-sm">
      <div className="flex items-center space-x-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-navy text-orange font-bold text-lg shadow-sm">
          R
        </div>
        <div>
          <h1 className="text-base font-bold text-navy leading-none">RepoMind</h1>
          <p className="text-[13px] text-gray-500 mt-0.5">GitHub History Assistant</p>
        </div>
      </div>
      <span className="rounded-full bg-orange/15 px-2 py-0.5 text-[11px] font-semibold text-rust">
        MVP v0.1
      </span>
    </header>
  );
};
