import { historyRetriever } from '../retrieval/retriever';
import { OWNER_REGEX, REPO_REGEX } from '../lib/validate';

async function main() {
  const args = process.argv.slice(2);
  const positional = args.filter((arg) => !arg.startsWith('--'));

  const [owner, repo, question] = positional;

  if (!owner || !repo || !question) {
    console.error('Usage: npm run retrieve -- <owner> <repo> "<question>"');
    console.error('Example: npm run retrieve -- fastify fastify "Why was schema validation changed?"');
    process.exit(1);
  }

  if (!OWNER_REGEX.test(owner)) {
    console.error(`Invalid owner "${owner}". Letters, numbers, and hyphens only.`);
    process.exit(1);
  }

  if (!REPO_REGEX.test(repo) || repo === '.' || repo === '..') {
    console.error(`Invalid repo "${repo}".`);
    process.exit(1);
  }

  if (question.trim().length < 3) {
    console.error('Question must be at least 3 characters.');
    process.exit(1);
  }

  console.log(`\n======================================================`);
  console.log(`RepoMind Evidence Retrieval`);
  console.log(`Repository: ${owner}/${repo}`);
  console.log(`Question:   "${question}"`);
  console.log(`======================================================\n`);

  try {
    const result = await historyRetriever.retrieveEvidence(owner, repo, question);

    if (result.evidence.length === 0) {
      console.log('No relevant evidence items found in cache.');
      console.log('Tip: Run "npm run ingest -- <owner> <repo>" first to populate the cache.\n');
      return;
    }

    console.log(`Found ${result.evidence.length} evidence items:\n`);

    result.evidence.forEach((item, index) => {
      console.log(`[#${index + 1}] Similarity: ${item.similarity.toFixed(4)} | Type: ${item.type.toUpperCase()}`);
      console.log(`Title:  ${item.title}`);
      console.log(`URL:    ${item.url}`);
      console.log(`Date:   ${item.timestamp}`);
      console.log(`Excerpt:`);
      console.log(`  ${item.excerpt.replace(/\n/g, '\n  ')}`);
      console.log('------------------------------------------------------\n');
    });
  } catch (err: unknown) {
    console.error('\n[Retrieval Error]');
    if (err instanceof Error) {
      console.error(err.message);
    } else {
      console.error(String(err));
    }
    process.exit(1);
  }
}

main();
