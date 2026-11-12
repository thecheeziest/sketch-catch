import appleAuth from '@invertase/react-native-apple-authentication';

export async function requestAppleCredentials() {
  const response = await appleAuth.performRequest({
    requestedOperation: appleAuth.Operation.LOGIN,
    requestedScopes: [appleAuth.Scope.FULL_NAME, appleAuth.Scope.EMAIL],
  });
  if (!response.identityToken) throw new Error('Apple identityToken을 받지 못했습니다');
  const fullName = response.fullName
    ? { familyName: response.fullName.familyName, givenName: response.fullName.givenName }
    : undefined;
  return { identityToken: response.identityToken, fullName };
}

// 탈퇴 직전 Apple 재인증 — 서버가 Apple 로그인 연결을 해제할 때 쓰는 일회용 authorization code를 받는다
export async function requestAppleAuthorizationCode(): Promise<string> {
  const response = await appleAuth.performRequest({ requestedOperation: appleAuth.Operation.LOGIN });
  if (!response.authorizationCode) throw new Error('Apple authorizationCode를 받지 못했습니다');
  return response.authorizationCode;
}
