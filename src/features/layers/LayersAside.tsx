import { useState, type ReactNode } from "react";
import { X } from "lucide-react";

interface LayersTab {
  label: string;
  content: ReactNode;
}

interface LayersAsideProps {
  tabs: LayersTab[];
  onClose: () => void;
}

export function LayersAside({ tabs, onClose }: LayersAsideProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  return (
    <aside className="absolute inset-y-0 left-0 z-20 flex w-80 flex-col bg-white shadow-lg">
      <header className="flex items-center justify-between border-b border-slate-200 px-3 py-2">
        <h2 className="font-semibold">Camadas</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar painel"
          className="text-slate-500 hover:text-slate-900"
        >
          <X size={18} />
        </button>
      </header>

      <nav className="flex border-b border-slate-200">
        {tabs.map((tab, index) => (
          <button
            key={tab.label}
            type="button"
            onClick={() => setActiveIndex(index)}
            className={`flex-1 py-2 text-sm ${
              index === activeIndex
                ? "border-b-2 border-blue-600 font-medium"
                : "text-slate-500"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <div className="flex-1 overflow-y-auto">{tabs[activeIndex].content}</div>
    </aside>
  );
}
