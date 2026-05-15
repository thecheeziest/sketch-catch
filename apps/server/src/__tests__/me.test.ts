import { describe, it, expect } from 'vitest';

// 이 파일은 Plan 05 (me 라우트)에서 실제 구현 테스트로 채워진다.
// 커버 대상: PROF-01 (30일 닉네임 제한), PROF-02 (친구코드), PROF-03 (캐릭터), PROF-05 (탈퇴)

describe('me routes', () => {
  it.todo('GET /me returns UserPrivate for authenticated user');
  it.todo('PATCH /me updates nickname when more than 30 days since last change');
  it.todo('PROF-01: PATCH /me with nickname within 30 days returns 429 NICKNAME_CHANGE_COOLDOWN with nextChangeAt');
  it.todo('PROF-02: PATCH /me with friendCode validates 5 alphanumeric uppercase and checks combo uniqueness');
  it.todo('PROF-03: PATCH /me with characterId accepts any of CHARACTER_IDS without cooldown');
  it.todo('PROF-05: DELETE /me cascade-deletes FriendRequest, Friendship, then User');

  it('placeholder — replaced in Plan 05', () => {
    expect(true).toBe(true);
  });
});
