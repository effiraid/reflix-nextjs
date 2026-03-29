export function getBoardLimitNotice(opts: {
  lang: "ko" | "en";
  boardCount: number;
  limit: number;
}) {
  const overLimit = opts.boardCount > opts.limit;

  if (opts.lang === "ko") {
    return overLimit
      ? "기존 보드는 계속 사용할 수 있지만, 무료 계정은 새 보드를 더 만들 수 없어요.\nPro로 업그레이드하면 제한 없이 만들 수 있어요."
      : "무료 계정은 보드 1개까지.\nPro로 업그레이드하세요.";
  }

  return overLimit
    ? "You can keep using your existing boards, but free accounts cannot create more boards.\nUpgrade to Pro for unlimited boards."
    : "Free accounts are limited to 1 board.\nUpgrade to Pro.";
}
