import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BoardSavePopover } from "./BoardSavePopover";
import { useAuthStore } from "@/stores/authStore";
import { useBoardStore } from "@/stores/boardStore";

const createClientMock = vi.fn();
const showToastMock = vi.fn();

vi.mock("@floating-ui/react", () => ({
  useFloating: () => ({
    refs: {
      setFloating: vi.fn(),
    },
    floatingStyles: {},
  }),
  autoUpdate: vi.fn(),
  offset: vi.fn(() => ({})),
  flip: vi.fn(() => ({})),
  shift: vi.fn(() => ({})),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => createClientMock(),
}));

vi.mock("@/components/common/Toast", () => ({
  showToast: (...args: unknown[]) => showToastMock(...args),
}));

function mockSupabaseClient(opts: {
  membershipRows?: { board_id: string }[];
  rpcMock?: ReturnType<typeof vi.fn>;
  membershipPromise?: Promise<unknown>;
}) {
  const rpc = opts.rpcMock ?? vi.fn().mockResolvedValue({ error: null });

  const selectReturnValue = opts.membershipPromise
    ? { eq: () => opts.membershipPromise }
    : {
        eq: () =>
          Promise.resolve({
            data: opts.membershipRows ?? [],
          }),
      };

  createClientMock.mockReturnValue({
    from: (table: string) => {
      if (table !== "board_clips") {
        throw new Error(`Unexpected table: ${table}`);
      }

      return {
        select: () => selectReturnValue,
      };
    },
    rpc,
  });

  return { rpc };
}

describe("BoardSavePopover", () => {
  let referenceElement: HTMLButtonElement;

  beforeEach(() => {
    referenceElement = document.createElement("button");
    document.body.appendChild(referenceElement);

    createClientMock.mockReset();
    showToastMock.mockReset();

    useAuthStore.setState({
      user: { id: "user-1", email: "user@example.com" } as never,
      tier: "free",
      isLoading: false,
    });

    useBoardStore.setState({
      boards: [
        {
          id: "board-1",
          name: "Board 1",
          clipCount: 1,
          coverClipIds: [],
          created_at: "2026-03-29T00:00:00.000Z",
          updated_at: "2026-03-29T00:00:00.000Z",
        },
      ],
      activeBoardId: null,
      activeBoardClipIds: null,
      isLoading: false,
    });
  });

  afterEach(() => {
    referenceElement.remove();
    vi.restoreAllMocks();
  });

  it("disables board toggles until membership loading finishes", async () => {
    let resolveMembership: ((value: unknown) => void) | undefined;
    const membershipPromise = new Promise((resolve) => {
      resolveMembership = resolve;
    });

    const { rpc } = mockSupabaseClient({ membershipPromise });

    render(
      <BoardSavePopover
        clipId="clip-1"
        referenceElement={referenceElement}
        onClose={vi.fn()}
      />
    );

    const boardButton = await screen.findByRole("button", { name: /Board 1/ });
    expect(boardButton).toBeDisabled();

    if (resolveMembership) {
      resolveMembership({
        data: [{ board_id: "board-1" }],
      });
    }

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Board 1/ })).toBeEnabled();
    });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("undoes a save by issuing the remove RPC", async () => {
    const rpcMock = vi.fn().mockResolvedValue({ error: null });

    mockSupabaseClient({
      membershipRows: [],
      rpcMock,
    });

    useBoardStore.setState({
      boards: [
        {
          id: "board-1",
          name: "Board 1",
          clipCount: 0,
          coverClipIds: [],
          created_at: "2026-03-29T00:00:00.000Z",
          updated_at: "2026-03-29T00:00:00.000Z",
        },
      ],
    });

    render(
      <BoardSavePopover
        clipId="clip-1"
        referenceElement={referenceElement}
        onClose={vi.fn()}
      />
    );

    fireEvent.click(await screen.findByRole("button", { name: /Board 1/ }));

    await waitFor(() => {
      expect(showToastMock).toHaveBeenCalledTimes(1);
    });

    const undo = showToastMock.mock.calls[0]?.[1] as (() => unknown) | undefined;

    await act(async () => {
      await undo?.();
    });

    expect(rpcMock).toHaveBeenNthCalledWith(1, "board_add_clip", {
      p_board_id: "board-1",
      p_clip_id: "clip-1",
    });

    await waitFor(() => {
      expect(rpcMock).toHaveBeenNthCalledWith(2, "board_remove_clip", {
        p_board_id: "board-1",
        p_clip_id: "clip-1",
      });
    });
  });
});
