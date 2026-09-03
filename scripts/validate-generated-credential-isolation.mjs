#!/usr/bin/env node

import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync
} from 'node:fs';
import { extname, relative, resolve } from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
const TARGET = resolve(ROOT, process.argv[2] || 'dist-pkg');
const MAX_TEXT_FILE_BYTES = 32 * 1024 * 1024;
const TEXT_EXTENSIONS = new Set([
  '',
  '.css',
  '.html',
  '.js',
  '.json',
  '.map',
  '.md',
  '.mjs',
  '.svg',
  '.txt',
  '.yaml',
  '.yml',
]);

function fail(message) {
  throw new Error(`LayerSentry generated credential-isolation validation failed: ${ message }`);
}

function assert(condition, message) {
  if (!condition) {
    fail(message);
  }
}

function walk(directory) {
  const out = [];

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);

    if (entry.isDirectory()) {
      out.push(...walk(path));
    } else if (entry.isFile()) {
      out.push(path);
    }
  }

  return out;
}

function looksTextual(path) {
  const extension = extname(path).toLowerCase();
  const size = statSync(path).size;

  return size <= MAX_TEXT_FILE_BYTES && TEXT_EXTENSIONS.has(extension);
}

function redactedOrPlaceholder(value) {
  const normalized = String(value || '').trim();

  return !normalized || /^(?:<[^>]+>|\$\{[^}]+\}|\{\{[^}]+\}\}|x+|\*+|redacted|masked|example|changeme|not[-_ ]?set|null|undefined)$/i.test(normalized);
}

function highEntropyCredential(value) {
  const normalized = String(value || '').trim();

  if (redactedOrPlaceholder(normalized) || normalized.length < 16) {
    return false;
  }

  const classes = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^a-zA-Z0-9]/]
    .filter((pattern) => pattern.test(normalized))
    .length;
  const uniqueRatio = new Set(normalized).size / normalized.length;

  return normalized.length >= 32 || (classes >= 3 && uniqueRatio >= 0.45);
}

assert(existsSync(TARGET), `generated output directory is missing: ${ TARGET }`);

const findings = [];
const scannedFiles = [];
const exactProtectedPaths = [
  /bootstrap-credentials\.json/i,
  /C:\\ProgramData\\LayerSentry\\bootstrap-credentials\.json/i,
];
const pemPrivateKey = /-----BEGIN (?:RSA |EC |OPENSSH |ENCRYPTED )?PRIVATE KEY-----[\s\S]{64,}?-----END (?:RSA |EC |OPENSSH |ENCRYPTED )?PRIVATE KEY-----/g;
const populatedAuthorization = /\bAuthorization\s*[:=]\s*["']?(?:Bearer|Basic)\s+([A-Za-z0-9._~+\/-]{24,}={0,2})/gi;
const populatedKubeconfigData = /\b(?:client-key-data|client-certificate-data)\s*:\s*([A-Za-z0-9+/]{80,}={0,2})/gi;
const populatedNamedSecret = /["'](?:nodePassword|clusterToken|adminPassword|bootstrapPassword|rke2Token|registryPassword)["']\s*:\s*["']([^"'\r\n]{8,})["']/gi;

for (const path of walk(TARGET)) {
  if (!looksTextual(path)) {
    continue;
  }

  const name = relative(ROOT, path);
  const source = readFileSync(path, 'utf8');

  scannedFiles.push(name);

  for (const pattern of exactProtectedPaths) {
    if (pattern.test(source)) {
      findings.push(`${ name }: protected credential-file path is present`);
    }
  }

  if (pemPrivateKey.test(source)) {
    findings.push(`${ name }: populated private-key block is present`);
  }
  pemPrivateKey.lastIndex = 0;

  for (const match of source.matchAll(populatedAuthorization)) {
    if (highEntropyCredential(match[1])) {
      findings.push(`${ name }: populated Authorization credential is present`);
    }
  }

  for (const match of source.matchAll(populatedKubeconfigData)) {
    findings.push(`${ name }: populated kubeconfig client credential is present`);
  }

  for (const match of source.matchAll(populatedNamedSecret)) {
    if (highEntropyCredential(match[1])) {
      findings.push(`${ name }: populated protected secret field is present`);
    }
  }

  const hasKubeconfigStructure = /(?:^|\n)\s*apiVersion\s*:\s*v1\s*(?:\r?\n)/m.test(source) &&
    /(?:^|\n)\s*clusters\s*:\s*(?:\r?\n)/m.test(source) &&
    /(?:^|\n)\s*users\s*:\s*(?:\r?\n)/m.test(source) &&
    /(?:client-key-data|token)\s*:\s*\S{16,}/m.test(source);

  if (hasKubeconfigStructure) {
    findings.push(`${ name }: populated kubeconfig document is present`);
  }
}

assert(scannedFiles.length > 0, 'no generated text files were available for validation');

if (findings.length) {
  fail(findings.join('\n'));
}

process.stdout.write(`LAYERSENTRY GENERATED BROWSER CREDENTIAL ISOLATION: PASS (${ scannedFiles.length } text files scanned)\n`);
