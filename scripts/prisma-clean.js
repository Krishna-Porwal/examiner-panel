const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const prismaDir = path.join(rootDir, 'node_modules', '.prisma');
const clientDir = path.join(rootDir, 'node_modules', '@prisma', 'client');

let removed = 0;

function safeRemove(targetPath, type) {
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      fs.rmSync(targetPath, { recursive: true, force: true });
      console.log(`Removed ${path.relative(rootDir, targetPath)}`);
      removed += 1;
      return;
    } catch (error) {
      if (error && (error.code === 'EPERM' || error.code === 'EBUSY')) {
        console.warn(`Retrying ${type} cleanup (${attempt}/5): ${error.message}`);
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250 * attempt);
        continue;
      }
      if (error && error.code !== 'ENOENT') {
        console.warn(`Unable to remove ${type} at ${targetPath}: ${error.message}`);
      }
      return;
    }
  }
  console.warn(`Cleanup for ${type} exceeded retries: ${targetPath}`);
}

if (fs.existsSync(prismaDir)) {
  safeRemove(prismaDir, 'Prisma cache');
}

if (fs.existsSync(clientDir)) {
  const tempFiles = fs.readdirSync(clientDir).filter((name) => /\.tmp\d*|\.tmp$/.test(name) || /^query_engine-windows\.dll\.node(?:\.tmp\d+)?$/.test(name));
  for (const file of tempFiles) {
    const fullPath = path.join(clientDir, file);
    try {
      fs.rmSync(fullPath, { force: true });
      console.log(`Removed stale Prisma temp file: ${path.relative(rootDir, fullPath)}`);
      removed += 1;
    } catch (error) {
      if (error && error.code !== 'ENOENT') {
        console.warn(`Unable to remove stale Prisma temp file: ${path.relative(rootDir, fullPath)} (${error.message})`);
      }
    }
  }
}

if (removed === 0) {
  console.log('No Prisma cache files found to remove.');
}
