export function getPagefindIndexOrThrow(result, step) {
  if (result?.errors?.length) {
    throw new Error(`${step} failed:\n${result.errors.join("\n")}`);
  }

  if (!result?.index) {
    throw new Error(`${step} did not return an index`);
  }

  return result.index;
}
