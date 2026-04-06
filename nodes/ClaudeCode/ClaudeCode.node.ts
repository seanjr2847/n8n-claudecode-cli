import type {
	IDataObject,
	IExecuteFunctions,
	ILoadOptionsFunctions,
	INodeExecutionData,
	INodePropertyOptions,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { promises as fs } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

export class ClaudeCode implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Claude Code',
		name: 'claudeCode',
		icon: 'file:claudecode.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"]}}',
		description: 'Execute Claude Code CLI via Agent SDK (Max plan)',
		defaults: {
			name: 'Claude Code',
		},
		inputs: ['main'],
		outputs: ['main'],
		credentials: [
			{
				name: 'claudeCodeAuth',
				required: false,
			},
		],
		properties: [
			// ── Operation ──
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Execute',
						value: 'execute',
						description: 'Send a new prompt to Claude Code',
						action: 'Execute a prompt',
					},
					{
						name: 'Continue',
						value: 'continue',
						description: 'Continue an existing conversation',
						action: 'Continue a conversation',
					},
				],
				default: 'execute',
			},

			// ── Core Parameters ──
			{
				displayName: 'Prompt',
				name: 'prompt',
				type: 'string',
				typeOptions: { rows: 4 },
				default: '',
				required: true,
				description: 'The prompt to send to Claude Code',
			},
			{
				displayName: 'Model',
				name: 'model',
				type: 'options',
				options: [
					{ name: 'Sonnet (Latest)', value: 'sonnet' },
					{ name: 'Opus (Latest)', value: 'opus' },
					{ name: 'Haiku (Latest)', value: 'haiku' },
					{ name: 'Claude Sonnet 4.5', value: 'claude-sonnet-4-5-20250929' },
					{ name: 'Claude Sonnet 4', value: 'claude-sonnet-4-20250514' },
					{ name: 'Claude Opus 4', value: 'claude-opus-4-20250514' },
					{ name: 'Claude Haiku 3.5', value: 'claude-3-5-haiku-20241022' },
				],
				default: 'sonnet',
				description: 'Claude model to use',
			},
			{
				displayName: 'Permission Mode',
				name: 'permissionMode',
				type: 'options',
				options: [
					{
						name: 'Plan (Read-Only)',
						value: 'plan',
						description: 'Analysis only, no file modifications',
					},
					{
						name: 'Plan + Execute (Auto-Approve)',
						value: 'planAndExecute',
						description: 'Plan first, then execute with all permissions auto-approved',
					},
					{
						name: 'Default',
						value: 'default',
						description: 'Standard behavior with permission prompts',
					},
					{
						name: 'Accept Edits',
						value: 'acceptEdits',
						description: 'Auto-accept file edit operations',
					},
					{
						name: 'Bypass Permissions',
						value: 'bypassPermissions',
						description: 'Skip all permission checks (dangerous)',
					},
				],
				default: 'plan',
				description: 'How to handle tool permissions',
			},
			{
				displayName: 'Project Path',
				name: 'projectPath',
				type: 'string',
				default: '',
				placeholder: '/path/to/project',
				description: 'Working directory for Claude Code. Leave empty for n8n default.',
			},

			// ── Continue-specific ──
			{
				displayName: 'Session ID',
				name: 'sessionId',
				type: 'string',
				default: '',
				placeholder: 'Leave empty to continue most recent session',
				description: 'Session ID to resume. Empty = continue most recent session.',
				displayOptions: {
					show: {
						operation: ['continue'],
					},
				},
			},

			// ── Advanced Options ──
			{
				displayName: 'Advanced Options',
				name: 'advancedOptions',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				options: [
					{
						displayName: 'Output Format',
						name: 'outputFormat',
						type: 'options',
						options: [
							{ name: 'JSON', value: 'json' },
							{ name: 'Text', value: 'text' },
							{ name: 'Messages', value: 'messages' },
						],
						default: 'json',
						description: 'How to format the output',
					},
					{
						displayName: 'JSON Schema',
						name: 'jsonSchema',
						type: 'json',
						default: '',
						placeholder: '{"type":"object","properties":{...}}',
						description: 'Enforce structured output matching this JSON Schema',
					},
					{
						displayName: 'Effort',
						name: 'effort',
						type: 'options',
						options: [
							{ name: 'Low', value: 'low' },
							{ name: 'Medium', value: 'medium' },
							{ name: 'High', value: 'high' },
							{ name: 'Max', value: 'max' },
						],
						default: 'high',
						description: 'Reasoning effort level',
					},
					{
						displayName: 'Max Turns',
						name: 'maxTurns',
						type: 'number',
						typeOptions: { minValue: 1 },
						default: 25,
						description: 'Maximum number of conversation turns',
					},
					{
						displayName: 'Max Budget (USD)',
						name: 'maxBudgetUsd',
						type: 'number',
						typeOptions: { minValue: 0.01 },
						default: 0,
						description: 'Maximum cost in USD. 0 = no limit.',
					},
					{
						displayName: 'Timeout (Seconds)',
						name: 'timeout',
						type: 'number',
						typeOptions: { minValue: 10 },
						default: 600,
						description: 'Maximum execution time in seconds',
					},
					{
						displayName: 'Allowed Tools',
						name: 'allowedTools',
						type: 'string',
						default: '',
						placeholder: 'Read,Edit,Bash,Grep,Glob',
						description: 'Comma-separated list of tools to auto-allow',
					},
					{
						displayName: 'Disallowed Tools',
						name: 'disallowedTools',
						type: 'string',
						default: '',
						placeholder: 'WebSearch,WebFetch',
						description: 'Comma-separated list of tools to block',
					},
					{
						displayName: 'System Prompt',
						name: 'systemPrompt',
						type: 'string',
						typeOptions: { rows: 4 },
						default: '',
						description: 'Appended to the default Claude Code system prompt',
					},
					{
						displayName: 'Fallback Model',
						name: 'fallbackModel',
						type: 'string',
						default: '',
						placeholder: 'sonnet',
						description: 'Model to use if primary is unavailable',
					},
					{
						displayName: 'Max Thinking Tokens',
						name: 'maxThinkingTokens',
						type: 'number',
						default: 0,
						description: 'Limit reasoning tokens. 0 = no limit.',
					},
					{
						displayName: 'Bare Mode',
						name: 'bareMode',
						type: 'boolean',
						default: false,
						description: 'Whether to skip loading hooks, plugins, skills, and CLAUDE.md',
					},
					{
						displayName: 'Load Settings From',
						name: 'settingSources',
						type: 'multiOptions',
						options: [
							{
								name: 'User (~/.claude/settings.json)',
								value: 'user',
							},
							{
								name: 'Project (.claude/settings.json)',
								value: 'project',
							},
							{
								name: 'Local (.claude/settings.local.json)',
								value: 'local',
							},
						],
						default: [],
						description: 'Load MCP servers, allowed tools, and permissions from Claude Code settings files. Docker: mount ~/.claude/ volume first.',
					},
					{
						displayName: 'Debug',
						name: 'debug',
						type: 'boolean',
						default: false,
						description: 'Whether to enable debug logging',
					},
					{
						displayName: 'Persist Session',
						name: 'persistSession',
						type: 'boolean',
						default: true,
						description: 'Whether to save the session for later resumption',
					},
				],
			},

			// ── MCP Servers (from local settings) ──
			{
				displayName: 'MCP Servers (From Settings)',
				name: 'mcpServerNames',
				type: 'multiOptions',
				typeOptions: {
					loadOptionsMethod: 'getAvailableMcpServers',
				},
				default: [],
				description: 'Select MCP servers from your ~/.claude.json config. Docker: mount ~/.claude.json as a volume.',
			},

			// ── MCP Servers (manual add) ──
			{
				displayName: 'Additional MCP Servers',
				name: 'mcpServersCollection',
				type: 'fixedCollection',
				typeOptions: { multipleValues: true },
				default: {},
				placeholder: 'Add Custom MCP Server',
				description: 'Manually add MCP servers not in your settings file',
				options: [
					{
						displayName: 'Servers',
						name: 'servers',
						values: [
							{
								displayName: 'Server Name',
								name: 'name',
								type: 'string',
								default: '',
								placeholder: 'my-server',
								description: 'Unique name for this server. Used in tool names as mcp__name__toolname.',
							},
							{
								displayName: 'Type',
								name: 'type',
								type: 'options',
								options: [
									{ name: 'Stdio (command)', value: 'stdio' },
									{ name: 'HTTP', value: 'http' },
									{ name: 'SSE', value: 'sse' },
								],
								default: 'stdio',
							},
							{
								displayName: 'Command',
								name: 'command',
								type: 'string',
								default: 'npx',
								placeholder: 'npx',
								description: 'Command to run the MCP server',
								displayOptions: { show: { type: ['stdio'] } },
							},
							{
								displayName: 'Arguments',
								name: 'args',
								type: 'string',
								default: '',
								placeholder: '-y @modelcontextprotocol/server-filesystem /data',
								description: 'Space-separated arguments for the command',
								displayOptions: { show: { type: ['stdio'] } },
							},
							{
								displayName: 'URL',
								name: 'url',
								type: 'string',
								default: '',
								placeholder: 'https://mcp-server.example.com',
								displayOptions: { show: { type: ['http', 'sse'] } },
							},
							{
								displayName: 'Environment Variables',
								name: 'envVars',
								type: 'string',
								default: '',
								placeholder: 'GITHUB_TOKEN=ghp_xxx,API_KEY=abc123',
								description: 'Comma-separated KEY=VALUE pairs',
							},
						],
					},
				],
			},

			// ── Plugins ──
			{
				displayName: 'Plugins',
				name: 'pluginsCollection',
				type: 'fixedCollection',
				typeOptions: { multipleValues: true },
				default: {},
				placeholder: 'Add Plugin',
				options: [
					{
						displayName: 'Plugins',
						name: 'plugins',
						values: [
							{
								displayName: 'Plugin Path',
								name: 'path',
								type: 'string',
								default: '',
								placeholder: '/path/to/my-plugin',
								description: 'Absolute or relative path to the plugin directory (must contain .claude-plugin/plugin.json)',
							},
						],
					},
				],
			},

			// ── Agents ──
			{
				displayName: 'Custom Agents',
				name: 'agentsCollection',
				type: 'fixedCollection',
				typeOptions: { multipleValues: true },
				default: {},
				placeholder: 'Add Agent',
				options: [
					{
						displayName: 'Agents',
						name: 'agents',
						values: [
							{
								displayName: 'Agent Name',
								name: 'name',
								type: 'string',
								default: '',
								placeholder: 'code-reviewer',
								description: 'Unique name for this agent',
							},
							{
								displayName: 'Description',
								name: 'description',
								type: 'string',
								default: '',
								placeholder: 'Expert code review specialist',
								description: 'When should Claude invoke this agent?',
							},
							{
								displayName: 'Prompt',
								name: 'prompt',
								type: 'string',
								typeOptions: { rows: 3 },
								default: '',
								placeholder: 'Review code for security, performance, and best practices',
								description: 'System prompt for this agent',
							},
							{
								displayName: 'Tools',
								name: 'tools',
								type: 'string',
								default: '',
								placeholder: 'Read,Grep,Glob,Bash',
								description: 'Comma-separated tools this agent can use. Leave empty to inherit all.',
							},
							{
								displayName: 'Model',
								name: 'model',
								type: 'options',
								options: [
									{ name: 'Inherit (same as parent)', value: '' },
									{ name: 'Sonnet', value: 'sonnet' },
									{ name: 'Opus', value: 'opus' },
									{ name: 'Haiku', value: 'haiku' },
								],
								default: '',
								description: 'Model override for this agent',
							},
						],
					},
				],
			},
		],
	};

	methods = {
		loadOptions: {
			async getAvailableMcpServers(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const options: INodePropertyOptions[] = [];
				const settingsPaths = [
					join(homedir(), '.claude.json'),
					join(homedir(), '.claude', 'settings.json'),
					join(homedir(), '.claude', 'settings.local.json'),
				];
				const seen = new Set<string>();

				for (const filePath of settingsPaths) {
					try {
						const content = await fs.readFile(filePath, 'utf-8');
						const config = JSON.parse(content);
						const servers = config.mcpServers || {};
						for (const name of Object.keys(servers)) {
							if (seen.has(name)) continue;
							seen.add(name);
							const server = servers[name];
							const label = server.command
								? `${name} (${server.command} ${(server.args || []).join(' ')})`
								: `${name} (${server.type || 'stdio'})`;
							options.push({ name: label, value: name });
						}
					} catch {
						// File not found or invalid JSON — skip
					}
				}

				if (options.length === 0) {
					options.push({
						name: '(No MCP servers found in ~/.claude.json)',
						value: '',
					});
				}

				return options;
			},
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let i = 0; i < items.length; i++) {
			try {
				const result = await executeItem.call(this, i);
				returnData.push({ json: result as IDataObject });
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: {
							error: error instanceof Error ? error.message : String(error),
							isError: true,
						},
					});
					continue;
				}
				throw error;
			}
		}

		return [returnData];
	}
}

async function executeItem(
	this: IExecuteFunctions,
	itemIndex: number,
): Promise<Record<string, unknown>> {
	// Dynamic import for ESM module
	const { query, AbortError } = await import('@anthropic-ai/claude-agent-sdk');

	const operation = this.getNodeParameter('operation', itemIndex) as string;
	const prompt = this.getNodeParameter('prompt', itemIndex) as string;
	const model = this.getNodeParameter('model', itemIndex) as string;
	const permissionMode = this.getNodeParameter('permissionMode', itemIndex) as string;
	const projectPath = this.getNodeParameter('projectPath', itemIndex, '') as string;
	const advanced = this.getNodeParameter('advancedOptions', itemIndex, {}) as Record<string, unknown>;

	// ── Build environment ──
	const env: Record<string, string | undefined> = { ...process.env };
	try {
		const credentials = await this.getCredentials('claudeCodeAuth');
		if (credentials?.authMethod === 'oauthToken' && credentials?.oauthToken) {
			env['CLAUDE_CODE_OAUTH_TOKEN'] = credentials.oauthToken as string;
		}
	} catch {
		// No credentials configured — rely on host session auth
	}

	// ── Build SDK options ──
	const options: Record<string, unknown> = {
		model,
		permissionMode: permissionMode === 'planAndExecute' ? 'plan' : permissionMode,
		env,
	};

	if (projectPath) {
		options.cwd = projectPath;
	}

	// Permission bypass safety
	if (permissionMode === 'bypassPermissions') {
		options.allowDangerouslySkipPermissions = true;
	}

	// Session management
	if (operation === 'continue') {
		const sessionId = this.getNodeParameter('sessionId', itemIndex, '') as string;
		if (sessionId) {
			options.resume = sessionId;
		} else {
			options.continue = true;
		}
	}

	// Advanced options
	if (advanced.maxTurns) options.maxTurns = advanced.maxTurns;
	if (advanced.maxBudgetUsd && (advanced.maxBudgetUsd as number) > 0) {
		options.maxBudgetUsd = advanced.maxBudgetUsd;
	}
	if (advanced.fallbackModel) options.fallbackModel = advanced.fallbackModel;
	if (advanced.maxThinkingTokens && (advanced.maxThinkingTokens as number) > 0) {
		options.maxThinkingTokens = advanced.maxThinkingTokens;
	}
	if (advanced.persistSession === false) options.persistSession = false;
	if (advanced.debug) options.debug = true;
	if (advanced.includePartialMessages) options.includePartialMessages = true;

	// Allowed/Disallowed tools
	const allowedToolsStr = advanced.allowedTools as string | undefined;
	if (allowedToolsStr) {
		options.allowedTools = allowedToolsStr.split(',').map((t: string) => t.trim()).filter(Boolean);
	}
	const disallowedToolsStr = advanced.disallowedTools as string | undefined;
	if (disallowedToolsStr) {
		options.disallowedTools = disallowedToolsStr.split(',').map((t: string) => t.trim()).filter(Boolean);
	}

	// System prompt
	const systemPromptText = advanced.systemPrompt as string | undefined;
	if (systemPromptText) {
		options.systemPrompt = {
			type: 'preset',
			preset: 'claude_code',
			append: systemPromptText,
		};
	}

	// JSON Schema output
	const jsonSchemaStr = advanced.jsonSchema as string | undefined;
	if (jsonSchemaStr) {
		try {
			const schema = JSON.parse(jsonSchemaStr);
			options.outputFormat = { type: 'json_schema', schema };
		} catch {
			throw new NodeOperationError(this.getNode(), 'Invalid JSON Schema', { itemIndex });
		}
	}

	// Effort via extraArgs
	const extraArgs: Record<string, string | null> = {};
	if (advanced.effort) {
		extraArgs['effort'] = advanced.effort as string;
	}
	if (advanced.bareMode) {
		extraArgs['bare'] = null;
	}
	if (Object.keys(extraArgs).length > 0) {
		options.extraArgs = extraArgs;
	}

	// Setting sources
	const settingSources = advanced.settingSources as string[] | undefined;
	if (advanced.bareMode) {
		options.settingSources = [];
	} else if (settingSources && settingSources.length > 0) {
		options.settingSources = settingSources;
	}

	// ── MCP Servers (from settings + manual) ──
	const mcpServers: Record<string, unknown> = {};

	// Load selected servers from settings files
	const selectedMcpNames = this.getNodeParameter('mcpServerNames', itemIndex, []) as string[];
	if (selectedMcpNames.length > 0) {
		const settingsPaths = [
			join(homedir(), '.claude.json'),
			join(homedir(), '.claude', 'settings.json'),
			join(homedir(), '.claude', 'settings.local.json'),
		];
		for (const filePath of settingsPaths) {
			try {
				const content = await fs.readFile(filePath, 'utf-8');
				const config = JSON.parse(content);
				const servers = config.mcpServers || {};
				for (const name of selectedMcpNames) {
					if (servers[name] && !mcpServers[name]) {
						mcpServers[name] = servers[name];
					}
				}
			} catch {
				// File not found or invalid — skip
			}
		}
	}

	// Add manually configured servers
	const mcpCollection = this.getNodeParameter('mcpServersCollection', itemIndex, {}) as {
		servers?: Array<{ name: string; type: string; command?: string; args?: string; url?: string; envVars?: string }>;
	};
	if (mcpCollection.servers && mcpCollection.servers.length > 0) {
		for (const server of mcpCollection.servers) {
			if (!server.name) continue;
			const envObj: Record<string, string> = {};
			if (server.envVars) {
				for (const pair of server.envVars.split(',')) {
					const [key, ...vals] = pair.split('=');
					if (key?.trim()) envObj[key.trim()] = vals.join('=').trim();
				}
			}
			if (server.type === 'stdio') {
				mcpServers[server.name] = {
					command: server.command || 'npx',
					args: server.args ? server.args.split(/\s+/).filter(Boolean) : [],
					...(Object.keys(envObj).length > 0 ? { env: envObj } : {}),
				};
			} else {
				mcpServers[server.name] = {
					type: server.type,
					url: server.url || '',
					...(Object.keys(envObj).length > 0 ? { headers: envObj } : {}),
				};
			}
		}
	}

	if (Object.keys(mcpServers).length > 0) {
		options.mcpServers = mcpServers;
	}

	// ── Plugins (fixedCollection → SDK format) ──
	const pluginsCollection = this.getNodeParameter('pluginsCollection', itemIndex, {}) as {
		plugins?: Array<{ path: string }>;
	};
	if (pluginsCollection.plugins && pluginsCollection.plugins.length > 0) {
		options.plugins = pluginsCollection.plugins
			.filter((p) => p.path)
			.map((p) => ({ type: 'local' as const, path: p.path }));
	}

	// ── Agents (fixedCollection → SDK format) ──
	const agentsCollection = this.getNodeParameter('agentsCollection', itemIndex, {}) as {
		agents?: Array<{ name: string; description: string; prompt: string; tools?: string; model?: string }>;
	};
	if (agentsCollection.agents && agentsCollection.agents.length > 0) {
		const agents: Record<string, unknown> = {};
		for (const agent of agentsCollection.agents) {
			if (!agent.name) continue;
			const def: Record<string, unknown> = {
				description: agent.description,
				prompt: agent.prompt,
			};
			if (agent.tools) {
				def.tools = agent.tools.split(',').map((t: string) => t.trim()).filter(Boolean);
			}
			if (agent.model) {
				def.model = agent.model;
			}
			agents[agent.name] = def;
		}
		if (Object.keys(agents).length > 0) {
			options.agents = agents;
		}
	}

	// ── Timeout ──
	const timeoutSec = (advanced.timeout as number) || 600;
	const abortController = new AbortController();
	const timer = setTimeout(() => abortController.abort(), timeoutSec * 1000);
	options.abortController = abortController;

	// ── Helper: run a single query ──
	async function runQuery(
		queryPrompt: string,
		queryOptions: Record<string, unknown>,
	): Promise<{ messages: Record<string, unknown>[]; resultMessage: Record<string, unknown> | null }> {
		const msgs: Record<string, unknown>[] = [];
		let result: Record<string, unknown> | null = null;

		const stream = query({ prompt: queryPrompt, options: queryOptions as any });
		for await (const message of stream) {
			if (message.type === 'result') {
				result = message as unknown as Record<string, unknown>;
			}
			msgs.push(message as unknown as Record<string, unknown>);
		}
		return { messages: msgs, resultMessage: result };
	}

	// ── Execute query ──
	let messages: Record<string, unknown>[] = [];
	let resultMessage: Record<string, unknown> | null = null;

	try {
		if (permissionMode === 'planAndExecute') {
			// Phase 1: Plan
			const planOptions: Record<string, unknown> = { ...options, permissionMode: 'plan' };
			delete planOptions.allowDangerouslySkipPermissions;
			const planResult = await runQuery(prompt, planOptions);
			const planText = (planResult.resultMessage?.result as string) || '';

			// Phase 2: Execute with auto-approve using the plan
			clearTimeout(timer);
			const executeAbort = new AbortController();
			const executeTimer = setTimeout(() => executeAbort.abort(), timeoutSec * 1000);
			try {
				const executeOptions = {
					...options,
					permissionMode: 'bypassPermissions',
					allowDangerouslySkipPermissions: true,
					abortController: executeAbort,
				};
				const executePrompt = `Execute the following plan:\n\n${planText}\n\nOriginal request: ${prompt}`;
				const executeResult = await runQuery(executePrompt, executeOptions);
				messages = executeResult.messages;
				resultMessage = executeResult.resultMessage;
			} finally {
				clearTimeout(executeTimer);
			}
		} else {
			// Standard single-phase execution
			const result = await runQuery(prompt, options);
			messages = result.messages;
			resultMessage = result.resultMessage;
		}
	} catch (error) {
		if (error instanceof AbortError || (error instanceof Error && error.name === 'AbortError')) {
			throw new NodeOperationError(
				this.getNode(),
				`Execution timed out after ${timeoutSec} seconds`,
				{ itemIndex },
			);
		}
		const errMsg = error instanceof Error ? error.message : String(error);
		if (errMsg.includes('authentication') || errMsg.includes('401') || errMsg.includes('auth')) {
			throw new NodeOperationError(
				this.getNode(),
				`Authentication failed. Run 'claude login' on the n8n host or provide an OAuth token via credentials. Details: ${errMsg}`,
				{ itemIndex },
			);
		}
		throw new NodeOperationError(this.getNode(), errMsg, { itemIndex });
	} finally {
		clearTimeout(timer);
	}

	// ── Format output ──
	const outputFormat = (advanced.outputFormat as string) || 'json';

	if (outputFormat === 'text') {
		return {
			sessionId: resultMessage?.session_id ?? '',
			result: resultMessage?.result ?? '',
			isError: resultMessage?.is_error ?? false,
			durationMs: resultMessage?.duration_ms ?? 0,
			costUsd: resultMessage?.total_cost_usd ?? 0,
		};
	}

	if (outputFormat === 'messages') {
		return {
			sessionId: resultMessage?.session_id ?? '',
			result: resultMessage?.result ?? '',
			isError: resultMessage?.is_error ?? false,
			durationMs: resultMessage?.duration_ms ?? 0,
			costUsd: resultMessage?.total_cost_usd ?? 0,
			numTurns: resultMessage?.num_turns ?? 0,
			structuredOutput: resultMessage?.structured_output ?? null,
			messages,
		};
	}

	// json (default)
	return {
		sessionId: resultMessage?.session_id ?? '',
		result: resultMessage?.structured_output ?? resultMessage?.result ?? '',
		isError: resultMessage?.is_error ?? false,
		durationMs: resultMessage?.duration_ms ?? 0,
		costUsd: resultMessage?.total_cost_usd ?? 0,
		numTurns: resultMessage?.num_turns ?? 0,
		usage: resultMessage?.usage ?? {},
		modelUsage: resultMessage?.modelUsage ?? {},
		structuredOutput: resultMessage?.structured_output ?? null,
	};
}
