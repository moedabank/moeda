const MoedaToken = artifacts.require('./MoedaToken');
const MockMigrationAgent = artifacts.require('./MockMigrationAgent');
const utils = require('./utils');

const assert = utils.assert;
const fail = utils.fail;
const assertVmException = utils.assertVmException;
const NULL_ADDRESS = '0x0000000000000000000000000000000000000000';

contract('MoedaToken', (accounts) => {
  let instance;
  const MINTER = accounts[1];
  beforeEach(async () => {
    instance = await MoedaToken.new(MINTER);
  });

  describe('constructor', () => {
    it('should set owner to senders address', async () => {
      const owner = await instance.owner.call();
      assert.strictEqual(owner, accounts[0]);
    });

    it('should set minter', async () => {
      const minter = await instance.minter.call();
      assert.strictEqual(minter, MINTER);
    });
  });

  describe('setMigrationagent', () => {
    let agent;

    beforeEach(async () => {
      agent = await MockMigrationAgent.new();
      await instance.unlock({ from: MINTER });
    });

    it('should throw if fundraiser is active', async () => {
      const token = await MoedaToken.new(MINTER);

      try {
        await token.setMigrationAgent(agent.address, { from: accounts[0] });
        assert.fail('should have thrown');
      } catch (error) {
        assertVmException(error);
      }
    });

    it('should throw if sender is not owner', async () => {
      try {
        await instance.setMigrationAgent(agent.address, { from: accounts[3] });
        assert.fail('should have thrown');
      } catch (error) {
        assertVmException(error);
      }
    });

    it('should throw if argument is null address', async () => {
      try {
        await instance.setMigrationAgent(NULL_ADDRESS);
        assert.fail('should have thrown');
      } catch (error) {
        assertVmException(error);
      }
    });

    it('should throw if migrationAgent is already set', async () => {
      await instance.setMigrationAgent(agent.address);

      try {
        await instance.setMigrationAgent(NULL_ADDRESS);
        assert.fail('should have thrown');
      } catch (error) {
        assertVmException(error);
      }
    });

    it('should assign migrationAgent attribute', async () => {
      await instance.setMigrationAgent(agent.address);
      const agentAddress = await instance.migrationAgent.call();
      assert.strictEqual(agentAddress, agent.address);
    });
  });

  describe('migrate', () => {
    const balance = 5;
    const spender = accounts[2];

    beforeEach(async () => {
      await instance.create(spender, balance, { from: MINTER });
      const agent = await MockMigrationAgent.new();
      await instance.unlock({ from: MINTER });
      await instance.setMigrationAgent(agent.address);
    });

    it('should throw when fundraiser is still active', async () => {
      const token = await MoedaToken.new(spender);
      const mintingFinished = await token.mintingFinished.call();
      assert.isFalse(mintingFinished);

      return utils.shouldThrowVmException(token.migrate.bind(instance, spender, balance));
    });

    it('should throw when beneficiary is null address', async () => (
      utils.shouldThrowVmException(
        instance.migrate.bind(instance, NULL_ADDRESS, balance))));

    it('should throw when migrationAgent has not been set', async () => {
      const token = await MoedaToken.new(spender);
      const agent = await token.migrationAgent.call();
      assert.strictEqual(agent, NULL_ADDRESS);
      return utils.shouldThrowVmException(
        token.migrate.bind(token, spender, balance));
    });

    it('should throw when amount is zero', async () => (
      utils.shouldThrowVmException(
        instance.migrate.bind(instance, spender, 0))));

    it('should destroy old tokens and call migration agent', async () => {
      const agentAddress = await instance.migrationAgent.call();
      const agent = MockMigrationAgent.at(agentAddress);
      const amountMigrated = balance - 1;
      const recipient = accounts[3];

      await instance.migrate(recipient, amountMigrated, { from: spender });

      const newBalance = await instance.balanceOf.call(spender);
      const agentBalance = await agent.balanceOf.call(recipient);
      const totalSupply = await instance.totalSupply.call();
      const totalMigrated = await instance.totalMigrated.call();

      assert.strictEqual(newBalance.toNumber(), 1);
      assert.strictEqual(agentBalance.toNumber(), amountMigrated);
      assert.strictEqual(totalSupply.toNumber(), 1);
      assert.strictEqual(totalMigrated.toNumber(), amountMigrated);
      const log = await utils.getLatestEvent(instance, 'LogMigration');
      assert.strictEqual(log.spender, spender);
      assert.strictEqual(log.grantee, recipient);
      assert.strictEqual(log.amount.toNumber(), amountMigrated);
    });
  });

  describe('burn', () => {
    let token;
    const balance = 12345;

    beforeEach(async () => {
      token = await MoedaToken.new(MINTER);
      token.create(accounts[3], balance, { from: MINTER });
    });

    it('should throw when amount is zero', async () => {
      utils.shouldThrowVmException(token.burn.bind(
        token, 0, { from: accounts[3] }));
    });

    it('should throw when balance is less than amount', async () => {
      utils.shouldThrowVmException(
        token.burn.bind(token, balance + 1, { from: accounts[3] }));
    });

    it('should reduce total supply and sender balance', async () => {
      const amountToBurn = 45;
      await token.burn(amountToBurn, { from: accounts[3] });
      const supply = await token.totalSupply.call();
      const newBalance = await token.balanceOf.call(accounts[3]);
      assert.isTrue(supply.eq(balance - amountToBurn));
      assert.isTrue(newBalance.eq(balance - amountToBurn));

      const event = await utils.getLatestEvent(token, 'LogDestruction');
      assert.isTrue(event.amount.eq(amountToBurn));
    });
  });

  describe('create()', () => {
    it('should throw if newly generated tokens would exceed max supply',
      async () => {
        const maxTokens = await instance.MAX_TOKENS.call();
        const totalSupply = await instance.totalSupply.call();
        assert.equals(totalSupply, 0);

        return utils.shouldThrowVmException(
          instance.create.bind(
            instance, accounts[2], maxTokens.plus(1), { from: MINTER }));
      });

    it('should increase tokenSupply by given amount', async () => {
      const supply = await instance.totalSupply.call();
      await instance.create(
        accounts[1], web3.toWei(500), { from: MINTER });
      const newSupply = await instance.totalSupply.call();
      assert.equal(
        newSupply.toString(), supply.plus(web3.toWei(500)).toString());
    });

    it('should increase the balance of given recipient by amount',
      async () => {
        const balance = await instance.balanceOf.call(accounts[2]);
        await instance.create(
          accounts[2], web3.toWei(500), { from: MINTER });
        const newBalance = await instance.balanceOf.call(accounts[2]);

        assert.equal(
          newBalance.toString(),
          balance.plus(web3.toWei(500)).toString());
      });

    it('should only allow minter to call', async () => (
      utils.shouldThrowVmException(
        instance.create.bind(instance, accounts[1], web3.toWei(500)))));

    it('should throw an error when fundraiser is not active', async () => {
      const token = await MoedaToken.new(MINTER);
      await token.unlock({ from: MINTER });
      const mintingFinished = await token.mintingFinished.call();
      assert.isTrue(mintingFinished);

      return utils.shouldThrowVmException(token.create.bind(token,
        accounts[1], web3.toWei(500), { from: MINTER }));
    });

    it('should emit a LogCreation event on success', async () => {
      const token = await MoedaToken.new(MINTER);

      try {
        await token.create(
          accounts[1], web3.toWei(500), { from: MINTER });
        const event = await utils.getLatestEvent(
          token, 'LogCreation');

        assert.strictEqual(event.donor, accounts[1]);
        assert.strictEqual(
          event.tokensReceived.toString(10),
          web3.toWei(500).toString(10));
      } catch (error) {
        fail(`should not have thrown ${error}`);
      }
    });
  });

  describe('unlock()', () => {
    it('should only allow minter to invoke', async () => {
      await utils.shouldThrowVmException(instance.unlock.bind(instance));

      const mintingFinished = await instance.mintingFinished.call();
      assert.strictEqual(mintingFinished, false);
    });

    it('should set mintingFinished to false', async () => {
      await instance.unlock({ from: MINTER });
      const mintingFinished = await instance.mintingFinished.call();
      assert.strictEqual(mintingFinished, true, 'should be unlocked');
    });
  });

  describe('transfer()', () => {
    beforeEach(async () => {
      await instance.create(accounts[1], web3.toWei(1500), { from: MINTER });
    });

    it('should throw when fundraiser is active', async () => {
      const mintingFinished = await instance.mintingFinished.call();
      assert.isFalse(mintingFinished);
      return utils.shouldThrowVmException(
        instance.transfer.bind(instance,
          accounts[2], web3.toWei(10), { from: accounts[1] }));
    });

    it('should not throw when transfers are unlocked', async () => {
      try {
        await instance.unlock({ from: MINTER });
        const mintingFinished = await instance.mintingFinished.call();
        assert.isTrue(mintingFinished);

        const amount = web3.toWei(15);
        await instance.transfer(
          accounts[2], amount, { from: accounts[1] });

        const balance = await instance.balanceOf.call(accounts[1]);
        assert.strictEqual(web3.fromWei(balance).toNumber(), 1485);

        const recipientBalance = await instance.balanceOf.call(accounts[2]);
        assert.strictEqual(
          recipientBalance.toString(),
          amount.toString());
      } catch (error) {
        fail(error.message);
      }
    });
  });

  describe('transferFrom()', () => {
    beforeEach(async () => {
      await instance.create(accounts[1], web3.toWei(1500), { from: MINTER });
    });

    it('should throw when fundraiser is active', async () => {
      const mintingFinished = await instance.mintingFinished.call();
      assert.isFalse(mintingFinished);

      await instance.approve(
        accounts[2], web3.toWei(100), { from: accounts[1] });
      const allowance = await instance.allowance.call(
        accounts[1], accounts[2]);
      assert.strictEqual(web3.fromWei(allowance).toNumber(), 100);

      return utils.shouldThrowVmException(
        instance.transferFrom.bind(instance,
          accounts[1], accounts[2], web3.toWei(50),
          { from: accounts[2] }));
    });

    it('should not throw when transfers are unlocked', async () => {
      try {
        await instance.unlock({ from: MINTER });
        const mintingFinished = await instance.mintingFinished.call();
        assert.isTrue(mintingFinished);

        await instance.approve(
          accounts[2], web3.toWei(100), { from: accounts[1] });
        const allowance = await instance.allowance.call(
          accounts[1], accounts[2]);
        assert.strictEqual(web3.fromWei(allowance).toNumber(), 100);

        await instance.transferFrom(
          accounts[1],
          accounts[2],
          web3.toWei(50),
          { from: accounts[2] });

        const balance = await instance.balanceOf.call(accounts[1]);
        assert.strictEqual(web3.fromWei(balance).toNumber(), 1450);

        const recipientBalance = await instance.balanceOf.call(accounts[2]);
        assert.strictEqual(
          recipientBalance.toString(),
          web3.toWei(50).toString());
      } catch (error) {
        fail(error.message);
      }
    });
  });

  describe('balanceOf()', () => {
    it('should return balance of token holder', async () => {
      await instance.create(accounts[1], web3.toWei(15), { from: MINTER });
      const balance = await instance.balanceOf.call(accounts[1]);
      assert.strictEqual(balance.toString(), web3.toWei(15).toString());
    });

    it('should return zero when sender has no balance', async () => {
      const balance = await instance.balanceOf.call(accounts[3]);
      assert.strictEqual(balance.toNumber(), 0);
    });
  });

  describe('approve()', () => {
    it('should set a given allowance for a requested spender',
      async () => {
        const token = await MoedaToken.new(accounts[0]);
        await token.create(accounts[1], web3.toWei(15));
        const amount = web3.toWei(4);
        await token.approve(
          accounts[2], amount, { from: accounts[1] });

        const allowance = await token.allowance.call(
          accounts[1], accounts[2]);
        assert.strictEqual(
          allowance.toString(), amount.toString());
      });

    it('should emit an approval event', async () => {
      await instance.create(accounts[1], web3.toWei(15), { from: MINTER });
      const amount = web3.toWei(9);
      await instance.approve(
        accounts[3], amount, { from: accounts[1] });
      const event = await utils.getLatestEvent(instance, 'Approval');
      assert.strictEqual(event.owner, accounts[1]);
      assert.strictEqual(event.spender, accounts[3]);
      assert.strictEqual(event.value.toString(), amount.toString());
    });
  });

  describe('allowance()', () => {
    it('should return an allowed transfer amount', async () => {
      await instance.create(accounts[1], web3.toWei(15), { from: MINTER });
      await instance.approve(
        accounts[2], web3.toWei(8), { from: accounts[1] });
      const allowance = await instance.allowance.call(
        accounts[1], accounts[2]);
      assert.strictEqual(
        web3.fromWei(allowance).toNumber(), 8);
    });

    it('should return zero if no allowance exists', async () => {
      const allowance = await instance.allowance.call(
        accounts[1], accounts[2]);
      assert.strictEqual(
        web3.fromWei(allowance).toNumber(), 0);
    });
  });
});
