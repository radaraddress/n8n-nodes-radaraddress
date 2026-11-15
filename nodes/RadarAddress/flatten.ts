/* (c) 2026 RadarWave di Gianluca Sordiglioni - www.radarwave.it */
import type { IDataObject } from 'n8n-workflow';

// The simplified output of every operation: a flat record with the same names as the RadarAddress
// app for Zapier (verified_address, verified_postcode, ...). The node never changes anything in
// the workflow by itself: the "Verified" fields are there to be written where the workflow needs them.

const obj = (v: unknown): IDataObject =>
	v && typeof v === 'object' && !Array.isArray(v) ? (v as IDataObject) : {};
const list = (v: unknown): IDataObject[] => (Array.isArray(v) ? (v as IDataObject[]) : []);
const text = (v: unknown): string => (v === undefined || v === null ? '' : String(v));
const lines = (v: unknown): string => (Array.isArray(v) ? v.join('\n') : text(v));
const orNull = <T>(v: T | undefined): T | null => (v === undefined ? null : v);

export function flattenContact(b: IDataObject): IDataObject {
	const r = obj(b.result);
	const n = obj(r.normalized);
	const p = obj(r.normalized_postal);
	const label = obj(r.outcome_label);
	const geo = obj(r.geo);
	const suggestions = list(r.suggestions);
	const sug = suggestions[0] ?? {};
	const cf = r.tax_code_outcome ? obj(r.tax_code_outcome) : null;
	const changes = list(r.changes);
	const mail = obj(obj(r.email_outcome).detail ? list(obj(r.email_outcome).detail)[0] : {});
	const mailTop = obj(r.email_outcome);
	const tel = obj(obj(r.phone_outcome).detail ? list(obj(r.phone_outcome).detail)[0] : {});
	const telTop = obj(r.phone_outcome);
	const out: IDataObject = {
		kind: text(label.kind || (r.error ? 'error' : '')),
		outcome: text(r.outcome),
		outcome_title: text(label.title),
		outcome_message: text(label.message),
		reason: text(r.reason || r.error),
		confidence: text(r.confidence),
		notes: text(r.notes),
		found: !!r.found,
		changed: changes.length > 0,
		changes: changes
			.map((m) => `${text(m.label || m.field)}: ${text(m.before) || '(empty)'} → ${text(m.after) || '(empty)'}`)
			.join('\n'),
		verified_last_name: text(n.last_name),
		verified_first_name: text(n.first_name),
		verified_title: text(n.title),
		verified_gender: text(n.gender),
		verified_care_of: text(n.care_of),
		verified_building: text(n.building),
		verified_address: text(n.address),
		verified_postcode: text(n.postcode),
		verified_city: text(n.city),
		verified_province: text(n.province),
		municipality: text(r.municipality),
		verified_country: text(n.country),
		verified_country_code: text(n.country_code),
		address_block: text(r.text),
		postal_address: text(p.address),
		postal_postcode: text(p.postcode),
		postal_city: text(p.city),
		postal_province: text(p.province),
		latitude: orNull(geo.lat),
		longitude: orNull(geo.lon),
		geo_precision: text(geo.precision),
		house_number_verified: orNull(r.house_number_verified),
		sub_address: list(r.sub_address)
			.map((s) => `${text(s.type)}: ${text(s.value)}`)
			.join('; '),
		suggestions_count: suggestions.length,
		suggestion_address: text(sug.street),
		suggestion_postcode: text(sug.postcode),
		suggestion_city: text(sug.city),
		suggestion_province: text(sug.province),
		tax_code: text(r.tax_code),
		tax_code_valid: cf ? !!cf.valid : null,
		tax_code_matches_name: cf ? orNull(cf.match) : null,
		tax_code_outcome: cf ? text(cf.outcome) : '',
		tax_code_reason: cf ? text(cf.reason) : '',
	};
	// email and phone travel with the address when the call carries them
	if (r.email_outcome) {
		Object.assign(out, {
			verified_email: text(mailTop.email),
			email_kind: text(mailTop.kind),
			email_outcome: text(mailTop.outcome),
			email_valid: !!mail.valid,
			email_corrected_from: text(mail.corrected_from),
			email_similar_to: text(mail.similar_to),
			email_disposable: !!mail.disposable,
			email_generic: !!mail.generic,
		});
	}
	if (r.phone_outcome) {
		Object.assign(out, {
			verified_phone: text(tel.e164 || telTop.phone),
			phone_kind: text(telTop.kind),
			phone_outcome: text(telTop.outcome),
			phone_valid: !!tel.valid,
			phone_class: text(tel.class),
		});
	}
	return out;
}

export function flattenEmail(b: IDataObject): IDataObject {
	return {
		kind: text(b.kind),
		outcome: text(b.outcome),
		outcome_title: text(b.title),
		reason: text(b.reason),
		notes: lines(b.notes),
		verified_email: text(b.email),
		corrected_from: text(b.corrected_from),
		suggestion: text(b.suggestion),
		similar_to: text(b.similar_to),
		typo_level: Number.isInteger(b.typo_level) ? (b.typo_level as number) : null,
		valid: !!b.valid,
		syntax: !!b.syntax,
		domain_exists: orNull(b.domain_exists),
		disposable: !!b.disposable,
		generic: !!b.generic,
	};
}

export function flattenPhone(b: IDataObject): IDataObject {
	const d = list(b.detail)[0] ?? {};
	return {
		kind: text(b.kind),
		outcome: text(b.outcome),
		outcome_title: text(d.title),
		reason: text(b.reason || d.reason),
		verified_phone: text(b.phone),
		verified_phone2: text(b.phone2),
		verified_phone3: text(b.phone3),
		e164: text(d.e164),
		national_number: text(d.national_number || d.number),
		class: text(d.class),
		type: text(d.type),
		town: text(d.town),
		operator: text(d.operator),
		country_code: text(d.country_code),
		valid: !!d.valid,
		changed: !!d.changed,
	};
}

export function flattenWebsite(b: IDataObject): IDataObject {
	const d = list(b.detail)[0] ?? {};
	return {
		kind: text(b.kind),
		outcome: text(b.outcome),
		outcome_title: text(d.title),
		reason: text(b.reason || d.reason),
		verified_website: text(b.website),
		verified_website2: text(b.website2),
		verified_website3: text(b.website3),
		host: text(d.host),
		reachable: orNull(d.reachable),
		http_status: orNull(d.http_status),
		final_url: text(d.final_url),
		redirects: orNull(d.redirects),
		https: orNull(d.https),
		certificate_ok: orNull(d.certificate_ok),
		valid: !!d.valid,
		changed: !!d.changed,
	};
}

export function flattenEnrichment(b: IDataObject): IDataObject {
	const ref = obj(b.contact_person);
	return {
		outcome: text(b.outcome),
		reason: text(b.reason),
		notes: lines(b.notes),
		subject_type: text(b.subject_type),
		verified_gender: text(b.gender),
		gender_source: text(b.gender_source),
		verified_title: text(b.title),
		verified_last_name: text(b.last_name),
		verified_first_name: text(b.first_name),
		contact_person_last_name: text(ref.last_name),
		contact_person_first_name: text(ref.first_name),
		formal_salutation: text(b.formal_salutation),
		informal_salutation: text(b.informal_salutation),
	};
}

export function flattenTaxCode(answer: IDataObject): IDataObject {
	// an extract of a wrong code answers { error, detail: {…} }: the detail is the same record
	const b = answer.detail && typeof answer.detail === 'object' ? { ...(answer.detail as IDataObject), ok: false } : answer;
	return {
		ok: !!b.ok,
		kind: text(b.kind),
		outcome: text(b.outcome),
		reason: text(b.reason),
		notes: lines(b.notes),
		tax_code: text(b.tax_code),
		valid: b.valid !== undefined ? !!b.valid : b.format === undefined ? null : !!b.format && !!b.check_digit,
		homocode: orNull(b.homocode),
		suggestion: text(b.suggestion),
		gender: text(b.gender),
		birth_date: text(b.birth_date),
		birth_place: text(b.birth_place_name || b.place),
		birth_province: text(b.birth_province || b.province),
		born_abroad: orNull(b.born_abroad),
		belfiore_code: text(b.belfiore_code),
	};
}

export function flattenCredit(b: IDataObject): IDataObject {
	const counters = obj(b.counters);
	const out: IDataObject = {
		account_email: text(obj(b.account).email),
		account_name: text(obj(b.account).full_name),
		needs_topup: Array.isArray(b.needs_topup) ? (b.needs_topup as string[]).join(', ') : '',
		free_forever: !!b.free_forever,
	};
	for (const k of ['contact', 'dedupe', 'light']) {
		const c = obj(counters[k]);
		out[`${k}_available`] = orNull(c.available);
		out[`${k}_state`] = text(c.state);
		out[`${k}_warning`] = text(c.warning);
	}
	return out;
}
