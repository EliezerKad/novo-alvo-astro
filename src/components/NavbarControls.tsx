import React, { useEffect, useState } from 'react';

const categoriesList = [
  'Política',
  'Economia',
  'Brasil',
  'Mundo',
  'Saúde',
  'Tecnologia',
  'Esportes',
  'Famosos',
];

const subCategoriesList = [
  'Entretenimento',
  'Ciência',
  'Educação',
  'Cultura',
  'Lifestyle',
  'Games',
  'Moda',
  'Música',
  'Futebol',
  'Entrevistas',
];

function SearchIcon({ className }: { className: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function MenuIcon({ className }: { className: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 12h16" />
      <path d="M4 18h16" />
      <path d="M4 6h16" />
    </svg>
  );
}

function XIcon({ className }: { className: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

function MoonIcon({ className }: { className: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
    </svg>
  );
}

function SunIcon({ className }: { className: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2" />
      <path d="M12 20v2" />
      <path d="m4.93 4.93 1.41 1.41" />
      <path d="m17.66 17.66 1.41 1.41" />
      <path d="M2 12h2" />
      <path d="M20 12h2" />
      <path d="m6.34 17.66-1.41 1.41" />
      <path d="m19.07 4.93-1.41 1.41" />
    </svg>
  );
}

interface Props {
  category?: string;
}

export default function NavbarControls({ category }: Props) {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const stored = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const nextTheme = stored === 'dark' || (!stored && prefersDark) ? 'dark' : 'light';
    setTheme(nextTheme);
    document.documentElement.classList.toggle('dark', nextTheme === 'dark');
  }, []);

  function toggleTheme() {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    localStorage.setItem('theme', nextTheme);
    document.documentElement.classList.toggle('dark', nextTheme === 'dark');
  }

  function updateSearch(value: string) {
    setSearchTerm(value);
    const url = new URL(window.location.href);
    if (value) url.searchParams.set('search', value);
    else url.searchParams.delete('search');
    window.history.replaceState({}, '', url);
  }

  return (
    <>
      <button
        onClick={() => setIsMenuOpen(true)}
        className="md:hidden p-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
        title="Abrir Menu"
      >
        <MenuIcon className="w-6 h-6" />
      </button>

      <div className="hidden lg:block relative">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
        <input
          type="text"
          placeholder="BUSCAR..."
          value={searchTerm}
          onChange={(event) => updateSearch(event.target.value)}
          className="bg-zinc-100 dark:bg-zinc-800 border-none rounded-lg pl-9 pr-3 py-2 text-[8px] font-black uppercase tracking-widest focus:ring-2 focus:ring-red-600/20 w-24 focus:w-40 transition-all dark:text-white"
        />
      </div>

      <button
        onClick={toggleTheme}
        className="hidden md:flex w-10 h-10 bg-zinc-100 dark:bg-zinc-800 rounded-xl items-center justify-center hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all text-zinc-600 dark:text-zinc-400"
        title={theme === 'dark' ? 'Modo Claro' : 'Modo Escuro'}
      >
        {theme === 'dark' ? <SunIcon className="w-4 h-4" /> : <MoonIcon className="w-4 h-4" />}
      </button>

      {isMenuOpen && (
        <>
          <div onClick={() => setIsMenuOpen(false)} className="fixed inset-0 bg-black/50 z-[100] backdrop-blur-sm" />
          <div className="fixed inset-y-0 left-0 w-[80%] max-w-sm bg-white dark:bg-zinc-900 z-[101] shadow-2xl p-6 overflow-y-auto transition-transform">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-xl font-serif font-black tracking-tighter text-zinc-900 dark:text-zinc-50">MENU</h2>
              <button onClick={() => setIsMenuOpen(false)} className="p-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                <XIcon className="w-5 h-5" />
              </button>
            </div>

            <div className="relative mb-8">
              <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
              <input
                type="text"
                placeholder="PESQUISAR..."
                value={searchTerm}
                onChange={(event) => updateSearch(event.target.value)}
                className="w-full bg-zinc-50 dark:bg-zinc-800 border-none rounded-xl pl-12 pr-4 py-3 text-xs font-black uppercase tracking-widest focus:ring-2 focus:ring-red-600/20 dark:text-white"
              />
            </div>

            <div className="space-y-8">
              <nav className="space-y-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Categorias</p>
                {categoriesList.map((cat) => (
                  <a
                    key={cat}
                    href={`/categoria/${cat.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')}/`}
                    onClick={() => setIsMenuOpen(false)}
                    className={`block uppercase text-sm font-black tracking-widest ${category === cat ? 'text-red-600' : 'text-zinc-800 dark:text-zinc-200'}`}
                  >
                    {cat}
                  </a>
                ))}
              </nav>

              <nav className="space-y-4 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Sub-Categorias</p>
                {subCategoriesList.map((cat) => (
                  <a
                    key={cat}
                    href={`/categoria/${cat.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')}/`}
                    onClick={() => setIsMenuOpen(false)}
                    className={`block uppercase text-xs font-bold tracking-widest ${category === cat ? 'text-red-600' : 'text-zinc-500 dark:text-zinc-400'}`}
                  >
                    {cat}
                  </a>
                ))}
              </nav>
            </div>
          </div>
        </>
      )}
    </>
  );
}
