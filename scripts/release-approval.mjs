#!/usr/bin/env node

import {
  parseReleaseApprovalCliArgs,
  runReleaseApprove,
  runReleaseGo,
  runReleaseMarkFailed,
  runReleaseMarkPublished,
  runReleaseReview,
  runReleaseScan,
  runReleaseStatus,
} from "./lib/release-approval.mjs";

async function main() {
  const parsed = parseReleaseApprovalCliArgs();

  if (parsed.command === "go") {
    await runReleaseGo(parsed);
    return;
  }

  if (parsed.command === "status") {
    const result = await runReleaseStatus(parsed);

    if (result.batch) {
      console.log(`\n📦 Active Batch: ${result.batch.name} (${result.batch.size}개)`);
      console.log(`   Published: ${result.batch.published}/${result.batch.size}`);
    } else {
      console.log("\n📦 Active Batch: 없음");
    }

    console.log(`\n📊 Published Total: ${result.published.total}개`);
    if (result.published.lastUpdated) {
      console.log(`   Last updated: ${result.published.lastUpdated}`);
    }

    console.log(`\n🔍 Eagle Library:`);
    console.log(`   Total eligible: ${result.library.eligible}`);
    console.log(`   Missing aiTags: ${result.library.missingAiTags}`);
    console.log(`   Available for next batch: ${result.library.availableForNextBatch}`);
    return;
  }

  if (parsed.command === "scan") {
    const result = await runReleaseScan(parsed);
    console.log(`범위: ${result.scope}`);
    console.log(`검사한 적격 아이템: ${result.summary.eligibleCount}개`);
    console.log(`선택된 아이템: ${result.summary.selectedCount}개`);
    console.log(`보류 아이템: ${result.summary.heldCount}개`);
    console.log(`제안 배치: ${result.proposalBatchPath}`);
    console.log(`제안 보고서: ${result.proposalReportPath}`);
    return;
  }

  if (parsed.command === "review") {
    const result = await runReleaseReview(parsed);
    console.log("검토 요약:");
    console.log(`- 변경 후 재검토 필요: ${result.summary.review_needed_changed}`);
    console.log(`- 검토 필요: ${result.summary.review_needed}`);
    console.log(`- 이미 승인됨: ${result.summary.already_approved}`);
    console.log(`- 보류: ${result.summary.held}`);
    console.log(`검토 보고서: ${result.reviewReportPath}`);
    console.log(`검토 제안: ${result.reviewSuggestionsPath}`);
    return;
  }

  if (parsed.command === "approve") {
    const result = await runReleaseApprove(parsed);
    console.log(`승인된 아이템: ${result.approvedIds.length}개`);
    console.log(`원본 제안 배치: ${result.sourceProposalBatchPath}`);
    console.log(`갱신된 제안 배치: ${result.proposalBatchPath}`);
    console.log(`활성 배치: ${result.releaseBatchPath}`);
    return;
  }

  if (parsed.command === "mark-published") {
    const result = await runReleaseMarkPublished(parsed);
    console.log(`게시 완료 처리: ${result.updatedIds.length}개`);
    console.log(`활성 배치: ${result.releaseBatchPath}`);
    return;
  }

  if (parsed.command === "mark-failed") {
    const result = await runReleaseMarkFailed(parsed);
    console.log(`게시 실패 처리: ${result.updatedIds.length}개`);
    console.log(`활성 배치: ${result.releaseBatchPath}`);
    return;
  }

  throw new Error(`Unsupported release approval command: ${parsed.command}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
