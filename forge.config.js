module.exports = {
  packagerConfig: {
    asar: true,
    name: 'EasyTwitch',
    executableName: 'EasyTwitch',
  },
  rebuildConfig: {},
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        name: 'EasyTwitch',
      },
    },
  ],
};
