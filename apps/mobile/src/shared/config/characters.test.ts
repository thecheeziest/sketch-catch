import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CHARACTER_IDS } from '@sketch-catch/shared';

const mobileAssets = resolve(process.cwd(), 'assets/characters');
const serverAssets = resolve(process.cwd(), '../server/assets/characters');
const imports = readFileSync(resolve(process.cwd(), 'src/shared/config/assets.ts'), 'utf8');

// 공용 ID만 늘고 실제 아바타 또는 공유 GIF가 빈칸이 되는 회귀를 막는다.
describe('캐릭터 에셋 연결', () => {
  it.each(CHARACTER_IDS)('%s가 모바일과 서버 GIF 양쪽에 유효한 PNG로 존재한다', id => {
    for (const root of [mobileAssets, serverAssets]) {
      const png = readFileSync(resolve(root, `${id}.png`));
      expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
      expect(png.readUInt32BE(16)).toBeGreaterThan(0);
      expect(png.readUInt32BE(20)).toBeGreaterThan(0);
    }
    expect(imports).toContain(`import ${id} from '@assets/characters/${id}.png'`);
  });
});
