const assert = require('chai').assert;

let idCounter = 0;

module.exports = {
    fail(message) {
        throw new Error(message);
    },
    assertVmException(error) {
        assert.include(error.message, 'invalid opcode');
    },
    async mineUntilBlock(web3, blockNumber) {
        const currentBlock = web3.eth.blockNumber;
        const blocksToGo = blockNumber - currentBlock;

        if (blocksToGo < 1) {
            return;
        }

        for (let i = 0; i < blocksToGo; i++) {
            await mineBlock(web3);
        }
    },
    async getLatestEvent(instance, eventName) {
        const watcher = instance[eventName]();
        const events = await new Promise(
            (resolve, reject) => watcher.get(
                (error, result) => {
                    watcher.stopWatching();
                    if (error) {
                        return reject(error);
                    }
                    resolve(result);
                }));

        return events[events.length - 1].args;
    },
    mineBlock,
};

async function mineBlock(web3) {
    return new Promise((resolve, reject) => {
        const payload = {
            jsonrpc: "2.0",
            method: "evm_mine",
            id: ++idCounter,
        };
        web3.currentProvider.sendAsync(
            payload,
            (error, result) => error ? reject(error) : resolve(result));
    });
}
