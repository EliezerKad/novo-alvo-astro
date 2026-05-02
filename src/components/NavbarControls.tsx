import React, { useState } from 'react';

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

interface Props {
  category?: string;
}

export default function NavbarControls({ category }: Props) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsMenuOpen(true)}
        className="md:hidden p-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
        title="Abrir Menu"
      >
        <MenuIcon className="w-6 h-6" />
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

            <form className="relative mb-8" action="/buscar" method="get" role="search">
              <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
              <input
                type="search"
                name="q"
                placeholder="PESQUISAR..."
                className="w-full bg-zinc-50 dark:bg-zinc-800 border-none rounded-xl pl-12 pr-4 py-3 text-xs font-black uppercase tracking-widest focus:ring-2 focus:ring-red-600/20 dark:text-white"
              />
            </form>

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
