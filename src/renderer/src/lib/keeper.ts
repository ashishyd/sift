/**
 * The copy to keep in a duplicate group when the user picked a folder rule, or undefined.
 * Only a folder directly under the home folder counts (/Users/<name>/<folder>/...), so a
 * nested folder such as ~/Documents/Pictures/ does not match "Pictures".
 */
export function keeperForRule(files: string[], folder: string): string | undefined {
  if (!folder) return undefined
  const prefix = new RegExp(`^/Users/[^/]+/${folder}/`)
  return files.find((f) => prefix.test(f))
}
