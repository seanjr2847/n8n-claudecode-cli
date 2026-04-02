import type {
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class ClaudeCodeAuth implements ICredentialType {
	name = 'claudeCodeAuth';
	displayName = 'Claude Code Auth';
	documentationUrl = 'https://docs.anthropic.com/en/docs/claude-code';
	properties: INodeProperties[] = [
		{
			displayName: 'Auth Method',
			name: 'authMethod',
			type: 'options',
			options: [
				{
					name: 'Host Session (claude login)',
					value: 'hostSession',
					description: 'Requires: run "npm i -g @anthropic-ai/claude-code && claude login" on the n8n host. Docker: run inside the container or use OAuth Token instead.',
				},
				{
					name: 'OAuth Token (Recommended for Docker)',
					value: 'oauthToken',
					description: 'Run "claude setup-token" on any machine with Claude Code installed, then paste the token here.',
				},
			],
			default: 'hostSession',
		},
		{
			displayName: 'OAuth Token',
			name: 'oauthToken',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			description: 'Token obtained via "claude setup-token" command. Steps: 1) Install Claude Code CLI, 2) Run "claude setup-token", 3) Paste the output token here.',
			displayOptions: {
				show: {
					authMethod: ['oauthToken'],
				},
			},
		},
	];
}
