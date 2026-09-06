#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import { InMemoryEventBus, createEvent, Agent, AgentConfig, Task, TaskResult, ToolContext, PermissionPolicy } from '@cortex/core';
import { InMemoryTaskGraph, createTask } from '@cortex/core';
import { AgentPool, AgentRuntime } from '@cortex/agent';
import { DefaultOrchestrator, DefaultAgentCommunication } from '@cortex/orchestrator';
import { HostRuntime, createHostRuntime } from '@cortex/runtime';
import { ReadFileTool, WriteFileTool, TerminalTool, GitStatusTool, GitDiffTool, GitCommitTool } from '@cortex/tools';
import { ToolRegistry } from '@cortex/core';
import { v4 as uuidv4 } from 'uuid';

class SimpleCortexAgent extends AgentRuntime {
  private hostRuntime: HostRuntime;
  private toolRegistry: ToolRegistry;

  constructor(config: AgentConfig, hostRuntime: HostRuntime, toolRegistry: ToolRegistry) {
    super(config);
    this.hostRuntime = hostRuntime;
    this.toolRegistry = toolRegistry;
  }

  async runTaskLoop(task: Task, metrics: any): Promise<any> {
    console.log(chalk.cyan(`[Agent] Starting task: ${task.name}`));
    
    const result = await this.hostRuntime.executeCommand('pwd');
    console.log(chalk.gray(`[Agent] Current directory: ${result.stdout.trim()}`));

    const fsResult = await this.callTool('terminal.execute', { command: 'ls', args: ['-la'] });
    if (fsResult.success && fsResult.data) {
      console.log(chalk.gray(`[Agent] Directory contents:\n${(fsResult.data as any).stdout}`));
    }

    return { task, directory: result.stdout.trim() };
  }

  async callTool(toolName: string, parameters: Record<string, unknown>): Promise<any> {
    const toolResult = await this.toolRegistry.execute(toolName, parameters, {
      agentId: this.config.id,
      sessionId: 'default',
      runtime: this.hostRuntime,
      workspace: { id: this.config.workspace.id, rootPath: this.config.workspace.rootPath } as any,
      permissions: {
        check: () => true,
        request: async () => true,
      } as any,
    });
    return toolResult;
  }
}

const program = new Command();

program
  .name('cortex')
  .description('Cortex Engine CLI')
  .version('0.1.0');

program
  .command('run')
  .description('Run a mission')
  .argument('<mission>', 'Mission description or file path')
  .option('--agent <type>', 'Agent type (kilo, openhands, cortex)', 'cortex')
  .option('--role <role>', 'Agent role', 'developer')
  .option('--max-agents <n>', 'Maximum number of agents', '2')
  .action(async (mission, options) => {
    console.log(chalk.blue('\n[Cortex Engine] Starting mission...'));
    console.log(chalk.gray(`Mission: ${mission}`));
    console.log(chalk.gray(`Agent type: ${options.agent}`));
    console.log(chalk.gray(`Role: ${options.role}`));
    console.log();

    const eventBus = new InMemoryEventBus();
    const taskGraph = new InMemoryTaskGraph();
    const toolRegistry = new ToolRegistry();
    const communication = new DefaultAgentCommunication();
    const pool = new AgentPool();

    const runtimeRef = createHostRuntime();
    const hostRuntime = new HostRuntime(runtimeRef);

    const fsTools = [new ReadFileTool(), new WriteFileTool(), new TerminalTool(), new GitStatusTool(), new GitDiffTool(), new GitCommitTool()];
    for (const tool of fsTools) {
      toolRegistry.register(tool);
    }

    const agentConfig: AgentConfig = {
      id: uuidv4(),
      name: `Cortex-${options.role}`,
      role: options.role as any,
      engine: options.agent as any,
      model: { id: 'default', provider: 'custom', model: 'local' } as any,
      permissions: { id: uuidv4(), name: 'default', permissions: [], defaultEffect: 'allow' } as any,
      tools: fsTools.map((t) => t.name),
      runtime: runtimeRef,
      workspace: { id: uuidv4(), rootPath: process.cwd() } as any,
      budget: { maxTokens: 100000, maxToolCalls: 100, maxDurationMs: 600000 },
      timeoutMs: 600000,
      maxIterations: 10,
    };

    const agent = new SimpleCortexAgent(agentConfig, hostRuntime, toolRegistry);
    pool.registerAgent(agent);

    const orchestrator = new DefaultOrchestrator(pool, taskGraph, eventBus, communication);
    await orchestrator.start();

    const missionObj = {
      id: uuidv4(),
      name: 'CLI Mission',
      description: mission,
      tasks: [createTask({ name: 'Explore workspace', description: mission, priority: 'high' })],
      maxAgents: parseInt(options.maxAgents),
      timeoutMs: 600000,
      budget: { maxTotalTokens: 100000, maxTotalCost: 10, maxDurationMs: 600000 },
    };

    try {
      const result = await orchestrator.submitMission(missionObj);
      if (result.success) {
        console.log(chalk.green('\n[Orchestrator] Mission completed successfully'));
      } else {
        console.log(chalk.red('\n[Orchestrator] Mission failed'));
        if (result.error) {
          console.log(chalk.red(`Error: ${result.error}`));
        }
      }
      console.log(chalk.gray(`Duration: ${result.metrics.totalDurationMs}ms`));
      console.log(chalk.gray(`Tokens: ${result.metrics.totalTokens}`));
      console.log(chalk.gray(`Cost: $${result.metrics.totalCost.toFixed(4)}`));
    } catch (err) {
      console.error(chalk.red('\n[Orchestrator] Mission error:'), err);
    } finally {
      await orchestrator.stop();
    }
  });

program
  .command('info')
  .description('Show system information')
  .action(() => {
    console.log(chalk.blue('\n[Cortex Engine] System Information'));
    console.log(chalk.gray('Version: 0.1.0'));
    console.log(chalk.gray('Runtime: Host'));
    console.log(chalk.gray('Node:'), process.version);
    console.log(chalk.gray('Platform:'), process.platform);
    console.log(chalk.gray('Arch:'), process.arch);
    console.log(chalk.gray('CWD:'), process.cwd());
    console.log();
  });

program.parse();
