const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const prismaDir = path.join(rootDir, 'node_modules', '.prisma');
const clientDir = path.join(rootDir, 'node_modules', '@prisma', 'client');
const pnpmPrismaClientDir = path.join(rootDir, 'node_modules', '.pnpm');

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

function removeTempEngineFiles(dir, label) {
  if (!fs.existsSync(dir)) return;

  const queue = [dir];
  while (queue.length > 0) {
    const current = queue.pop();
    let entries;
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch (error) {
      if (error && (error.code === 'EPERM' || error.code === 'EBUSY')) {
        console.warn(`Skipping ${label} due to file lock: ${current}`);
      }
      continue;
    }

    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        queue.push(fullPath);
        continue;
      }

      if (/\.tmp\d*$|\.tmp$/.test(entry.name) || /^query_engine-windows\.dll\.node(?:\.tmp\d+)?$/.test(entry.name)) {
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
  }
}

if (fs.existsSync(prismaDir)) {
  safeRemove(prismaDir, 'Prisma cache');
}

if (fs.existsSync(clientDir)) {
  removeTempEngineFiles(clientDir, 'Prisma client directory');
}

if (fs.existsSync(pnpmPrismaClientDir)) {
  removeTempEngineFiles(pnpmPrismaClientDir, 'pnpm Prisma store');
}

if (removed === 0) {
  console.log('No Prisma cache files found to remove.');
}
