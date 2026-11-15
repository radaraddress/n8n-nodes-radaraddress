/* (c) 2026 RadarWave di Gianluca Sordiglioni - www.radarwave.it */
// Copies the icons next to the compiled files. `n8n-node build` does the same, but it also
// walks the folder of the test installation (prova/), so the build uses this script.
import { cpSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';

for (const dir of ['credentials', 'nodes']) {
	const walk = (d) => {
		for (const name of readdirSync(d)) {
			const p = join(d, name);
			if (statSync(p).isDirectory()) walk(p);
			else if (/\.(svg|png|json)$/.test(name)) {
				mkdirSync(join('dist', dirname(p)), { recursive: true });
				cpSync(p, join('dist', p));
			}
		}
	};
	walk(dir);
}
