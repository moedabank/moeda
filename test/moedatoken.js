const MoedaToken = artifacts.require('./MoedaToken');
const MockMigrationAgent = artifacts.require('./MockMigrationAgent');
const utils = require('./utils');
const fail = utils.fail;
const assertVmException = utils.assertVmException;
const NULL_ADDRESS = '0x0000000000000000000000000000000000000000';

contract('MoedaToken', (accounts) => {
  let instance;
  const ADMIN = accounts[1];
  beforeEach(async () => {
    instance = await MoedaToken.new(ADMIN);
  });

  describe('constructor', () => {
    it('should set saleActive to true', async () => {
      const saleActive = await instance.saleActive.call();
      assert.strictEqual(
        saleActive, true, 'should be saleActive');
    });

    it('should set owner to senders address', async () => {
      const owner = await instance.owner.call();
      assert.strictEqual(
        owner, accounts[0]);
    });

    it('should set admin', async () => {
      const admin = await instance.admin.call();
      assert.strictEqual(admin, ADMIN);
    });
  });

  describe('setMigrationagent', () => {
    let agent;

    beforeEach(async () => {
      agent = await MockMigrationAgent.new();
      await instance.unlock();
    });

    it('should throw if sale is active', async () => {
      const instance = await MoedaToken.new(ADMIN);

      try {
        await instance.setMigrationAgent(agent.address, { from: ADMIN });
        assert.fail('should have thrown');
      } catch (error) {
        assertVmException(error);
      }
    });

    it('should throw if sender is not admin', async () => {
      try {
        await instance.setMigrationAgent(agent.address, { from: accounts[3] });
        assert.fail('should have thrown');
      } catch (error) {
        assertVmException(error);
      }
    });

    it('should throw if argument is null address', async () => {
      try {
        await instance.setMigrationAgent(NULL_ADDRESS, { from: ADMIN });
        assert.fail('should have thrown');
      } catch (error) {
        assertVmException(error);
      }
    });

    it('should throw if migrationAgent is already set', async () => {
      await instance.setMigrationAgent(agent.address, { from: ADMIN });

      try {
        await instance.setMigrationAgent(NULL_ADDRESS, { from: ADMIN });
        assert.fail('should have thrown');
      } catch (error) {
        assertVmException(error);
      }
    });

    it('should assign migrationAgent attribute', async () => {
      await instance.setMigrationAgent(agent.address, { from: ADMIN });
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
      await instance.setMigrationAgent(agent.address, { from: ADMIN });
    });

    it('should throw when sale is still active', async () => {
      const instance = await MoedaToken.new(spender);
      const saleActive = await instance.saleActive.call();
      assert.isTrue(saleActive);

      try {
        await instance.migrate(spender, balance);
        assert.fail('should have thrown');
      } catch (error) {
        assertVmException(error);
      }
    });

    it('should throw when beneficiary is null address', async () => {
      try {
        await instance.migrate(NULL_ADDRESS, balance);
        assert.fail('should have thrown');
      } catch (error) {
        assertVmException(error);
      }
    });

    it('should throw when migrationAgent has not been set', async () => {
      try {
        await instance.migrate(spender, balance);
        assert.fail('should have thrown');
      } catch (error) {
        assertVmException(error);
      }
    });

    it('should throw when amount is zero', async () => {
      try {
        await instance.migrate(spender, 0);
        assert.fail('should have thrown');
      } catch (error) {
        assertVmException(error);
      }
    });

    it('should destroy old tokens and call migration agent', async () => {
      const agentAddress = await instance.migrationAgent.call();
      const agent = MockMigrationAgent.at(agentAddress);
      const amountMigrated = balance - 1;

      await instance.migrate(spender, amountMigrated, { from: spender });

      const newBalance = await instance.balanceOf.call(spender);
      const agentBalance = await agent.balanceOf.call(spender);
      const totalSupply = await instance.totalSupply.call();
      const totalMigrated = await instance.totalMigrated.call();

      assert.strictEqual(newBalance.toNumber(), 1);
      assert.strictEqual(agentBalance.toNumber(), amountMigrated);
      assert.strictEqual(totalSupply.toNumber(), 1);
      assert.strictEqual(totalMigrated.toNumber(), amountMigrated);
      const log = await utils.getLatestEvent(instance, 'LogMigration');
      assert.strictEqual(log.recipient, spender);
      assert.strictEqual(log.amount.toNumber(), amountMigrated);
    });
  });

  describe('burn', () => {
    let instance;
    let balance = 12345;

    beforeEach(async () => {
      instance = await MoedaToken.new(ADMIN);
      instance.create(accounts[3], balance);
    });

    it('should throw when amount is zero', async () => {
      utils.shouldThrowVmException(instance.burn.bind(
        instance, 0, { from: accounts[3] }));
    });

    it('should throw when balance is less than amount', async () => {
      utils.shouldThrowVmException(
        instance.burn.bind(instance, balance + 1, { from: accounts[3] }));
    });

    it('should reduce total supply and sender balance', async () => {
      const amountToBurn = 45;
      await instance.burn(amountToBurn, { from: accounts[3] });
      const supply = await instance.totalSupply.call();
      const newBalance = await instance.balanceOf.call(accounts[3]);
      assert.isTrue(supply.eq(balance - amountToBurn));
      assert.isTrue(newBalance.eq(balance - amountToBurn));

      const event = await utils.getLatestEvent(instance, 'LogDestruction');
      assert.isTrue(event.amount.eq(amountToBurn));
    });
  });

  describe('create()', () => {
    it('should throw if newly generated tokens would exceed max supply',
      async () => {
        const maxTokens = await instance.MAX_TOKENS.call();
        try {
          await instance.create(
            accounts[2], maxTokens.plus(1), { from: accounts[0] });
          fail('should have thrown');
        } catch (error) {
          assertVmException(error);
        }
      });

    it('should increase tokenSupply by given amount', async () => {
      const supply = await instance.totalSupply.call();
      await instance.create(
        accounts[1], web3.toWei(500), { from: accounts[0] });
      const newSupply = await instance.totalSupply.call();
      assert.equal(
        newSupply.toString(), supply.plus(web3.toWei(500)).toString());
    });

    it('should increase the balance of given recipient by amount',
      async () => {
        const balance = await instance.balanceOf.call(accounts[2]);
        await instance.create(
          accounts[2], web3.toWei(500), { from: accounts[0] });
        const newBalance = await instance.balanceOf.call(accounts[2]);

        assert.equal(
          newBalance.toString(),
          balance.plus(web3.toWei(500)).toString());
      });

    it('should only allow owner to call', async () => {
      try {
        await instance.create(
          accounts[1], web3.toWei(500), { from: accounts[1] });
        fail('should have thrown');
      } catch (error) {
        assertVmException(error);
      }
    });

    it('should throw an error when sale is not active', async () => {
      const instance = await MoedaToken.new(accounts[0]);
      await instance.unlock();
      const saleActive = await instance.saleActive.call();
      assert.isFalse(saleActive);

      try {
        await instance.create(
          accounts[1], web3.toWei(500), { from: accounts[0] });
        fail('should have thrown');
      } catch (error) {
        assertVmException(error);
      }
    });

    it('should emit a LogCreation event on success', async () => {
      const instance = await MoedaToken.new(accounts[0]);

      try {
        await instance.create(
          accounts[1], web3.toWei(500), { from: accounts[0] });
        const event = await utils.getLatestEvent(
          instance, 'LogCreation');

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
      try {
        await instance.unlock({ from: accounts[1] });
        fail('should have thrown');
      } catch (error) {
        assertVmException(error);
      }

      const saleActive = await instance.saleActive.call();
      assert.strictEqual(saleActive, true);
    });

    it('should set saleActive to false', async () => {
      await instance.unlock({ from: accounts[0] });
      const saleActive = await instance.saleActive.call();
      assert.strictEqual(saleActive, false, 'should be unlocked');
    });
  });

  describe('transfer()', () => {
    beforeEach(async () => {
      await instance.create(accounts[1], web3.toWei(1500));
    });

    it('should throw when sale is active', async () => {
      try {
        const saleActive = await instance.saleActive.call();
        assert.isTrue(saleActive);

        await instance.transfer(
          accounts[2], web3.toWei(10), { from: accounts[1] });
        fail('should have thrown');
      } catch (error) {
        assertVmException(error);
      }
    });

    it('should not throw when transfers are unlocked', async () => {
      try {
        await instance.unlock();
        const saleActive = await instance.saleActive.call();
        assert.isFalse(saleActive);

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

    it('should throw when sale is active', async () => {
      try {
        const saleActive = await instance.saleActive.call();
        assert.isTrue(saleActive);

        await instance.approve(
          accounts[2], web3.toWei(100), { from: accounts[1] });
        const allowance = await instance.allowance.call(
          accounts[1], accounts[2]);
        assert.strictEqual(web3.fromWei(allowance).toNumber(), 100);

        await instance.transferFrom(
          accounts[1], accounts[2], web3.toWei(50),
          { from: accounts[2] });

        fail('should have thrown');
      } catch (error) {
        assertVmException(error);
      }
    });

    it('should not throw when transfers are unlocked', async () => {
      try {
        await instance.unlock();
        const saleActive = await instance.saleActive.call();
        assert.isFalse(saleActive);

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
        const instance = await MoedaToken.new(accounts[0]);
        await instance.create(accounts[1], web3.toWei(15));
        const amount = web3.toWei(4);
        await instance.approve(
          accounts[2], amount, { from: accounts[1] });

        const allowance = await instance.allowance.call(
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
