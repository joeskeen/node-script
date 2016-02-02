#!/usr/bin/env node
/// <reference path="../typings/tsd.d.ts" />
/// <reference path="../node-script.d.ts" />
'use strict';
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, Promise, generator) {
    return new Promise(function (resolve, reject) {
        generator = generator.call(thisArg, _arguments);
        function cast(value) { return value instanceof Promise && value.constructor === Promise ? value : new Promise(function (resolve) { resolve(value); }); }
        function onfulfill(value) { try { step("next", value); } catch (e) { reject(e); } }
        function onreject(value) { try { step("throw", value); } catch (e) { reject(e); } }
        function step(verb, value) {
            var result = generator[verb](value);
            result.done ? resolve(result.value) : cast(result.value).then(onfulfill, onreject);
        }
        step("next", void 0);
    });
};
var request = require('request-promise');
var url = require('url');
var yargs = require('yargs');
var path_1 = require('path');
var childProcess = require('child_process');
var chalk = require('chalk');
var fs = require('fs');
var _2promise_1 = require('./2promise');
const writeFileAsync = (file, data) => _2promise_1.fromErrCallback(fs.writeFile, fs, [file, data]);
const existsAsync = (file) => _2promise_1.fromNoErrCallback(fs.exists, fs, file);
const mkdirAsync = (dir) => _2promise_1.fromErrCallback(fs.mkdir, fs, dir);
const readFileAsync = (file) => _2promise_1.fromErrCallback(fs.readFile, fs, file);
const settingsFileName = 'node-script.json';
run();
function run() {
    return __awaiter(this, void 0, Promise, function* () {
        try {
            const args = parseArgs();
            const environment = yield initializeNodeScript();
            yield runScript(environment, args);
        }
        catch (error) {
            console.error(chalk.bold.red('Error running script'));
            console.dir(error);
        }
    });
}
function initializeNodeScript() {
    return __awaiter(this, void 0, Promise, function* () {
        const home = process.env.HOME || process.env.USERPROFILE;
        if (!home)
            throw new Error('Unable to detect user directory for node-script settings.');
        const settingsDir = path_1.join(home, '.node-script');
        const settingsFilePath = path_1.join(settingsDir, settingsFileName);
        if (!(yield existsAsync(settingsDir))) {
            console.log('Initializing node-script...');
            yield mkdirAsync(settingsDir);
        }
        if (!(yield existsAsync(settingsFilePath))) {
            yield writeFileAsync(settingsFilePath, JSON.stringify({}));
        }
        const scriptsDir = path_1.join(settingsDir, 'scripts');
        if (!(yield existsAsync(scriptsDir))) {
            yield mkdirAsync(scriptsDir);
        }
        const settingsFileContents = (yield readFileAsync(settingsFilePath)).toString();
        const settings = JSON.parse(settingsFileContents);
        const nodeModulesDir = path_1.join(settingsDir, 'node_modules');
        const env = process.env;
        env.NODE_PATH = env.NODE_PATH ? `${nodeModulesDir}:${env.NODE_PATH}` : nodeModulesDir;
        return { settingsDir, settings, nodeModulesDir, scriptsDir };
    });
}
function parseArgs() {
    const scriptFile = setupOptions(yargs).argv._[0];
    const scriptFileArgIndex = process.argv.indexOf(scriptFile);
    const nodeScriptArgs = process.argv.slice(0, scriptFileArgIndex);
    const scriptArgs = process.argv.slice(scriptFileArgIndex);
    const args = setupOptions(yargs(nodeScriptArgs)).argv;
    return {
        nodeScriptArgs: args,
        scriptArgs,
        scriptFile
    };
    function setupOptions(yargs) {
        return yargs.usage('$0 script_path [script_args]')
            .demand(1)
            .option('verbose', {
            alias: 'v',
            boolean: true,
            description: 'enable verbose logging'
        });
    }
}
function runScript(environment, args) {
    return __awaiter(this, void 0, Promise, function* () {
        const verbose = args.nodeScriptArgs.verbose;
        global['script'] = (config) => {
            log('script with config: ', config);
            if (config && config.dependencies) {
                const dependencies = config.dependencies;
                //TODO: Only 'NPM install' if needed for each package (use 'semver' module to check)
                //TODO: run script from temp location so installed node modules don't pollute the CWD
                const packages = Object.keys(dependencies).map(packageName => `${packageName}@${dependencies[packageName]}`);
                const command = `npm install ${packages.join(' ')} --prefix ${environment.settingsDir}`;
                childProcess.execSync(command, {
                    stdio: verbose ? [0, 1, 2] : [],
                });
                log(packages);
            }
        };
        log('process.argv', process.argv);
        log('nodeScriptArgs', args.nodeScriptArgs);
        log('scriptArgs', args.scriptArgs);
        process.argv.length = 0;
        args.scriptArgs.forEach(arg => process.argv.push(arg));
        const scriptContents = yield getScriptContents(args.scriptFile, environment.scriptsDir);
        const destinationPath = path_1.join(environment.scriptsDir, path_1.basename(args.scriptFile));
        yield writeFileAsync(destinationPath, scriptContents);
        log(`running script ${args.scriptFile}...`);
        //TODO: use 'interpret' module to determine which JS variant loaders we need to register (.ts, .coffee, etc.)
        require(destinationPath);
        function log(title, logObj) {
            if (verbose) {
                console.log.apply(this, arguments);
            }
        }
    });
}
function getScriptContents(scriptFile, scriptDir) {
    return __awaiter(this, void 0, Promise, function* () {
        try {
            const scriptUrl = url.parse(scriptFile);
            if (scriptUrl.hostname) {
                return yield request.get(scriptFile);
            }
            const relativePath = path_1.resolve(process.cwd(), scriptFile);
            if (yield existsAsync(relativePath)) {
                return (yield readFileAsync(relativePath)).toString();
            }
            const scriptFolderPath = path_1.resolve(scriptDir, scriptFile);
            if (yield existsAsync(scriptFolderPath)) {
                return (yield readFileAsync(scriptFolderPath)).toString();
            }
        }
        catch (error) {
            throw new Error(`Error while loading script file ${scriptFile}: ${error}`);
        }
        throw new Error(`Unable to find script file ${scriptFile}`);
    });
}
