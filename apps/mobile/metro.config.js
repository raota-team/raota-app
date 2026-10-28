// Sentry가 번들과 소스맵에 같은 Debug ID를 붙여야 출시 빌드의 오류 위치를 원본 코드로 되돌린다
const { getSentryExpoConfig } = require('@sentry/react-native/metro');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getSentryExpoConfig(projectRoot);

// 1. Watch all files within the monorepo
config.watchFolders = [monorepoRoot];
// A worktree may reuse a symlinked pnpm dependency cache. Watch the actual
// third-party store as well, while application/shared source stays in this worktree.
const dependencyStore = path.join(monorepoRoot, 'node_modules', '.pnpm');
if (fs.existsSync(dependencyStore)) {
  const resolvedStore = fs.realpathSync(dependencyStore);
  if (!resolvedStore.startsWith(`${monorepoRoot}${path.sep}`)) {
    config.watchFolders.push(resolvedStore);
  }
}

// 2. Let Metro know where to resolve packages and in what order
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

// 3. Polyfill Node.js standard library modules
config.resolver.extraNodeModules = {
  buffer: require.resolve('buffer'),
};

// 4. EXPO_PUBLIC_* 값은 변환 단계에서 코드에 박히는데, Metro 캐시 키에는 그 값이 없다.
//    그래서 .env를 바꿔도 예전 값이 박힌 캐시가 다시 쓰였다(2026.10.26 출시 빌드에서 PostHog 키가 빠짐).
//    개발 중 켠 기능 스위치가 출시 빌드에 그대로 남을 수도 있어, 값이 바뀌면 캐시를 새로 쓰도록 키에 넣는다.
const publicEnv = Object.keys(process.env)
  .filter((key) => key.startsWith('EXPO_PUBLIC_'))
  .sort()
  .map((key) => `${key}=${process.env[key]}`)
  .join('\n');
config.cacheVersion = `${config.cacheVersion ?? ''}:${crypto.createHash('sha256').update(publicEnv).digest('hex').slice(0, 16)}`;

module.exports = config;
