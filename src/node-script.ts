/// <reference path="../typings/tsd.d.ts" />
/// <reference path="../node-script.d.ts" />
'use strict';

import * as yargs from 'yargs';
import { join, resolve, basename } from 'path';
import * as childProcess from 'child_process';
import * as chalk from 'chalk';
import * as fs from 'fs';
import { fromErrCallback, fromNoErrCallback } from './2promise';

const writeFileAsync = (file: string, data: any) => fromErrCallback(fs.writeFile, fs, [file, data]);
const existsAsync = (file: string) => fromNoErrCallback<boolean>(fs.exists, fs, file);
const mkdirAsync = (dir: string) => fromErrCallback(fs.mkdir, fs, dir);
const readFileAsync = (file: string) => fromErrCallback<Buffer>(fs.readFile, fs, file);

const settingsFileName = 'node-script.json';

run();

async function run() {
    try {
        const args = parseArgs();
        const environment = await initializeNodeScript();
        await runScript(environment, args);
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

async function runScript(environment: NodeScriptEnvironment, args: Arguments) {
    const verbose: boolean = args.nodeScriptArgs.verbose;
    
    global['script'] = (config?: NodeScriptMetadata) => {
        log('script with config: ', config);
        if (config && config.dependencies) {
            const dependencies = config.dependencies;
            //TODO: Only 'NPM install' if needed for each package (use 'semver' module to check)
            //TODO: run script from temp location so installed node modules don't pollute the CWD
            const packages = Object.keys(dependencies).map(packageName => `${packageName}@${dependencies[packageName]}`);
            const command = `npm install ${packages.join(' ')} --prefix ${environment.settingsDir}`;
            childProcess.execSync(command, {
                stdio: verbose ? [0,1,2] : [],
            });
            log(packages);
        }
    };
    
    log('process.argv', process.argv);
    log('nodeScriptArgs', args.nodeScriptArgs);
    log('scriptArgs', args.scriptArgs);
    process.argv.length = 0;
    args.scriptArgs.forEach(arg => process.argv.push(arg));
    const scriptPath = resolve(process.cwd(), args.scriptFile);
    const scriptContents = await readFileAsync(scriptPath);
    const destinationPath = join(environment.scriptsDir, basename(args.scriptFile));
    await writeFileAsync(destinationPath, scriptContents);
    log(`running script ${scriptPath}...`);
    //TODO: use 'interpret' module to determine which JS variant loaders we need to register (.ts, .coffee, etc.)
    require(destinationPath);

    function log(title: string | any, logObj?: any) {
        if (verbose) {
            console.log.apply(this, arguments);
        }
    }
}
