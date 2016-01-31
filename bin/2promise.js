#!/usr/bin/env node
/// <reference path="../typings/tsd.d.ts" />
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
function fromNoErrCallback(func, thisArg, args) {
    return __awaiter(this, void 0, Promise, function* () {
        return toPromise(func, thisArg, args, createNoErrCallback);
    });
}
exports.fromNoErrCallback = fromNoErrCallback;
function fromErrCallback(func, thisArg, args) {
    return __awaiter(this, void 0, Promise, function* () {
        return toPromise(func, thisArg, args, createErrCallback);
    });
}
exports.fromErrCallback = fromErrCallback;
function createErrCallback(resolve, reject) {
    return function (error) {
        if (error) {
            reject(error);
        }
        else {
            switch (arguments.length) {
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
function createNoErrCallback(resolve, reject) {
    return function () {
        switch (arguments.length) {
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
function toPromise(func, thisArg, args, callbackFactory) {
    return new Promise((resolve, reject) => {
        const callbackArray = [callbackFactory(resolve, reject)];
        let fullArgs;
        if (args) {
            const argArray = Array.isArray(args) ? args : [args];
            fullArgs = argArray.concat(callbackArray);
        }
        else {
            fullArgs = callbackArray;
        }
        func.apply(thisArg, fullArgs);
    });
}
