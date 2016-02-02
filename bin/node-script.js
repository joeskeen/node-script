#!/usr/bin/env node
/// <reference path="../typings/tsd.d.ts" />
/// <reference path="../typings/interpret.d.ts" />
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
var semver = require('semver');
var interpret_1 = require('interpret');
var _2promise_1 = require('./2promise');
const writeFileAsync = (file, data) => _2promise_1.fromErrCallback(fs.writeFile, fs, [file, data]);
const existsAsync = (file) => _2promise_1.fromNoErrCallback(fs.exists, fs, file);
const mkdirAsync = (dir) => _2promise_1.fromErrCallback(fs.mkdir, fs, dir);
const readFileAsync = (file) => _2promise_1.fromErrCallback(fs.readFile, fs, file);
const settingsFileName = 'node-script.json';
let verbose = false;
let environment;
run();
function run() {
    return __awaiter(this, void 0, Promise, function* () {
        try {
            const args = parseArgs();
            environment = yield initializeNodeScript();
            yield runScript(args);
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
    verbose = args.verbose;
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
function runScript(args) {
    return __awaiter(this, void 0, Promise, function* () {
        const verbose = args.nodeScriptArgs.verbose;
        global['script'] = script;
        log('process.argv', process.argv);
        log('nodeScriptArgs', args.nodeScriptArgs);
        log('scriptArgs', args.scriptArgs);
        process.argv.length = 0;
        args.scriptArgs.forEach(arg => process.argv.push(arg));
        const scriptContents = yield getScriptContents(args.scriptFile, environment.scriptsDir);
        const scriptBaseName = path_1.basename(args.scriptFile);
        const destinationPath = path_1.join(environment.scriptsDir, scriptBaseName);
        yield writeFileAsync(destinationPath, scriptContents);
        //TODO: use 'interpret' module to determine which JS variant loaders we need to register (.ts, .coffee, etc.)
        const extension = Object.keys(interpret_1.extensions)
            .sort((a, b) => b.length - a.length)
            .filter(ext => scriptBaseName.endsWith(ext))[0];
        if (!extension) {
            throw new Error(`Can't find a suitable module loader for ${scriptBaseName} (using 'interpret' https://github.com/js-cli/js-interpret/blob/master/index.js)`);
        }
        const loader = interpret_1.extensions[extension];
        if (loader) {
            let isLoaded = false;
            let loaderModules = Array.isArray(loader)
                ? loader
                : [loader];
            loaderModules.forEach(module => {
                if (isLoaded)
                    return;
                const moduleInfo = typeof module === 'string'
                    ? { module: module, register: null }
                    : module;
                try {
                    const modName = moduleInfo.module.split('/')[0];
                    if (!isInstalled(modName)) {
                        npmInstall(modName);
                    }
                    require(moduleInfo.module);
                    isLoaded = true;
                }
                catch (error) {
                }
            });
            if (!isLoaded) {
                throw new Error(`Can't find a suitable module loader for ${scriptBaseName} (using 'interpret' https://github.com/js-cli/js-interpret/blob/master/index.js)`);
            }
        }
        log(`script extension: ${extension}`);
        log(`running script ${scriptBaseName}...`);
        require(destinationPath);
    });
}
function script(config) {
    log('script with config: ', config);
    if (config && config.dependencies) {
        const dependenciesToInstall = Object.keys(config.dependencies)
            .map(name => ({ moduleName: name, version: config.dependencies[name] }))
            .filter(mod => !isInstalled(mod.moduleName, mod.version))
            .map(mod => `${mod.moduleName}@${mod.version}`)
            .join(' ')
            .trim();
        if (dependenciesToInstall)
            npmInstall(dependenciesToInstall);
    }
}
function npmInstall(packages) {
    const command = `npm install ${packages} --prefix ${environment.settingsDir}`;
    log(`installing the following packages: ${packages}`);
    childProcess.execSync(command, {
        stdio: verbose ? [0, 1, 2] : [],
    });
}
function log(title, logObj) {
    if (verbose) {
        console.log.apply(this, arguments);
    }
}
//must be synchronous since it is called during script setup
function isInstalled(moduleName, version) {
    version = semver.valid(version) || '*';
    const modulePackageJson = path_1.join(environment.settingsDir, 'node_modules', moduleName, 'package.json');
    if (!(fs.existsSync(modulePackageJson))) {
        log(`couldn't find module dir for ${moduleName}`);
        return false;
    }
    const json = JSON.parse(fs.readFileSync(modulePackageJson).toString());
    const moduleVersion = json.version;
    const versionValid = semver.satisfies(moduleVersion, version);
    if (!versionValid) {
        log(`Found module dir for ${module}, but requested version ${version} wasn't satisfied by ${moduleVersion}`);
    }
    return versionValid;
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
