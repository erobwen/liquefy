var path = require('path');
var webpack = require('webpack');
var CopyPlugin = require('copy-webpack-plugin');

module.exports = {
  context: __dirname,
  entry: './src/index.js',
  module: {
    rules: [
      {
        test: /\.(png|jpe?g|gif|svg)$/i,
        use: [
          {
            loader: 'file-loader',
          },
        ],
      },
      {
        test: /\.js$/,
        enforce: "pre",
        use: ["source-map-loader"],
      },
    ],
  },
  output: {
      path: __dirname + '/dist/',
      filename: 'bundle.js',
      publicPath: '/dist/'
  }, 
  mode: 'development',
  plugins: [
    new CopyPlugin({
      patterns: [
        {from: 'resources', to: 'resources'}
      ]
    })
  ],
  devServer: {
    static: {
      directory: path.join(__dirname, 'dist'),
    },
    compress: true,
    port: 3001,
    open: true
  },
};

