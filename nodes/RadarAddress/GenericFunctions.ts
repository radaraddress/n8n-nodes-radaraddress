/* (c) 2026 RadarWave di Gianluca Sordiglioni - www.radarwave.it */
import type { IDataObject, IExecuteFunctions, IHttpRequestMethods, JsonObject } from 'n8n-workflow';
import { NodeApiError } from 'n8n-workflow';

// Same number as package.json (checked by the test that comes with the package)
export const VERSION = '1.0.1';

export const DEFAULT_API_URL = 'https://www.radaraddress.com/api/v1';

const SITE = 'https://www.radaraddress.com';
// the counter arrives in English from the API, the packs page wants the Italian code
const COUNTER_SITE: IDataObject = { contact: 'contatto', dedupe: 'deduplica', light: 'leggere' };

/** Where the call comes from, for the headers every integration sends. */
export function contextHeaders(ctx: IExecuteFunctions): Record<string, string> {
	let instance = '';
	try {
		instance = String(ctx.getInstanceBaseUrl() || '').replace(/\/+$/, '');
	} catch {
		instance = '';
	}
	const headers: Record<string, string> = {
		'User-Agent': `RadarAddress-N8n/${VERSION}${instance ? ` (${instance})` : ''}`,
		Accept: 'application/json',
	};
	const wf = ctx.getWorkflow();
	const clean = (s: string) =>
		s
			.normalize('NFKD')
			.replace(/[^\x20-\x7e]/g, '')
			.replace(/\s+/g, '-')
			.slice(0, 60);
	const nome = clean(String(wf.name || '')) || (wf.id ? `workflow-${wf.id}` : '');
	if (nome) headers['X-RadarAddress-Form'] = `n8n:${nome}`;
	// the address of the workflow, never a query or a fragment
	if (instance && wf.id) headers['X-RadarAddress-Form-Page'] = `${instance}/workflow/${wf.id}`;
	return headers;
}

/** One call to the RadarAddress API with the token of the credential. */
export async function raRequest(
	ctx: IExecuteFunctions,
	method: IHttpRequestMethods,
	endpoint: string,
	body: IDataObject | undefined,
	itemIndex: number,
): Promise<IDataObject> {
	const credentials = await ctx.getCredentials('radarAddressApi');
	const base = String(credentials.baseUrl || DEFAULT_API_URL).replace(/\/+$/, '');
	const response = (await ctx.helpers.httpRequestWithAuthentication.call(ctx, 'radarAddressApi', {
		method,
		url: `${base}/${endpoint}`,
		headers: { ...contextHeaders(ctx), ...(body ? { 'Content-Type': 'application/json' } : {}) },
		body,
		json: true,
		returnFullResponse: true,
		ignoreHttpStatusErrors: true,
		timeout: 120000,
	})) as { statusCode: number; body: unknown; headers: Record<string, string> };

	const status = response.statusCode;
	let data: IDataObject = {};
	if (response.body && typeof response.body === 'object') data = response.body as IDataObject;
	else if (typeof response.body === 'string') {
		try {
			data = JSON.parse(response.body) as IDataObject;
		} catch {
			data = {};
		}
	}
	if (status < 400) return data;
	// a tax code that does not check out answers 400 with the outcome in the body: it is a result, not a failure
	const detail = (data.detail ?? {}) as IDataObject;
	if (status === 400 && ((typeof data.outcome === 'string' && data.outcome !== '') || typeof detail.outcome === 'string')) return data;

	const err = (data.error ?? {}) as IDataObject;
	const code = String(err.code || `http_${status}`);
	let message = String(err.message || `RadarAddress answered with HTTP ${status}.`);
	let description = `Error code: ${code}`;
	if (status === 401) {
		message = 'The RadarAddress API token is not valid';
		description = 'Check the token in the RadarAddress API credential, or create a new one in your account.';
	} else if (status === 402) {
		const c = (data.credit ?? {}) as IDataObject;
		message = 'Not enough operations available on your RadarAddress account';
		if (Number.isFinite(c.needed) && Number.isFinite(c.available)) {
			description = `This step needs ${c.needed}, ${c.available} available.`;
		}
		if (credentials.baseUrl === DEFAULT_API_URL || !credentials.baseUrl) {
			const counter = String(c.counter || 'contact');
			description += ` Add a pack: ${SITE}/en/crediti.php?compra=${encodeURIComponent(String(COUNTER_SITE[counter] || counter))}`;
		}
	} else if (status === 429) {
		const wait = response.headers?.['retry-after'];
		description = wait ? `Try again in ${wait} seconds. ${description}` : description;
	}
	throw new NodeApiError(ctx.getNode(), data as JsonObject, {
		message,
		description,
		httpCode: String(status),
		itemIndex,
	});
}
