import type { ReactNode } from "react";

// Tamanho do ícone dentro dos botões da lateral (o botão em si tem 44 px: alvo confortável para toque)
export const CONTROL_ICON_SIZE = 22;

interface MapControlButtonProps {
  label: string; // vira tooltip e nome para leitores de tela (o botão só tem ícone)
  pressed?: boolean;
  onClick: () => void;
  children: ReactNode;
}

// Botão quadrado da coluna da lateral do mapa: camadas, satélite e globo/plano
export function MapControlButton({ label, pressed, onClick, children }: MapControlButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={pressed}
      className="flex size-11 items-center justify-center rounded-lg bg-white text-slate-700 shadow-md hover:bg-slate-100"
    >
      {children}
    </button>
  );
}
