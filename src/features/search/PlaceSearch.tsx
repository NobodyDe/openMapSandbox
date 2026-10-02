import { useState, type FormEvent } from "react";
import { Search } from "lucide-react";
import { searchPlace, type Place } from "./searchPlace";

type Status = "idle" | "loading" | "notFound" | "error";

const STATUS_MESSAGE: Partial<Record<Status, string>> = {
  notFound: "Nenhum país ou cidade encontrado",
  error: "Não foi possível buscar agora. Tente de novo.",
};

interface PlaceSearchProps {
  onFound: (place: Place) => void;
}

export function PlaceSearch({ onFound }: PlaceSearchProps) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<Status>("idle");

  // <form> + onSubmit: Enter no campo e clique no botão caem no mesmo lugar
  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const text = query.trim();
    if (!text || status === "loading") return; // uma busca por vez
    setStatus("loading");
    try {
      const place = await searchPlace(text);
      setStatus(place ? "idle" : "notFound");
      if (place) onFound(place);
    } catch (error) {
      console.error(error);
      setStatus("error");
    }
  }

  const message = STATUS_MESSAGE[status];
  return (
    <form
      onSubmit={handleSubmit}
      role="search"
      className="absolute left-1/2 top-3 z-10 w-80 max-w-[calc(100%-1.5rem)] -translate-x-1/2"
    >
      <div className="flex items-center rounded bg-white shadow">
        <input
          type="search"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            if (status !== "loading") setStatus("idle"); // a mensagem antiga some ao digitar
          }}
          placeholder="Buscar país ou cidade…"
          aria-label="Buscar país ou cidade"
          className="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm outline-none"
        />
        <button
          type="submit"
          disabled={status === "loading"}
          title="Buscar"
          aria-label="Buscar"
          className="px-3 py-2 text-slate-600 hover:text-slate-900 disabled:opacity-50"
        >
          <Search size={16} />
        </button>
      </div>
      {message && <p className="mt-1 rounded bg-white px-3 py-1 text-xs text-slate-600 shadow">{message}</p>}
    </form>
  );
}
