export function getCategoryColor(category: string): string {
  const colors: Record<string, string> = {
    Brasil: "bg-emerald-600",
    Mundo: "bg-blue-900",
    Política: "bg-zinc-800",
    Economia: "bg-green-700",
    Tecnologia: "bg-cyan-600",
    Esportes: "bg-orange-500",
    Saúde: "bg-emerald-500",
    Ciência: "bg-teal-600",
    Educação: "bg-blue-600",
    Cultura: "bg-violet-600",
    Famosos: "bg-yellow-500",
    Entretenimento: "bg-fuchsia-600",
    Gastronomia: "bg-amber-600",
    Moda: "bg-pink-500",
    Viagens: "bg-sky-500",
    Carros: "bg-slate-700",
    Games: "bg-indigo-600",
    Música: "bg-purple-600",
    Entrevistas: "bg-rose-700",
    Geral: "bg-red-600",
    DESTAQUE: "bg-red-700",
  };

  return colors[category] || "bg-zinc-600";
}

export function formatRelativeDate(date: string): string {
  const then = new Date(date).getTime();
  const now = Date.now();
  const diffHours = Math.max(1, Math.round((now - then) / 36e5));

  if (diffHours < 24) return `há ${diffHours}h`;
  const diffDays = Math.round(diffHours / 24);
  return `há ${diffDays}d`;
}

export function formatEditorialDate(date: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
    .format(new Date(date))
    .toUpperCase();
}

export function getReadingTime(content: string): number {
  const text = content.replace(/<[^>]*>/g, ' ').trim();
  const words = text ? text.split(/\s+/).length : 0;
  return Math.max(1, Math.ceil(words / 220));
}

export function getResponsiveImageSet(imageUrl?: string): string | undefined {
  if (!imageUrl) return undefined;
  if (!imageUrl.includes('images.unsplash.com')) return undefined;

  const widths = [640, 960, 1280, 1600];
  return widths
    .map((width) => {
      const url = new URL(imageUrl);
      url.searchParams.set('w', String(width));
      url.searchParams.set('q', width >= 1280 ? '80' : '75');
      return `${url.toString()} ${width}w`;
    })
    .join(', ');
}
