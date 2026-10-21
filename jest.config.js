const expoPreset = require('jest-expo/jest-preset');
const [babelJest, babelOptions] = expoPreset.transform['\\.[jt]sx?$'];

module.exports = {
  preset: 'jest-expo',
  testMatch: ['**/__tests__/**/*.test.ts?(x)'],
  // Exercise lazy native imports in Jest's CommonJS VM. Metro's production
  // import handling is unchanged; preserve all of jest-expo's other transforms.
  transform: {
    ...expoPreset.transform,
    '\\.[jt]sx?$': [babelJest, {
      ...babelOptions,
      plugins: [...(babelOptions.plugins ?? []), '@babel/plugin-transform-dynamic-import'],
    }],
  },
};
