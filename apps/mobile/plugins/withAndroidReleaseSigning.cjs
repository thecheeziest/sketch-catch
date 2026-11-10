const { withAppBuildGradle } = require('expo/config-plugins');

const STORE_FILE_PROP = 'SKETCHCATCH_UPLOAD_STORE_FILE';

const RELEASE_SIGNING_CONFIG = `signingConfigs {
        release {
            if (project.hasProperty('${STORE_FILE_PROP}')) {
                storeFile file(${STORE_FILE_PROP})
                storePassword SKETCHCATCH_UPLOAD_STORE_PASSWORD
                keyAlias SKETCHCATCH_UPLOAD_KEY_ALIAS
                keyPassword SKETCHCATCH_UPLOAD_KEY_PASSWORD
            }
        }`;

// Play 업로드 키가 주입되면 release 빌드를 업로드 키로 서명
/** @type {import('expo/config-plugins').ConfigPlugin} */
module.exports = config =>
  withAppBuildGradle(config, modConfig => {
    let contents = modConfig.modResults.contents;
    if (contents.includes(STORE_FILE_PROP)) return modConfig;

    const releaseSigningPattern = /(release \{[^}]*?)signingConfig signingConfigs\.debug/;
    if (!contents.includes('signingConfigs {') || !releaseSigningPattern.test(contents)) {
      throw new Error('withAndroidReleaseSigning: app/build.gradle signing blocks not found.');
    }

    contents = contents.replace('signingConfigs {', RELEASE_SIGNING_CONFIG);
    contents = contents.replace(
      releaseSigningPattern,
      `$1signingConfig project.hasProperty('${STORE_FILE_PROP}') ? signingConfigs.release : signingConfigs.debug`,
    );
    modConfig.modResults.contents = contents;
    return modConfig;
  });
