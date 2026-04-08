const path = require('path');

module.exports = {
  webpack: {
    alias: {
      'agentic-avatars': path.resolve(__dirname, '../agentic-avatars/src/index.ts'),
      'react': path.resolve(__dirname, 'node_modules/react'),
      'react-dom': path.resolve(__dirname, 'node_modules/react-dom'),
      'three': path.resolve(__dirname, 'node_modules/three'),
    },
    configure: (webpackConfig) => {
      // Allow imports from outside src/ (agentic-avatars lives one level up)
      webpackConfig.resolve.plugins = webpackConfig.resolve.plugins.filter(
        (plugin) => plugin.constructor.name !== 'ModuleScopePlugin',
      );

      // Make babel-loader also transpile agentic-avatars/src TypeScript files
      const oneOfRule = webpackConfig.module.rules.find((r) => r.oneOf);
      if (oneOfRule) {
        const babelRule = oneOfRule.oneOf.find(
          (r) => r.loader && r.loader.includes('babel-loader') && r.include,
        );
        if (babelRule) {
          babelRule.include = [babelRule.include, path.resolve(__dirname, '../agentic-avatars/src')].flat();
        }
      }

      // Fix: ESM packages in node_modules that use extensionless relative
      // imports (e.g. @elevenlabs/react) fail with webpack's strict ESM
      // resolver. Disable fullySpecified for .js files inside node_modules.
      webpackConfig.module.rules.push({
        test: /\.m?js$/,
        resolve: { fullySpecified: false },
        include: /node_modules/,
      });

      return webpackConfig;
    },
  },
};
