import { historyRetriever } from '../retrieval/retriever';
import { OWNER_REGEX, REPO_REGEX } from '../lib/validate';

async function main() {
  const args = process.argv.slice(2);
  const flags = args.filter((arg) => arg.startsWith('--'));
  const positional = args.filter((arg) => !arg.startsWith('--'));

  const forceRefresh = flags.includes('--refresh');
  const [owner, repo] = positional;

  if (!owner || !repo) {
    console.error('Usage: npm run ingest -- <owner> <repo> [--refresh]');
    console.error('Example: npm run ingest -- fastify fastify');
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

  console.log(`\n======================================================`);
  console.log(`RepoMind Ingest: ${owner}/${repo}`);
  console.log(`Mode: ${forceRefresh ? 'Force Refresh (--refresh)' : 'Cache with TTL'}`);
  console.log(`======================================================\n`);

  try {
    const summary = await historyRetriever.ingestRepository(owner, repo, {
      forceRefresh,
      onProgress: (stage, progress) => {
        if (progress) {
          process.stdout.write(`\r[Ingest] ${stage} (${progress.current}/${progress.total})`);
        } else {
          console.log(`[Ingest] ${stage}`);
        }
      },
    });

    console.log('\n\n--- Ingestion Summary ---');
    console.log(`Repository:      ${summary.owner}/${summary.repo}`);
    console.log(`Cache Status:    ${summary.cached ? 'Reused existing cache (Fresh)' : 'Fetched new records from GitHub'}`);
    console.log(`Fetched At:      ${summary.fetchedAt}`);
    console.log(`Truncated:       ${summary.isTruncated ? 'Yes (MVP limit reached)' : 'No'}`);
    console.log('\n--- Record Counts ---');
    console.log(`Pull Requests:   ${summary.counts.pullRequests}`);
    console.log(`Linked Issues:   ${summary.counts.issues}`);
    console.log(`Reviews:         ${summary.counts.reviews}`);
    console.log(`Comments:        ${summary.counts.comments}`);
    console.log(`Commits:         ${summary.counts.commits}`);
    console.log(`Total Records:   ${summary.counts.totalRecords}`);
    console.log(`Text Chunks:     ${summary.counts.chunks}`);
    console.log(`Embeddings:      ${summary.counts.embeddings}`);
    console.log('======================================================\n');
  } catch (err: unknown) {
    console.error('\n[Ingest Error]');
    if (err instanceof Error) {
      console.error(err.message);
    } else {
      console.error(String(err));
    }
    process.exit(1);
  }
}

main();
