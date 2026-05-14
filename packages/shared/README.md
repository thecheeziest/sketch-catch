# @sketch-catch/shared

`apps/mobile`과 `apps/server`가 함께 사용하는 공유 코드.

- `types/`: 게임 상태, Socket.io 이벤트, API DTO 타입
- `events/`: Socket.io 이벤트 enum + payload 타입
- `schemas/`: Zod 스키마 (클라이언트/서버 동일 검증)
- `constants/`: 매직 넘버 상수

## 사용

`apps/*` 워크스페이스의 `package.json`에:

```json
"dependencies": {
  "@sketch-catch/shared": "workspace:*"
}
```
