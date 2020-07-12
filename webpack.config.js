const webpack = require('webpack');
const TsConfigWebpackPlugin = require('ts-config-webpack-plugin');

module.exports = {
  target: 'node',
  output: {
    path: __dirname + '/bin'
  },
  optimization: {
    minimize: false
  },
  plugins: [
    // Multi threading typescript loader configuration with caching for .ts and .tsx files
    // see https://github.com/namics/webpack-config-plugins/tree/master/packages/ts-config-webpack-plugin/config
    new TsConfigWebpackPlugin(),
    new webpack.BannerPlugin({
      raw: true,
      banner: '#!/usr/bin/env node'
    })
  ],
  externals: {
    // Keep PeerDependencies out of the bundle
    puppeteer: 'require("puppeteer")'
  },
  stats: {
    // Ignore warnings due to yarg's dynamic module loading
    warningsFilter: [/node_modules\/yargs/, /node_modules\/express/]
  },
};
