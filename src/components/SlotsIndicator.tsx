interface SlotsIndicatorProps {
  total: number;
  taken: number;
  minRequired?: number;
}

export default function SlotsIndicator({ total, taken, minRequired = 3 }: SlotsIndicatorProps) {
  const confirmed = taken >= minRequired;
  const dots = Array.from({ length: Math.min(total, 5) }, (_, i) => i < taken);

  return (
    <div className="flex items-center gap-1.5">
      <div className="flex gap-1">
        {dots.map((filled, i) => (
          <span
            key={i}
            className={`inline-block w-2.5 h-2.5 rounded-full transition-all ${
              filled
                ? confirmed
                  ? 'bg-[#49e619]'
                  : 'bg-amber-400'
                : 'bg-slate-200'
            }`}
          />
        ))}
      </div>
      <span className="text-xs text-slate-500 font-medium">
        {taken}/{minRequired}
        {confirmed && (
          <span className="ml-1 text-[#49e619] font-bold">Confirmé !</span>
        )}
      </span>
    </div>
  );
}
