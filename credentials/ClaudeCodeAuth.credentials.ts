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
					description: 'Use the Claude Code login session on the n8n host machine',
				},
				{
					name: 'OAuth Token',
					value: 'oauthToken',
					description: 'Use an OAuth token from "claude setup-token"',
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
			description: 'Token obtained via "claude setup-token" command',
			displayOptions: {
				show: {
					authMethod: ['oauthToken'],
				},
			},
		},
	];
}
