"use client";

import { startTransition, useEffect, useRef, useState } from "react";
import { Loader2, SearchIcon } from "lucide-react";

interface SearchBarProps {
  initialQuery?: string;
  placeholder: string;
  onSearch: (query: string) => void;
  debounceMs?: number;
  isSearching?: boolean;
  statusText?: string;
  autoFocus?: boolean;
}

export function SearchBar({
  initialQuery = "",
  placeholder,
  onSearch,
  debounceMs = 150,
  isSearching = false,
  statusText,
  autoFocus = false,
}: SearchBarProps) {
  const [query, setQuery] = useState(initialQuery);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  useEffect(() => {
    if (query === initialQuery) {
      return;
    }

    timeoutRef.current = window.setTimeout(() => {
      startTransition(() => {
        onSearch(query.trim());
      });
    }, debounceMs);

    return () => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [debounceMs, initialQuery, onSearch, query]);

  function handleChange(value: string) {
    setQuery(value);
  }

  return (
    <form
      role="search"
      aria-label={placeholder}
      aria-busy={isSearching}
      className="w-full"
      onSubmit={(event) => {
        event.preventDefault();
        if (timeoutRef.current !== null) {
          window.clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
        onSearch(query.trim());
      }}
    >
      <div className="relative">
        <SearchIcon
          aria-hidden="true"
          className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted"
          strokeWidth={1.9}
        />
        <input
          type="search"
          value={query}
          onChange={(event) => handleChange(event.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
          autoFocus={autoFocus}
          className="h-10 w-full rounded-full border border-border bg-surface pl-11 pr-10 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent focus-visible:border-foreground/40"
        />
        {isSearching ? (
          <Loader2
            data-testid="search-spinner"
            aria-hidden="true"
            className="pointer-events-none absolute right-4 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted"
            strokeWidth={1.9}
          />
        ) : null}
      </div>
      {statusText ? (
        <p className="px-3 pt-2 text-xs text-muted" aria-live="polite">
          {statusText}
        </p>
      ) : null}
    </form>
  );
}
