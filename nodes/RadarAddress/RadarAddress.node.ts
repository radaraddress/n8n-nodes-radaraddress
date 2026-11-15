/* (c) 2026 RadarWave di Gianluca Sordiglioni - www.radarwave.it */
import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeApiError, NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

import {
	flattenContact,
	flattenCredit,
	flattenEmail,
	flattenEnrichment,
	flattenPhone,
	flattenTaxCode,
	flattenWebsite,
} from './flatten';
import { raRequest } from './GenericFunctions';

const LANGUAGES = [
	{ name: 'Account Language', value: '' },
	{ name: 'Dansk', value: 'da' },
	{ name: 'Deutsch', value: 'de' },
	{ name: 'English', value: 'en' },
	{ name: 'Español', value: 'es' },
	{ name: 'Français', value: 'fr' },
	{ name: 'Íslenska', value: 'is' },
	{ name: 'Italiano', value: 'it' },
	{ name: 'Nederlands', value: 'nl' },
	{ name: 'Norsk', value: 'no' },
	{ name: 'Português', value: 'pt' },
	{ name: 'Suomi', value: 'fi' },
	{ name: 'Svenska', value: 'sv' },
	{ name: 'Ελληνικά', value: 'el' },
];

const language: INodeProperties = {
	displayName: 'Language of the Messages',
	name: 'language',
	type: 'options',
	options: LANGUAGES,
	default: '',
	description:
		'Language of the outcome title, reason and notes. Field names and outcome codes stay in English. By default the language of your RadarAddress account.',
};

const simplify = (resources: string[]): INodeProperties => ({
	displayName: 'Simplify',
	name: 'simplify',
	type: 'boolean',
	default: true,
	description:
		'Whether to return a flat record with the verified values ("verified_address", "verified_postcode"...) or the whole answer of the API',
	displayOptions: { show: { resource: resources } },
});

const countryField = (description: string, displayName = 'Country'): INodeProperties => ({
	displayName,
	name: 'country',
	type: 'string',
	default: '',
	placeholder: 'e.g. DE or Germany',
	description,
});

const show = (resource: string, operation?: string[]) => ({
	show: { resource: [resource], ...(operation ? { operation } : {}) },
});

export class RadarAddress implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'RadarAddress',
		name: 'radarAddress',
		icon: { light: 'file:radaraddress.svg', dark: 'file:radaraddress.dark.svg' },
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description:
			'Verify postal addresses, emails, phone numbers and websites, check Italian tax codes, split names with the right salutation and find duplicate contacts',
		defaults: { name: 'RadarAddress' },
		usableAsTool: true,
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [{ name: 'radarAddressApi', required: true }],
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{ name: 'Contact', value: 'contact' },
					{ name: 'Credit', value: 'credit' },
					{ name: 'Duplicate', value: 'duplicate' },
					{ name: 'Email', value: 'email' },
					{ name: 'Name', value: 'name' },
					{ name: 'Phone', value: 'phone' },
					{ name: 'Tax Code', value: 'taxCode' },
					{ name: 'Website', value: 'website' },
				],
				default: 'contact',
			},

			// ---------------------------------------------------------------- operations
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: show('contact'),
				options: [
					{
						name: 'Verify',
						value: 'verify',
						action: 'Verify a contact',
						description:
							'Verify and correct a postal address against the national address registers, and check the email, phone, name and tax code of the same record',
					},
				],
				default: 'verify',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: show('email'),
				options: [
					{
						name: 'Verify',
						value: 'verify',
						action: 'Verify an email',
						description:
							'Check that an email address can receive mail, correct certain typos in common domains and recognise disposable and generic addresses. No email is sent.',
					},
				],
				default: 'verify',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: show('phone'),
				options: [
					{
						name: 'Verify',
						value: 'verify',
						action: 'Verify a phone number',
						description: 'Check and format a phone number without calling it',
					},
				],
				default: 'verify',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: show('website'),
				options: [
					{
						name: 'Verify',
						value: 'verify',
						action: 'Verify a website',
						description: 'Check the domain, the HTTP answer and the certificate of a website',
					},
				],
				default: 'verify',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: show('name'),
				options: [
					{
						name: 'Enrich',
						value: 'enrich',
						action: 'Enrich a name',
						description:
							'Split a name into last name, first name and title, tell a person from a company and write the salutation',
					},
				],
				default: 'enrich',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: show('taxCode'),
				options: [
					{
						name: 'Extract',
						value: 'extract',
						action: 'Extract data from a tax code',
						description: 'Read birth date, gender and birth place from an Italian tax code',
					},
					{
						name: 'Generate',
						value: 'generate',
						action: 'Generate a tax code',
						description: 'Compute the Italian tax code from the personal data',
					},
					{
						name: 'Validate',
						value: 'validate',
						action: 'Validate a tax code',
						description: 'Check format and check character of an Italian tax code, homocodes included',
					},
				],
				default: 'validate',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: show('duplicate'),
				options: [
					{
						name: 'Find',
						value: 'find',
						action: 'Find duplicate contacts',
						description:
							'Find the contacts that are the same person among all the incoming items, with the level of certainty and the reason',
					},
				],
				default: 'find',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: show('credit'),
				options: [
					{
						name: 'Get',
						value: 'get',
						action: 'Get the available operations',
						description: 'Operations available and state of every counter of the token. Consumes nothing.',
					},
				],
				default: 'get',
			},

			// ---------------------------------------------------------------- contact
			{
				displayName: 'Street and House Number',
				name: 'address',
				type: 'string',
				required: true,
				default: '',
				placeholder: 'e.g. via leopardi 4',
				description:
					'The street line as written. The whole address in this one field works too, when the other fields are empty.',
				displayOptions: show('contact'),
			},
			{
				displayName: 'Postcode',
				name: 'postcode',
				type: 'string',
				default: '',
				displayOptions: show('contact'),
			},
			{
				displayName: 'Town or City',
				name: 'city',
				type: 'string',
				default: '',
				displayOptions: show('contact'),
			},
			{
				...countryField(
					'Country of the address: the ISO code (DE) or the name (Germany). Empty: Italy.',
				),
				displayOptions: show('contact'),
			},
			{
				displayName: 'Additional Fields',
				name: 'additionalFields',
				type: 'collection',
				placeholder: 'Add Field',
				default: {},
				displayOptions: show('contact'),
				options: [
					{ displayName: 'Building, Floor, Flat', name: 'building', type: 'string', default: '' },
					{ displayName: 'Care Of (C/O)', name: 'careOf', type: 'string', default: '' },
					{
						displayName: 'Email',
						name: 'email',
						type: 'string',
						placeholder: 'name@email.com',
						default: '',
						description: 'Checked in the same call, with no further operation consumed',
					},
					{ displayName: 'First Name', name: 'firstName', type: 'string', default: '' },
					{ displayName: 'Last Name', name: 'lastName', type: 'string', default: '', description: 'The whole name in one field works too' },
					language,
					{
						displayName: 'Phone',
						name: 'phone',
						type: 'string',
						default: '',
						description:
							'Checked in the same call, with the country of the address, with no further operation consumed',
					},
					{
						displayName: 'Precision',
						name: 'precision',
						type: 'options',
						options: [
							{ name: '1 Strict', value: 1, description: 'The town as written, only corrections the data confirm beyond doubt' },
							{ name: '2 Narrow', value: 2, description: 'Also wrong postcodes and provinces, abbreviated town names' },
							{ name: '3 Normal', value: 3, description: 'Also names written in part, and the street moved to the municipality where it is' },
							{ name: '4 Broad', value: 4, description: 'Also names that sound the same; confidence is never high' },
							{ name: '5 Maximum', value: 5, description: 'Everything that can be found; confidence is never high' },
						],
						default: 3,
						description: 'How far RadarAddress goes to find a badly written address',
					},
					{
						displayName: 'Province or Region',
						name: 'province',
						type: 'string',
						default: '',
						description: 'Italy: the two-letter province code (MI, RM). Leave empty elsewhere.',
					},
					{
						displayName: 'Tax Code (Codice Fiscale)',
						name: 'taxCode',
						type: 'string',
						default: '',
						description: 'Italian tax code: checked and compared with the name',
					},
				],
			},

			// ---------------------------------------------------------------- email
			{
				displayName: 'Email Address',
				name: 'email',
				type: 'string',
				required: true,
				placeholder: 'name@email.com',
				default: '',
				displayOptions: show('email'),
			},
			{
				displayName: 'Options',
				name: 'options',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				displayOptions: show('email'),
				options: [
					{
						displayName: 'Fix Typos',
						name: 'fixTypos',
						type: 'boolean',
						default: true,
						description:
							'Whether to correct the typo. When off (the person confirmed the address is as written) it is kept as it is and a likely typo only goes to "similar_to".',
					},
					language,
					{
						displayName: 'Typo Correction',
						name: 'precision',
						type: 'options',
						options: [
							{ name: '1 Only Domains That Do Not Exist', value: 1 },
							{ name: '2 Also Domains That Receive No Email', value: 2 },
							{ name: '3 Also Domains That Receive Email', value: 3 },
						],
						default: 3,
						description:
							'Which typos in the domain are corrected. A typo above the chosen level is not corrected: the likely address goes to "similar_to".',
					},
				],
			},

			// ---------------------------------------------------------------- phone
			{
				displayName: 'Phone Number',
				name: 'phone',
				type: 'string',
				required: true,
				default: '',
				description: 'Up to three numbers in one field are split into "verified_phone", "verified_phone2" and "verified_phone3"',
				displayOptions: show('phone'),
			},
			{
				displayName: 'Options',
				name: 'options',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				displayOptions: show('phone'),
				options: [
					countryField(
						'Country of the numbers written without the international prefix: the ISO code (DE) or the name. Empty: Italy.',
					),
					{
						displayName: 'Format',
						name: 'format',
						type: 'options',
						options: [
							{ name: 'International (+39 02 …)', value: 'international' },
							{ name: 'National (02 …)', value: 'national' },
						],
						default: 'international',
					},
					language,
				],
			},

			// ---------------------------------------------------------------- website
			{
				displayName: 'Website',
				name: 'website',
				type: 'string',
				required: true,
				placeholder: 'e.g. www.example.com',
				default: '',
				description: 'Up to three addresses in one field are split into "verified_website", "verified_website2" and "verified_website3"',
				displayOptions: show('website'),
			},
			{
				displayName: 'Options',
				name: 'options',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				displayOptions: show('website'),
				options: [
					language,
					{
						displayName: 'Check That the Site Answers',
						name: 'network',
						type: 'boolean',
						default: true,
						description:
							'Whether to contact the site (HTTP answer, redirects, certificate). When off, only the form of the address is checked.',
					},
				],
			},

			// ---------------------------------------------------------------- name
			{
				displayName: 'Last Name, or the Whole Name',
				name: 'lastName',
				type: 'string',
				required: true,
				default: '',
				placeholder: 'e.g. Dr. Anna Bianchi',
				description: 'The whole name in one field works: "Dr. Anna Bianchi", "Müller, Hans", "Rossi Srl".',
				displayOptions: show('name'),
			},
			{
				displayName: 'Options',
				name: 'options',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				displayOptions: show('name'),
				options: [
					countryField(
						'Country of the person: it chooses the first names ("Andrea" is a man in Italy and a woman in Germany) and the language of the salutations. Empty: Italy.',
					),
					{ displayName: 'First Name', name: 'firstName', type: 'string', default: '' },
					{
						displayName: 'Gender',
						name: 'gender',
						type: 'options',
						options: [
							{ name: 'Not Known', value: '' },
							{ name: 'Male', value: 'M' },
							{ name: 'Female', value: 'F' },
						],
						default: '',
					},
					language,
					{
						displayName: 'Profession',
						name: 'profession',
						type: 'string',
						default: '',
						description: 'Gives the title when it is missing (lawyer, engineer)',
					},
					{ displayName: 'Title', name: 'title', type: 'string', default: '', description: 'Mr, Mrs, Dr, Herr, Frau, Sig.ra…' },
				],
			},

			// ---------------------------------------------------------------- tax code
			{
				displayName: 'Tax Code',
				name: 'taxCode',
				type: 'string',
				required: true,
				default: '',
				placeholder: 'e.g. RSSMRA80E12F205L',
				displayOptions: show('taxCode', ['validate', 'extract']),
			},
			{
				displayName: 'Last Name',
				name: 'lastName',
				type: 'string',
				required: true,
				default: '',
				displayOptions: show('taxCode', ['generate']),
			},
			{
				displayName: 'First Name',
				name: 'firstName',
				type: 'string',
				required: true,
				default: '',
				displayOptions: show('taxCode', ['generate']),
			},
			{
				displayName: 'Gender',
				name: 'gender',
				type: 'options',
				options: [
					{ name: 'Male', value: 'M' },
					{ name: 'Female', value: 'F' },
				],
				default: 'M',
				displayOptions: show('taxCode', ['generate']),
			},
			{
				displayName: 'Birth Date',
				name: 'birthDate',
				type: 'string',
				required: true,
				default: '',
				placeholder: 'e.g. 1980-05-12',
				description: 'YYYY-MM-DD or DD/MM/YYYY, with a four-digit year',
				displayOptions: show('taxCode', ['generate']),
			},
			{
				displayName: 'Birth Place',
				name: 'birthPlace',
				type: 'string',
				required: true,
				default: '',
				placeholder: 'e.g. Milano',
				description: 'The municipality, or the foreign country (for example "Francia")',
				displayOptions: show('taxCode', ['generate']),
			},
			{
				displayName: 'Options',
				name: 'options',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				displayOptions: show('taxCode', ['generate']),
				options: [
					{
						displayName: 'Birth Province',
						name: 'birthProvince',
						type: 'string',
						default: '',
						description: 'Disambiguates municipalities with the same name',
					},
				],
			},

			// ---------------------------------------------------------------- duplicates
			{
				displayName:
					'Every incoming item is a record of the same list, compared with all the others: the node sends them together in one call (up to 500). The output has one item per record, with the group it belongs to.',
				name: 'duplicateNotice',
				type: 'notice',
				default: '',
				displayOptions: show('duplicate'),
			},
			{
				displayName: 'Record ID',
				name: 'recordId',
				type: 'string',
				default: '',
				description: 'Your own identifier of the record. Empty: the position of the item (0, 1, 2…).',
				displayOptions: show('duplicate'),
			},
			{ displayName: 'Last Name', name: 'lastName', type: 'string', default: '', displayOptions: show('duplicate') },
			{ displayName: 'First Name', name: 'firstName', type: 'string', default: '', displayOptions: show('duplicate') },
			{ displayName: 'Street and House Number', name: 'address', type: 'string', default: '', displayOptions: show('duplicate') },
			{ displayName: 'Postcode', name: 'postcode', type: 'string', default: '', displayOptions: show('duplicate') },
			{ displayName: 'Town or City', name: 'city', type: 'string', default: '', displayOptions: show('duplicate') },
			{
				displayName: 'Additional Fields',
				name: 'additionalFields',
				type: 'collection',
				placeholder: 'Add Field',
				default: {},
				displayOptions: show('duplicate'),
				options: [
					{ displayName: 'Email', name: 'email', type: 'string', placeholder: 'name@email.com', default: '' },
					{
						displayName: 'Gender',
						name: 'gender',
						type: 'options',
						options: [
							{ name: 'Not Known', value: '' },
							{ name: 'Male', value: 'M' },
							{ name: 'Female', value: 'F' },
						],
						default: '',
					},
					{ displayName: 'Phone', name: 'phone', type: 'string', default: '' },
					{ displayName: 'Province', name: 'province', type: 'string', default: '' },
					countryField('Country of the record: the ISO code (DE) or the name. Empty: the default country below.'),
				],
			},
			{
				displayName: 'Options',
				name: 'options',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				displayOptions: show('duplicate'),
				options: [
					countryField(
						'Country of the records that do not state their own: the ISO code (DE) or the name. Without it they are Italian.',
						'Default Country',
					),
					{ ...language },
					{
						displayName: 'Minimum Level',
						name: 'minLevel',
						type: 'options',
						options: [
							{ name: 'Certain', value: 'certain' },
							{ name: 'Probable', value: 'probable' },
							{ name: 'Ambiguous', value: 'ambiguous' },
						],
						default: 'probable',
						description: 'The weakest level of certainty a group must have to be reported',
					},
					{
						displayName: 'Surname Precision',
						name: 'precision',
						type: 'options',
						options: [
							{ name: '1 to 3 Letter by Letter', value: 3 },
							{ name: '4 With or Without a Space ("La Pera", "Lapera")', value: 4 },
							{ name: '5 Also the Same Sound ("Lepera")', value: 5 },
						],
						default: 3,
						description: 'How far the surname comparison stretches. Groups found at 4 and 5 are never more than "ambiguous".',
					},
				],
			},

			simplify(['contact', 'email', 'phone', 'website', 'name', 'taxCode', 'credit']),
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const resource = this.getNodeParameter('resource', 0) as string;
		const operation = this.getNodeParameter('operation', 0) as string;
		const out: INodeExecutionData[] = [];

		if (resource === 'duplicate') {
			return [await findDuplicates(this, items.length)];
		}

		// the balance does not depend on the items: one call, whatever arrives
		const count = resource === 'credit' ? Math.min(1, items.length || 1) : items.length;
		for (let i = 0; i < count; i++) {
			try {
				const raw = await callOne(this, resource, operation, i);
				const simple = this.getNodeParameter('simplify', i, true) as boolean;
				const json = simple ? simplified(resource, raw) : raw;
				out.push({ json, pairedItem: { item: i } });
			} catch (error) {
				if (this.continueOnFail()) {
					out.push({
						json: { error: (error as Error).message },
						pairedItem: { item: i },
					});
					continue;
				}
				const failure =
					error instanceof NodeApiError || error instanceof NodeOperationError
						? error
						: new NodeOperationError(this.getNode(), error as Error, { itemIndex: i });
				failure.context.itemIndex = i;
				throw failure;
			}
		}
		return [out];
	}
}

/** The strings that are really there: an empty field is not sent. */
function filled(o: IDataObject): IDataObject {
	const r: IDataObject = {};
	for (const [k, v] of Object.entries(o)) {
		if (v === undefined || v === null) continue;
		if (typeof v === 'string') {
			if (v.trim() === '') continue;
			r[k] = v.trim();
		} else r[k] = v;
	}
	return r;
}

/** A code of two letters goes in `code`, a name in `name`. */
function withCountry(data: IDataObject, value: unknown, code = 'country_code', name = 'country'): IDataObject {
	const v = String(value ?? '').trim();
	if (!v) return data;
	if (/^[A-Za-z]{2}$/.test(v)) data[code] = v.toUpperCase();
	else data[name] = v;
	return data;
}

function simplified(resource: string, raw: IDataObject): IDataObject {
	switch (resource) {
		case 'contact':
			return flattenContact(raw);
		case 'email':
			return flattenEmail(raw);
		case 'phone':
			return flattenPhone(raw);
		case 'website':
			return flattenWebsite(raw);
		case 'name':
			return flattenEnrichment(raw);
		case 'taxCode':
			return flattenTaxCode(raw);
		default:
			return flattenCredit(raw);
	}
}

async function callOne(ctx: IExecuteFunctions, resource: string, operation: string, i: number): Promise<IDataObject> {
	const p = (name: string, fallback: unknown = '') => ctx.getNodeParameter(name, i, fallback);
	const opt = (ctx.getNodeParameter('options', i, {}) as IDataObject) ?? {};
	switch (resource) {
		case 'contact': {
			const a = (p('additionalFields', {}) as IDataObject) ?? {};
			const data = withCountry(
				filled({
					address: p('address'),
					building: a.building,
					care_of: a.careOf,
					postcode: p('postcode'),
					city: p('city'),
					province: a.province,
					last_name: a.lastName,
					first_name: a.firstName,
					tax_code: a.taxCode,
					email: a.email,
					phone: a.phone,
					language: a.language,
				}),
				p('country'),
			);
			if (a.precision) data.precision = a.precision;
			return raRequest(ctx, 'POST', 'contact', data, i);
		}
		case 'email': {
			const data = filled({ email: p('email'), language: opt.language });
			if (opt.precision) data.precision = opt.precision;
			data.fix_typos = opt.fixTypos === undefined ? true : !!opt.fixTypos;
			return raRequest(ctx, 'POST', 'email', data, i);
		}
		case 'phone': {
			const data = withCountry(filled({ phone: p('phone'), format: opt.format, language: opt.language }), opt.country);
			return raRequest(ctx, 'POST', 'phone', data, i);
		}
		case 'website': {
			const data = filled({ website: p('website'), language: opt.language });
			if (opt.network !== undefined) data.network = !!opt.network;
			return raRequest(ctx, 'POST', 'website', data, i);
		}
		case 'name': {
			const data = withCountry(
				filled({
					last_name: p('lastName'),
					first_name: opt.firstName,
					title: opt.title,
					gender: opt.gender,
					profession: opt.profession,
					language: opt.language,
				}),
				opt.country,
			);
			return raRequest(ctx, 'POST', 'enrichment', data, i);
		}
		case 'taxCode': {
			if (operation === 'generate') {
				const data = filled({
					action: 'generate',
					last_name: p('lastName'),
					first_name: p('firstName'),
					gender: p('gender'),
					birth_date: p('birthDate'),
					birth_place: p('birthPlace'),
					birth_province: opt.birthProvince,
				});
				return raRequest(ctx, 'POST', 'tax-code', data, i);
			}
			return raRequest(ctx, 'POST', 'tax-code', { action: operation, tax_code: String(p('taxCode')).trim() }, i);
		}
		case 'credit':
			return raRequest(ctx, 'GET', 'credit', undefined, i);
	}
	throw new NodeOperationError(ctx.getNode(), `Unknown resource: ${resource}`, { itemIndex: i });
}

async function findDuplicates(ctx: IExecuteFunctions, count: number): Promise<INodeExecutionData[]> {
	if (count === 0) return [];
	if (count > 500) {
		throw new NodeOperationError(
			ctx.getNode(),
			`Find Duplicates compares up to 500 records in one call, ${count} arrived`,
			{ description: 'Split the list in two or more parts of up to 500 with the Loop Over Items node, or use the file upload on radaraddress.com for the whole list.' },
		);
	}
	const opt = (ctx.getNodeParameter('options', 0, {}) as IDataObject) ?? {};
	const records: IDataObject[] = [];
	for (let i = 0; i < count; i++) {
		const a = (ctx.getNodeParameter('additionalFields', i, {}) as IDataObject) ?? {};
		const id = String(ctx.getNodeParameter('recordId', i, '') || i).trim();
		records.push(
			withCountry(
				{
					id,
					...filled({
						last_name: ctx.getNodeParameter('lastName', i, ''),
						first_name: ctx.getNodeParameter('firstName', i, ''),
						address: ctx.getNodeParameter('address', i, ''),
						postcode: ctx.getNodeParameter('postcode', i, ''),
						city: ctx.getNodeParameter('city', i, ''),
						province: a.province,
						gender: a.gender,
						email: a.email,
						phone: a.phone,
					}),
				},
				a.country,
			),
		);
	}
	const body: IDataObject = { records, save: false, ...filled({ language: opt.language, min_level: opt.minLevel }) };
	if (opt.precision && Number(opt.precision) >= 4) body.precision = opt.precision;
	withCountry(body, opt.country, 'default_country', 'default_country');
	const res = await raRequest(ctx, 'POST', 'dedupe', body, 0);

	const ids = records.map((r) => String(r.id));
	const info = new Map<string, IDataObject>();
	for (const g of (res.groups as IDataObject[]) ?? []) {
		const members = ((g.members as unknown[]) ?? []).map(String);
		const detail: IDataObject = {
			is_duplicate: true,
			group: g.group as number,
			level: String(g.level ?? ''),
			reason: String(g.reason ?? ''),
			notes: Array.isArray(g.notes) ? (g.notes as string[]).join('\n') : '',
			main_record: String(g.main_record ?? ''),
			group_members: members.join(', '),
		};
		for (const m of members) info.set(m, { ...detail, is_main_record: m === String(g.main_record) });
	}
	return ids.map((id, i) => ({
		json: {
			id,
			...(info.get(id) ?? {
				is_duplicate: false,
				group: null,
				level: '',
				reason: '',
				notes: '',
				main_record: '',
				group_members: '',
				is_main_record: false,
			}),
		},
		pairedItem: { item: i },
	}));
}
