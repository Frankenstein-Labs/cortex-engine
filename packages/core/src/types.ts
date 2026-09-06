import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';

// ============================================================================
// FUNDAMENTAL TYPES
// ============================================================================

export type EntityId = string;

export interface Timestamped {
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// EVENT SYSTEM
// ============================================================================

export type EventType =
  | 'agent.started'
  | 'agent.stopped'
  | 'agent.error'
  | 'session.created'
  | 'session.started'
  | 'session.stopped'
  | 'session.error'
  | 'task.created'
  | 'task.assigned'
  | 'task.started'
  | 'task.completed'
  | 'task.failed'
  | 'task.cancelled'
  | 'tool.called'
  | 'tool.completed'
  | 'tool.error'
  | 'runtime.started'
  | 'runtime.stopped'
  | 'runtime.error'
  | 'command.executed'
  | 'file.changed'
  | 'test.started'
  | 'test.completed'
  | 'test.failed'
  | 'error.detected'
  | 'agent.message'
  | 'review.completed'
  | 'vm.started'
  | 'vm.stopped'
  | 'vm.error'
  | 'permission.denied'
  | 'permission.requested'
  | 'budget.exceeded';

export interface CortexEvent<T = unknown> {
  id: EntityId;
  type: EventType;
  timestamp: Date;
  source: EntityId;
  data: T;
  metadata?: Record<string, unknown>;
}

export const CortexEventSchema = z.object({
  id: z.string().uuid(),
  type: z.string(),
  timestamp: z.coerce.date(),
  source: z.string(),
  data: z.unknown(),
  metadata: z.record(z.unknown()).optional(),
});

export type CortexEventHandler<T = unknown> = (event: CortexEvent<T>) => void | Promise<void>;

export interface EventBus {
  on<T>(eventType: EventType, handler: CortexEventHandler<T>): () => void;
  off<T>(eventType: EventType, handler: CortexEventHandler<T>): void;
  emit<T>(event: CortexEvent<T>): void;
}

// ============================================================================
// PERMISSION SYSTEM
// ============================================================================

export type PermissionAction =
  | 'filesystem.read'
  | 'filesystem.write'
  | 'filesystem.delete'
  | 'terminal.execute'
  | 'git.push'
  | 'git.merge'
  | 'git.rebase'
  | 'network.access'
  | 'browser.use'
  | 'extension.install'
  | 'vm.create'
  | 'vm.start'
  | 'vm.stop'
  | 'secret.access'
  | 'deploy'
  | 'admin';

export interface Permission {
  id: EntityId;
  action: PermissionAction;
  resource?: string;
  effect: 'allow' | 'deny';
  conditions?: Record<string, unknown>;
}

export interface PermissionPolicy {
  id: EntityId;
  name: string;
  permissions: Permission[];
  defaultEffect: 'allow' | 'deny';
}

export interface PermissionContext {
  agentId: EntityId;
  taskId?: EntityId;
  sessionId?: EntityId;
}

export interface PermissionChecker {
  check(permission: PermissionAction, context: PermissionContext): boolean;
  request(permission: PermissionAction, context: PermissionContext, reason: string): Promise<boolean>;
}

// ============================================================================
// TOOL SYSTEM
// ============================================================================

export interface ToolParameter {
  name: string;
  type: string;
  description: string;
  required: boolean;
  default?: unknown;
  schema?: z.ZodSchema;
}

export interface ToolResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface ToolCall {
  id: EntityId;
  toolName: string;
  parameters: Record<string, unknown>;
  timestamp: Date;
}

export interface ToolContext {
  agentId: EntityId;
  sessionId: EntityId;
  taskId?: EntityId;
  runtime: Runtime;
  workspace: WorkspaceRef;
  permissions: PermissionChecker;
}

export interface Tool {
  name: string;
  description: string;
  version: string;
  parameters: ToolParameter[];
  requiredPermissions: PermissionAction[];
  runtimeRequirements?: RuntimeCapability[];
  execute(params: Record<string, unknown>, context: ToolContext): Promise<ToolResult>;
}

export type RuntimeCapability = 'terminal' | 'browser' | 'network' | 'filesystem' | 'processes' | 'vm';

// ============================================================================
// TASK SYSTEM
// ============================================================================

export type TaskStatus = 'pending' | 'assigned' | 'running' | 'completed' | 'failed' | 'cancelled' | 'waiting';

export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';

export interface Task {
  id: EntityId;
  name: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  role?: string;
  dependencies: EntityId[];
  assignedAgentId?: EntityId;
  result?: unknown;
  error?: string;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  budget: TaskBudget;
  timeoutMs: number;
  retryCount: number;
  maxRetries: number;
  createdAt: Date;
  updatedAt: Date;
  startedAt?: Date;
  completedAt?: Date;
}

export interface TaskBudget {
  maxTokens: number;
  maxToolCalls: number;
  maxDurationMs: number;
  maxCost?: number;
}

export interface TaskGraph {
  tasks: Map<EntityId, Task>;
  edges: Array<{ from: EntityId; to: EntityId }>;
  
  addTask(task: Task): void;
  addDependency(from: EntityId, to: EntityId): void;
  getReadyTasks(): Task[];
  getNextTask(taskId: EntityId): Task | null;
  getTask(taskId: EntityId): Task | undefined;
  getAllTasks(): Task[];
  markTaskStatus(id: EntityId, status: TaskStatus, result?: unknown, error?: string): void;
}

// ============================================================================
// AGENT SDK
// ============================================================================

export type AgentRole =
  | 'architect'
  | 'developer'
  | 'researcher'
  | 'tester'
  | 'reviewer'
  | 'security'
  | 'debugger'
  | 'devops'
  | 'explorer'
  | 'custom';

export interface AgentConfig {
  id: EntityId;
  name: string;
  role: AgentRole | string;
  engine: 'kilo' | 'openhands' | 'cortex';
  model: ModelRef;
  permissions: PermissionPolicy;
  tools: string[];
  memory?: MemoryRef;
  runtime: RuntimeRef;
  workspace: WorkspaceRef;
  budget: AgentBudget;
  timeoutMs: number;
  maxIterations: number;
  metadata?: Record<string, unknown>;
}

export interface AgentBudget {
  maxTokens: number;
  maxToolCalls: number;
  maxDurationMs: number;
  maxCost?: number;
}

export interface AgentState {
  status: 'idle' | 'working' | 'waiting' | 'error' | 'stopped';
  currentTaskId?: EntityId;
  iterationCount: number;
  tokensUsed: number;
  toolCallsUsed: number;
  cost: number;
  startedAt?: Date;
  lastActivityAt?: Date;
  error?: string;
}

export interface AgentMessage {
  id: EntityId;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export interface AgentAction {
  id: EntityId;
  type: string;
  parameters: Record<string, unknown>;
  timestamp: Date;
}

export interface AgentObservation {
  id: EntityId;
  actionId: EntityId;
  type: string;
  data: unknown;
  timestamp: Date;
  success: boolean;
  error?: string;
}

export interface AgentMemory {
  id: EntityId;
  shortTerm: AgentMessage[];
  longTerm?: unknown;
  workingSet: Map<string, unknown>;
}

export interface AgentExecutionContext {
  task: Task;
  session: Session;
  eventBus: EventBus;
  tools: Map<string, Tool>;
  memory: AgentMemory;
  state: AgentState;
}

export interface Session {
  id: EntityId;
  agentId: EntityId;
  messages: AgentMessage[];
  actions: AgentAction[];
  observations: AgentObservation[];
  createdAt: Date;
  updatedAt: Date;
  context?: Record<string, unknown>;
}

export interface Agent {
  readonly config: AgentConfig;
  readonly state: AgentState;
  
  start(): Promise<void>;
  stop(): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  execute(task: Task): Promise<TaskResult>;
  sendMessage(message: string): Promise<AgentMessage>;
  callTool(toolName: string, parameters: Record<string, unknown>): Promise<ToolResult>;
  getSession(): Promise<Session>;
}

export interface TaskResult {
  success: boolean;
  output?: unknown;
  error?: string;
  artifacts?: Record<string, unknown>;
  metrics: {
    tokensUsed: number;
    toolCalls: number;
    durationMs: number;
    cost: number;
  };
}

// ============================================================================
// MODEL / PROVIDER
// ============================================================================

export type ModelProviderType = 'openai' | 'anthropic' | 'google' | 'ollama' | 'custom';

export interface ModelRef {
  id: string;
  provider: ModelProviderType;
  model: string;
  apiKey?: string;
  baseUrl?: string;
  parameters?: Record<string, unknown>;
}

export interface ModelCapabilities {
  supportsTools: boolean;
  supportsVision: boolean;
  supportsStreaming: boolean;
  maxContextTokens: number;
  maxOutputTokens: number;
}

export interface ModelRegistry {
  register(model: ModelRef, capabilities: ModelCapabilities): void;
  get(modelId: string): { model: ModelRef; capabilities: ModelCapabilities } | undefined;
  list(): Array<{ model: ModelRef; capabilities: ModelCapabilities }>;
}

// ============================================================================
// MEMORY
// ============================================================================

export interface MemoryRef {
  id: EntityId;
  type: 'session' | 'project' | 'agent' | 'shared';
}

export interface MemoryStore {
  get(id: EntityId): Promise<unknown>;
  set(id: EntityId, data: unknown): Promise<void>;
  delete(id: EntityId): Promise<void>;
  search(query: string, limit?: number): Promise<Array<{ id: EntityId; data: unknown; score: number }>>;
}

// ============================================================================
// WORKSPACE
// ============================================================================

export interface WorkspaceRef {
  id: EntityId;
  rootPath: string;
  branch?: string;
  worktreePath?: string;
}

export interface Workspace {
  readonly ref: WorkspaceRef;
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
  deleteFile(path: string): Promise<void>;
  listFiles(path?: string): Promise<string[]>;
  exists(path: string): Promise<boolean>;
  getGitStatus(): Promise<GitStatus>;
  createWorktree(name: string, branch: string): Promise<WorkspaceRef>;
  removeWorktree(name: string): Promise<void>;
}

export interface GitStatus {
  branch: string;
  dirty: boolean;
  staged: string[];
  modified: string[];
  untracked: string[];
  ahead: number;
  behind: number;
}

// ============================================================================
// RUNTIME
// ============================================================================

export interface RuntimeRef {
  id: EntityId;
  type: 'host' | 'container' | 'vm';
  capabilities: RuntimeCapability[];
}

export interface Runtime {
  readonly ref: RuntimeRef;
  executeCommand(command: string, args?: string[], env?: Record<string, string>): Promise<CommandResult>;
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
  deleteFile(path: string): Promise<void>;
  listFiles(path?: string): Promise<string[]>;
  startProcess(command: string, args?: string[]): Promise<ProcessHandle>;
  openBrowser(url: string): Promise<void>;
  takeScreenshot(): Promise<Buffer>;
  hasCapability(capability: RuntimeCapability): boolean;
}

export interface CommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
}

export interface ProcessHandle {
  pid: number;
  kill(): Promise<void>;
  wait(): Promise<CommandResult>;
}

// ============================================================================
// ORCHESTRATOR
// ============================================================================

export interface AgentPool {
  createAgent(config: AgentConfig): Promise<Agent>;
  getAgent(id: EntityId): Agent | undefined;
  removeAgent(id: EntityId): Promise<void>;
  listAgents(): Agent[];
  getAvailableAgents(role?: string): Agent[];
  assignTask(task: Task, agentId: EntityId): Promise<TaskResult>;
}

export interface AgentCommunication {
  send(from: EntityId, to: EntityId, message: unknown): Promise<void>;
  broadcast(from: EntityId, message: unknown, recipients?: EntityId[]): Promise<void>;
  postToSharedArtifact(from: EntityId, artifactId: EntityId, data: unknown): Promise<void>;
  getSharedArtifact(artifactId: EntityId): Promise<unknown>;
}

export interface Orchestrator {
  start(): Promise<void>;
  stop(): Promise<void>;
  submitMission(mission: Mission): Promise<MissionResult>;
  getStatus(): OrchestratorStatus;
}

export interface Mission {
  id: EntityId;
  name: string;
  description: string;
  tasks: Task[];
  maxAgents: number;
  timeoutMs: number;
  budget: MissionBudget;
}

export interface MissionBudget {
  maxTotalTokens: number;
  maxTotalCost: number;
  maxDurationMs: number;
}

export interface MissionResult {
  success: boolean;
  completedTasks: Task[];
  failedTasks: Task[];
  output?: unknown;
  error?: string;
  metrics: {
    totalDurationMs: number;
    totalTokens: number;
    totalCost: number;
    agentCount: number;
  };
}

export interface OrchestratorStatus {
  status: 'idle' | 'running' | 'paused' | 'error';
  activeAgents: number;
  pendingTasks: number;
  runningTasks: number;
  completedTasks: number;
  failedTasks: number;
}

// ============================================================================
// SHARED ARTIFACTS
// ============================================================================

export interface SharedArtifact {
  id: EntityId;
  type: 'file' | 'patch' | 'log' | 'result' | 'reference';
  data: unknown;
  createdBy: EntityId;
  createdAt: Date;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// MCP
// ============================================================================

export interface MCPServer {
  id: EntityId;
  name: string;
  url: string;
  transport: 'stdio' | 'sse' | 'http';
  tools?: MCPTool[];
}

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: unknown;
}

export interface MCPResource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}
