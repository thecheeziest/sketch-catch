const { AndroidConfig, withInfoPlist, withStringsXml } = require('expo/config-plugins');

/**
 * 홈 화면에 보이는 앱 이름만 바꾼다. expo.name(SketchCatch)은 iOS 프로젝트·스킴 이름의 기준이라 영문 그대로 둔다.
 * iOS는 CFBundleName(=SketchCatch)이 남고 alternateNames를 INAlternativeAppNames로 등록해 영문 이름으로도 찾을 수 있게 한다.
 * @type {import('expo/config-plugins').ConfigPlugin<{ displayName: string; alternateNames?: string[] }>}
 */
module.exports = (config, { displayName, alternateNames = [] }) => {
  if (!displayName) throw new Error('withAppDisplayName requires a displayName.');

  config = withInfoPlist(config, modConfig => {
    modConfig.modResults.CFBundleDisplayName = displayName;
    if (alternateNames.length > 0) {
      modConfig.modResults.INAlternativeAppNames = alternateNames.map(name => ({ INAlternativeAppName: name }));
    }
    return modConfig;
  });

  return withStringsXml(config, modConfig => {
    modConfig.modResults = AndroidConfig.Strings.setStringItem(
      [AndroidConfig.Resources.buildResourceItem({ name: 'app_name', value: displayName })],
      modConfig.modResults,
    );
    return modConfig;
  });
};
