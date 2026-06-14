import * as path from 'path'
import * as url from 'url'
import * as fs from 'fs'
import webpack from 'webpack'
import { AngularWebpackPlugin } from '@ngtools/webpack'

const __dirname = url.fileURLToPath(new URL('.', import.meta.url))

const isDev = !!process.env.TABBY_DEV

export default {
    target: 'node',
    entry: './src/index.ts',
    context: __dirname,
    devtool: 'source-map',
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: 'index.js',
        pathinfo: true,
        libraryTarget: 'umd',
        publicPath: 'auto',
    },
    mode: isDev ? 'development' : 'production',
    optimization: {
        minimize: false,
    },
    resolve: {
        extensions: ['.ts', '.js'],
    },
    module: {
        rules: [
            {
                test: /\.ts$/,
                use: ['@ngtools/webpack'],
            },
            {
                test: /\.pug$/,
                use: [
                    'apply-loader',
                    {
                        loader: 'pug-loader',
                        options: {
                            pretty: true,
                        },
                    },
                ],
            },
            {
                test: /\.scss$/,
                use: ['to-string-loader', 'css-loader', 'sass-loader'],
                include: /component\.scss$/,
            },
            {
                test: /\.scss$/,
                use: ['style-loader', 'css-loader', 'sass-loader'],
                exclude: /component\.scss$/,
            },
            {
                test: /\.css$/,
                use: ['to-string-loader', 'css-loader'],
                include: /component\.css$/,
            },
            {
                test: /\.css$/,
                use: ['style-loader', 'css-loader'],
                exclude: /component\.css$/,
            },
        ],
    },
    externals: [
        '@angular/animations',
        '@angular/common',
        '@angular/compiler',
        '@angular/core',
        '@angular/forms',
        '@angular/platform-browser',
        '@angular/platform-browser-dynamic',
        '@ng-bootstrap/ng-bootstrap',
        'child_process',
        'fs',
        'ngx-toastr',
        'os',
        'path',
        'rxjs',
        /^rxjs\//,
        'tabby-core',
        'tabby-settings',
        'tabby-terminal',
    ],
    plugins: [
        new AngularWebpackPlugin({
            tsconfig: path.resolve(__dirname, 'tsconfig.json'),
            directTemplateLoading: false,
            jitMode: true,
        }),
    ],
}
