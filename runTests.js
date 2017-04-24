const Config = require("truffle-config");
const Command = require("truffle/lib/command");
const TaskError = require("truffle/lib/errors/taskerror");
const TruffleError = require("truffle-error");
const Resolver = require("truffle-resolver");
const fork = require('child_process').fork;
const command = new Command(require("truffle/lib/commands"));

const options = {
    logger: console
};

const server = fork('./startRpc.js');

server.on('message', (message) => {
    if (message !== 'server running') {
        process.exit(1);
    }

    command.run('test', options, function(err) {
        if (err) {
            if (err instanceof TruffleError) {
                console.log(err.message);
            } else if (typeof err == "number") {
                // If a number is returned, exit with that number.
                server.kill();
                process.exit(err);
            } else {
                // Bubble up all other unexpected errors.
                console.log(err.stack || err.toString());
            }
        }

        server.kill();
        process.exit(0);
    });
});