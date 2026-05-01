import React, { useState } from 'react';

function SearchIcon({ className }: { className: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

export default function NavbarMobileSearch() {
  const [searchTerm, setSearchTerm] = useState('');

  function updateSearch(value: string) {
    setSearchTerm(value);
    const url = new URL(window.location.href);
    if (value) url.searchParams.set('search', value);
    else url.searchParams.delete('search');
    window.history.replaceState({}, '', url);
  }

  return (
    <div className="md:hidden bg-white dark:bg-zinc-900 px-4 py-2 border-b border-zinc-100 dark:border-zinc-800">
      <div className="relative">
        <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
        <input
          type="text"
          placeholder="PESQUISAR NOTÍCIAS..."
          value={searchTerm}
          onChange={(event) => updateSearch(event.target.value)}
          className="w-full bg-zinc-50 dark:bg-zinc-800 border-none rounded-xl pl-12 pr-4 py-3 text-[10px] font-black uppercase tracking-widest focus:ring-2 focus:ring-red-600/20 dark:text-white"
        />
      </div>
    </div>
  );
}
