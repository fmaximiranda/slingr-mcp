import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const distDir = path.join(rootDir, 'dist');

fs.mkdirSync(distDir, { recursive: true });

const packageJson = JSON.parse(
  fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8')
);

const outputFile = path.join(
  distDir,
  `${packageJson.name}-${packageJson.version}.mcpb`
);

try {
  execFileSync('mcpb', ['pack', '.', outputFile], {
    cwd: rootDir,
    stdio: 'inherit'
  });

  console.log(`\nMCPB created successfully: ${outputFile}`);
} catch (error) {
  console.error('\nFailed to build MCPB.');
  console.error('Make sure @anthropic-ai/mcpb is installed and available as "mcpb".');
  process.exit(error.status || 1);
}
