const path = require('path');
const webpack = require('webpack');

module.exports = {
    plugins: [
        new webpack.ProvidePlugin({
            process: 'process/browser',
        }),
        new webpack.NormalModuleReplacementPlugin(
            /^process\/browser$/,
            require.resolve('process/browser.js')
        ),
    ],
    module: {
        rules: [
            {
                test: /\.m?js$/,
                resolve: {
                    fullySpecified: false,
                },
            },
        ],
    },
    resolve: {
        fullySpecified: false,
        extensionAlias: {
            '.js': ['.js', '.ts'],
        },
        alias: {
            'process/browser': require.resolve('process/browser.js'),
        },
        fallback: {
            process: require.resolve('process/browser.js'),
        },
    },
};
