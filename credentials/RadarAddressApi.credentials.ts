/* (c) 2026 RadarWave di Gianluca Sordiglioni - www.radarwave.it */
import type {
	IAuthenticateGeneric,
	Icon,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class RadarAddressApi implements ICredentialType {
	name = 'radarAddressApi';

	displayName = 'RadarAddress API';

	icon: Icon = { light: 'file:radaraddress.svg', dark: 'file:radaraddress.dark.svg' };

	documentationUrl = 'https://www.radaraddress.com/en/n8n-integration?utm_source=plugin-n8n';

	properties: INodeProperties[] = [
		{
			displayName: 'API Token',
			name: 'apiToken',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			description:
				'The API token of your RadarAddress account. No account yet? Create a free one at www.radaraddress.com and copy the token from the API token page.',
		},
		{
			displayName: 'API URL',
			name: 'baseUrl',
			type: 'string',
			default: 'https://www.radaraddress.com/api/v1',
			description: 'Leave as it is. Change it only if you were given another address together with your token.',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '=Bearer {{$credentials.apiToken}}',
			},
		},
	};

	// GET /credit consumes nothing and says whose token it is
	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{$credentials.baseUrl}}',
			url: '/credit',
			method: 'GET',
		},
	};
}
