'use strict';

interface IGreeter {
    greet(): void;
}

class Greeter implements IGreeter {
    constructor(public name: string) {
    }
    
    greet() {
        console.log(`hello from ${this.name}`);
    }
}

const greeter: IGreeter = new Greeter('Jon');
console.log(greeter.greet());