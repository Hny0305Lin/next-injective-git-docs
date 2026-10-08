# iGit Protocol and Contract Reference

Source repository: `next-injective-git` (branch `dev`).
Scope: the immutable EVM contract suite (Suite v3), the storage-neutral successor (Suite v4 / BYOS), and the client-side protocol rules that published developer documentation must state accurately.

> **Evidence rule.** Every Solidity identifier, field name, struct member, constant and status label in this document was read directly from the referenced source file. Where the source is silent, this document says so explicitly instead of inferring. Status labels `PASS`, `FAIL`, `BLOCKED`, `NOT PROVEN` and `HISTORICAL` are preserved verbatim from the repository's own status documents.

---

## 0. Repository layout

| Path | Contents |
|---|---|
| `contracts/evm-v2/` | Suite v3 — nine Solidity contracts, `foundry.toml`, checked-in `abi/`, `artifacts/`, `out/`, `test/SuiteArchitecture.t.sol` |
| `contracts/evm-v2-successor/` | Suite v4 — BYOS successor; evolved `RepositoryCore.sol` plus byte-identical copies of the other eight sources |
| `docs/storage-byos.md` | BYOS implementation specification (Chinese, with English status header) |
| `docs/adr/0002-pluggable-pack-storage.md` | Pack storage pluggability decision (2026-08-14) |
| `docs/adr/0004-mainnet-storage-neutral-successor-and-byos-scope.md` | Confirmed first-release scope: successor + AWS/R2 BYOS |
| `docs/adr/0005-incremental-packs-via-manifest-schema-2.md` | Manifest schema 2 incremental packs (2026-10-05) |
| `docs/evm-wallet-compatibility.md` | Wallet discovery, chain `1439`, legacy type-0 transaction contract |
| `docs/feegrant-policy.md` | Gas sponsorship status and minimum gas price |
| `docs/suite-version-compatibility.md` | On-chain version dispatch matrix (v1…v5+) |
| `docs/roadmap-byos-providers.md` | Mainland-China S3-compatible provider candidates — **roadmap only** |
| `docs/glossary.md` | Terminology boundaries, including the six provider candidates |

The v3 sources, ABIs, artifacts and deployment evidence under `contracts/evm-v2` are described as **untouched** by the successor work; both suites coexist behind on-chain version dispatch.

---

## 1. The nine contracts

### 1.1 Classification

Source: `contracts/evm-v2/README.md` and `contracts/evm-v2/src/suite/ISuite.sol`.

**Infrastructure contracts (2)** — they are *not* members of `SuiteIds` and are not part of the seven-module activation loop:

- `SuiteDirectory`
- `BootstrapCoordinator`

**Production modules (7)** — required modules, each identified by a `SuiteIds` constant and each returning its id from `moduleId()`:

| Module | `SuiteIds` constant | `keccak256` preimage |
|---|---|---|
| `RepositoryCore` | `SuiteIds.CORE` | `"igit.module.repository-core"` |
| `RecoveryModule` | `SuiteIds.RECOVERY` | `"igit.module.recovery"` |
| `ModerationModule` | `SuiteIds.MODERATION` | `"igit.module.moderation"` |
| `EconomicModule` | `SuiteIds.ECONOMIC` | `"igit.module.economic"` |
| `UsernameModule` | `SuiteIds.USERNAME` | `"igit.module.username"` |
| `BadgeModule` | `SuiteIds.BADGE` | `"igit.module.badge"` |
| `ReleaseModule` | `SuiteIds.RELEASE` | `"igit.module.release"` |

`SuiteIds.REQUIRED_MODULES = 7`.

All seven production modules inherit `SuiteModule` (`src/suite/SuiteModule.sol`), an `abstract contract SuiteModule is IBootstrapModule` that supplies shared bootstrap state and the two access modifiers used throughout.

### 1.2 Shared module base — `SuiteModule`

```solidity
abstract contract SuiteModule is IBootstrapModule {
    uint256 public constant MAX_IMPORT_BATCH_ITEMS = 128;
    uint256 public constant MAX_IMPORT_PAYLOAD_BYTES = 96_000;

    address public immutable override suiteDirectory;
    address public immutable override bootstrapCoordinator;

    bool public bootstrapStarted;
    bool public override bootstrapFinalized;
    uint256 public expectedImportCount;
    uint256 public expectedImportBatches;
    uint256 public importedCount;
    uint256 public nextImportSequence;
    bytes32 public expectedImportRoot;
    bytes32 public rollingImportRoot;
```

Modifiers: `onlyBootstrap` (reverts `UnauthorizedBootstrap` unless `msg.sender == bootstrapCoordinator`) and `onlyActiveSuite` (reverts `SuiteNotActive` unless `ISuiteDirectory(suiteDirectory).state() == 1`).

Bootstrap lifecycle functions: `beginBootstrap(uint256 expectedCount, uint256 expectedBatches, bytes32 expectedRoot, bytes32 snapshotRoot)`, `bootstrapImport(uint256 sequence, uint256 count, bytes32 payloadHash, bytes calldata payload)`, `finalizeBootstrap()`.

Rolling commitment fold (identical shape in both `SuiteModule` and `BootstrapCoordinator`):

```solidity
rollingImportRoot = keccak256(
    abi.encode(rollingImportRoot, moduleId(), sequence, count, payloadHash)
);
```

Initial fold: `keccak256(abi.encode(moduleId(), snapshotRoot))`. `finalizeBootstrap()` calls the virtual hook `_beforeBootstrapFinalized()` (overridden only by `UsernameModule`).

---

### 1.3 `SuiteDirectory` — infrastructure

**Responsibility.** Single immutable trust root. Holds the active/bootstrapping state machine, the configured chain ID, the snapshot root, the module address/code-hash registry, and exposes `verifyModule`.

**Key state** (`src/SuiteDirectory.sol`):

```solidity
uint64 public constant suiteVersion = 3;          // 4 in the successor
enum State { Bootstrapping, Active }
State public state;
uint256 public immutable configuredChainId;
bytes32 public immutable snapshotRoot;
address public bootstrapAuthority;
address public bootstrapCoordinator;
bytes32 public bootstrapCoordinatorCodeHash;
mapping(bytes32 id => address module) public moduleAddress;
mapping(bytes32 id => bytes32 codeHash) public moduleCodeHash;
uint256 public registeredModuleCount;
```

**Constructor:** `constructor(address authority, uint256 chainId, bytes32 snapshotRoot_)`. Reverts `InvalidBootstrapAuthority` on zero authority, `InvalidChainId(chainId, block.chainid)` when `chainId == 0 || chainId != block.chainid`, and `InvalidSnapshotRoot` on a zero root. Note that the chain ID is checked at construction time *and* again at activation.

**Public/external functions:**

| Function | Signature | Notes |
|---|---|---|
| `setBootstrapCoordinator` | `setBootstrapCoordinator(address coordinator, bytes32 expectedCodeHash) external` | One-shot; clears `bootstrapAuthority` |
| `configureModule` | `configureModule(bytes32 id, address module, bytes32 expectedCodeHash) external` | Callable only by `bootstrapCoordinator`; one-shot per id |
| `activate` | `activate() external` | Callable only by `bootstrapCoordinator` |
| `requiredModuleAt` | `requiredModuleAt(uint256 index) public pure returns (bytes32)` | Fixed index → id map |
| `verifyModule` | `verifyModule(bytes32 id) external view returns (bool)` | Full binding + code-hash re-check |

**Events:** `CoordinatorConfigured(address indexed coordinator, bytes32 indexed codeHash)`, `ModuleConfigured(bytes32 indexed id, address indexed module, bytes32 indexed codeHash)`, `SuiteActivated(uint64 indexed version, uint256 indexed chainId, bytes32 indexed snapshotRoot)`.

**Errors:** `InvalidBootstrapAuthority()`, `InvalidChainId(uint256 configured, uint256 actual)`, `InvalidSnapshotRoot()`, `Unauthorized(address caller)`, `DirectoryAlreadyActive()`, `CoordinatorAlreadyConfigured()`, `InvalidCoordinator()`, `InvalidModuleId(bytes32 id)`, `ModuleAlreadyConfigured(bytes32 id)`, `InvalidModule(address module)`, `CodeHashMismatch(bytes32 expected, bytes32 actual)`, `ModuleBindingMismatch(bytes32 id, address module)`, `MissingModule(bytes32 id)`, `CoordinatorNotReady()`.

---

### 1.4 `BootstrapCoordinator` — infrastructure

**Responsibility.** Binds one snapshot root, registers each module into the Directory with its runtime code hash, imports modules in a fixed order under strict sequence/count/root accounting and a module-local rolling commitment, enforces the Username escrow attestation, and finally activates the Directory.

**Key state** (`src/BootstrapCoordinator.sol`):

```solidity
struct ModuleProgress {
    bool started;
    bool finalized;
    uint256 expectedCount;
    uint256 expectedBatches;
    uint256 importedCount;
    uint256 nextSequence;
    bytes32 expectedRoot;
    bytes32 rollingRoot;
}

address public immutable suiteDirectory;
bytes32 public immutable snapshotRoot;
address public immutable operator;
uint256 public nextModuleIndex;
bytes32 public usernameEscrowEvidenceHash;
bool public activated;

mapping(bytes32 id => ModuleProgress progress) public moduleProgress;
```

All state-changing functions are `onlyOperator`:

| Function | Signature |
|---|---|
| `registerModule` | `registerModule(bytes32 id, address module, bytes32 codeHash) external` |
| `beginNextModule` | `beginNextModule(bytes32 id, uint256 expectedCount, uint256 expectedBatches, bytes32 expectedRoot) external` |
| `importBatch` | `importBatch(bytes32 id, uint256 sequence, uint256 count, bytes32 payloadHash, bytes calldata payload) external` |
| `finalizeCurrentModule` | `finalizeCurrentModule(bytes32 id) external` |
| `attestUsernameEscrowReleased` | `attestUsernameEscrowReleased(bytes32 evidenceHash) external` |
| `activateSuite` | `activateSuite() external` |
| `readyForActivation` | `readyForActivation() public view returns (bool)` |

The operator modifier also blocks post-activation use:

```solidity
modifier onlyOperator() {
    if (msg.sender != operator) revert Unauthorized(msg.sender);
    if (activated) revert SuiteAlreadyActivated();
    _;
}
```

`readyForActivation()` is:

```solidity
return !activated && nextModuleIndex == SuiteIds.REQUIRED_MODULES
    && usernameEscrowEvidenceHash != bytes32(0);
```

**Events:** `ModuleRegistered`, `ModuleImportStarted`, `ModuleBatchImported`, `ModuleImportFinalized`, `UsernameEscrowReleaseAttested`, `SuiteActivationRequested`.

---

### 1.5 `RepositoryCore` — production module

**Responsibility.** Stable repository identity, locators and aliases, metadata, refs, collaborators, bounded forks, timelocked ownership transfers, and the Recovery-only ownership capability.

**Constants:**

```solidity
uint256 public constant MAX_NAME_LENGTH = 64;
uint256 public constant MAX_DESCRIPTION_LENGTH = 1024;
uint256 public constant MAX_REF_NAME_LENGTH = 256;
uint256 public constant MAX_PACK_URIS = 128;
uint256 public constant MAX_PACK_URI_LENGTH = 512;
uint256 public constant MAX_REFS_PER_REPO = 1024;
uint256 public constant MAX_COLLABORATORS_PER_REPO = 256;
uint256 public constant MAX_FORK_REFS = 64;
uint256 public constant MAX_QUERY_PAGE_SIZE = 64;
uint64 public constant OWNERSHIP_TRANSFER_DELAY = 7 days;
uint64 public constant OWNERSHIP_TRANSFER_WINDOW = 30 days;

enum Role { None, Maintainer, Reader }
```

**Ref struct (v3):** see §3.

**Key public/external functions:**

| Function | Signature |
|---|---|
| `createRepository` | `createRepository(string calldata name, string calldata description, string calldata defaultBranch) external onlyActiveSuite returns (bytes32 repoId)` |
| `forkRepository` | `forkRepository(bytes32 sourceRepoId, string calldata newName) external onlyActiveSuite returns (bytes32 forkId)` |
| `updateMetadata` | `updateMetadata(bytes32 repoId, bool updateDescription, string calldata description, bool updateDefaultBranch, string calldata defaultBranch) external onlyActiveSuite` |
| `updateRef` | `updateRef(bytes32 repoId, string calldata refName, string calldata commitSha, string[] calldata packUris, string calldata expectedSha, bool force) external onlyActiveSuite` |
| `deleteRef` | `deleteRef(bytes32 repoId, string calldata refName) external onlyActiveSuite` |
| `setCollaborator` | `setCollaborator(bytes32 repoId, address account, Role role) external onlyActiveSuite` |
| `beginOwnershipTransfer` | `beginOwnershipTransfer(bytes32 repoId, address newOwner) external onlyActiveSuite` |
| `cancelOwnershipTransfer` | `cancelOwnershipTransfer(bytes32 repoId) external onlyActiveSuite` |
| `acceptOwnershipTransfer` | `acceptOwnershipTransfer(bytes32 repoId) external onlyActiveSuite` |
| `expireOwnershipTransfer` | `expireOwnershipTransfer(bytes32 repoId) external onlyActiveSuite` |
| `recoverOwnership` | `recoverOwnership(bytes32 repoId, address newOwner) external onlyActiveSuite` |
| `getRepository` | `getRepository(bytes32 repoId) external view returns (Repository memory)` |
| `resolveRepository` | `resolveRepository(address owner, string calldata name) external view returns (Repository memory repository, bool canonical)` |
| `getRef` | `getRef(bytes32 repoId, string calldata refName) external view returns (GitRef memory)` |
| `listRepositoriesPage` | `listRepositoriesPage(address owner, uint256 cursor, uint256 limit) external view returns (Repository[] memory page, uint256 nextCursor)` |
| `listRefsPage` | `listRefsPage(bytes32 repoId, uint256 cursor, uint256 limit) external view returns (string[] memory names, GitRef[] memory refs, uint256 nextCursor)` |
| `listCollaboratorsPage` | `listCollaboratorsPage(bytes32 repoId, uint256 cursor, uint256 limit) external view returns (address[] memory accounts, Role[] memory roles, uint256 nextCursor)` |
| `collaboratorRole` | `collaboratorRole(bytes32 repoId, address account) external view returns (Role)` |
| `pendingOwnershipTransfer` | `pendingOwnershipTransfer(bytes32 repoId) external view returns (PendingOwnershipTransfer memory)` |
| `canMaintain` | `canMaintain(bytes32 repoId, address actor) external view returns (bool)` |

**Repository id derivation (v3 and v4 use the same preimage string):**

```solidity
repoId = keccak256(abi.encode("igit:suite:v3:repo", block.chainid, suiteDirectory, msg.sender, name));
```

Locator: `keccak256(abi.encode(owner, name))`.

**Validation rules enforced on-chain:**

- Repository name: 1–64 bytes, ASCII `[a-zA-Z0-9._-]` only.
- Ref name: 5–256 bytes and must begin with the literal `refs/` (assembly prefix comparison against `0x726566732f`); bytes 5..n must be in `0x21..0x7e` and must not be `~`, `^`, `:`, `\`, nor contain `..`.
- Commit SHA: exactly 40 or 64 hex characters (`[0-9a-fA-F]`).
- Pack URI (v3): length > 7 and ≤ 512, and must begin with the literal `ipfs://` (assembly prefix comparison against `0x697066733a2f2f`). **HTTPS is not accepted by the v3 core.**
- Pages: `limit` must be non-zero and ≤ `MAX_QUERY_PAGE_SIZE` (64); `cursor` must be ≤ total.

**Events:** `RepositoryCreated`, `RepositoryMetadataUpdated`, `RefUpdated`, `RefDeleted`, `CollaboratorUpdated`, `OwnershipTransferStarted`, `OwnershipTransferCancelled`, `OwnershipTransferred`.

**Import kinds** accepted by `_importPayload`: `kind == 0` `ImportRepository[]`, `kind == 1` `ImportAlias[]`, `kind == 2` `ImportRef[]`, `kind == 3` `ImportCollaborator[]`; anything else reverts `InvalidImportKind(kind)`.

---

### 1.6 `RecoveryModule` — production module

**Responsibility.** Guardian configuration and timelocked, multi-approval ownership recovery. This is the only module that may call `RepositoryCore.recoverOwnership`.

**Constants and structs:**

```solidity
uint256 public constant MAX_GUARDIANS = 10;
uint64 public constant RECOVERY_DELAY = 7 days;
uint64 public constant RECOVERY_WINDOW = 30 days;

struct GuardianConfig { address configuredBy; uint8 threshold; address[] guardians; }
struct Proposal {
    address proposedBy; address newOwner;
    uint64 executeAfter; uint64 expiresAt;
    uint64 nonce; uint8 approvals;
}
struct ImportGuardianConfig { bytes32 repoId; address configuredBy; uint8 threshold; address[] guardians; }
```

| Function | Signature |
|---|---|
| `setGuardians` | `setGuardians(bytes32 repoId, address[] calldata guardians, uint8 threshold) external onlyActiveSuite` |
| `proposeRecovery` | `proposeRecovery(bytes32 repoId, address newOwner) external onlyActiveSuite` |
| `approveRecovery` | `approveRecovery(bytes32 repoId) external onlyActiveSuite` |
| `cancelRecovery` | `cancelRecovery(bytes32 repoId) external override onlyActiveSuite` |
| `executeRecovery` | `executeRecovery(bytes32 repoId) external onlyActiveSuite` |
| `guardianConfig` | `guardianConfig(bytes32 repoId) external view returns (GuardianConfig memory)` |
| `recoveryProposal` | `recoveryProposal(bytes32 repoId) external view returns (Proposal memory)` |
| `hasApproved` | `hasApproved(bytes32 repoId, uint64 nonce, address guardian) external view returns (bool)` |
| `hasPendingRecovery` | `hasPendingRecovery(bytes32 repoId) external view override returns (bool)` |

Guardian configuration is bound to the owner that configured it; a stale configuration (owner changed since configuration) reverts `GuardianConfigStale(configuredBy, currentOwner)`. `executeRecovery` requires `msg.sender == proposal.newOwner`, the delay elapsed, the window not expired, and `proposal.approvals >= config.threshold`. `proposeRecovery` reverts `OwnershipTransferPending` if a Core ownership transfer is pending. `cancelRecovery` clears the configuration entirely when called by Core or Economic; otherwise only the owner or the proposed new owner may cancel the proposal.

**Events:** `GuardiansConfigured`, `RecoveryProposed`, `RecoveryApproved`, `RecoveryCancelled`, `RecoveryExecuted`.

---

### 1.7 `ModerationModule` — production module

**Responsibility.** Repository status, reports, appeals, action trails, and the **mandatory policy hooks** consumed by Core and Economic.

**Enums and structs:**

```solidity
enum RepoStatus { Active, Frozen, Delisted }
enum ReportStatus { Open, Resolved, Appealed, AppealResolved }
enum TrailAction { Submitted, Resolved, Appealed, AppealResolved, StatusSet }

struct Report {
    uint256 id; bytes32 repoId; address reporter;
    ReportStatus status; RepoStatus resolution;
    string reasonHash; uint64 createdAt; uint64 updatedAt; bool exists;
}
struct TrailEntry { TrailAction action; address actor; RepoStatus status; string reasonHash; uint64 timestamp; }
struct StatusTrailEntry { RepoStatus status; address actor; string reasonHash; uint64 timestamp; uint256 reportId; }
```

**Constants and state:** `MAX_REASON_LENGTH = 128`, `MAX_QUERY_PAGE_SIZE = 64`, `address public immutable admin`, `address public committee`, `uint256 public nextReportId = 1`.

**Policy hooks (the interface Core and Economic call):**

```solidity
function requireRefMutation(bytes32 repoId, address) external view override;   // reverts RepositoryFrozen if Frozen
function requireEconomicAction(bytes32 repoId, address) external view override; // reverts RepositoryFrozen if Frozen
function requireFork(bytes32 repoId, address) external view override;           // _requireActiveRepository
function requireBadgeAward(bytes32 repoId, address) external view override;     // _requireActiveRepository
```

`requireFork` and `requireBadgeAward` call `_requireActiveRepository`, which reverts `RepositoryNotActive(repoId, status)` for any status other than `Active`. `requireRefMutation` and `requireEconomicAction` revert only on `Frozen` — a `Delisted` repository can still mutate refs.

| Function | Signature |
|---|---|
| `setCommittee` | `setCommittee(address newCommittee) external onlyActiveSuite` (admin only) |
| `setRepositoryStatus` | `setRepositoryStatus(bytes32 repoId, RepoStatus status, string calldata reasonHash) external onlyActiveSuite onlyCommittee` |
| `submitReport` | `submitReport(bytes32 repoId, string calldata reasonHash) external onlyActiveSuite returns (uint256 reportId)` |
| `resolveReport` | `resolveReport(uint256 reportId, RepoStatus status, string calldata reasonHash) external onlyActiveSuite onlyCommittee` |
| `appealReport` | `appealReport(uint256 reportId, string calldata reasonHash) external onlyActiveSuite` (repository owner only) |
| `resolveAppeal` | `resolveAppeal(uint256 reportId, RepoStatus status, string calldata reasonHash) external onlyActiveSuite onlyCommittee` |
| `effectiveStatus` | `effectiveStatus(bytes32 repoId) external view returns (RepoStatus)` |
| `getReport` | `getReport(uint256 reportId) external view returns (Report memory)` |
| `reportCommitments` | `reportCommitments(uint256 reportId) external view returns (string memory reasonHash, string memory resolutionHash, string memory appealHash)` |
| `listReportTrailPage` | `listReportTrailPage(uint256 reportId, uint256 cursor, uint256 limit) external view returns (TrailEntry[] memory page, uint256 nextCursor)` |
| `listReportsByRepositoryPage` | `listReportsByRepositoryPage(bytes32 repoId, uint256 cursor, uint256 limit) external view returns (Report[] memory page, uint256 nextCursor)` |
| `listRepositoryStatusTrailPage` | `listRepositoryStatusTrailPage(bytes32 repoId, uint256 cursor, uint256 limit) external view returns (StatusTrailEntry[] memory page, uint256 nextCursor)` |

---

### 1.8 `EconomicModule` — production module

**Responsibility.** Native INJ sponsorship, revenue splits, platform fee, treasury settlement, and queryable migrated totals per historical denom. The contract never fetches off-chain bytes and handles only the native coin.

**Constants and structs:**

```solidity
uint16 public constant MAX_PLATFORM_FEE_BPS = 500;   // 5%
uint256 public constant MAX_SPLIT_RECIPIENTS = 20;
uint256 public constant MAX_MESSAGE_LENGTH = 256;
uint256 public constant MAX_DENOM_LENGTH = 128;

struct Split { address payable recipient; uint16 bps; }
struct ImportSplits { bytes32 repoId; Split[] splits; }
struct ImportTotal { bytes32 repoId; string denom; uint256 amount; }
```

State: `address public immutable admin`, `address payable public treasury`, `uint16 public platformFeeBps`, and a private reentrancy lock `_settlementLock = 1`.

| Function | Signature |
|---|---|
| `setRevenueSplits` | `setRevenueSplits(bytes32 repoId, address payable[] calldata recipients, uint16[] calldata bps) external onlyActiveSuite` |
| `sponsor` | `sponsor(bytes32 repoId, string calldata message) external payable onlyActiveSuite` |
| `setFeeConfig` | `setFeeConfig(address payable newTreasury, uint16 newPlatformFeeBps) external onlyActiveSuite` (admin only) |
| `clearRevenueSplitsOnOwnershipTransfer` | `clearRevenueSplitsOnOwnershipTransfer(bytes32 repoId) external override onlyActiveSuite` (Core only) |
| `revenueSplits` | `revenueSplits(bytes32 repoId) external view returns (Split[] memory)` |
| `sponsorTotal` | `sponsorTotal(bytes32 repoId, string calldata denom) external view returns (uint256)` |
| `sponsorDenoms` | `sponsorDenoms(bytes32 repoId) external view returns (string[] memory)` |

`sponsor` calls `IModerationPolicy(moderation).requireEconomicAction(repoId, msg.sender)`, adds to the `"inj"` total, computes `fee = (msg.value * platformFeeBps) / 10_000`, distributes each split as `(distributable * bps) / 10_000`, and pays the remainder to `repository.owner`. The owner may not be a split recipient (`OwnerCannotReceiveRevenueSplit`); total bps may not exceed `10_000`.

`clearRevenueSplitsOnOwnershipTransfer` is callable only by the Core module, deletes the splits, and then calls `IRecoveryOwnershipHook(recovery).cancelRecovery(repoId)` — meaning an ownership change clears revenue splits **and** any pending recovery.

---

### 1.9 `UsernameModule` — production module

**Responsibility.** Reserved names and limited original-owner claims, without migrating V1 escrow liabilities.

```solidity
uint64 public constant ORIGINAL_OWNER_CLAIM_WINDOW = 90 days;
uint256 public constant MAX_USERNAME_LENGTH = 32;
uint256 public constant MAX_RESERVED_USERNAMES = 128;

struct UsernameRecord { address owner; uint64 registeredAt; }
struct ImportOriginalOwner { string name; address owner; }
```

State: `address public immutable policyAdmin`, `uint64 public originalOwnerClaimDeadline`, `uint256 public reservedUsernameCount`.

| Function | Signature |
|---|---|
| `registerUsername` | `registerUsername(string calldata name) external onlyActiveSuite` |
| `claimOriginalUsername` | `claimOriginalUsername(string calldata name) external onlyActiveSuite` |
| `releaseUsername` | `releaseUsername() external onlyActiveSuite` |
| `setReserved` | `setReserved(string calldata name, bool reserved) external onlyActiveSuite` (policy admin only) |
| `resolveUsername` | `resolveUsername(string calldata name) external view returns (UsernameRecord memory)` |
| `usernameOf` | `usernameOf(address owner) external view returns (string memory)` |
| `originalOwnerOf` | `originalOwnerOf(string calldata name) external view returns (address)` |
| `isReserved` | `isReserved(string calldata name) external view returns (bool)` |

Name rules (`_validateAndHash`): 3–32 bytes; lowercase `[a-z0-9-]` only; may not begin or end with `-`; and must not begin with the four-character prefix `inj1`. The original-owner claim window opens during `_beforeBootstrapFinalized()`, which sets `originalOwnerClaimDeadline = block.timestamp + ORIGINAL_OWNER_CLAIM_WINDOW` and emits `OriginalOwnerClaimWindowOpened`.

---

### 1.10 `BadgeModule` — production module

**Responsibility.** Non-transferable badges with recipient-indexed and repository-indexed pagination.

```solidity
uint256 public constant MAX_REASON_LENGTH = 256;
uint256 public constant MAX_QUERY_PAGE_SIZE = 64;

struct Badge {
    uint256 id; bytes32 repoId; address recipient;
    address awardedBy; string reason; uint64 awardedAt; bool exists;
}
uint256 public nextBadgeId = 1;
```

| Function | Signature |
|---|---|
| `awardBadge` | `awardBadge(bytes32 repoId, address recipient, string calldata reason) external onlyActiveSuite returns (uint256 badgeId)` |
| `getBadge` | `getBadge(uint256 badgeId) external view returns (Badge memory)` |
| `listBadgesByRecipientPage` | `listBadgesByRecipientPage(address recipient, uint256 cursor, uint256 limit) external view returns (Badge[] memory page, uint256 nextCursor)` |
| `listBadgesByRepositoryPage` | `listBadgesByRepositoryPage(bytes32 repoId, uint256 cursor, uint256 limit) external view returns (Badge[] memory page, uint256 nextCursor)` |

`awardBadge` is owner-only, calls `IModerationPolicy(_moderation()).requireBadgeAward(repoId, msg.sender)`, rejects a zero recipient, rejects the repository owner as recipient (`OwnerCannotReceiveBadge`), and requires a reason of 1–256 bytes.

The source does not implement `transferFrom`, `safeTransferFrom` or any ERC-721/ERC-1155 surface: badges are recorded as struct entries, not as transferable tokens.

---

### 1.11 `ReleaseModule` — production module

**Responsibility.** Immutable `(version, platform) -> sha256` records.

```solidity
uint256 public constant MAX_VERSION_LENGTH = 64;
uint256 public constant MAX_PLATFORM_LENGTH = 64;
uint256 public constant MAX_QUERY_PAGE_SIZE = 64;

struct Artifact {
    string version; string platform; bytes32 sha256;
    address registeredBy; uint64 registeredAt; bool exists;
}
address public immutable releaseAuthority;
```

| Function | Signature |
|---|---|
| `registerArtifact` | `registerArtifact(string calldata version, string calldata platform, bytes32 digest) external onlyActiveSuite` (release authority only) |
| `getArtifact` | `getArtifact(string calldata version, string calldata platform) external view returns (Artifact memory)` |
| `listArtifactsPage` | `listArtifactsPage(string calldata version, uint256 cursor, uint256 limit) external view returns (Artifact[] memory page, uint256 nextCursor)` |

Key derivation: `keccak256(abi.encode(version, platform))`. Version/platform tokens are 1–64 bytes from `[a-zA-Z0-9._-]`. A zero digest reverts `InvalidSHA256()`, and re-registering an existing key reverts `ArtifactAlreadyRegistered(version, platform)`.

---

## 2. `SuiteDirectory` verification chain

This section states **exactly what a client verifies before performing reads or writes.**

### 2.1 On-chain primitives quoted from the source

From `src/suite/ISuite.sol`:

```solidity
interface ISuiteDirectory {
    function state() external view returns (uint8);
    function suiteVersion() external view returns (uint64);
    function configuredChainId() external view returns (uint256);
    function snapshotRoot() external view returns (bytes32);
    function bootstrapCoordinator() external view returns (address);
    function moduleAddress(bytes32 id) external view returns (address);
    function moduleCodeHash(bytes32 id) external view returns (bytes32);
}

interface ISuiteBound {
    function suiteDirectory() external view returns (address);
    function bootstrapCoordinator() external view returns (address);
    function moduleId() external pure returns (bytes32);
}
```

The Directory's own `verifyModule(bytes32 id)` re-checks the whole binding in one call:

```solidity
function verifyModule(bytes32 id) external view returns (bool) {
    address module = moduleAddress[id];
    return module != address(0) && module.code.length != 0 && module.codehash == moduleCodeHash[id]
        && ISuiteBound(module).suiteDirectory() == address(this)
        && ISuiteBound(module).bootstrapCoordinator() == bootstrapCoordinator
        && ISuiteBound(module).moduleId() == id;
}
```

Also exposed and used by clients: `bootstrapCoordinatorCodeHash` (public state variable) and `registeredModuleCount` (public state variable).

### 2.2 Client verification steps (`web/src/lib/transport.ts`, `verifySuiteNow`)

In order, the Web client:

1. Resolves the configured `SuiteDirectory` address (`requireDirectory`); an invalid address raises `SuiteConfigurationError`.
2. Calls `eth_chainId` and `eth_blockNumber`, pinning a single `blockTag` used for every subsequent read (a consistent-snapshot read).
3. Fails if the RPC chain ID does not equal the profile's `evmChainId`.
4. Calls `eth_getCode` on the Directory at that block; `"0x"` fails with *"SuiteDirectory has no code"*.
5. Reads `state`, `suiteVersion`, `configuredChainId`, `snapshotRoot`, `bootstrapCoordinator`, `bootstrapCoordinatorCodeHash`, `registeredModuleCount`.
6. Requires `Number(state) === 1` — i.e. `State.Active`.
7. Requires `suiteVersion >= 3n`. Versions 3 and 4 are documented as fully tested; unknown future versions (5+) pass verification and are read through the latest known ABI fallback with a warning.
8. Requires `configuredChainId == cfg.evmChainId`.
9. Requires `registeredModuleCount == MODULE_KEYS.length` (7).
10. Requires the coordinator address to be non-zero, then calls `eth_getCode` on the coordinator and requires `keccak256(coordinatorCode) == bootstrapCoordinatorCodeHash`.
11. For each of the seven module keys, in parallel:
    - reads `moduleAddress(id)`, `moduleCodeHash(id)` and `verifyModule(id)`;
    - rejects a zero/invalid module address;
    - requires `verifyModule(id) === true`;
    - calls `eth_getCode` on the module and requires `keccak256(code) == moduleCodeHash(id)`;
    - reads `suiteDirectory()`, `bootstrapCoordinator()`, `moduleId()` **directly on the module** and requires all three to match the Directory address, the normalized coordinator address, and the expected module id.

Only after all of this does it return a `SuiteBinding { directory, coordinator, snapshotRoot, blockTag, version, modules, codeHashes }`. Results are cached for `VERIFY_TTL_MS = 30_000` ms with in-flight de-duplication; `clearSuiteCache()` empties both caches. Reads go through `readModule(...)`, which uses `suite.blockTag` so reads and writes share one verified view. `readSuiteVersion(cfg, address, blockTag)` exists to probe the on-chain version of a candidate Directory address.

Wallet connection is deliberately **independent** of this verification: connecting a wallet does not require a verified Suite, but no write proceeds without one, and repository reads/writes "continue to fail closed when the Suite is not configured or does not verify" (`docs/evm-wallet-compatibility.md`).

### 2.3 One-shot configuration and activation semantics

- **Constructor-time pinning.** `configuredChainId` and `snapshotRoot` are `immutable`. The constructor requires `chainId != 0 && chainId == block.chainid` and a non-zero `snapshotRoot`.
- **Coordinator configured exactly once.** `setBootstrapCoordinator` reverts `CoordinatorAlreadyConfigured()` if `bootstrapCoordinator != address(0)`. It requires the caller to be `bootstrapAuthority`, the coordinator to have code, `expectedCodeHash != 0` and `coordinator.codehash == expectedCodeHash` (`CodeHashMismatch` otherwise), and it cross-calls the coordinator for `suiteDirectory() == address(this)` and `snapshotRoot() == snapshotRoot`. On success it **zeroes `bootstrapAuthority`**, permanently removing the ability to ever set a coordinator again.
- **Modules configured exactly once each.** `configureModule` reverts `ModuleAlreadyConfigured(id)` if `moduleAddress[id] != address(0)`, rejects non-required ids (`InvalidModuleId`), requires a contract with code, requires the code hash to match, and requires the on-module `suiteDirectory()` / `bootstrapCoordinator()` / `moduleId()` bindings to match exactly (`ModuleBindingMismatch`).
- **Activation is atomic and permanent.** `activate()` reverts `DirectoryAlreadyActive()` unless `state == State.Bootstrapping`; it re-checks `block.chainid == configuredChainId`; it loops `i < SuiteIds.REQUIRED_MODULES` requiring each module to be present (`MissingModule`), to still match its recorded `moduleCodeHash` (`CodeHashMismatch`), and to report `bootstrapFinalized() == true` (`CoordinatorNotReady`); it finally requires `IBootstrapCoordinator(bootstrapCoordinator).readyForActivation()`. Only then does it set `state = State.Active` and emit `SuiteActivated`.
- **There is no code path back to `Bootstrapping`.** No deactivate, no module re-registration, no coordinator replacement, no code-hash update exists in the source. The README states module addresses and runtime code hashes "are configured once and frozen when the directory becomes active."
- **Ordering is enforced independently by the coordinator.** `BootstrapCoordinator` advances a single `nextModuleIndex`; `beginNextModule`, `importBatch` and `finalizeCurrentModule` all call `requiredModuleAt(nextModuleIndex)` and revert `ModuleOrderMismatch(expected, actual)` on any deviation. `finalizeCurrentModule` requires exact count, exact batch count, and an exact rolling-root match, and for `SuiteIds.USERNAME` additionally requires `usernameEscrowEvidenceHash != bytes32(0)`.

---

## 3. Suite v3 vs Suite v4 ref shape

### 3.1 Suite v3 — `contracts/evm-v2/src/RepositoryCore.sol`

```solidity
struct GitRef {
    string commitSha;
    string[] packUris;
    uint64 updatedAt;
    address updatedBy;
    bool exists;
}
```

- `commitSha` is a 40- or 64-character hex string.
- `packUris` is an ordered array of `ipfs://…` strings: 1..`MAX_PACK_URIS` (128) entries, each > 7 and ≤ `MAX_PACK_URI_LENGTH` (512) bytes, each required to begin with `ipfs://`.
- Update signature: `updateRef(bytes32 repoId, string calldata refName, string calldata commitSha, string[] calldata packUris, string calldata expectedSha, bool force)`.
- Concurrency control is `expectedSha` compared against the stored `commitSha`. With `force == false` and an existing ref, a mismatch reverts `ShaMismatch(expectedSha, target.commitSha)`. See §7 for the v3 specific caveat.
- When `force` is false and the ref already has pack URIs, new URIs are **merged** (append-if-absent) rather than replaced; when `force` is true, or the ref had no URIs, the array is replaced.
- `packUris.length == 0` reverts `TooManyPackUris(0, MAX_PACK_URIS)` — the error name is reused for the empty case.
- `deleteRef` performs a full `delete _refs[repoId][refId]` and removes the name from `_refNames` by swap-and-pop. There is no tombstone; the revision concept does not exist in v3.
- `forkRepository` copies every ref (`commitSha`, `packUris`, fresh `updatedAt`/`updatedBy`) up to `MAX_FORK_REFS` (64).

### 3.2 Suite v4 — `contracts/evm-v2-successor/src/RepositoryCore.sol`

```solidity
/// @notice Commitment-shaped ref state. `commitSha` is intentionally absent:
///         the commit OID lives inside the manifest and is bound by the
///         committed digest; it is still carried by RefUpdated events.
struct GitRef {
    bytes32 manifestDigest;   // SHA-256 of the canonical JCS manifest bytes
    uint96 manifestSize;      // 1..MANIFEST_MAX_SIZE
    string bootstrapLocator;  // https:// prefix, bounded length
    uint64 revision;          // monotonic from 1, never reset (also across delete)
    uint64 updatedAt;
    address updatedBy;
    bool exists;
}
```

Constants:

```solidity
uint96 public constant MANIFEST_MAX_SIZE = 65_536;  // 64 KiB
uint256 public constant MAX_LOCATOR_LENGTH = 512;
```

Removed relative to v3 (per the successor README and confirmed by the source): `packUris` storage and merge logic, `_validatePackUri`, `_contains`, `TooManyPackUris`, `ShaMismatch`, `MAX_PACK_URIS`, `MAX_PACK_URI_LENGTH`, `MAX_FORK_REFS` / `ForkTooLarge`.

**v4 update signature** (nine parameters; note the three new argument positions and the trailing `force`):

```solidity
function updateRef(
    bytes32 repoId,
    string calldata refName,
    string calldata commitSha,
    bytes32 manifestDigest,
    uint96 manifestSize,
    string calldata bootstrapLocator,
    uint64 expectedRevision,
    bytes32 expectedManifestDigest,
    bool force
) external onlyActiveSuite
```

**CAS contract**, documented in the NatSpec and implemented literally:

| Case | Required `(expectedRevision, expectedManifestDigest)` |
|---|---|
| Create | `(0, bytes32(0))` |
| Update | current `(revision, manifestDigest)` |
| Recreate after delete | the tombstone `revision` and the zero digest |

Mismatch reverts:

```solidity
error CommitmentMismatch(uint64 expectedRevision, bytes32 expectedDigest, uint64 actualRevision, bytes32 actualDigest);
```

On success: `target.revision = target.revision + 1`, then digest/size/locator are written. **`commitSha` is validated but never stored.**

**Delete is a tombstone**, not a removal: `target.exists = false`, `manifestDigest = bytes32(0)`, `manifestSize = 0`, `bootstrapLocator = ""`, `updatedAt`/`updatedBy` refreshed, and **`revision` deliberately preserved**. Consequently a replayed stale create fails, so delete/recreate cannot ABA.

**Events v2 carry the full ref name unindexed.** `indexed refId` (i.e. `keccak256(bytes(refName))`) is only the topic; `refName` is emitted as data so indexers can restore complete ref names:

```solidity
event RefUpdated(
    bytes32 indexed repoId, bytes32 indexed refId, address indexed updatedBy,
    string refName, string commitSha, bytes32 manifestDigest, uint96 manifestSize,
    string bootstrapLocator, uint64 revision
);
event RefDeleted(
    bytes32 indexed repoId, bytes32 indexed refId, address indexed deletedBy,
    string refName, uint64 revision
);
```

**Fork behaviour changed.** `forkRepository` copies **metadata only** and never copies ref commitments; the NatSpec requires the forker to publish a fresh manifest bound to the target repo/ref context through `updateRef`.

**Import changed.** `ImportRef` now carries the commitment fields and imports are written with `revision = 1`.

**Structural commitment validation** (the contract never resolves the locator or reads the manifest):

```solidity
function _validateCommitment(bytes32 digest, uint96 size, string memory locator) private pure {
    if (digest == bytes32(0)) revert InvalidManifestDigest(digest);
    if (size == 0 || size > MANIFEST_MAX_SIZE) revert InvalidManifestSize(size, MANIFEST_MAX_SIZE);
    bytes memory raw = bytes(locator);
    if (raw.length < 8 || raw.length > MAX_LOCATOR_LENGTH) revert InvalidBootstrapLocator(locator);
    uint256 prefix;
    assembly { prefix := shr(192, mload(add(raw, 32))) }
    if (prefix != 0x68747470733a2f2f) revert InvalidBootstrapLocator(locator);  // "https://"
}
```

### 3.3 Byte-identity between the suites (verified)

I computed SHA-256 over both trees. The following files in `contracts/evm-v2-successor/src` are **byte-identical** to their `contracts/evm-v2/src` counterparts:

`BadgeModule.sol`, `EconomicModule.sol`, `ModerationModule.sol`, `RecoveryModule.sol`, `ReleaseModule.sol`, `UsernameModule.sol`, `BootstrapCoordinator.sol`, `suite/ISuite.sol`, `suite/SuiteModule.sol`.

Only `SuiteDirectory.sol` differs, and the sole functional difference is the version constant: `uint64 public constant suiteVersion = 3;` becomes `= 4;` (the successor README calls this *"byte-identical to v3 except `suiteVersion = 4` (review candidate)"*). `RepositoryCore.sol` is **not** byte-related to v3.

Note that the v4 `RepositoryCore` still derives repository ids with the literal preimage `"igit:suite:v3:repo"`; this is what the source says and is therefore reproduced here without correction.

### 3.4 Version dispatch

`docs/suite-version-compatibility.md` is the stated single source of truth:

| Version | Ref shape on-chain | Pack retrieval |
|---|---|---|
| v1 | CosmWasm contract state | IPFS (historic), read-only archive |
| v2 | *(none deployed)* | — |
| v3 | `commitSha + packUris(string[])` | IPFS gateway, legacy path (frozen) |
| v4 | `manifestDigest + manifestSize + bootstrapLocator + revision` | BYOS (`aws-s3` / `cloudflare-r2`) |
| v5+ | Unknown | v4 ABI fallback + warning |

Rules R1–R6: the on-chain `suiteVersion()` is authoritative (R1); v3 and older use the IPFS path (R2); v4 uses the BYOS path (R3); v5+ is best-effort with the latest known ABI (R4); V1 CosmWasm is a separate read-only archive (R5); exactly one `SuiteDirectory` is configured at a time (R6).

---

## 4. The v4 BYOS manifest protocol

Source of truth: `docs/storage-byos.md` (specification), `docs/adr/0004-…`, `docs/adr/0005-…`.

### 4.1 Canonical JSON baseline

The encoding baseline is **RFC 8785 JCS** (<https://www.rfc-editor.org/rfc/rfc8785>). Required properties:

- UTF-8, no BOM, no extra newlines.
- Object keys sorted per JCS; **arrays keep protocol order**.
- Rejected: duplicate keys, invalid Unicode, `NaN`/`Infinity`, unknown/undefined fields or versions, trailing data, over-limit nesting.
- Bytes are length-limited first, then strictly parsed and checked against the canonical bytes; ordinary `JSON.parse` / `encoding/json` can silently accept duplicate keys and are explicitly not sufficient.
- No Unicode normalization is performed, so ref/string meaning is never altered.
- The spec warns that Go's default JSON serialization and a hand-written "sorted JSON.stringify" are **not** automatically JCS.

### 4.2 Field names (schema 1, frozen)

```text
PackManifest {
  schema: "igit.pack-manifest", schemaVersion: 1,
  chainId: decimal-string, suiteDirectory: lower-case-0x-address,
  repoId: lower-case-0x-bytes32, refName: full-ref-name,
  commit: { algorithm: "sha1" | "sha256", oid: lower-case-hex },
  packs: [ PackEntry, ... ]
}
PackEntry {
  sequence: safe-integer, sha256: 64-lower-case-hex, size: decimal-string,
  format: "git-pack", packVersion: safe-integer,
  thin: boolean, dependsOn: [pack-sha256, ...],
  locations: [ PackLocation, ... ]
}
ManifestCommitment { sha256, size, bootstrapLocator } // outside hashed body
```

Frozen details recorded in §9 of the specification:

- `commit.algorithm` currently accepts **`sha1` only**; `packVersion = 2`.
- All fields are **mandatory**; unknown fields, missing fields, `null`, duplicate keys (including after escape decoding), invalid UTF-8/Unicode, trailing data and non-canonical bytes are rejected.
- Only `dependsOn = []` and `thin = false` are usable in schema 1; pack `sequence` starts at 0 and increments contiguously; digests are unique; locations must not repeat within an entry either.
- Full ref names accept only `refs/heads/*` and `refs/tags/*`, UTF-8, at most 255 bytes, dangerous characters rejected per Git ref rules; **no Unicode normalization**.
- `chainId` is a positive decimal string with no leading zeros, up to `uint256`; `size` is a positive decimal string subject to the resource limits below.
- `suiteDirectory` is a lowercase `0x`-address; `repoId` is a lowercase `0x`-bytes32; `oid` is a non-zero lowercase SHA-1.

`PackLocation` is fixed as `{provider, url, reader}` with **all three fields present** and exactly one of `url` / `reader` non-empty:

- `provider` accepts only `aws-s3`, `cloudflare-r2`, `ipfs`.
- Cloud public locations use a stable HTTPS URL; authenticated independent locations use a local reader label of at most 64 characters, and the manifest stores no private bucket or secret.
- IPFS uses `ipfs://CID` with an empty reader; a CID is separate addressing information and **cannot substitute for the raw SHA-256**.
- The HTTPS grammar is limited to ASCII domains and ordinary path segments; userinfo, query, fragment, explicit port, percent-encoding, IP literals and dot paths are rejected. A custom public domain is allowed but must not be treated as an arbitrary write API endpoint.

`schemaVersion: 1` refers to the **manifest** schema only; it is neither Suite v1 nor a statement that the successor is v4.

### 4.3 Digest rules and object key convention

```text
packDigest     = SHA256(exact uploaded .pack bytes)
manifestBytes  = UTF8(JCS(PackManifest))
manifestDigest = SHA256(manifestBytes)
pack key       = <user-prefix>/packs/sha256/<64-lowercase-hex>.pack
manifest key   = <user-prefix>/manifests/sha256/<64-lowercase-hex>.json
```

- **`manifestDigest` is not placed inside the hashed manifest body**, which would be self-referential; it belongs to the returned envelope and the on-chain commitment. The manifest's own key/URL also stays outside. Pack `locations` *may* live inside the manifest because they do not depend on `manifestDigest`.
- Ephemeral credentials, verification receipts and provider timestamps never enter the canonical body.
- Keys are derived from a restricted prefix plus the digest; path traversal and non-canonical casing are rejected.
- Distinctions that must be preserved: Git OID, raw pack SHA-256, IPFS CID, S3 ETag/provider checksum and EVM Keccak topic are **different concepts**. A CID is affected by DAG/encoding and must not be treated as the raw pack SHA-256.
- **v3 has no on-chain raw SHA-256/size.** Locally re-hashing a download cannot manufacture a missing on-chain commitment; legacy readers must state their verification boundary.

### 4.4 Manifest schema 2 (incremental packs)

`docs/adr/0005-incremental-packs-via-manifest-schema-2.md`, user decision 2026-10-05, delivered as S08:

1. **No contract change.** The on-chain commitment stays `manifestDigest + manifestSize + bootstrapLocator + revision`; the chain never reads manifest contents, so `suiteVersion` stays 4 and no module, ABI or deployment change is in scope.
2. **Schema 2 carries the increment.** A ref manifest lists an ordered, bounded pack chain. A fast-forward push appends exactly one pack containing only objects absent from that chain, generated with the ref's **own previous tip as the only exclusion base** (`git rev-list --objects <new-tip> --not <old-tip>`). Sibling refs are never exclusion bases.
3. **Explicit closure; never git thin packs.** Each new entry declares `dependsOn` referencing **earlier entries of the same manifest only**; receivers validate backward-only references, acyclic topological order and bounded depth. No `--thin`, no `--fix-thin`; raw SHA-256 + size are verified per pack before Git sees the bytes.
4. **Fail-closed compatibility.** schemaVersion 2 is rejected by the then-current parsers; old clients must report an actionable upgrade error, never a silent fallback. Schema 1 manifests and all existing digest-keyed objects remain valid and unchanged.
5. **Empty increment.** A fast-forward push adding no new objects reuses the existing pack set with a new commit binding and `revision + 1`; no pack upload happens.
6. **Automatic fallback to a fresh full self-contained pack** (the chain resets to a single entry) when the update is not fast-forward, the previous manifest is missing/corrupt/fails verification, the chain would exceed the 16-pack limit, or the 2 GiB total-size budget would be exceeded. **Force push never waives revision CAS.**
7. **Per-ref independence is a hard gate.** Deleting or rewriting any other ref must not affect this ref's closure.

Web keeps per-pack budgets of **32 MiB per pack, 256 MiB total** across the chain when parsing schema 2 (distinct from the schema-1 limits in §4.5). Out of scope: chain compaction/merging, orphan GC, cross-ref or cross-repo dependencies, git thin packs, contract or suite-version changes, private repositories, and any change to the v3 IPFS path.

### 4.5 Size and integer bounds

Schema-1 limits recorded in §9 of the BYOS specification:

| Limit | Implemented value |
|---|---|
| manifest bytes / JSON depth | 64 KiB / 16 |
| packs / locations per pack | 16 / 4 |
| pack bytes / manifest-declared total | 512 MiB / 2 GiB |
| single PUT | at most 16 MiB (both AWS and R2) |
| multipart | AWS only, in local SDK/HTTP tests; 8 MiB parts, at most 512 MiB |
| R2 over-limit | explicitly rejected before request and source-file IO; **no multipart fallback** |
| retries | single PUT / GET / UploadPart at most 3 attempts, 100/200 ms backoff; cancellation stops immediately |
| AWS Complete 409 | at most 2 sessions, all parts re-uploaded; old ID retained, no automatic abort |

Integer discipline: values that can exceed the JS safe-integer range (`chainId`, byte `size`) use no-leading-zero decimal strings; `sequence`, `schemaVersion` and `packVersion` accept only protocol-bounded non-negative safe integers. Field omission, empty array and `null` rules are fixed (all fields mandatory in schema 1).

The on-chain `MANIFEST_MAX_SIZE = 65_536` deliberately mirrors the frozen schema-1 receiver limit.

### 4.6 Read-back verification rule

The specification is explicit and unconditional for the first release:

> The default policy of the first reliable writer is a **full streaming GET read-back** verifying digest/size after conditional creation, reusing the same verification module for both pack and manifest. Metadata SHA-256 may be used for diagnostics but is not independent proof; an object that already exists at the same key must also be read back. The public path should additionally verify anonymous reads. Transport/cache layers must not silently rewrite the original bytes; content encoding, truncation, extra trailing bytes and false response-size claims must be handled correctly. Until a real canary proves a cheaper scheme, **HEAD/ETag must not replace this policy.**

Corollaries: raw SHA-256 + size are always authoritative; metadata and ETag can never substitute for read-back; digest verification must happen **before** Git repairs or ingests bytes (a `git index-pack --fix-thin` result is no longer guaranteed to equal the uploaded raw pack).

---

## 5. Transaction rules

Sources: `cli/internal/chain/evm_transactor.go`, `cli/internal/chain/evm_keystore.go`, `web/src/lib/transport.ts`, `docs/evm-wallet-compatibility.md`, `docs/feegrant-policy.md`.

### 5.1 Legacy type-0 signing — and no EIP-1559

- The CLI signer builds `types.NewTx(&types.LegacyTx{...})` (`evm_keystore.go`), and `evm_types.go` describes `EVMTransaction` as *"the secure signer boundary for legacy type-0 writes."*
- Tests assert `transaction.Type() == types.LegacyTxType` and that deployments have a nil `To`.
- The source comment states the policy reason: *"The Suite keeps its tested type-0 policy until a funded type-2 canary has produced a retained receipt on the target Injective EVM network."*
- The Web side: `docs/evm-wallet-compatibility.md` requires providers to accept *"the existing estimated, explicit legacy type-0 transaction shape through `eth_sendTransaction`"*, and the live acceptance record must demonstrate `transaction type 0x0`.
- `docs/delivery-roadmap.md` likewise refers to retaining "the tested legacy type-0 path until a funded, signed type-2 canary is" available.

**EIP-1559 / type-2 is not used.** It is neither implemented for writes nor accepted as evidence; it is explicitly gated behind a future funded, signed type-2 canary that has not happened. Legacy transactions remain replay-protected (the CLI comment calls them "one replay-protected legacy transaction").

### 5.2 Minimum gas price: `160000000 wei`

- CLI: `injectiveMinGasPriceWei = uint64(160_000_000)`; applied in `injectiveLegacyGasPrice(chainID, gasPrice)` when `chainID == 1439 || chainID == 1776` and the RPC-quoted price is lower:
  ```go
  if (chainID == 1439 || chainID == 1776) && price < injectiveMinGasPriceWei {
      price = injectiveMinGasPriceWei
  }
  ```
- Operator CLI flag: `--gas-price`, default `160000000`, help text *"gas price in wei (minimum 160000000)"*.
- Web: `const MIN_INJECTIVE_GAS_PRICE = 160_000_000n;`
- `docs/feegrant-policy.md`: *"Every current write is a legacy EVM transaction paid by its signer with explicit estimated gas and a minimum gas price of `160000000 wei`."*
- The wallet acceptance record must show *"explicit gas price of at least `160000000 wei`."*

### 5.3 Gas estimation

- **CLI:** `t.rpc.EstimateGas(...)` then `AdjustEVMGasLimit(gas, 10_000)` before signing. The CLI path reads the gas price from the RPC and applies the Injective floor.
- **Web:** `const GAS_HEADROOM = 10_000n;` and the estimate is scaled: `const gas = (estimate * 14n) / 10n + GAS_HEADROOM;` — i.e. estimate × 1.4 plus 10,000.
- The wallet compatibility plan requires the acceptance record to demonstrate *"estimated gas with the current headroom."*

### 5.4 Receipt polling window (~2 minutes)

- **CLI:** `defaultEVMReceiptTimeout = 2 * time.Minute`. `Send`/`transact` derive `receiptCtx, cancel := context.WithTimeout(ctx, t.receiptTimeout)` and call `t.rpc.WaitReceipt(receiptCtx, hash)`. `SetReceiptTimeout` can shorten or (for `timeout <= 0`) restore the default; the comment explains that Injective's public RPC can lag on receipt indexing and that state-aware administrative callers may use a shorter bound and then verify contract/storage directly.
- **Web:** `RECEIPT_ATTEMPTS = 120`, `RECEIPT_INTERVAL_MS = 1_000`, `RECEIPT_INTERNAL_ERROR_LIMIT = 3` — 120 attempts at 1 s intervals, i.e. a ~2-minute window. Each poll calls `eth_getTransactionReceipt`; `status === 0` throws `EVMTransactionRevertedError(txHash)`, `status !== 1` throws `EVMReceiptUnconfirmedError(txHash)`.

### 5.5 Uncertain-receipt behaviour

**CLI.** `transact` returns `result` (which already carries `Hash`) together with one of:

- `*TransactionRevertedError` — a definitive on-chain revert; `result.Receipt` is set.
- `*EVMReceiptUnconfirmedError{Hash: hash, Err: err}` — *"broadcast but its receipt was not confirmed."* Its doc comment states it *"distinguishes an uncertain post-broadcast state from failures which happened before the transaction reached the RPC node. Callers can use Hash to inspect the transaction without risking a duplicate."*

Crucially, the nonce reservation is only committed on a confirmed receipt:

```go
committed := false
defer func() {
    if !committed { reservation.Invalidate() }
}()
...
reservation.Commit()
committed = true
```

So a reverted **or** uncertain outcome both return the transaction hash **and let the deferred `reservation.Invalidate()` discard the cached nonce**, forcing the next operation to re-sync with the chain. `evm_nonce.go` documents exactly this: *"failed operation invalidates the cache so the next operation re-syncs with"* the chain, and `Release()` is *"the pre-broadcast spelling"* of `Invalidate()`.

**Web.** `waitForReceipt` throws `EVMReceiptUnconfirmedError(txHash)` when the attempt budget is exhausted, when a receipt object has a non-0/1 status, or when a provider error other than `-32603`/"internal error" occurs; three consecutive internal errors also produce `EVMReceiptUnconfirmedError`. A `status === 0` receipt produces `EVMTransactionRevertedError(txHash)`. In all cases the transaction hash is retained.

**Recovery contract.** The BYOS specification's failure table requires: after broadcast, with an unknown receipt or a reorg, retain the tx hash, nonce and expected ref values; query the receipt and canonical chain state; do **not** blindly re-broadcast with a new nonce; do not mark success and do not garbage-collect. The BYOS push flow states that a publication is only marked on-chain successful after a successful receipt and the agreed finality policy, and that an unknown result must record the tx hash for targeted recovery. §5.6 of the specification also records the "upload succeeded, ref CAS conflicted / transaction reverted" case: objects are retained and recorded, the ref is re-read, and repack/re-send is an explicit choice — **never an automatic force.**

### 5.6 Gas sponsorship

`docs/feegrant-policy.md` states that the former chain-native feegrant wrappers are **not** part of the immutable EVM Suite runtime or the default CI/release path, and that any future sponsorship must be a separate EVM-compatible service with bounded authorization, replay protection, rate limits, accounting and abuse controls — and must not introduce a second chain backend or bypass `SuiteDirectory` verification. The document defines no on-chain sponsorship function in the current suite; note that `EconomicModule.sponsor` is a repository *revenue* sponsorship (`msg.value` split to treasury/splits/owner), not transaction gas sponsorship.

### 5.7 Networks

| Network | EVM chain ID | Hex |
|---|---|---|
| Injective EVM testnet | `1439` | `0x59f` |
| Injective EVM mainnet | `1776` | `0x6f0` (planned) |

---

## 6. Storage provider policy

### 6.1 Production-supported providers — exactly two

The confirmed first-release scope states:

> **Providers: Amazon S3 and Cloudflare R2**, with separate capability profiles.

- AWS S3 profile id: **`aws-s3`**
- Cloudflare R2 profile id: **`cloudflare-r2`**

`docs/roadmap-byos-providers.md` repeats the boundary: *"The currently delivered Suite v4 production configuration supports **Amazon S3 and Cloudflare R2 only**."* Each adapter negotiates and limits its own capabilities; the specification explicitly warns that because R2 uses the S3 API, AWS headers, error recovery, encryption and retention semantics **must not** be reused wholesale. The `PackLocation.provider` field in the manifest accepts `aws-s3`, `cloudflare-r2`, and `ipfs` — `ipfs` being the legacy location scheme, not a change to the production provider list.

### 6.2 Explicit exclusions

Excluded from the first release, stated in the ADR 0002/0004 decision tables and the specification:

- **MinIO**
- **Other clouds** (beyond Amazon S3 and Cloudflare R2)
- **Arbitrary / generic S3-compatible endpoints**
- **Self-hosted object-storage services**

Support is for *"user-owned cloud buckets"*, explicitly **not** for *"self-hosted storage services."* Production configuration must reject arbitrary S3-compatible base URLs, `localhost`, IP literals and unknown providers; there must be no `allow-any-endpoint` backdoor left in production configuration for mocking convenience. Tests may inject a local HTTP fake, but that must not enable self-hosted providers in production configuration. The provider restriction concerns the storage service/API; it does **not** ban a user-configured public read domain backed by an accepted cloud bucket.

### 6.3 The six mainland-China providers — ROADMAP CANDIDATES ONLY

**This is a hard documentation boundary. The six providers below are roadmap candidates only: not implemented, not integrated, not verified, and not supported. They must never be described as supported or integrated, and their endpoints must never appear in configuration examples, CLI flags, or production guidance.**

| Provider ID (suggested) | 厂商 | Product page |
|---|---|---|
| `tencent-cos` | 腾讯云 COS | https://cloud.tencent.com/product/cos |
| `aliyun-oss` | 阿里云 OSS | https://www.aliyun.com/product/oss |
| `huawei-obs` | 华为云 OBS | https://www.huaweicloud.com/product/obs.html |
| `volcengine-tos` | 火山引擎 TOS | https://www.volcengine.com/product/TOS |
| `bitiful-s4` | 缤纷云 S4 | http://bitiful.com/s4 |
| `ctyun-zos` | 天翼云 ZOS | https://www.ctyun.cn/products/zos |

**Verification of this boundary (performed on the `dev` tree):**

- A repository-wide content search for the six provider ids and for their endpoint domains (`myqcloud`, `aliyuncs`, `myhuaweicloud`, `volces`, `bitiful.com`, `ctyun.cn`) returns matches **only** in `docs/roadmap-byos-providers.md` and `docs/glossary.md`. There are **no** matches in contract sources, CLI Go code, Web TypeScript, or any configuration example.
- `docs/examples/storage-byos.json` — the only shipped config example — contains provider values `"aws-s3"` (twice) and `"cloudflare-r2"` (twice) and nothing else. Its bucket, account ID, prefix and directory values are placeholders, and the file is documented as containing only fake bucket/account/Directory values and environment-variable **names**, not to be used as a deployment configuration.
- `docs/roadmap-byos-providers.md` header (status: *"Roadmap (planned follow-up). Not implemented. Not verified."*) states that nothing on the page is implemented, integrated or verified in any released CLI/Web build, and that **no endpoint below may appear in configuration examples, CLI flags, or production guidance** until the corresponding implementation and review evidence is approved. It also records that provider IDs are *suggested values only* and that the implemented code is the source of truth.
- `docs/glossary.md` states for all six: *"All six are roadmap candidates only — not supported, not integrated"* / *"六家均为 roadmap 候选，未实现、未接入"*.
- `docs/glossary.md` prescribes the exact wording boundary: **must say** *"roadmap candidate / roadmap 候选"*; **must NOT say** *"supported / 已支持 / 已接入"* for any of them. It also requires the phrase *"production: Amazon S3 and Cloudflare R2 only"* and forbids presenting any other provider as available.

Two further glossary rules belong in published documentation: the phrase *"SuiteDirectory remains empty until approved"* must be used rather than presenting test addresses as official ones; and the status words `NOT PROVEN`, `BLOCKED`, `PASS`, `FAIL`, `HISTORICAL` are kept in English and must not be softened in translation.

### 6.4 Configuration and credential boundary

- Network/Suite trust configuration is separated from the storage profile; the storage choice must never change the `Directory` or `chainId`. Per repository, local writer/reader selection is bound by `chainId + Directory + repoId` so that a rename/transfer cannot cause the wrong bucket to be chosen by name.
- Ordinary JSON stores **references only** (e.g. `credentialRef: {kind: "aws-profile", name: "igit-writer"}` or an environment-variable *name*). It never stores access key values, secrets, session tokens or `Authorization` headers. As implemented, the first credential source supports only `kind = env` with explicit variable names (plus an optional session-token variable name); named AWS profiles and OS vaults are **not implemented**.
- Credentials, presigned URLs and session tokens never enter chain state, manifests, Git remotes, logs, browser storage or ordinary iGit JSON config. Non-secret credential *references* are allowed locally.
- Maintainers need two independent authorizations: on-chain ref maintenance permission, and cloud PUT/GET permission on the designated bucket/prefix. Collaborators need only their own GET (and necessary HEAD) permission and must not reuse the uploader's long-lived keys. `DeleteObject`, bucket-policy changes and bucket listing are not granted by default; multipart permissions are documented separately. The specification warns not to promise that R2 token scope granularity equals AWS IAM prefix limits.
- Network safety: write API endpoints are derived/validated from known provider fields; redirects are not followed; userinfo, signed queries, fragments, HTTP downgrade, path traversal and unexpected ports are rejected; CLI SSRF defenses must cover DNS resolution/rebinding, private/loopback/link-local/cloud-metadata/IPv6-mapped addresses and every redirect hop. Public GETs carry no Cookie/Authorization/session token, and signed requests may only go to the profile-derived official host.
- An authenticated reader must not change expected verification values, nor propagate private-bucket parameters onto the chain, into public manifests, or into Web `localStorage`. If public manifest/pack URLs are not anonymously reachable, the Web must explain that public read configuration or an independent CLI reader is needed — never ask for the writer secret. The first release provides no long-lived Web secret, no managed GET broker and no automatic temporary-credential distribution.

### 6.5 Provider capability notes that must not be overstated

These are documented as a **2026-09-13 official-documentation capability check, not a real test PASS** in this repository. Conditional multipart behaviour that R2 documentation does not prove is retained as **NOT PROVEN** and must not be written as either supported or definitively unsupported. `r2.dev` domains are documented as development use, not a production SLA. A successful `GET` does not imply correct browser CORS; both entry points are tested.

---

## 7. Security invariants

### 7.1 Data before ref

- The BYOS push sequence requires: verify chain/Directory/version/code hashes/bindings → generate a self-contained pack with streaming raw SHA-256/size → conditionally upload, read back and verify → upload and verify the manifest → confirm the public read path → only then update the on-chain commitment under CAS.
- The specification states the rule directly: the ref changes only after bytes are published and verified; if a pack uploads but the manifest fails, the ref is unchanged.
- The ADR is explicit about the limit of the claim: *"The contract cannot fetch cloud/IPFS bytes. The data-before-ref rule is a client publication policy, not an on-chain proof of persistence. BYOS does not introduce a trusted iGit storage-receipt signer."* It also states that a location or S3 ETag is not the content authority, and that neither hashing nor an on-chain ref guarantees long-term availability or recovery.
- Downloads are verified before Git consumes them: limit length, check on-chain digest/size, then strictly check schema/JCS/context; write to a restricted temporary file; verify the complete raw bytes' SHA-256 and actual length; **only then** hand the file to Git. On Windows the file is closed and reopened before ingestion.

### 7.2 Force push on v4 never waives revision CAS

- The NatSpec on the v4 `updateRef` states: *"`force` ... never waives the CAS check: force only expresses a client-side history-replacement intent that the contract cannot and does not judge."*
- The CAS check is unconditional — there is no `force` term in it:
  ```solidity
  if (expectedRevision != target.revision || expectedManifestDigest != target.manifestDigest) {
      revert CommitmentMismatch(expectedRevision, expectedManifestDigest, target.revision, target.manifestDigest);
  }
  ```
- `docs/storage-byos.md` §5: *"`force` allows replacing history but **must not exempt the successor's CAS**."* It adds that `expectedSha` alone is insufficient to protect manifest/location updates for the same commit, that explicit expected revision/old commitment must be used, and that ref delete/recreate keeps a monotonic version to prevent ABA.
- ADR 0005 §6 restates it: *"Force push never waives revision CAS. Fast-forward/ancestry checks are client policy; the chain keeps only its CAS concurrency check."*
- The failure table requires that a CAS conflict or reverted transaction must re-read the ref and make repack/re-send an explicit choice — **no automatic force.**
- The README records that in v3 the `force` flag *does* skip the `expectedSha` comparison, and the BYOS specification marks the successor CAS requirement as *"successor requirements, not a claim that the existing v3 already implements them."* Documentation must keep that distinction.

### 7.3 Moderation hooks are mandatory

- The v3 README: *"Normal Core ref changes and Economic sponsorship call the Directory-bound Moderation policy before changing state. Core ownership recovery accepts calls only from the Directory-bound Recovery module. These are enforced capabilities, not advisory client conventions."*
- Enforced in code:
  - `RepositoryCore.updateRef` and `deleteRef` call `IModerationPolicy(_moderation()).requireRefMutation(repoId, msg.sender)`.
  - `RepositoryCore.forkRepository` calls `requireFork(sourceRepoId, msg.sender)`.
  - `EconomicModule.sponsor` calls `requireEconomicAction(repoId, msg.sender)`.
  - `BadgeModule.awardBadge` calls `requireBadgeAward(repoId, msg.sender)`.
- `_moderation()` resolves the address from the Directory and reverts `SuiteNotActive()` if it is zero — i.e. the hook cannot be bypassed by leaving the module unconfigured.
- The v4 core keeps the moderation hook: the successor README states *"The contract still never fetches off-chain bytes, never validates Git ancestry, and keeps the moderation hook, collaborator and ownership rules."*

### 7.4 Recovery is the only ownership-recovery capability

- `RepositoryCore.recoverOwnership(bytes32 repoId, address newOwner)` is gated by:
  ```solidity
  address recovery = ISuiteDirectory(suiteDirectory).moduleAddress(SuiteIds.RECOVERY);
  if (msg.sender != recovery || recovery == address(0)) revert Unauthorized(msg.sender);
  ```
  Only the Directory-bound Recovery module can call it. It also rejects a pending ownership transfer and re-checks locator availability.
- `RecoveryModule.executeRecovery` is the only internal caller, and it applies guardian threshold, delay and window before calling `IRepositoryCore(_core()).recoverOwnership(...)`.
- The v3 README describes the capability as "the Recovery-only ownership capability."
- `IEconomicOwnershipHook.clearRevenueSplitsOnOwnershipTransfer` is likewise gated to Core only, and it clears revenue splits and cancels any pending recovery on ownership change.

### 7.5 No proxies, diamonds, or `delegatecall`; non-upgradeable

- The v3 README: *"There are no proxies, upgrade entry points, diamonds, or `delegatecall` paths."*
- The build gate enforces this mechanically: `scripts/evm-suite-solc-check.mjs` fails the check when a production source file matches `\b(delegatecall|selfdestruct)\b`.
- `SuiteDirectory` has no setter for module addresses or code hashes after configuration, no path back to `Bootstrapping`, and no owner/governance role. `configuredChainId` and `snapshotRoot` are `immutable`.
- Module constructors take `(address directory, address coordinator)` and revert `InvalidSuiteDirectory` / `InvalidBootstrapCoordinator` when either is zero or has no code; `suiteDirectory` and `bootstrapCoordinator` are `immutable`.
- The consequence documented by the project: the current Suite is immutable and **cannot** receive a new payload format, which is precisely why the storage-neutral successor required a fresh suite rather than an upgrade.
- `docs/project-status.md` (HISTORICAL section) states the non-upgradeable guarantee as: no hidden governance backdoors, users can verify exact code at deployment time, no proxy-related security risks, and fixed predictable behaviour.

### 7.6 Additional invariants stated by the specification

- Clients never overwrite different bytes at an existing digest-derived key; editing content produces new pack bytes, a new manifest and an authorized ref update.
- Out-of-band overwrite or deletion by a bucket administrator is possible; clients detect tampering or absence, and this does not retroactively legitimize different chain-committed content.
- No automatic deletion/GC of remote packs, manifests, historical pins or incomplete multipart uploads; no background-triggered Delete/GC in the default interface; the existing "reaper" must not be enabled.
- Cache keys must be isolated by trusted digest and protocol context; a chain ref cache must include chainId, Directory, repo/ref, and revision/block identity, and must handle reorg invalidation.
- An indexer must not advance its checkpoint on decode failure, and contract reads must remain independently usable without an indexer.
- Fork or cross-ref copying must regenerate a manifest bound to the target repo/ref; a commitment carrying source context must never be copied verbatim.
- The canonical-body rule keeps credentials, receipts and provider timestamps out of the hashed bytes; the locator needed to find the manifest must not be placed back inside the not-yet-read manifest (no circular dependency).

---

## 8. Build and toolchain

### 8.1 Solidity version (fixed)

`solc_version = "0.8.24"` in both `contracts/evm-v2/foundry.toml` and `contracts/evm-v2-successor/foundry.toml`, and every source file declares `pragma solidity 0.8.24;` (not `^0.8.24`). The npm dev dependency is pinned: `"solc": "0.8.24"`. The gate *"fixes Solidity at `0.8.24`."*

### 8.2 Foundry configuration (both suites)

```toml
[profile.default]
src = "src"
test = "test"
out = "out"
libs = []
solc_version = "0.8.24"
optimizer = true
optimizer_runs = 1
via_ir = true

[fuzz]
runs = 256

[invariant]
runs = 128
depth = 64
fail_on_revert = true
```

The package intentionally has **no external dependencies**; tests deploy production artifacts through a small local `Vm` interface.

### 8.3 How the contracts are built and tested

**Portable gate (no Foundry required).** `npm ci` then `npm run check`:

- v3 — `contracts/evm-v2/package.json`: `"check": "node ../../scripts/evm-suite-solc-check.mjs"`, plus `"abi"` (`--write-abi`) and `"artifacts"` (`--write-artifacts`).
- v4 — `contracts/evm-v2-successor/package.json`: `"check": "node ../../scripts/evm-successor-solc-check.mjs"`, plus the same `abi`/`artifacts` modes.

The gate compiles with the locked solc 0.8.24 and the same optimizer/`viaIR` settings as Foundry, compiles the suite state-machine tests, rejects forbidden upgrade primitives (`delegatecall`, `selfdestruct`), and enforces EIP-170 and EIP-3860 limits. The v4 gate additionally verifies the "unchanged from v3" file set and checks in `abi/` and `artifacts/` under schema `igit.evm-successor.solc-artifact.v1`.

**Size floors.** The v3 gate demands 1024 bytes of `RepositoryCore` runtime headroom under EIP-170; the successor gate keeps `minimumCoreRuntimeHeadroomBytes = 512`, because the successor spends headroom on commitment state, CAS, tombstones and ref-restorable events.

Measured sizes (2026-10-04, solc 0.8.24), from the successor README:

| Contract | initcode | runtime | EIP-170 headroom |
|---|---|---|---|
| `RepositoryCore` (successor) | 23058 | **22637** | **1939** |
| `SuiteDirectory` (v=4) | 4079 | 3765 | 20811 |
| other 7 modules | identical to v3 | identical to v3 | unchanged |

The successor core is 867 bytes smaller than v3's 23504-runtime core. `docs/project-status.md` records that the v3 **test contract** `SuiteProtocolParityTest` emits a `25537 > 24576` byte warning.

**Foundry commands (v3 README):**

```sh
forge build
forge test -vvv
forge test --match-contract '^SuiteArchitectureTest$' -vvv
forge test --gas-report
```

Foundry is described as additionally executing bootstrap ordering, double-finalize, abandoned-suite, malicious binding, policy hook, capability, gas, and stateful invariant checks. Test contract artifacts in `out/SuiteArchitecture.t.sol/` include `SuiteArchitectureTest`, `SuiteArchitectureSecurityTest`, `SuiteProtocolParityTest`, `SuiteImportValidationTest`, and auxiliary contracts `ReentrantSponsorReceiver`, `RevertingBindingModule`, `WronglyBoundModule`, `SuiteVm`.

**Successor gate commands (README):**

```powershell
npm ci --prefix contracts/evm-v2-successor
npm run check --prefix contracts/evm-v2-successor
```

**Go bindings.** The successor's Go bindings live in `cli/internal/chain/successor` (embedded ABIs plus a contract-faithful fake chain for tests). The embedded ABIs must stay identical to `abi/*.json`; `TestEmbeddedSuccessorABIsMatchSolidityArtifacts` fails the build on drift.

### 8.4 Project status — what is PASS, NOT PROVEN, BLOCKED

**Do not overstate completion.** The repository separates delivered-and-verified from delivered-but-unproven, and from blocked.

**PASS**

- Nine production contracts exist, compile under solc 0.8.24, and `npm run check` passes; ABI/artifact and production sizes checked. (`docs/project-status.md`, 2026-09-13 baseline.)
- Testnet Suite fixed-block read-only check: chain 1439, block 139852506 / `0x855fada`, `state=1` (active), version 3, with seven module addresses and code hashes consistent. **PASS** — note this is the **v3** suite version at that block.
- Go local tests and `go vet ./...` exit 0 (unit and mock/fixture only; cannot be extrapolated to real writes).
- CLI read-only RPC against the nine contracts (`evm-demo-inspect` `code-addresses` mode, `latest` mode).
- Web typecheck / API tests / build (73 tests passed, 0 failed at that audit).
- BYOS S01–S03 local slice: Go/TS JCS bytes+digest cross vectors (`npm run test:storage-cross`), CLI storage/manifest/config/IPFS/Git tests, Linux amd64 cross-compile, Windows DACL journal write/read.
- `docs/delivery-roadmap.md` records P3 (S01–S02 manifest and verified packstore) as **PASS (2026-09-13)**.
- Real Cloudflare R2 end-to-end Git flows (push/clone/fetch/ls-remote/tag/ref-delete/tombstone rebuild), anonymous public GET + CORS, and Web repository browsing — **PASS**, per the ADR 0004 status update, the BYOS specification header and the READMEs.
- v4 local compile/ABI gate **PASS**.
- ADR 0005 (S08) reports schema-2 parsers with Go/TS cross vectors, `gitio` incremental APIs, byos chain push/fetch with full-pack fallbacks, and all §2.3 admission gates passing locally, plus a real Injective-testnet + Cloudflare-R2 incremental push verified on `demo-showcase-byos` on 2026-10-05.

**NOT PROVEN** (documented as such; must not be described as verified)

- Real AWS S3 canary — the stated remaining gap in every current status document.
- Real force-push staleness / real concurrency races.
- Real Cloudflare R2 out-of-band tamper detection.
- Blockscout source verification for the successor.
- Successor publication evidence and the public profile switch ("nothing here authorizes a publication switch").
- Mainnet approval and mainnet acceptance.
- Foundry gates for the successor (see BLOCKED).
- Remaining real-layer residuals for BYOS.
- `docs/project-status.md` lists under NOT PROVEN for the 2026-09-13 audit: real replication, gateway pack, Git integrity, EVM writes, push/fetch E2E; and "nine-contract complete acceptance, product switch, production deployment" absent Foundry, real E2E, finality, security review, approval and checksum gates.
- From the S01–S03 slice: real AWS / real R2 (pre-R2-E2E), real IPFS/replication, successor contract/deployment/transactions (S04 then not implemented), Windows/Linux Git remote push/clone E2E, real browser public URL/CORS — all NOT PROVEN at that time.

**BLOCKED**

- **Foundry build/test/gas — BLOCKED (R04).** The environment has no `forge` on `PATH`; Foundry acceptance was not executed and solc must not be substituted for it. The successor README states Foundry unit/invariant/gas as **BLOCKED (no forge on this machine, R04)**. `docs/delivery-roadmap.md` carries the same label.
- Ordinary `igit suite verify` — BLOCKED by a Windows DACL *Access is denied* on an isolated keyless configuration; detailed inspect also timed out at username progress.
- Real local Kubo / recursive pin — BLOCKED (no `ipfs` on `PATH`, no node/listener observed, `127.0.0.1:5001` refused; lifecycle tests SKIP).
- `go test -race -count=1 ./internal/packstore/...` — BLOCKED (`CGO_ENABLED=0`; Go returns `-race requires cgo`; no gcc/clang on `PATH`).

**FAIL**

- Web Moderation UI completion claim — **FAIL**: documents claimed the Moderation UI was implemented, but the corresponding files do not exist; `modules.ts` API surface is not a UI. (`docs/roadmap-byos-providers.md` scope guard and §7 note that the missing Moderation UI does not block S01–S03.)
- The four EVM indexing scripts — **FAIL**: still untracked, with wrong topics, SHA-256 module IDs, wrong selectors, placeholder ABIs and checkpoint/reorg/unpin defects. Labelled R01/R02 FAIL; these scripts must not be used as a basis for real indexing or cleanup.
- `git diff --check` — **FAIL** on pre-existing Markdown trailing whitespace in HISTORICAL README/backlog text, intentionally preserved and not cleaned.

**HISTORICAL**

- Past deployments, activations and Blockscout records are bound to commit `00000000000000000000000000000000`; receipts from that period are not current product acceptance.
- The BYOS specification §9 is a **HISTORICAL** snapshot of the 2026-09-13 S01–S03 slice; its "next step / not yet implemented" wording reflects only that moment.
- `docs/project-status.md`'s collapsed section and the root-level `MIGRATION-*`, `A01-BXX-MIGRATION-REPORT.md`, `PRIORITY-*` drafts, plus `docs/a11-storage-indexer-v2.md`, `docs/PRIORITY-MAPPING.md`, `docs/evm-v2-handoff.md` and `docs/liveagent-evm-v2-context.md`, are explicitly marked as historical migration drafts / unaligned reports and are **not** a basis for current project status.

**Deployment reality check.** The successor suite is deployed and **active on Injective testnet (2026-10-04)** at Directory `0x00000000000000000000000000000000` with evidence `local-only/successor-deploy/deployment5.json` (no-clobber). The public built-in CLI/Web profiles deliberately carry **no** deployed `SuiteDirectory`; the checked-in placeholder address is not a deployment. Documentation must not present test addresses as official addresses, and the testnet deployment is not a mainnet approval.

**Security review status.** The delivery roadmap and project status record that security review and mainnet approval remain NOT PROVEN / not obtained. The historical P1.5 items ("deep source security review", "resolve all security findings", "independent hash-bound cutover approval", `security-review.pdf`, `cutover-approval.txt`) are listed as unchecked. No security-review artefact is claimed as complete in any current status document.

---

## 9. Where the source is silent

Recorded deliberately so that published documentation does not over-claim:

1. The v3 `RecoveryModule` and other modules declare `onlyActiveSuite` and `onlyBootstrap` but the source contains **no** per-repository pause/emergency-stop capability beyond `ModerationModule` status.
2. `BadgeModule` stores badges in module state with no ERC-721/ERC-1155 interface; "non-transferable" is a consequence of there being no transfer function, and the source does not implement an on-chain transfer rejection beyond that absence.
3. No function exists to enumerate all repositories globally; only `listRepositoriesPage(address owner, ...)` and the repo-scoped listings are exposed.
4. `SuiteDirectory` exposes no getter that returns all module ids at once; clients reconstruct the list from `SuiteIds` constants and `requiredModuleAt(index)`.
5. The v4 `RepositoryCore` does not store `commitSha`; the only on-chain record of a commit OID is the `RefUpdated` event and the committed manifest. A cold client must read the manifest to learn the commit OID.
6. The contract never fetches off-chain bytes and never validates Git ancestry; there is **no** on-chain proof of pack availability, and no trusted storage-receipt signer exists by design.
7. Manifest schema 2 is not described in the contract sources at all — the chain is unaware of `schemaVersion`; schema-2 handling is entirely client-side, which is why ADR 0005 changes no contract and no `suiteVersion`.
8. The specification does not decide the priority order among the six roadmap providers, nor whether mainland-China endpoints require a distinct default public-read domain or mirror guidance; both are listed as non-binding open questions.
9. No EIP-1559/type-2 transaction path is implemented anywhere in the sources read; the type-2 canary referenced in comments and the roadmap has no recorded result.
10. `EconomicModule` imports `ImportTotal` and `sponsorTotal` for historical denoms, but the source does not document which historical denoms existed; migrated totals are supplied through bootstrap import records.
