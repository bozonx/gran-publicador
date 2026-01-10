import {
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class GranPublicadorApi implements ICredentialType {
	name = 'granPublicadorApi';
	displayName = 'Gran Publicador API';
	documentationUrl = 'https://github.com/bozonx/gran-publicador';
	properties: INodeProperties[] = [
		{
			displayName: 'Base URL',
			name: 'baseUrl',
			type: 'string',
			default: 'http://gran-publicador:8080',
			required: true,
			description: 'The base URL of the Gran Publicador API',
		},
		{
			displayName: 'API Token',
			name: 'apiToken',
			type: 'string',
			typeOptions: {
				password: true,
			},
			default: '',
			required: true,
			description: 'The API token for authentication',
		},
	];
}
