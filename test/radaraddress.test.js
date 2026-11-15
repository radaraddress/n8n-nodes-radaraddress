/* (c) 2026 RadarWave di Gianluca Sordiglioni - www.radarwave.it */
'use strict';
// Without n8n: the flat records, the description of the node and the numbers of version.
// Needs the build (npm run build).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const dist = path.join(__dirname, '..', 'dist');
const pkg = require('../package.json');
const { RadarAddress } = require(path.join(dist, 'nodes/RadarAddress/RadarAddress.node.js'));
const { RadarAddressApi } = require(path.join(dist, 'credentials/RadarAddressApi.credentials.js'));
const f = require(path.join(dist, 'nodes/RadarAddress/flatten.js'));
const { VERSION } = require(path.join(dist, 'nodes/RadarAddress/GenericFunctions.js'));
const campione = (n) => JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'make', 'campioni', n), 'utf8'));

test('version in package.json and in the User-Agent are the same', () => {
	assert.strictEqual(VERSION, pkg.version);
});

test('the node and the credential are declared as the package says', () => {
	const n = new RadarAddress().description;
	assert.strictEqual(n.name, 'radarAddress');
	assert.strictEqual(new RadarAddressApi().name, 'radarAddressApi');
	assert.deepStrictEqual(pkg.n8n.nodes, ['dist/nodes/RadarAddress/RadarAddress.node.js']);
	assert.ok(pkg.keywords.includes('n8n-community-node-package'));
	assert.strictEqual(pkg.license, 'MIT');
	assert.ok(n.credentials.some((c) => c.name === 'radarAddressApi'));
	for (const r of ['contact', 'email', 'phone', 'website', 'name', 'taxCode', 'duplicate', 'credit']) {
		assert.ok(n.properties[0].options.some((o) => o.value === r), `resource ${r}`);
	}
});

test('verify contact: the verified fields, with email and phone from the same call', () => {
	const r = f.flattenContact(campione('contact.json'));
	assert.strictEqual(r.verified_address, 'Via Giacomo Leopardi 4');
	assert.strictEqual(r.verified_postcode, '20123');
	assert.strictEqual(r.kind, 'modified');
	assert.strictEqual(r.confidence, 'high');
	assert.strictEqual(r.verified_email, 'mario@gmail.com');
	assert.strictEqual(r.email_corrected_from, 'mario@gmial.com');
	assert.strictEqual(r.verified_phone, '+393331234567');
	assert.strictEqual(r.phone_class, 'mobile');
	assert.strictEqual(r.changed, true);
});

test('email, phone, website, name, tax code, credit', () => {
	assert.strictEqual(f.flattenEmail(campione('email_similar.json')).valid, true);
	assert.strictEqual(f.flattenPhone(campione('phone.json')).valid, true);
	assert.strictEqual(f.flattenWebsite(campione('website.json')).verified_website, 'https://www.radarwave.it');
	assert.strictEqual(f.flattenEnrichment(campione('enrichment.json')).verified_last_name.length > 0, true);
	assert.strictEqual(f.flattenTaxCode(campione('taxcode_validate.json')).valid, true);
	assert.strictEqual(f.flattenTaxCode(campione('taxcode_generate.json')).tax_code, 'RSSMRA80E12F205L');
	assert.strictEqual(f.flattenCredit(campione('credit.json')).contact_available, 1250);
});

test('extract of a wrong tax code: the record of the detail, not an error', () => {
	const r = f.flattenTaxCode({ error: 'check_digit', detail: { tax_code: 'RSSMRA80E12F205X', valid: false, outcome: 'TAX_CODE_CHECK_DIGIT_WRONG', kind: 'error', suggestion: 'RSSMRA80E12F205L' } });
	assert.strictEqual(r.valid, false);
	assert.strictEqual(r.suggestion, 'RSSMRA80E12F205L');
	assert.strictEqual(r.outcome, 'TAX_CODE_CHECK_DIGIT_WRONG');
});
