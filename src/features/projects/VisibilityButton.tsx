import { Eye, EyeOff } from "lucide-react";

interface VisibilityButtonProps {
  hidden: boolean;
  onClick: () => void;
}

// O mesmo olho nos projetos, nas camadas e nos elementos
export function VisibilityButton({ hidden, onClick }: VisibilityButtonProps) {
  const label = hidden ? "Mostrar no mapa" : "Ocultar do mapa";
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={!hidden}
      className={`rounded-[2px] p-1 hover:bg-slate-100 ${hidden ? "text-slate-400" : "text-slate-700"}`}
    >
      {hidden ? <EyeOff size={16} /> : <Eye size={16} />}
    </button>
  );
}
