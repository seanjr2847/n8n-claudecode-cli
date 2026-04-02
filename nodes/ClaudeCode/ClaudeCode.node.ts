import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

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
					{ name: 'Sonnet', value: 'sonnet' },
					{ name: 'Opus', value: 'opus' },
					{ name: 'Haiku', value: 'haiku' },
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

			// ── MCP Servers ──
			{
				displayName: 'MCP Servers',
				name: 'mcpServers',
				type: 'json',
				default: '',
				placeholder: '{"server-name": {"command": "npx", "args": ["-y", "mcp-server"]}}',
				description: 'MCP server configurations as JSON object',
			},

			// ── Plugins ──
			{
				displayName: 'Plugins',
				name: 'plugins',
				type: 'json',
				default: '',
				placeholder: '[{"type": "local", "path": "./my-plugin"}]',
				description: 'Plugin configurations as JSON array',
			},

			// ── Agents ──
			{
				displayName: 'Agents',
				name: 'agents',
				type: 'json',
				default: '',
				placeholder: '{"reviewer": {"description": "Code reviewer", "prompt": "Review code", "tools": ["Read","Grep"]}}',
				description: 'Custom agent definitions as JSON object',
			},
		],
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
		permissionMode,
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

	// Setting sources (bare mode = none)
	if (advanced.bareMode) {
		options.settingSources = [];
	}

	// ── MCP Servers ──
	const mcpServersStr = this.getNodeParameter('mcpServers', itemIndex, '') as string;
	if (mcpServersStr) {
		try {
			options.mcpServers = JSON.parse(mcpServersStr);
		} catch {
			throw new NodeOperationError(this.getNode(), 'Invalid MCP Servers JSON', { itemIndex });
		}
	}

	// ── Plugins ──
	const pluginsStr = this.getNodeParameter('plugins', itemIndex, '') as string;
	if (pluginsStr) {
		try {
			options.plugins = JSON.parse(pluginsStr);
		} catch {
			throw new NodeOperationError(this.getNode(), 'Invalid Plugins JSON', { itemIndex });
		}
	}

	// ── Agents ──
	const agentsStr = this.getNodeParameter('agents', itemIndex, '') as string;
	if (agentsStr) {
		try {
			options.agents = JSON.parse(agentsStr);
		} catch {
			throw new NodeOperationError(this.getNode(), 'Invalid Agents JSON', { itemIndex });
		}
	}

	// ── Timeout ──
	const timeoutSec = (advanced.timeout as number) || 600;
	const abortController = new AbortController();
	const timer = setTimeout(() => abortController.abort(), timeoutSec * 1000);
	options.abortController = abortController;

	// ── Execute query ──
	const messages: Record<string, unknown>[] = [];
	let resultMessage: Record<string, unknown> | null = null;

	try {
		const stream = query({ prompt, options: options as any });

		for await (const message of stream) {
			if (message.type === 'result') {
				resultMessage = message as unknown as Record<string, unknown>;
			}
			messages.push(message as unknown as Record<string, unknown>);
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
