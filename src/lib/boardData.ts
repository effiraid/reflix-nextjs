type PostgrestErrorLike = {
  code?: string | null;
  details?: string | null;
  hint?: string | null;
  message?: string | null;
};

type BoardRow = {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  clip_ids?: string[] | null;
};

type BoardClipRow = {
  board_id?: string | null;
  clip_id?: string | null;
  added_at?: string | null;
};

type BoardClipIdRow = {
  clip_id?: string | null;
};

type BoardIdRow = {
  id?: string | null;
  board_id?: string | null;
  clip_ids?: string[] | null;
};

type QueryResult<T> = Promise<{
  data: T | null;
  error: PostgrestErrorLike | null;
}>;

type SupabaseLikeClient = {
  from: unknown;
  rpc?: unknown;
};

type TableQueryBuilder = {
  select: (columns: string) => unknown;
  update?: (values: Record<string, unknown>) => {
    eq: (column: string, value: string) => Promise<{
      error: PostgrestErrorLike | null;
    }>;
  };
};

function fromTable(client: SupabaseLikeClient, table: string): TableQueryBuilder {
  return (client.from as (name: string) => TableQueryBuilder)(table);
}

export interface BoardSummary {
  id: string;
  name: string;
  clipCount: number;
  coverClipIds: string[];
  created_at: string;
  updated_at: string;
}

type BoardStorageMode = "unknown" | "join" | "legacy";

let boardStorageMode: BoardStorageMode = "unknown";

function normalizeClipIds(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((clipId): clipId is string => typeof clipId === "string");
}

function isMissingJoinStorageError(error: PostgrestErrorLike | null | undefined) {
  const haystack = [
    error?.message,
    error?.details,
    error?.hint,
    error?.code,
  ]
    .filter((value): value is string => typeof value === "string")
    .join(" ")
    .toLowerCase();

  return (
    error?.code === "PGRST205" ||
    error?.code === "42P01" ||
    haystack.includes("board_clips") ||
    haystack.includes("schema cache")
  );
}

function isMissingJoinRpcError(error: PostgrestErrorLike | null | undefined) {
  const haystack = [
    error?.message,
    error?.details,
    error?.hint,
    error?.code,
  ]
    .filter((value): value is string => typeof value === "string")
    .join(" ")
    .toLowerCase();

  return (
    error?.code === "PGRST202" ||
    error?.code === "42883" ||
    haystack.includes("board_add_clip") ||
    haystack.includes("board_remove_clip")
  );
}

function markBoardStorageMode(mode: Exclude<BoardStorageMode, "unknown">) {
  boardStorageMode = mode;
}

function getJoinCoverClipIds(boardClips: BoardClipRow[]): string[] {
  return [...boardClips]
    .filter((row): row is { clip_id: string; added_at?: string | null } =>
      typeof row.clip_id === "string"
    )
    .sort(
      (a, b) =>
        new Date(b.added_at ?? 0).getTime() -
        new Date(a.added_at ?? 0).getTime()
    )
    .map((row) => row.clip_id)
    .slice(0, 3);
}

function buildLegacyBoardSummaries(boardRows: BoardRow[]): BoardSummary[] {
  return boardRows.map((row) => {
    const clipIds = normalizeClipIds(row.clip_ids);
    return {
      id: row.id,
      name: row.name,
      clipCount: clipIds.length,
      coverClipIds: [...clipIds].reverse().slice(0, 3),
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  });
}

async function loadLegacyBoardRows(client: SupabaseLikeClient) {
  const boardsQuery = fromTable(client, "boards").select(
    "id, name, clip_ids, created_at, updated_at"
  ) as {
    order: (
      column: string,
      options: { ascending: boolean }
    ) => QueryResult<BoardRow[]>;
  };
  const { data, error } = await boardsQuery.order("created_at", {
    ascending: false,
  });

  return {
    data: (data ?? []) as BoardRow[],
    error: (error ?? null) as PostgrestErrorLike | null,
  };
}

async function loadLegacyBoardClipIds(
  client: SupabaseLikeClient,
  boardId: string
) {
  const boardQuery = fromTable(client, "boards").select("clip_ids") as {
    eq: (column: string, value: string) => {
      single: () => QueryResult<{ clip_ids?: string[] | null }>;
    };
  };
  const { data, error } = await boardQuery.eq("id", boardId).single();

  if (error) {
    return { clipIds: [] as string[], error: error as PostgrestErrorLike };
  }

  markBoardStorageMode("legacy");
  return {
    clipIds: normalizeClipIds(data?.clip_ids),
    error: null,
  };
}

export async function loadBoardSummaries(
  client: SupabaseLikeClient
): Promise<BoardSummary[]> {
  if (boardStorageMode === "legacy") {
    const legacy = await loadLegacyBoardRows(client);
    if (!legacy.error) {
      return buildLegacyBoardSummaries(legacy.data);
    }
    boardStorageMode = "unknown";
  }

  const boardsQuery = fromTable(client, "boards").select(
    "id, name, created_at, updated_at"
  ) as {
    order: (
      column: string,
      options: { ascending: boolean }
    ) => QueryResult<BoardRow[]>;
  };
  const { data: boardRows, error: boardsError } = await boardsQuery.order(
    "created_at",
    { ascending: false }
  );

  if (boardsError || !boardRows) {
    return [];
  }

  const boardIds = boardRows
    .map((row: BoardRow) => row.id)
    .filter((boardId: unknown): boardId is string => typeof boardId === "string");

  if (boardIds.length === 0) {
    return [];
  }

  const boardClipsQuery = fromTable(client, "board_clips").select(
    "board_id, clip_id, added_at"
  ) as {
    in: (column: string, values: string[]) => QueryResult<BoardClipRow[]>;
  };
  const { data: boardClipRows, error: boardClipsError } =
    await boardClipsQuery.in("board_id", boardIds);

  if (!boardClipsError) {
    markBoardStorageMode("join");
    const boardClipsByBoardId = new Map<string, BoardClipRow[]>();

    for (const row of (boardClipRows ?? []) as BoardClipRow[]) {
      if (typeof row.board_id !== "string") {
        continue;
      }

      const boardClips = boardClipsByBoardId.get(row.board_id) ?? [];
      boardClips.push(row);
      boardClipsByBoardId.set(row.board_id, boardClips);
    }

    return (boardRows as BoardRow[]).map((row) => {
      const boardClips = boardClipsByBoardId.get(row.id) ?? [];
      return {
        id: row.id,
        name: row.name,
        clipCount: boardClips.filter((entry) => typeof entry.clip_id === "string")
          .length,
        coverClipIds: getJoinCoverClipIds(boardClips),
        created_at: row.created_at,
        updated_at: row.updated_at,
      };
    });
  }

  const legacy = await loadLegacyBoardRows(client);
  if (!legacy.error) {
    markBoardStorageMode("legacy");
    return buildLegacyBoardSummaries(legacy.data);
  }

  if (!isMissingJoinStorageError(boardClipsError)) {
    return (boardRows as BoardRow[]).map((row) => ({
      id: row.id,
      name: row.name,
      clipCount: 0,
      coverClipIds: [],
      created_at: row.created_at,
      updated_at: row.updated_at,
    }));
  }

  return [];
}

export async function loadBoardClipIds(
  client: SupabaseLikeClient,
  boardId: string
): Promise<string[]> {
  if (!boardId) {
    return [];
  }

  if (boardStorageMode !== "legacy") {
    const boardClipsQuery = fromTable(client, "board_clips").select(
      "clip_id"
    ) as {
      eq: (column: string, value: string) => QueryResult<BoardClipIdRow[]>;
    };
    const { data, error } = await boardClipsQuery.eq("board_id", boardId);

    if (!error) {
      markBoardStorageMode("join");
      return (data as BoardClipIdRow[]).flatMap((row) =>
        typeof row.clip_id === "string" ? [row.clip_id] : []
      );
    }
  }

  const legacy = await loadLegacyBoardClipIds(client, boardId);
  return legacy.clipIds;
}

export async function loadBoardIdsForClip(
  client: SupabaseLikeClient,
  clipId: string
): Promise<string[]> {
  if (!clipId) {
    return [];
  }

  if (boardStorageMode !== "legacy") {
    const boardClipsQuery = fromTable(client, "board_clips").select(
      "board_id"
    ) as {
      eq: (column: string, value: string) => QueryResult<BoardIdRow[]>;
    };
    const { data, error } = await boardClipsQuery.eq("clip_id", clipId);

    if (!error) {
      markBoardStorageMode("join");
      return (data as BoardIdRow[]).flatMap((row) =>
        typeof row.board_id === "string" ? [row.board_id] : []
      );
    }
  }

  const boardsQuery = fromTable(client, "boards").select(
    "id, clip_ids"
  ) as QueryResult<BoardIdRow[]>;
  const { data, error } = await boardsQuery;
  if (error) {
    return [];
  }

  markBoardStorageMode("legacy");
  return (data as BoardIdRow[])
    .filter((row) => normalizeClipIds(row.clip_ids).includes(clipId))
    .flatMap((row) => (typeof row.id === "string" ? [row.id] : []));
}

async function persistLegacyBoardClipMembership(
  client: SupabaseLikeClient,
  boardId: string,
  clipId: string,
  nextInBoard: boolean
) {
  const { clipIds, error } = await loadLegacyBoardClipIds(client, boardId);
  if (error) {
    return { error };
  }

  const currentInBoard = clipIds.includes(clipId);
  const nextClipIds = nextInBoard
    ? currentInBoard
      ? clipIds
      : [...clipIds, clipId]
    : clipIds.filter((entry) => entry !== clipId);

  const { error: updateError } = await fromTable(client, "boards")
    .update?.({ clip_ids: nextClipIds })
    ?.eq("id", boardId) ?? { error: { message: "Boards update unavailable" } };

  if (!updateError) {
    markBoardStorageMode("legacy");
  }

  return { error: (updateError ?? null) as PostgrestErrorLike | null };
}

export async function persistBoardClipMembership(
  client: SupabaseLikeClient,
  boardId: string,
  clipId: string,
  nextInBoard: boolean
) {
  if (boardStorageMode === "unknown") {
    await loadBoardClipIds(client, boardId);
  }

  if (boardStorageMode === "legacy") {
    return persistLegacyBoardClipMembership(
      client,
      boardId,
      clipId,
      nextInBoard
    );
  }

  const rpcName = nextInBoard ? "board_add_clip" : "board_remove_clip";
  const rpc = client.rpc as
    | ((
        fn: string,
        args: Record<string, unknown>
      ) => PromiseLike<{ error: PostgrestErrorLike | null }>)
    | undefined;

  if (!rpc) {
    return persistLegacyBoardClipMembership(client, boardId, clipId, nextInBoard);
  }
  const { error } = await rpc(rpcName, {
    p_board_id: boardId,
    p_clip_id: clipId,
  });

  if (!error) {
    markBoardStorageMode("join");
    return { error: null };
  }

  if (isMissingJoinRpcError(error) || isMissingJoinStorageError(error)) {
    return persistLegacyBoardClipMembership(
      client,
      boardId,
      clipId,
      nextInBoard
    );
  }

  return { error };
}

export function resetBoardStorageModeForTests() {
  boardStorageMode = "unknown";
}
