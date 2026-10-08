// Sidebars for the Next Injective Git docs site.
//
// The docs plugin mounts the repository's real `../docs` folder. Those files
// are evidence-bearing records and must NOT be edited (no frontmatter, no
// renames), so sidebar order/labels/grouping is fully controlled here.
//
// Every included .md file is listed exactly once. When you add a new page in
// `docs/`, add it here (and add a `zh` translation or stub, see
// docs/AGENTS.md). Do not invent categories for files that do not exist.

/** @type {import('@docusaurus/plugin-content-docs').SidebarsConfig} */
const sidebars = {
  docs: [
    {
      type: 'category',
      label: 'Getting Started',
      link: { type: 'doc', id: 'README' },
      collapsed: false,
      items: [
        { type: 'doc', id: 'README', label: 'Documentation Index' },
        { type: 'doc', id: 'architecture', label: 'Architecture' },
        { type: 'doc', id: 'suite-version-compatibility', label: 'Suite Version Compatibility' },
        { type: 'doc', id: 'glossary', label: 'Glossary' },
      ],
    },
    {
      type: 'category',
      label: 'Status',
      items: [
        { type: 'doc', id: 'project-status', label: 'Project Status' },
        { type: 'doc', id: 'backlog', label: 'Backlog' },
        { type: 'doc', id: 'open-questions', label: 'Open Decisions' },
        { type: 'doc', id: 'delivery-roadmap', label: 'Delivery Roadmap' },
      ],
    },
    {
      type: 'category',
      label: 'Storage & BYOS',
      items: [
        { type: 'doc', id: 'storage-byos', label: 'BYOS Specification (S3/R2)' },
        { type: 'doc', id: 'roadmap-byos-providers', label: 'BYOS Provider Roadmap (Mainland China)' },
        { type: 'doc', id: 'pinning-infrastructure', label: 'Pinning Infrastructure' },
        { type: 'doc', id: 'infrastructure', label: 'IPFS Data Plane (as-built)' },
      ],
    },
    {
      type: 'category',
      label: 'Operations',
      items: [
        { type: 'doc', id: 'release', label: 'Release & Cutover' },
        { type: 'doc', id: 'acceptance-evidence', label: 'Acceptance Evidence' },
        { type: 'doc', id: 'monitor', label: 'Public Monitor' },
        { type: 'doc', id: 'push-setup', label: 'Push Setup' },
        { type: 'doc', id: 'ci-web-publishing', label: 'CI Web Publishing' },
        { type: 'doc', id: 'evm-wallet-compatibility', label: 'EVM Wallet Compatibility' },
        { type: 'doc', id: 'feegrant-policy', label: 'Feegrant Policy' },
        { type: 'doc', id: 'archived-repositories', label: 'Archived Repositories' },
      ],
    },
    {
      type: 'category',
      label: 'Architecture Decision Records',
      link: {
        type: 'generated-index',
        slug: '/adr',
        title: 'Architecture Decision Records',
        description:
          'Immutable decision records for Next Injective Git. The original English files in docs/adr are the single source of truth; localized copies are informational translations only.',
      },
      items: [
        { type: 'doc', id: 'adr/evm-v2-runtime-and-migration-scope', label: 'ADR 0001 · EVM v2 Runtime and Migration Scope' },
        { type: 'doc', id: 'adr/pluggable-pack-storage', label: 'ADR 0002 · Pluggable Pack Storage' },
        { type: 'doc', id: 'adr/fresh-evm-suite-and-v1-archive-preview', label: 'ADR 0003 · Fresh EVM Suite and V1 Archive Preview' },
        { type: 'doc', id: 'adr/mainnet-storage-neutral-successor-and-byos-scope', label: 'ADR 0004 · Mainnet Storage-Neutral Successor and BYOS Scope' },
        { type: 'doc', id: 'adr/incremental-packs-via-manifest-schema-2', label: 'ADR 0005 · Incremental Packs via Manifest Schema 2' },
      ],
    },
    {
      type: 'category',
      label: 'Migration History',
      items: [
        { type: 'doc', id: 'evm-v2-migration', label: 'EVM v2 Migration Guide' },
        { type: 'doc', id: 'target-topology-migration', label: 'Target Topology Migration' },
        { type: 'doc', id: 'a11-storage-indexer-v2', label: 'A11 Storage Indexer v2' },
        { type: 'doc', id: 'evm-v2-repo-identity', label: 'EVM v2 Repo Identity' },
        { type: 'doc', id: 'reconciliation-baseline-2026-09-12', label: 'Reconciliation Baseline (2026-09-12)' },
        { type: 'doc', id: 'p0-evidence', label: 'P0 Evidence' },
        { type: 'doc', id: 'evm-v2-repair-plan', label: 'EVM v2 Repair Plan' },
        { type: 'doc', id: 'evm-v2-handoff', label: 'EVM v2 Handoff' },
      ],
    },
    {
      type: 'category',
      label: 'Verification',
      items: [
        { type: 'doc', id: 'keplr-acceptance', label: 'Keplr Acceptance' },
        { type: 'doc', id: 'e2e-verification-summary', label: 'E2E Verification Summary' },
        { type: 'doc', id: 'e2e-visual-verification-report', label: 'E2E Visual Verification Report' },
      ],
    },
    {
      type: 'category',
      label: 'Web & UI',
      items: [
        { type: 'doc', id: 'frontend-improvement-analysis', label: 'Frontend Improvement Analysis' },
        { type: 'doc', id: 'gogs-frontend-redesign', label: 'Gogs Frontend Redesign' },
        { type: 'doc', id: 'web-repository-search-draft', label: 'Web Repository Search Draft' },
      ],
    },
    {
      type: 'category',
      label: 'Working Notes (historical)',
      items: [
        { type: 'doc', id: 'liveagent-evm-v2-context', label: 'LiveAgent EVM v2 Context' },
        { type: 'doc', id: 'liveagent-continuation-2026-09-20', label: 'LiveAgent Continuation (2026-09-20)' },
        { type: 'doc', id: 'PRIORITY-MAPPING', label: 'Priority Mapping' },
        { type: 'doc', id: 'prompts/next-storage-implementation', label: 'Prompt · Next Storage Implementation (S01–S03)' },
        { type: 'doc', id: 'prompts/s04-s05-successor-integration', label: 'Prompt · S04/S05 Successor Integration' },
        { type: 'doc', id: 'prompts/storage-byos-hands-on-validation', label: 'Prompt · BYOS Hands-on Validation' },
      ],
    },
  ],
};

module.exports = sidebars;
