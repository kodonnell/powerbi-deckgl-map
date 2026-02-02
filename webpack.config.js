const path = require('path');

module.exports = {
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
        alias: {
            'process/browser': path.resolve(__dirname, 'node_modules/process/browser.js'),
            'process/browser.js': path.resolve(__dirname, 'node_modules/process/browser.js'),
        },
        fallback: {
            "process": require.resolve("process/browser.js"),
        }
    }
};
