"use client";
import { useEffect, useId, useState } from "react";
import { API_BASE } from "../auth-client";

export interface FriendCandidate {
  id: string;
  coachName: string;
}

interface FriendUsernameAutocompleteProps {
  onSelect: (candidate: FriendCandidate) => void;
  /** Optional placeholder for the input. */
  placeholder?: string;
}

const MIN_QUERY_LENGTH = 2;
const DEBOUNCE_MS = 250;

export default function FriendUsernameAutocomplete({
  onSelect,
  placeholder,
}: FriendUsernameAutocompleteProps): JSX.Element {
  const inputId = useId();
  const [value, setValue] = useState("");
  const [results, setResults] = useState<FriendCandidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const trimmed = value.trim().replace(/^@+/, "");
    if (trimmed.length < MIN_QUERY_LENGTH) {
      setResults([]);
      setError(null);
      return;
    }
    let cancelled = false;
    const handle = setTimeout(() => {
      void (async () => {
        setLoading(true);
        setError(null);
        try {
          const token = localStorage.getItem("auth_token");
          const url = `${API_BASE}/friends/search?q=${encodeURIComponent(trimmed)}`;
          const res = await fetch(url, {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          });
          if (cancelled) return;
          if (!res.ok) {
            setError(`Erreur ${res.status}`);
            setResults([]);
            return;
          }
          const body = (await res.json()) as {
            success?: boolean;
            data?: { results?: unknown };
          };
          const list = Array.isArray(body?.data?.results)
            ? (body.data.results as unknown[]).filter(
                (r): r is FriendCandidate =>
                  typeof r === "object" &&
                  r !== null &&
                  typeof (r as FriendCandidate).id === "string" &&
                  typeof (r as FriendCandidate).coachName === "string",
              )
            : [];
          setResults(list);
        } catch (e) {
          if (!cancelled) {
            setError(e instanceof Error ? e.message : String(e));
            setResults([]);
          }
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
    }, DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [value]);

  return (
    <div className="relative">
      <label htmlFor={inputId} className="block text-sm font-medium mb-1">
        Pseudo de coach
      </label>
      <input
        id={inputId}
        data-testid="friend-autocomplete-input"
        type="text"
        autoComplete="off"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder ?? "@coach"}
        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:border-nuffle-gold focus:outline-none"
      />
      {loading && (
        <p className="mt-1 text-xs text-gray-500">Recherche...</p>
      )}
      {error && (
        <p className="mt-1 text-xs text-red-600">Erreur : {error}</p>
      )}
      {results.length > 0 && (
        <ul
          data-testid="friend-autocomplete-list"
          role="listbox"
          className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-64 overflow-auto"
        >
          {results.map((candidate) => (
            <li
              key={candidate.id}
              role="option"
              data-testid={`friend-autocomplete-option-${candidate.id}`}
              tabIndex={0}
              onClick={() => onSelect(candidate)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelect(candidate);
                }
              }}
              className="px-3 py-2 text-sm hover:bg-amber-50 cursor-pointer"
            >
              <span className="font-medium">{candidate.coachName}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
