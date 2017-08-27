const MoedaToken = artifacts.require('./TestMintingToken');
const LiveToken = artifacts.require('./MoedaToken');
const MockMigrationAgent = artifacts.require('./MockMigrationAgent');
const utils = require('./utils');

const assert = utils.assert;
const fail = utils.fail;
const NULL_ADDRESS = '0x0000000000000000000000000000000000000000';

contract('MoedaToken', (accounts) => {
  let instance;
  beforeEach(async () => {
    instance = await MoedaToken.new();
  });

  describe('constructor', () => {
    it('should set owner to senders address', async () => {
      const owner = await instance.owner.call();
      assert.strictEqual(owner, accounts[0]);
    });

    it('should allocate tokens', async () => {
      const token = await LiveToken.new();
      const other = await token.balanceOf.call(
        '0x2f37be861699b6127881693010596B4bDD146f5e');
      const supply = await token.totalSupply.call();
      const expectedAmount = web3.toWei(20000000);

      assert.equals(other, expectedAmount);
      assert.equals(supply, expectedAmount);
    });
  });

  describe('setMigrationagent', () => {
    let agent;

    beforeEach(async () => {
      agent = await MockMigrationAgent.new();
      await instance.unlock();
    });

    it('should throw if minting is active', async () => {
      const token = await MoedaToken.new();
      return utils.shouldThrowVmException(
        token.setMigrationAgent.bind(token, agent.address));
    });

    it('should throw if sender is not owner', () => (
      utils.shouldThrowVmException(
        instance.setMigrationAgent.bind(
          instance, agent.address, { from: accounts[1] }))));

    it('should throw if argument is null address', () => (
      utils.shouldThrowVmException(
        instance.setMigrationAgent.bind(instance, NULL_ADDRESS))));

    it('should throw if argument is not a contract', () => (
      utils.shouldThrowVmException(
        instance.setMigrationAgent.bind(instance, accounts[1]))));

    it('should throw if migrationAgent is already set', async () => {
      await instance.setMigrationAgent(agent.address);

      return utils.shouldThrowVmException(
        instance.setMigrationAgent.bind(instance, agent.address));
    });

    it('should throw if argument is not a MigrationAgent', async () => {
      const fakeAgent = await MoedaToken.new();
      return utils.shouldThrowVmException(
        instance.setMigrationAgent.bind(instance, fakeAgent.address));
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
      await instance.create(spender, balance);
      const agent = await MockMigrationAgent.new();
      await instance.unlock();
      await instance.setMigrationAgent(agent.address);
    });

    it('should throw when minting is still active', async () => {
      const token = await MoedaToken.new();
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

      assert.equals(newBalance, 1);
      assert.equals(agentBalance, amountMigrated);
      assert.equals(totalSupply, '2');
      assert.equals(totalMigrated, amountMigrated);
      const log = await utils.getLatestEvent(instance, 'LogMigration');
      assert.equals(log.spender, spender);
      assert.equals(log.grantee, recipient);
      assert.equals(log.amount, amountMigrated);
    });
  });

  describe('burn', () => {
    let token;
    const balance = 12345;

    beforeEach(async () => {
      token = await MoedaToken.new();
      return token.create(accounts[3], balance);
    });

    it('should throw when amount is zero', () => (
      utils.shouldThrowVmException(token.burn.bind(
        token, 0, { from: accounts[3] }))));

    it('should throw when balance is less than amount', () => (
      utils.shouldThrowVmException(
        token.burn.bind(token, balance + 1, { from: accounts[3] }))));

    it('should reduce total supply and sender balance', async () => {
      const amountToBurn = 45;
      const supplyBefore = await token.totalSupply.call();
      await token.burn(amountToBurn, { from: accounts[3] });
      const supply = await token.totalSupply.call();
      const newBalance = await token.balanceOf.call(accounts[3]);
      assert.isTrue(supply.eq(supplyBefore.sub(amountToBurn)));
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
        assert.equals(totalSupply, '1');

        return utils.shouldThrowVmException(
          instance.create.bind(
            instance, accounts[2], maxTokens.plus(1)));
      });

    it('should increase tokenSupply by given amount', async () => {
      const supply = await instance.totalSupply.call();
      await instance.create(
        accounts[1], web3.toWei(500));
      const newSupply = await instance.totalSupply.call();
      assert.equal(
        newSupply.toString(), supply.plus(web3.toWei(500)).toString());
    });

    it('should increase the balance of given recipient by amount',
      async () => {
        const balance = await instance.balanceOf.call(accounts[2]);
        await instance.create(
          accounts[2], web3.toWei(500));
        const newBalance = await instance.balanceOf.call(accounts[2]);

        assert.equal(
          newBalance.toString(),
          balance.plus(web3.toWei(500)).toString());
      });

    it('should throw an error when minting is not active', async () => {
      const token = await MoedaToken.new();
      await token.unlock();
      const mintingFinished = await token.mintingFinished.call();
      assert.isTrue(mintingFinished);

      return utils.shouldThrowVmException(token.create.bind(token,
        accounts[1], web3.toWei(500)));
    });

    it('should emit a LogCreation event on success', async () => {
      const token = await MoedaToken.new();

      try {
        await token.create(
          accounts[1], web3.toWei(500));
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
    it('should only allow owner to invoke', async () => {
      await utils.shouldThrowVmException(instance.unlock.bind(
        instance, { from: accounts[1] }));

      const mintingFinished = await instance.mintingFinished.call();
      assert.strictEqual(mintingFinished, false);
    });

    it('should set mintingFinished to true', async () => {
      await instance.unlock();
      const mintingFinished = await instance.mintingFinished.call();
      assert.strictEqual(mintingFinished, true, 'should be unlocked');
    });
  });

  describe('transfer()', () => {
    beforeEach(async () => {
      await instance.create(accounts[1], web3.toWei(1500));
    });

    it('should throw when minting is active', async () => {
      const mintingFinished = await instance.mintingFinished.call();
      assert.isFalse(mintingFinished);
      return utils.shouldThrowVmException(
        instance.transfer.bind(instance,
          accounts[2], web3.toWei(10), { from: accounts[1] }));
    });

    it('should throw if recipient is null address', async () => {
      await instance.create(accounts[1], 100);
      return utils.shouldThrowVmException(
        instance.transfer.bind(instance, NULL_ADDRESS, 90, { from: accounts[1] }));
    });

    it('should not throw when transfers are unlocked', async () => {
      try {
        await instance.unlock();
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
      await instance.create(accounts[1], web3.toWei(1500));
    });

    it('should throw if recipient is null address', async () => {
      await instance.create(accounts[1], 100);
      await instance.approve(accounts[2], 90, { from: accounts[1] });
      return utils.shouldThrowVmException(
        instance.transferFrom.bind(
          instance, accounts[1], NULL_ADDRESS, 90, { from: accounts[2] }));
    });

    it('should throw when minting is active', async () => {
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
        await instance.unlock();
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
      await instance.create(accounts[1], web3.toWei(15));
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
      await instance.create(accounts[1], web3.toWei(15));
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
      await instance.create(accounts[1], web3.toWei(15));
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
