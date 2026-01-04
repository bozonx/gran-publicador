#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const enUS = JSON.parse(fs.readFileSync(path.join(__dirname, '../ui/i18n/locales/en-US.json'), 'utf8'));
const ruRU = JSON.parse(fs.readFileSync(path.join(__dirname, '../ui/i18n/locales/ru-RU.json'), 'utf8'));

function getAllKeys(obj, prefix = '') {
    const keys = [];
    for (const key in obj) {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
            keys.push(...getAllKeys(obj[key], fullKey));
        } else {
            keys.push(fullKey);
        }
    }
    return keys;
}

const enKeys = getAllKeys(enUS).sort();
const ruKeys = getAllKeys(ruRU).sort();

console.log('Total keys in en-US:', enKeys.length);
console.log('Total keys in ru-RU:', ruKeys.length);

const missingInRu = enKeys.filter(k => !ruKeys.includes(k));
const missingInEn = ruKeys.filter(k => !enKeys.includes(k));

if (missingInRu.length > 0) {
    console.log('\n❌ Missing in ru-RU.json:');
    missingInRu.forEach(k => console.log('  -', k));
}

if (missingInEn.length > 0) {
    console.log('\n❌ Missing in en-US.json:');
    missingInEn.forEach(k => console.log('  -', k));
}

if (missingInRu.length === 0 && missingInEn.length === 0) {
    console.log('\n✅ All keys are synchronized!');
    process.exit(0);
} else {
    console.log('\n❌ Keys are not synchronized!');
    process.exit(1);
}
