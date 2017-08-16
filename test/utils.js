const assert = require('chai').assert;
const Web3 = require('web3');
const { development } = require('../truffle.js').networks;

const web3 = new Web3(new Web3.providers.HttpProvider(
  `http://${development.host}:${development.port}`));

let idCounter = 0;

function isBigNumber(obj) {
  return obj.constructor.name === 'BigNumber';
}

// add bignumber support to chai assert
const PatchedAssert = {
  isAbove(valueToCheck, valueToBeAbove, message) {
    if (isBigNumber(valueToCheck) || isBigNumber(valueToBeAbove)) {
      const bnValue = web3.toBigNumber(valueToCheck);
      return assert.isTrue(
        bnValue.gt(valueToBeAbove),
        `${bnValue.toString('10')} should have been above ${valueToBeAbove.toString('10')}`);
    }

    return assert.isAbove(valueToCheck, valueToBeAbove, message);
  },
  isBelow(valueToCheck, valueToBeBelow, message) {
    if (isBigNumber(valueToCheck) || isBigNumber(valueToBeBelow)) {
      const bnValue = web3.toBigNumber(valueToCheck);
      return assert.isTrue(
        bnValue.lt(valueToBeBelow),
        `${bnValue.toString('10')} should have been below ${valueToBeBelow.toString('10')}`);
    }

    return assert.isBelow(valueToCheck, valueToBeBelow, message);
  },
  isAtLeast(valueToCheck, valueToBeAtLeast, message) {
    if (isBigNumber(valueToCheck) || isBigNumber(valueToBeAtLeast)) {
      const bnValue = web3.toBigNumber(valueToCheck);
      return assert.isTrue(
        bnValue.gte(valueToBeAtLeast),
        `${bnValue.toString('10')} should have been at least ${valueToBeAtLeast.toString('10')}`);
    }

    return assert.isAtLeast(valueToCheck, valueToBeAtLeast, message);
  },
  equals(valueToCheck, valueToEqual, message) {
    if (isBigNumber(valueToCheck) || isBigNumber(valueToEqual)) {
      const bnValue = web3.toBigNumber(valueToCheck);
      return assert.isTrue(bnValue.eq(valueToEqual),
        `${bnValue.toString('10')} should have been equal to ${valueToEqual.toString('10')}`);
    }

    return assert.equal(valueToCheck, valueToEqual, message);
  },
};

async function mineBlock() {
  return new Promise((resolve, reject) => {
    idCounter += 1;
    const payload = {
      jsonrpc: '2.0',
      method: 'evm_mine',
      id: idCounter,
    };
    web3.currentProvider.sendAsync(
      payload,
      (error, result) => {
        if (error) {
          return reject(error);
        }
        return resolve(result);
      });
  });
}

async function getAllEvents(instance, eventName) {
  const watcher = instance[eventName]();
  const events = await new Promise(
    (resolve, reject) => watcher.get(
      (error, result) => {
        watcher.stopWatching();
        if (error) {
          return reject(error);
        }
        return resolve(result);
      }));

  return events.map(event => event.args);
}

async function getLatestEvent(instance, eventName) {
  const events = await getAllEvents(instance, eventName);
  return events[events.length - 1];
}

async function usedAllGas(data) {
  const tx = await web3.eth.getTransaction(data.tx);
  return tx.gas === data.receipt.gasUsed;
}

module.exports = {
  assert: Object.assign({}, assert, PatchedAssert),
  fail(message) {
    throw new Error(message);
  },
  assertVmException(error) {
    assert.include(error.message, 'invalid opcode');
  },
  async shouldThrowVmException(fn) {
    try {
      const receipt = await fn();

      // only portable way to do this right now
      // if we used all gas there's a high probability that the contract call
      // threw an exception
      if (usedAllGas(receipt)) {
        throw new Error('invalid opcode');
      }

      assert.fail('should have thrown');
    } catch (error) {
      assert.include(error.message, 'invalid opcode');
    }
  },
  async mineUntilBlock(blockNumber) {
    const currentBlock = web3.eth.blockNumber;
    const blocksToGo = blockNumber - currentBlock;

    if (blocksToGo < 1) {
      return;
    }

    for (let i = 0; i < blocksToGo; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await mineBlock(web3);
    }
  },
  getLatestEvent,
  getAllEvents,
  mineBlock,
};
