import { Eye, EyeOff } from "lucide-react";

interface VisibilityButtonProps {
  hidden: boolean;
  onClick: () => void;
}

// O mesmo olho nas pastas e nos itens
export function VisibilityButton({ hidden, onClick }: VisibilityButtonProps) {
  const label = hidden ? "Mostrar no mapa" : "Ocultar do mapa";
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={!hidden}
      className={`rounded p-1 hover:bg-slate-100 ${hidden ? "text-slate-400" : "text-blue-700"}`}
    >
      {hidden ? <EyeOff size={18} /> : <Eye size={18} />}
    </button>
  );
}
