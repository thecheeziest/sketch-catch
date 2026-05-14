// pnpm 모노레포에서 Metro가 ../../packages/shared와 hoisted node_modules를 찾도록 설정
const { getDefaultConfig } = require('expo/metro-config');
const path = require('node:path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// 1. Metro가 모노레포 루트 + 워크스페이스 패키지를 watch하도록
config.watchFolders = [monorepoRoot];

// 2. node_modules resolution 순서: 앱 로컬 → 모노레포 루트
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

// 3. 심볼릭 링크 해소 (pnpm은 심볼릭 링크 기반)
config.resolver.unstable_enableSymlinks = true;
config.resolver.unstable_enablePackageExports = true;

module.exports = config;
