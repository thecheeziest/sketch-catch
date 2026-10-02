const { IOSConfig, withFinalizedMod } = require('expo/config-plugins');
const { generateImageAsync } = require('@expo/image-utils');
const fs = require('node:fs/promises');
const path = require('node:path');

/**
 * @type {import('expo/config-plugins').ConfigPlugin<{ storeIcon: string }>}
 */
module.exports = (config, { storeIcon }) => {
  if (!storeIcon || typeof config.icon !== 'string') {
    throw new Error('withStoreIcon requires a storeIcon and a PNG launcher icon.');
  }
  const launcherIcon = config.icon;

  // Run after Expo's universal-icon generation so prebuild preserves the split.
  config = withFinalizedMod(config, [
    'ios',
    async modConfig => {
      const projectRoot = modConfig.modRequest.projectRoot;
      const projectName = IOSConfig.XcodeUtils.getProjectName(projectRoot);
      const destination = path.join(projectRoot, 'ios', projectName, 'Images.xcassets', 'AppIcon.appiconset');
      const slots = [
        ...[20, 29, 40, 60].flatMap(size => [2, 3].map(scale => ({ idiom: 'iphone', size, scale }))),
        ...[20, 29, 40, 76].flatMap(size => [1, 2].map(scale => ({ idiom: 'ipad', size, scale }))),
        { idiom: 'ipad', size: 83.5, scale: 2 },
        { idiom: 'ios-marketing', size: 1024, scale: 1 },
      ];
      await fs.mkdir(destination, { recursive: true });
      const images = await Promise.all(
        slots.map(async ({ idiom, size, scale }) => {
          const filename = idiom === 'ios-marketing' ? 'App-Icon-1024x1024@1x.png' : `${idiom}-${size}@${scale}x.png`;
          const { source } = await generateImageAsync(
            { projectRoot, cacheType: 'sketch-catch-store-icons' },
            {
              src: idiom === 'ios-marketing' ? storeIcon : launcherIcon,
              name: filename,
              width: size * scale,
              height: size * scale,
              resizeMode: 'contain',
              removeTransparency: true,
              backgroundColor: '#1E1C2C',
            },
          );
          await fs.writeFile(path.join(destination, filename), source);
          if (idiom === 'ios-marketing') {
            await fs.writeFile(path.join(projectRoot, 'assets/app-icons/01-deep-space-app-store.png'), source);
          }
          return { filename, idiom, size: `${size}x${size}`, scale: `${scale}x` };
        }),
      );
      await fs.writeFile(
        path.join(destination, 'Contents.json'),
        JSON.stringify({ images, info: { version: 1, author: 'expo' } }, null, 2),
      );
      return modConfig;
    },
  ]);

  return withFinalizedMod(config, [
    'android',
    async modConfig => {
      const projectRoot = modConfig.modRequest.projectRoot;
      const { source } = await generateImageAsync(
        { projectRoot, cacheType: 'sketch-catch-store-icons' },
        {
          src: storeIcon,
          name: '01-deep-space-google-play.png',
          width: 512,
          height: 512,
          resizeMode: 'contain',
          removeTransparency: true,
          backgroundColor: '#1E1C2C',
        },
      );
      await fs.writeFile(path.join(projectRoot, 'assets/app-icons/01-deep-space-google-play.png'), source);
      return modConfig;
    },
  ]);
};
