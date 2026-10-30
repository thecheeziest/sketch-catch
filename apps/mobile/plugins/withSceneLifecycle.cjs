const { withAppDelegate, withInfoPlist } = require('expo/config-plugins');

/** @type {import('expo/config-plugins').ConfigPlugin} */
module.exports = config => {
  config = withInfoPlist(config, modConfig => {
    // iOS 27 requires a scene lifecycle. Expo forwards scene events to the existing app delegate.
    modConfig.modResults.UIApplicationSceneManifest = {
      UIApplicationSupportsMultipleScenes: false,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [
          {
            UISceneConfigurationName: 'Default Configuration',
            UISceneDelegateClassName: 'EXExpoAppSceneDelegate',
          },
        ],
      },
    };
    return modConfig;
  });

  return withAppDelegate(config, modConfig => {
    if (modConfig.modResults.language !== 'swift') {
      throw new Error('withSceneLifecycle requires a Swift AppDelegate.');
    }

    let contents = modConfig.modResults.contents;
    contents = contents.replace(
      'class AppDelegate: ExpoAppDelegate {',
      'class AppDelegate: ExpoAppDelegate, ExpoReactNativeFactoryProvider {',
    );

    // The scene delegate owns the window and starts React Native once it connects.
    contents = contents.replace(
      /#if os\(iOS\) \|\| os\(tvOS\)\s+window = UIWindow\(frame: UIScreen\.main\.bounds\)\s+factory\.startReactNative\(\s+withModuleName: "main",\s+in: window,\s+launchOptions: launchOptions\)\s+#endif\r?\n/,
      '',
    );

    if (!contents.includes('ExpoReactNativeFactoryProvider') || contents.includes('factory.startReactNative(')) {
      throw new Error('withSceneLifecycle could not migrate AppDelegate safely. Check its React Native startup code.');
    }

    modConfig.modResults.contents = contents;
    return modConfig;
  });
};
