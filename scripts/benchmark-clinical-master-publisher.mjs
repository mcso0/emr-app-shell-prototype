#!/usr/bin/env node

import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";

const repoRoot = resolve(import.meta.dirname, "..");
const fixturePath = resolve(
  repoRoot,
  "tests/fixtures/clinical-master-execution-preset-release-v1.json",
);
const ownerMigrationPath = resolve(
  repoRoot,
  "supabase/migrations/20260831132225_clinical_master_publisher_set_based_owner_revision.sql",
);
const finalizationMigrationPath = resolve(
  repoRoot,
  "supabase/migrations/20260831135847_clinical_master_publisher_set_based_finalization.sql",
);
const benchmarkSqlPath = resolve(
  repoRoot,
  "supabase/snippets/clinical_master_execution_preset_publisher_benchmark.sql",
);
const fixtureSha256 = sha256(readFileSync(fixturePath));
const ownerMigrationSha256 = sha256(readFileSync(ownerMigrationPath));
const finalizationMigrationSha256 = sha256(
  readFileSync(finalizationMigrationPath),
);
const candidateChainSha256 = sha256(
  [ownerMigrationPath, finalizationMigrationPath]
    .map((path) => `${basename(path)}\0${readFileSync(path, "utf8")}\0`)
    .join(""),
);
const fixtureContainerPath = `/tmp/clinical-master-publisher-${fixtureSha256}.json`;
const args = parseArgs(process.argv.slice(2));

if (args.help) {
  printHelp();
  process.exit(0);
}

const container = requiredArg(args, "container");
const templateDatabase = requiredArg(args, "template-db");
const repetitions = numberArg(args, "repetitions", 2);
const committedRetry = Boolean(args["committed-retry"]);
const planOnly = Boolean(args.plan);
const append = Boolean(args.append);
const outputPath = resolve(
  String(
    args.output ??
      `/private/tmp/clinical-master-publisher-${committedRetry ? "retry" : "abba"}-${Date.now()}.jsonl`,
  ),
);

assertSafeContainer(container);
assertSafeDatabaseName(templateDatabase, "template database");
if (!Number.isInteger(repetitions) || repetitions < 1 || repetitions > 10) {
  fail("--repetitions must be an integer between 1 and 10");
}
if (!append && existsSync(outputPath)) {
  fail(
    `output already exists; choose a new path or pass --append: ${outputPath}`,
  );
}

const sequence = committedRetry
  ? ["candidate"]
  : Array.from({ length: repetitions }, () => [
      "baseline",
      "candidate",
      "candidate",
      "baseline",
    ]).flat();

if (planOnly) {
  console.log(
    JSON.stringify(
      {
        localOnly: true,
        container,
        templateDatabase,
        mode: committedRetry ? "committed_retry" : "rollback_publish",
        sequence,
        fixturePath,
        fixtureSha256,
        comparison: "owner_to_finalization",
        ownerBaselineMigration: {
          path: ownerMigrationPath,
          sha256: ownerMigrationSha256,
        },
        candidateMigration: {
          path: finalizationMigrationPath,
          sha256: finalizationMigrationSha256,
        },
        candidateChainSha256,
        outputPath,
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

assertLocalDockerEndpoint();
assertDockerContainer(container);
assertTemplateBaseline(container, templateDatabase);
copyFixture(container);
mkdirSync(dirname(outputPath), { recursive: true });

for (const [sequenceIndex, variant] of sequence.entries()) {
  const runId = `${committedRetry ? "retry" : "abba"}-${String(sequenceIndex + 1).padStart(2, "0")}-${variant}`;
  const runDatabase = buildRunDatabaseName(sequenceIndex + 1, variant);
  let runDatabaseCreated = false;

  try {
    createRunDatabase(container, templateDatabase, runDatabase);
    runDatabaseCreated = true;

    applyMigration(container, runDatabase, ownerMigrationPath);
    if (variant === "candidate") {
      applyMigration(container, runDatabase, finalizationMigrationPath);
    }
    assertVariantMarkers(container, runDatabase, variant);

    const evidence = committedRetry
      ? runCommittedRetry(container, runDatabase, runId)
      : runRollbackProbe(container, runDatabase, runId, variant);

    const output = {
      ...evidence,
      sequenceIndex: sequenceIndex + 1,
      templateDatabase,
      comparison: "owner_to_finalization",
      ownerBaselineMigration: basename(ownerMigrationPath),
      ownerBaselineMigrationSha256: ownerMigrationSha256,
      candidateMigration: basename(finalizationMigrationPath),
      candidateMigrationSha256: finalizationMigrationSha256,
      candidateChainSha256,
    };
    appendFileSync(outputPath, `${JSON.stringify(output)}\n`, "utf8");
    console.log(`[PASS] ${runId} ${formatTiming(output)} -> ${outputPath}`);
  } finally {
    if (runDatabaseCreated) {
      dropRunDatabase(container, runDatabase);
    }
  }
}

console.log(`[PASS] local-only benchmark complete: ${outputPath}`);

function parseArgs(tokens) {
  const parsed = {};
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (!token.startsWith("--")) fail(`unexpected argument: ${token}`);
    const key = token.slice(2);
    if (["help", "plan", "append", "committed-retry"].includes(key)) {
      parsed[key] = true;
      continue;
    }
    const value = tokens[index + 1];
    if (!value || value.startsWith("--")) fail(`missing value for --${key}`);
    parsed[key] = value;
    index += 1;
  }
  return parsed;
}

function requiredArg(parsed, key) {
  const value = parsed[key];
  if (!value) fail(`--${key} is required`);
  return String(value);
}

function numberArg(parsed, key, fallback) {
  return parsed[key] === undefined ? fallback : Number(parsed[key]);
}

function printHelp() {
  console.log(`Local clinical-master publisher benchmark

Usage:
  node scripts/benchmark-clinical-master-publisher.mjs \\
    --container <local-supabase-db-container> \\
    --template-db <ownership-preserving-baseline-db> [options]

Options:
  --repetitions <n>   Owner-baseline vs finalization ABBA cycles (default: 2, max: 10)
  --committed-retry   Commit once, retry from a new connection, then drop the DB
  --output <path>     JSONL evidence path (default: unique /private/tmp path)
  --append            Append when the output path already exists
  --plan              Print the exact local plan without creating a database
  --help              Show this help

Safety boundary:
  The effective Docker endpoint must be a local unix:// socket. SSH, TCP, and
  other remote Docker contexts are rejected before any container operation.
  Docker container names must start with supabase_db_. Every mutable database
  is created by this runner with the clinical_master_bench_ prefix and dropped
  in a finally block. No network URL or remote Supabase command is accepted.
`);
}

function sha256(content) {
  return createHash("sha256").update(content).digest("hex");
}

function run(command, commandArgs, options = {}) {
  const result = spawnSync(command, commandArgs, {
    cwd: repoRoot,
    encoding: "utf8",
    input: options.input,
    timeout: options.timeout ?? 30_000,
    maxBuffer: 20 * 1024 * 1024,
  });
  if (result.status !== 0) {
    const detail = [result.stdout, result.stderr]
      .filter(Boolean)
      .join("\n")
      .trim();
    fail(
      `${command} failed (${result.status ?? "no status"})${detail ? `\n${detail}` : ""}`,
    );
  }
  return result.stdout.trim();
}

function dockerExec(containerName, commandArgs, options = {}) {
  return run(
    "docker",
    ["exec", ...(options.stdin ? ["-i"] : []), containerName, ...commandArgs],
    options,
  );
}

function psql(containerName, database, sql, options = {}) {
  return dockerExec(
    containerName,
    [
      "psql",
      "-qAt",
      "-U",
      "supabase_admin",
      "-d",
      database,
      "-v",
      "ON_ERROR_STOP=1",
      ...(options.variables ?? []).flatMap(([key, value]) => [
        "-v",
        `${key}=${value}`,
      ]),
      "-f",
      "-",
    ],
    { stdin: true, input: sql, timeout: options.timeout ?? 90_000 },
  );
}

function assertSafeContainer(value) {
  if (!/^supabase_db_[A-Za-z0-9_.-]+$/.test(value)) {
    fail(
      "--container must name a local Supabase Postgres container starting with supabase_db_",
    );
  }
}

function assertSafeDatabaseName(value, label) {
  if (!/^[a-z][a-z0-9_]{0,62}$/.test(value)) {
    fail(`${label} must match ^[a-z][a-z0-9_]{0,62}$`);
  }
}

function assertLocalDockerEndpoint() {
  const environmentHost = process.env.DOCKER_HOST?.trim();
  if (environmentHost && !environmentHost.startsWith("unix://")) {
    fail(`refusing non-local DOCKER_HOST: ${environmentHost}`);
  }

  const contextHost = run("docker", [
    "context",
    "inspect",
    "--format",
    '{{ (index .Endpoints "docker").Host }}',
  ]);
  if (!contextHost.startsWith("unix://")) {
    fail(`refusing non-local Docker context endpoint: ${contextHost}`);
  }
}

function assertDockerContainer(containerName) {
  const image = run("docker", [
    "inspect",
    "--format",
    "{{.Config.Image}}",
    containerName,
  ]);
  if (!image.includes("supabase/postgres")) {
    fail(`refusing non-Supabase Postgres container image: ${image}`);
  }
}

function assertTemplateBaseline(containerName, database) {
  const output = dockerExec(containerName, [
    "psql",
    "-qAt",
    "-U",
    "supabase_admin",
    "-d",
    database,
    "-v",
    "ON_ERROR_STOP=1",
    "-c",
    `select jsonb_build_object(
      'database',current_database(),
      'orders',(select count(*) from master.master_records where record_type='order'),
      'presetVersions',(select count(*) from master.order_execution_presets),
      'presetCurrent',(select count(*) from master.order_execution_preset_current),
      'targetReleaseCount',(select count(*) from master.master_releases where source_fingerprint='8b939f7a0c752bb7b8989aca80380e51c1a720a8b98ccb35d1ceb1408648a0f0'),
      'ownerMarker',strpos((select prosrc from pg_proc where oid='private.publish_clinical_master_release_cumulative(jsonb,uuid)'::regprocedure),'clinical_master_owner_stage_contract_invalid')>0,
      'finalizationMarker',strpos((select prosrc from pg_proc where oid='private.publish_clinical_master_release_cumulative(jsonb,uuid)'::regprocedure),'clinical_master_finalization_stage_contract_invalid')>0
    )::text`,
  ]);
  const snapshot = parseSingleJsonLine(output);
  if (
    snapshot.database !== database ||
    snapshot.orders !== 510 ||
    snapshot.presetVersions !== 108 ||
    snapshot.presetCurrent !== 108 ||
    snapshot.targetReleaseCount !== 0 ||
    snapshot.ownerMarker ||
    snapshot.finalizationMarker
  ) {
    fail(
      `template is not the exact pre-owner-candidate 510/108/108 baseline: ${output}`,
    );
  }
}

function copyFixture(containerName) {
  run("docker", [
    "cp",
    fixturePath,
    `${containerName}:${fixtureContainerPath}`,
  ]);
}

function buildRunDatabaseName(index, variant) {
  const nonce = `${Date.now()}${process.pid}`.slice(-12);
  const name = `clinical_master_bench_${nonce}_${String(index).padStart(2, "0")}_${variant === "candidate" ? "b" : "a"}`;
  assertSafeDatabaseName(name, "run database");
  return name;
}

function createRunDatabase(containerName, template, runDatabase) {
  assertOwnedRunDatabase(runDatabase);
  dockerExec(
    containerName,
    ["createdb", "-U", "supabase_admin", "-T", template, runDatabase],
    { timeout: 60_000 },
  );
}

function dropRunDatabase(containerName, runDatabase) {
  assertOwnedRunDatabase(runDatabase);
  dockerExec(
    containerName,
    ["dropdb", "-U", "supabase_admin", "--if-exists", runDatabase],
    { timeout: 30_000 },
  );
}

function assertOwnedRunDatabase(database) {
  if (!/^clinical_master_bench_[a-z0-9_]+$/.test(database)) {
    fail(`refusing mutation outside runner-owned database prefix: ${database}`);
  }
}

function applyMigration(containerName, database, migrationPath) {
  psql(containerName, database, readFileSync(migrationPath, "utf8"), {
    timeout: 60_000,
  });
}

function assertVariantMarkers(containerName, database, variant) {
  const output = dockerExec(containerName, [
    "psql",
    "-qAt",
    "-U",
    "supabase_admin",
    "-d",
    database,
    "-v",
    "ON_ERROR_STOP=1",
    "-c",
    "select jsonb_build_object('owner',strpos(prosrc,'clinical_master_owner_stage_contract_invalid')>0,'finalization',strpos(prosrc,'clinical_master_finalization_stage_contract_invalid')>0)::text from pg_proc where oid='private.publish_clinical_master_release_cumulative(jsonb,uuid)'::regprocedure",
  ]);
  const markers = parseSingleJsonLine(output);
  const expectedFinalization = variant === "candidate";
  if (markers.owner !== true || markers.finalization !== expectedFinalization) {
    fail(
      `variant marker mismatch in ${database}: expected owner=true/finalization=${expectedFinalization}, got ${output}`,
    );
  }
}

function runRollbackProbe(containerName, database, runId, variant) {
  const startedAt = performance.now();
  const output = psql(
    containerName,
    database,
    readFileSync(benchmarkSqlPath, "utf8"),
    {
      variables: [
        ["payload_server_path", fixtureContainerPath],
        ["fixture_sha256", fixtureSha256],
        ["run_id", runId],
        ["variant", variant],
      ],
      timeout: 90_000,
    },
  );
  const evidence = parseSingleJsonLine(output);
  evidence.timing.clientElapsedMs = Number(
    (performance.now() - startedAt).toFixed(3),
  );
  return evidence;
}

function runCommittedRetry(containerName, database, runId) {
  const publishSql = `\\set ON_ERROR_STOP on
create temp table benchmark_input(payload jsonb not null);
insert into benchmark_input values (pg_read_file(:'payload_server_path')::jsonb);
select private.publish_clinical_master_release(payload,null)::text from benchmark_input;
`;
  const variables = [["payload_server_path", fixtureContainerPath]];
  const firstStartedAt = performance.now();
  const first = parseSingleJsonLine(
    psql(containerName, database, publishSql, { variables, timeout: 90_000 }),
  );
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      first.releaseId,
    )
  ) {
    fail(`publisher returned an invalid release UUID: ${first.releaseId}`);
  }
  const firstClientElapsedMs = Number(
    (performance.now() - firstStartedAt).toFixed(3),
  );
  const retryStartedAt = performance.now();
  const retry = parseSingleJsonLine(
    psql(containerName, database, publishSql, { variables, timeout: 90_000 }),
  );
  const retryClientElapsedMs = Number(
    (performance.now() - retryStartedAt).toFixed(3),
  );

  const readbackSql = `create temp table benchmark_readback_input(payload jsonb not null);
insert into benchmark_readback_input values (pg_read_file(:'payload_server_path')::jsonb);
with finalize as materialized (
  select
    version.master_record_id,
    version.revision,
    records.value->'names' names,
    records.value->'source' source_content
  from master.master_record_versions version
  join private.clinical_master_lab_publish_stage stage
    on stage.release_id=version.release_id
   and stage.master_record_id=version.master_record_id
  join benchmark_readback_input input on true
  join lateral jsonb_array_elements(input.payload->'records') records(value)
    on btrim(records.value->>'masterKey')=stage.master_key
  where version.release_id=:'release_id'::uuid
)
select jsonb_build_object(
        'releaseCount',(select count(*) from master.master_releases where source_fingerprint='8b939f7a0c752bb7b8989aca80380e51c1a720a8b98ccb35d1ceb1408648a0f0'),
        'presetVersions',(select count(*) from master.order_execution_presets),
        'presetCurrent',(select count(*) from master.order_execution_preset_current),
        'manifest',(select count(*) from private.clinical_master_release_payload_owner_manifest where release_id=:'release_id'::uuid),
        'reviewEvents',(select count(*) from master.master_review_events event join master.master_record_versions version on version.master_record_id=event.master_record_id and version.revision=event.revision where version.release_id=:'release_id'::uuid),
        'releaseVersions',(select count(*) from master.master_record_versions where release_id=:'release_id'::uuid),
        'stageVersionMismatches',(select count(*) from master.master_record_versions version join private.clinical_master_lab_publish_stage stage on stage.release_id=version.release_id and stage.master_record_id=version.master_record_id where version.release_id=:'release_id'::uuid and (version.revision is distinct from stage.effective_revision or version.snapshot is distinct from jsonb_set(stage.base_content || stage.relation_content,'{revision}',to_jsonb(stage.effective_revision),true))),
        'ownerRevisionMismatches',(select count(*) from master.master_record_versions version join private.clinical_master_lab_publish_stage stage on stage.release_id=version.release_id and stage.master_record_id=version.master_record_id join master.master_records owner on owner.id=stage.master_record_id where version.release_id=:'release_id'::uuid and (owner.current_revision is distinct from stage.effective_revision or owner.current_release_id is distinct from :'release_id'::uuid)),
        'nameSemanticMismatches',(
          select count(*) from finalize
          where (select count(*) from master.master_record_names actual where actual.master_record_id=finalize.master_record_id) is distinct from jsonb_array_length(finalize.names)
             or exists (
               select 1 from jsonb_array_elements(finalize.names) expected(value)
               where not exists (
                 select 1 from master.master_record_names actual
                 where actual.master_record_id=finalize.master_record_id
                   and actual.language_code=expected.value->>'languageCode'
                   and actual.name_kind=expected.value->>'nameKind'
                   and actual.name=btrim(expected.value->>'name')
                   and actual.normalized_name=lower(regexp_replace(btrim(expected.value->>'name'),'[[:space:]]+',' ','g'))
                   and actual.searchable is not distinct from coalesce((expected.value->>'searchable')::boolean,true)
                   and actual.sort_order is not distinct from coalesce((expected.value->>'sortOrder')::integer,0)
               )
             )
        ),
        'sourceSemanticMismatches',(
          select count(*) from finalize
          where not exists (
            select 1 from master.master_record_sources link
            join master.master_sources source on source.id=link.source_id
            where link.master_record_id=finalize.master_record_id
              and link.assertion_scope='record'
              and link.notes='Validated Phase 1B-1 synthetic publisher source.'
              and source.source_type is not distinct from finalize.source_content->>'sourceType'
              and source.title is not distinct from finalize.source_content->>'title'
              and source.reference_uri is not distinct from finalize.source_content->>'referenceUri'
              and source.source_version is not distinct from finalize.source_content->>'sourceVersion'
              and source.accessed_at is not distinct from nullif(finalize.source_content->>'accessedAt','')::timestamptz
              and source.license_notes is not distinct from finalize.source_content->>'licenseNotes'
          )
        ),
        'reviewSemanticMismatches',(
          select count(*) from finalize
          where exists (
            select 1 from (values ('validated'::text),('published'::text)) expected(event_type)
            where (select count(*) from master.master_review_events review
              where review.master_record_id=finalize.master_record_id
                and review.revision=finalize.revision
                and review.event_type=expected.event_type
                and review.actor_user_id is null
                and review.actor_label=(select payload->>'publishedByLabel' from benchmark_readback_input)
                and review.source_surface='publisher')<>1
          )
        )
      )::text;
`;
  const readback = parseSingleJsonLine(
    psql(containerName, database, readbackSql, {
      variables: [
        ["payload_server_path", fixtureContainerPath],
        ["release_id", first.releaseId],
      ],
      timeout: 90_000,
    }),
  );

  if (
    first.idempotent !== false ||
    retry.idempotent !== true ||
    retry.releaseId !== first.releaseId ||
    first.recordCount !== 689 ||
    retry.recordCount !== 689 ||
    readback.releaseCount !== 1 ||
    readback.presetVersions !== 630 ||
    readback.presetCurrent !== 522 ||
    readback.manifest !== 689 ||
    readback.reviewEvents !== 1070 ||
    readback.releaseVersions !== 535 ||
    readback.stageVersionMismatches !== 0 ||
    readback.ownerRevisionMismatches !== 0 ||
    readback.nameSemanticMismatches !== 0 ||
    readback.sourceSemanticMismatches !== 0 ||
    readback.reviewSemanticMismatches !== 0
  ) {
    fail(
      `committed retry contract mismatch: ${JSON.stringify({ first, retry, readback })}`,
    );
  }

  return {
    schemaVersion: 1,
    suite: "clinical-master-publisher-benchmark",
    runId,
    variant: "candidate",
    mode: "committed_retry",
    fixture: { sha256: fixtureSha256, records: 689, orders: 522 },
    timing: { firstClientElapsedMs, retryClientElapsedMs },
    result: { first, retry },
    readback,
  };
}

function parseSingleJsonLine(output) {
  const lines = output
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const candidates = lines.filter(
    (line) => line.startsWith("{") && line.endsWith("}"),
  );
  if (candidates.length !== 1) {
    fail(
      `expected exactly one JSON line, received ${candidates.length}:\n${output}`,
    );
  }
  try {
    return JSON.parse(candidates[0]);
  } catch (error) {
    fail(`invalid JSON output: ${error.message}\n${candidates[0]}`);
  }
}

function formatTiming(output) {
  if (output.mode === "rollback_publish") {
    return `${output.timing.sqlElapsedMs}ms SQL / ${output.timing.clientElapsedMs}ms client`;
  }
  return `${output.timing.firstClientElapsedMs}ms first / ${output.timing.retryClientElapsedMs}ms retry`;
}

function fail(message) {
  throw new Error(`[BLOCKED] ${message}`);
}
