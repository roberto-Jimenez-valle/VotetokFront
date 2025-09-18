#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(process.cwd());
const INPUT = path.join(ROOT, 'static', 'data', 'avatars-1k.json');
const OUTDIR = path.join(ROOT, 'static', 'data');

function cluster(entries, cellDeg) {
  const cells = new Map();
  for (const r of entries) {
    const lat = r.lat;
    const lng = r.lng;
    if (typeof lat !== 'number' || typeof lng !== 'number') continue;
    const key = `${Math.floor(lat / cellDeg)}|${Math.floor((lng + 180) / cellDeg)}`;
    const prev = cells.get(key);
    if (!prev || (r.v ?? 0) > (prev.v ?? 0)) cells.set(key, r);
  }
  return Array.from(cells.values());
}

function loadJson(file) {
  const txt = fs.readFileSync(file, 'utf-8');
  return JSON.parse(txt);
}

function saveJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function main() {
  if (!fs.existsSync(INPUT)) {
    console.error('Input not found:', INPUT);
    process.exit(1);
  }
  const entries = loadJson(INPUT);
  const levels = [12, 6, 3, 1];
  for (const deg of levels) {
    const clustered = cluster(entries, deg);
    const out = path.join(OUTDIR, `clusters-${deg}.json`);
    saveJson(out, clustered);
    console.log(`Wrote ${out} (${clustered.length} items)`);
  }
}

main();
