"use client";

import { useEffect, useRef, useState } from "react";

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
  const isComposingRef = useRef(false);

  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  return (
    <form
      className="w-full"
      onSubmit={(event) => {
        event.preventDefault();
        onSearch(query.trim());
      }}
    >
      <input
        type="search"
        value={query}
        onChange={(event) => {
          if (!isComposingRef.current) {
            setQuery(event.target.value);
          }
        }}
        onCompositionStart={() => {
          isComposingRef.current = true;
        }}
        onCompositionEnd={(event) => {
          isComposingRef.current = false;
          setQuery(event.currentTarget.value);
        }}
        placeholder={placeholder}
        aria-label={placeholder}
        className="h-10 w-full rounded-full border border-border bg-surface px-4 text-sm outline-none transition-colors focus:border-foreground/40"
      />
    </form>
  );
}
