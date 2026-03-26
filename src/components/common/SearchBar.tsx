"use client";

import { useEffect, useState } from "react";
import { SearchIcon } from "lucide-react";

interface SearchBarProps {
  initialQuery?: string;
  placeholder: string;
  onSearch: (query: string) => void;
}

export function SearchBar({
  initialQuery = "",
  placeholder,
  onSearch,
}: SearchBarProps) {
  const [query, setQuery] = useState(initialQuery);

  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  function handleChange(value: string) {
    setQuery(value);
    onSearch(value.trim());
  }

  return (
    <form
      className="w-full"
      onSubmit={(event) => {
        event.preventDefault();
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
          className="h-10 w-full rounded-full border border-border bg-surface pl-11 pr-4 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent focus-visible:border-foreground/40"
        />
      </div>
    </form>
  );
}
