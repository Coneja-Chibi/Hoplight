/**
 * Mechanical formatter for removing emoji sequences from authored files before the doctrine scan.
 * Paths are explicit command arguments; fixture and sample data should never be passed here.
 */

const EMOJI_SEQUENCE = /\p{Extended_Pictographic}(?:\uFE0E|\uFE0F)?(?:\u200D\p{Extended_Pictographic}(?:\uFE0E|\uFE0F)?)*/gu;

const paths = process.argv.slice(2);
if (paths.length === 0) {
  console.error("remove-emoji: pass one or more authored files");
  process.exit(1);
}
for (const path of paths) {
  const source = await Bun.file(path).text();
  await Bun.write(path, source.replace(EMOJI_SEQUENCE, ""));
  console.log(`remove-emoji: ${path}`);
}
