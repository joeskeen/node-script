/// <reference path="../typings/tsd.d.ts" />
'use strict';

export async function fromNoErrCallback<TResult>(func: Function, thisArg: any, args?: any) {
    return toPromise<TResult>(func, thisArg, args, createNoErrCallback);
}

export async function fromErrCallback<TResult>(func: Function, thisArg: any, args?: any) {
    return toPromise<TResult>(func, thisArg, args, createErrCallback);
}

function createErrCallback<T>(resolve: ResolveFunction<T>, reject: RejectFunction) {
    return function(error: any) {
        if (error) {
            reject(error);
        }
        else {
            switch(arguments.length) {
                case 0:
                case 1:
                    resolve();
                    break;
                case 2:
                    resolve(arguments[1]);
                    break;
                default:
                    resolve(Array.prototype.slice.call(arguments, 1));
                    break;
            } 
        }
    };
}

function createNoErrCallback<T>(resolve: ResolveFunction<T>, reject: RejectFunction) {
    return function () {
        switch(arguments.length) {
            case 0:
                resolve();
                break;
            case 1:
                resolve(arguments[0]);
                break;
            default:
                resolve(Array.prototype.slice.call(arguments, 1));
                break;
        }
    };
}

type ResolveFunction<T> = (value?: T | PromiseLike<T>) => void;
type RejectFunction = (reason: any) => void;
type PromiseExecutorFunc<T> = (resolve: ResolveFunction<T>, reject: RejectFunction) => Function;

function toPromise<TResult>(func: Function, thisArg: any, args: any, callbackFactory: PromiseExecutorFunc<TResult>) {
    return new Promise<TResult>((resolve, reject) => {
        const callbackArray = [callbackFactory(resolve, reject)];
        let fullArgs: any[];
        if (args) {
            const argArray: any[] = Array.isArray(args) ? args : [args];
            fullArgs = argArray.concat(callbackArray); 
        }
        else {
            fullArgs = callbackArray;
        }
        func.apply(thisArg, fullArgs);
    });
}