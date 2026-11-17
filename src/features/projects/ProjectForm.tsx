import { useState, type FormEvent, type KeyboardEvent } from "react";
import { searchPlace } from "../search/searchPlace";
import type { LngLat, ProjectInput } from "./types";

interface ProjectFormProps {
  initial?: ProjectInput; // ausente = novo projeto
  submitLabel: string;
  onSubmit: (input: ProjectInput) => void;
  onCancel: () => void;
  onPickLocation: (onPicked: (point: LngLat) => void) => void; // "Marcar no mapa"
}

// AAAA-MM-DD no fuso do usuário: o toISOString daria o dia seguinte depois das 21 h no Brasil
function today(): string {
  return new Date().toLocaleDateString("sv-SE");
}

const INPUT = "w-full rounded-[2px] border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-slate-900";
const LINK = "text-slate-700 underline-offset-2 hover:underline";

// O mesmo formulário cria e edita. O local é opcional: sem ele, o projeto adota o da primeira camada
export function ProjectForm({ initial, submitLabel, onSubmit, onCancel, onPickLocation }: ProjectFormProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [date, setDate] = useState(initial?.date ?? today());
  const [location, setLocation] = useState<LngLat | null>(initial?.location ?? null);
  const [placeQuery, setPlaceQuery] = useState<string | null>(null); // null = campo de busca fechado
  const [message, setMessage] = useState<string | null>(null);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (trimmed) onSubmit({ name: trimmed, date, location });
  }

  async function findPlace() {
    if (!placeQuery?.trim()) return;
    try {
      const place = await searchPlace(placeQuery);
      if (!place) return setMessage("Lugar não encontrado.");
      setLocation({ lng: place.lng, lat: place.lat });
      setPlaceQuery(null);
      setMessage(null);
    } catch (error) {
      setMessage((error as Error).message);
    }
  }

  // Enter no campo de lugar busca o lugar, em vez de enviar o formulário do projeto
  function handlePlaceKey(event: KeyboardEvent) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    void findPlace();
  }

  function pickOnMap() {
    setMessage("Clique no mapa para marcar o local. Esc cancela.");
    onPickLocation((point) => {
      setLocation(point);
      setMessage(null);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <input
        autoFocus
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder="Nome do projeto"
        aria-label="Nome do projeto"
        className={INPUT}
      />
      <input
        type="date"
        value={date}
        onChange={(event) => setDate(event.target.value)}
        aria-label="Data do projeto"
        className={INPUT}
      />
      <div className="space-y-1 text-xs">
        <p className="text-slate-500">
          Local:{" "}
          <span className="text-slate-800">
            {location ? `${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}` : "sem local"}
          </span>
        </p>
        <div className="flex gap-3">
          <button type="button" onClick={() => setPlaceQuery((query) => (query === null ? "" : null))} className={LINK}>
            Buscar lugar
          </button>
          <button type="button" onClick={pickOnMap} className={LINK}>
            Marcar no mapa
          </button>
          {location && (
            <button type="button" onClick={() => setLocation(null)} className={LINK}>
              Limpar
            </button>
          )}
        </div>
        {placeQuery !== null && (
          <div className="flex gap-2">
            <input
              autoFocus
              value={placeQuery}
              onChange={(event) => setPlaceQuery(event.target.value)}
              onKeyDown={handlePlaceKey}
              placeholder="Cidade, bairro ou endereço"
              aria-label="Buscar lugar"
              className={INPUT}
            />
            <button
              type="button"
              onClick={() => void findPlace()}
              className="rounded-[2px] border border-slate-300 px-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              Buscar
            </button>
          </div>
        )}
        {message && <p className="text-slate-500">{message}</p>}
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="rounded-[2px] px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100">
          Cancelar
        </button>
        <button
          type="submit"
          disabled={!name.trim()}
          className="rounded-[2px] bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
