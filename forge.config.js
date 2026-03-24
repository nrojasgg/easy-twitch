module.exports = {
  packagerConfig: {
    asar: true,
    name: 'ConfortTwitch',
    executableName: 'ConfortTwitch',
  },
  rebuildConfig: {},
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        name: 'ConfortTwitch',
      },
    },
  ],
};
