const { spawn } = require('node:child_process');
const path = require('node:path');

const port = process.env.PORT || '4200';
const host = process.env.HOST || '0.0.0.0';

const ngPath = require.resolve('@angular/cli/bin/ng.js');

const args = [ngPath, 'serve', '--host', host, '--port', port];

const child = spawn(process.execPath, args, {
  stdio: 'inherit',
  cwd: path.resolve(__dirname, '..')
});

child.on('close', (code) => {
  process.exit(code ?? 0);
});
