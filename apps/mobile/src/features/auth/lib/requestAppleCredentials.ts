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
