import webpack from 'webpack';

export default function override(config) {
    // Add a polyfill for 'stream' and 'buffer' which Firebase might indirectly need in some environments
    config.resolve.fallback = {
        ...config.resolve.fallback,
        "stream": require.resolve("stream-browserify"),
        "buffer": require.resolve("buffer"),
    };

    // Add the Buffer plugin for global access
    config.plugins = (config.plugins || []).concat([
        new webpack.ProvidePlugin({
            process: 'process/browser',
            Buffer: ['buffer', 'Buffer']
        })
    ]);

    // This is often needed for Firebase modular imports in Webpack 5 used by CRA 5
    config.module.rules.unshift({
        test: /\.m?js$/,
        resolve: {
            fullySpecified: false // Disable the fully specified rule for .mjs files
        }
    });

    return config;
}