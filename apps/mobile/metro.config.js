// Sentry가 번들과 소스맵에 같은 Debug ID를 붙여야 출시 빌드의 오류 위치를 원본 코드로 되돌린다
const { getSentryExpoConfig } = require('@sentry/react-native/metro');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getSentryExpoConfig(projectRoot);

// 1. Watch all files within the monorepo
config.watchFolders = [monorepoRoot];

// 2. Let Metro know where to resolve packages and in what order
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

// 3. Polyfill Node.js standard library modules
config.resolver.extraNodeModules = {
  buffer: require.resolve('buffer'),
};

module.exports = config;
