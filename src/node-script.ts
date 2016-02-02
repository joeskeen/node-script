/// <reference path="../typings/tsd.d.ts" />
/// <reference path="../typings/interpret.d.ts" />
/// <reference path="../node-script.d.ts" />
'use strict';

import * as request from 'request-promise';
import * as url from 'url';
import * as yargs from 'yargs';
import { join, resolve, basename } from 'path';
import * as childProcess from 'child_process';
import * as chalk from 'chalk';
import * as fs from 'fs';
import * as semver from 'semver';
import { extensions, ModuleInfo } from 'interpret';
import { fromErrCallback, fromNoErrCallback } from './2promise';

const writeFileAsync = (file: string, data: any) => fromErrCallback(fs.writeFile, fs, [file, data]);
const existsAsync = (file: string) => fromNoErrCallback<boolean>(fs.exists, fs, file);
const mkdirAsync = (dir: string) => fromErrCallback(fs.mkdir, fs, dir);
const readFileAsync = (file: string) => fromErrCallback<Buffer>(fs.readFile, fs, file);

const settingsFileName = 'node-script.json';

let verbose: boolean = false;
let environment: NodeScriptEnvironment;

run();

async function run() {
    try {
        const args = parseArgs();
        environment = await initializeNodeScript();
        await runScript(args);
    } catch (error) {
        console.error(chalk.bold.red('Error running script'));
        console.dir(error);
    }
}

async function initializeNodeScript() {
    const home = process.env.HOME || process.env.USERPROFILE;
    if (!home)
        throw new Error('Unable to detect user directory for node-script settings.');
    
    const settingsDir = join(home, '.node-script');
    const settingsFilePath = join(settingsDir, settingsFileName);
    if (!(await existsAsync(settingsDir))) {
        console.log('Initializing node-script...');
        await mkdirAsync(settingsDir);
    }
    if (!(await existsAsync(settingsFilePath))) {
        await writeFileAsync(settingsFilePath, JSON.stringify({}));
    }
    
    const scriptsDir = join(settingsDir, 'scripts');
    if (!(await existsAsync(scriptsDir))) {
        await mkdirAsync(scriptsDir);
    }
    
    const settingsFileContents = (await readFileAsync(settingsFilePath)).toString();
    const settings: NodeScriptSettings = JSON.parse(settingsFileContents);
    
    const nodeModulesDir = join(settingsDir, 'node_modules');
    const env = process.env;
    env.NODE_PATH = env.NODE_PATH ? `${nodeModulesDir}:${env.NODE_PATH}` : nodeModulesDir;
    return { settingsDir, settings, nodeModulesDir, scriptsDir };
}

interface NodeScriptEnvironment {
    scriptsDir: string;
    settingsDir: string;
    settings: NodeScriptSettings;
    nodeModulesDir: string;
}

interface NodeScriptSettings {
    
}

interface Arguments {
    nodeScriptArgs: any;
    scriptArgs: string[];
    scriptFile: string;
}

function parseArgs(): Arguments {
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
    
    function setupOptions(yargs: yargs.Argv): yargs.Argv {
        return yargs.usage('$0 script_path [script_args]')
            .demand(1)
            .option('verbose', {
                alias: 'v',
                boolean: true,
                description: 'enable verbose logging'
            });
    }
}

async function runScript(args: Arguments) {
    const verbose: boolean = args.nodeScriptArgs.verbose;
    
    global['script'] = script;
    
    log('process.argv', process.argv);
    log('nodeScriptArgs', args.nodeScriptArgs);
    log('scriptArgs', args.scriptArgs);
    process.argv.length = 0;
    args.scriptArgs.forEach(arg => process.argv.push(arg));
    const scriptContents = await getScriptContents(args.scriptFile, environment.scriptsDir);
    const scriptBaseName = basename(args.scriptFile);
    const destinationPath = join(environment.scriptsDir, scriptBaseName);
    await writeFileAsync(destinationPath, scriptContents);
    //TODO: use 'interpret' module to determine which JS variant loaders we need to register (.ts, .coffee, etc.)
    const extension = Object.keys(extensions)
        .sort((a, b) => b.length - a.length)
        .filter(ext => scriptBaseName.endsWith(ext))[0];
    if (!extension) {
        throw new Error(`Can't find a suitable module loader for ${scriptBaseName} (using 'interpret' https://github.com/js-cli/js-interpret/blob/master/index.js)`);
    }
    const loader = extensions[extension];
    if (loader) {
        let isLoaded = false;
        let loaderModules = Array.isArray(loader)
                ? loader
                : [loader];
        loaderModules.forEach(module => {
            if (isLoaded)
                return;
            
            const moduleInfo = typeof module === 'string'
                ? <ModuleInfo>{ module: module, register: null }
                : module;
            
            try {
                const modName = moduleInfo.module.split('/')[0];
                if (!isInstalled(modName)) {
                    npmInstall(modName);
                }
            
                require(moduleInfo.module);
                isLoaded = true;
            } catch (error) {
                //continue on    
            }
        });
        
        if (!isLoaded) {
            throw new Error(`Can't find a suitable module loader for ${scriptBaseName} (using 'interpret' https://github.com/js-cli/js-interpret/blob/master/index.js)`);
        }
    }
    log(`script extension: ${extension}`);
    log(`running script ${scriptBaseName}...`);
    require(destinationPath);
}

function script(config?: NodeScriptMetadata) {
    log('script with config: ', config);
    if (config && config.dependencies) {
        const dependenciesToInstall = Object.keys(config.dependencies)
            .map(name => ({moduleName: name, version: config.dependencies[name]}))
            .filter(mod => !isInstalled(mod.moduleName, mod.version))
            .map(mod => `${mod.moduleName}@${mod.version}`)
            .join(' ')
            .trim();
        if (dependenciesToInstall)
            npmInstall(dependenciesToInstall);
    }
}

function npmInstall(packages: string) {
    const command = `npm install ${packages} --prefix ${environment.settingsDir}`;
    log(`installing the following packages: ${packages}`);
    childProcess.execSync(command, {
        stdio: verbose ? [0,1,2] : [],
    });
}

function log(title: string | any, logObj?: any) {
    if (verbose) {
        console.log.apply(this, arguments);
    }
}

//must be synchronous since it is called during script setup
function isInstalled(moduleName: string, version?: string) {
    version = semver.valid(version) || '*';
    const modulePackageJson = join(environment.settingsDir, 'node_modules', moduleName, 'package.json');
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

async function getScriptContents(scriptFile: string, scriptDir: string) {
    try {
        const scriptUrl = url.parse(scriptFile);
        if (scriptUrl.hostname) { 
            return await request.get(scriptFile);
        }
        
        const relativePath = resolve(process.cwd(), scriptFile);
        if (await existsAsync(relativePath)) {
            return (await readFileAsync(relativePath)).toString();
        }
        
        const scriptFolderPath = resolve(scriptDir, scriptFile);
        if (await existsAsync(scriptFolderPath)) {
            return (await readFileAsync(scriptFolderPath)).toString();
        }
    } catch (error) {
        throw new Error(`Error while loading script file ${scriptFile}: ${error}`);
    }
    
    throw new Error(`Unable to find script file ${scriptFile}`);
}
