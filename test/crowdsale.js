const Crowdsale = artifacts.require('Crowdsale');
const MoedaToken = artifacts.require('./MoedaToken');
const Wallet = artifacts.require('MultiSigWalletWithDailyLimit');
const utils = require('./utils');
const fail = utils.fail;
const assertVmException = utils.assertVmException;
const NULL_ADDRESS = '0x0000000000000000000000000000000000000000';
const centsPerEth = 26235;
const assert = utils.assert;

contract('Crowdsale', (accounts) => {
  let TEST_WALLET;
  beforeEach(async () => {
    const instance = await Wallet.new(
      [accounts[0]], 1, web3.toWei(1000000000));
    TEST_WALLET = instance.address;
  });

  describe('reclaimToken', () => {
    let instance;
    let testToken;
    let tokenAmount;

    beforeEach(async () => {
      instance = await Crowdsale.deployed();
      testToken = await MoedaToken.new(accounts[1]);
      tokenAmount = web3.toWei(150);
      await testToken.create(
        instance.address, tokenAmount, { from: accounts[1] });
      await testToken.unlock({ from: accounts[1] });
    });

    it('should transfer given token and log it', async () => {
      const owner = await instance.owner.call();
      await instance.reclaimToken(
        testToken.address, { from: owner });
      const tokenBalance = await testToken.balanceOf.call(instance.address);
      const receiverBalance = await testToken.balanceOf.call(owner);

      assert.strictEqual(tokenBalance.toString(10), '0');
      assert.strictEqual(receiverBalance.toString(10), tokenAmount);
    });

    it('should only allow owner to drain tokens', async () => {
      try {
        const owner = await instance.owner.call();
        assert.notStrictEqual(owner, accounts[3]);
        await instance.reclaimToken(
          testToken.address, { from: accounts[3] });
      } catch (error) {
        assertVmException(error);
      }
    });
  });

  describe('constructor', () => {
    let instance;
    before(async () => {
      instance = await Crowdsale.deployed();
    });

    it('should create a moedaToken instance', async () => {
      const tokenAddress = await instance.moedaToken.call();
      const token = MoedaToken.at(tokenAddress);
      const owner = await token.owner.call();
      const minter = await token.minter.call();

      assert.strictEqual(minter, instance.address);
      assert.strictEqual(owner, accounts[0]);
      assert.notStrictEqual(tokenAddress, NULL_ADDRESS);
    });

    it('should not throw when using new', async () => {
      const currentBlock = web3.eth.blockNumber;
      const startBlock = currentBlock + 10;

      try {
        const instance = await Crowdsale.new(
          accounts[0], startBlock, startBlock + 30, centsPerEth);
      } catch (error) {
        fail('should not have thrown')
      }
    });

    it('should throw when wallet address is null address', async () => {
      const currentBlock = web3.eth.blockNumber;
      const startBlock = currentBlock + 10;

      try {
        const instance = await Crowdsale.new(
          0, startBlock, startBlock + 30, centsPerEth);
        fail('should have thrown');
      } catch (error) {
        assertVmException(error);
      }
    });

    it('should throw when startBlock is in the past', async () => {
      const currentBlock = web3.eth.blockNumber;

      try {
        const instance = await Crowdsale.new(
          accounts[0], currentBlock - 1, currentBlock + 10);
        fail('should have thrown');
      } catch (error) {
        assertVmException(error);
      }
    });

    it('should throw when endBlock is prior or equal to startBlock',
      async () => {
        const currentBlock = web3.eth.blockNumber;
        const startBlock = currentBlock + 5;

        try {
          const instance = await Crowdsale.new(
            accounts[0], startBlock, startBlock - 1, centsPerEth);
          fail('should have thrown');
        } catch (error) {
          assertVmException(error);
        }
      });

    it('should assign wallet address', async () => {
      const wallet = await instance.wallet.call();
      assert.notStrictEqual(wallet, NULL_ADDRESS)
    });

    it('should have a presale wallet address', async () => {
      const presaleWallet = await instance.PRESALE_WALLET.call();
      assert.strictEqual(
        presaleWallet,
        '0x30B3C64d43e7A1E8965D934Fa96a3bFB33Eee0d2'.toLowerCase());
    });

    it('should assign crowdsale finalised boolean', async () => {
      const finalised = await instance.finalised.call();
      assert.strictEqual(finalised, false);
    });

    it('should assign startBlock', async () => {
      const block = await instance.startBlock.call();
      assert.notStrictEqual(block.toNumber(), 0);
    });

    it('should assign endBlock', async () => {
      const block = await instance.endBlock.call();
      assert.notStrictEqual(block.toNumber(), 0);
    });

    it('should assign owner', async () => {
      const owner = await instance.owner.call();
      assert.strictEqual(owner, accounts[0]);
    });
  });

  describe('addIssuer', () => {
    let instance;
    beforeEach(async () => {
      instance = await initUnstartedSale(TEST_WALLET);
    });

    it('should only allow owner to run', async () => {
      await utils.shouldThrowVmException(
        instance.addIssuer.bind(
          instance, TEST_WALLET, 100, { from: accounts[1] }));
    });

    it('should throw if sale has been finalised', async () => {
      await fastForwardToBlock(instance, 'endBlock');
      await instance.finalise();
      await utils.shouldThrowVmException(
        instance.addIssuer.bind(instance, TEST_WALLET, 100));
    });

    it('should throw if address is null address', async () => {
      await utils.shouldThrowVmException(
        instance.addIssuer.bind(instance, NULL_ADDRESS, 100));
    });

    it('should throw if amount is zero', async () => {
      await utils.shouldThrowVmException(
        instance.addIssuer.bind(instance, accounts[1], 0)
      );
    });

    it('should throw if amount would exceed issuer cap', async () => {
      const issuerCap = await instance.ISSUER_CAP.call();
      await utils.shouldThrowVmException(
        instance.addIssuer.bind(instance, accounts[1], issuerCap.plus(1))
      );
    });

    it('should add issuer address', async () => {
      const allocation = 100;
      await instance.addIssuer(TEST_WALLET, allocation);
      assert.equals(await instance.allocations.call(TEST_WALLET), 100);
      const event = await utils.getLatestEvent(instance, 'LogIssuerAdded');

      assert.strictEqual(event.issuer, TEST_WALLET);
      assert.equals(event.amount, allocation);
    });
  });

  describe('updateRate', () => {
    it('should only allow owner to call', async () => {
      const instance = await Crowdsale.deployed();
      await utils.shouldThrowVmException(
        instance.updateRate.bind(instance, 123, { from: accounts[1] }));
    });

    it('should throw if rate is zero', async () => {
      const instance = await Crowdsale.deployed();
      await utils.shouldThrowVmException(
        instance.updateRate.bind(instance, 0));
    });

    it('should throw if rate of change is greater than 50%', async () => {
      const instance = await initUnstartedSale(TEST_WALLET);

      // >50% increase
      await utils.shouldThrowVmException(
        instance.updateRate.bind(instance, (centsPerEth * 150) / 100 + 1));
      // >50% decrease
      await utils.shouldThrowVmException(
        instance.updateRate.bind(instance, (centsPerEth * 50) / 100 - 1));

      const rate = await instance.tokensPerEth.call();
      assert.isTrue(rate.eq(web3.toWei(centsPerEth / 100)));
    });

    it('should update rates and log change', async () => {
      const instance = await initUnstartedSale(TEST_WALLET);
      await instance.updateRate(centsPerEth - 10);
      const tokenRate = await instance.tokensPerEth.call();
      assert.strictEqual(tokenRate.toString(10), '262250000000000000000');

      const event = await utils.getLatestEvent(instance, 'LogRateUpdate');
      assert.strictEqual(event.centsPerEth.toString(10), '26225');
      assert.strictEqual(
        event.tokensPerEth.toString(10), '262250000000000000000');
    });
  });

  describe('getAvailable()', () => {
    let instance;
    beforeEach(async () => instance = await Crowdsale.deployed());

    it('should return given amount if it is within cap', async () => {
      const decimals = await instance.TOKEN_MULTIPLIER.call();
      const tokensPerEth = await instance.tokensPerEth.call();
      const publicCap = await instance.PUBLIC_CAP.call();
      const amount = web3.toBigNumber(web3.toWei(1500));
      const expectedTokens = amount.mul(tokensPerEth).div(decimals).floor();
      const [tokens, available] = await instance.getAvailable.call(amount);
      assert.equals(available, amount);
      assert.equals(tokens, expectedTokens);
    });

    it('should return reduced amounts if given ETH amount would exceed cap',
    async () => {
      const decimals = await instance.TOKEN_MULTIPLIER.call();
      const tokensPerEth = await instance.tokensPerEth.call();
      const publicCap = await instance.PUBLIC_CAP.call();
      const amount = web3.toBigNumber(publicCap)
        .mul(decimals).div(tokensPerEth).floor().plus(web3.toWei(100));
      const expectedAmount = web3.toBigNumber(publicCap)
        .mul(decimals).div(tokensPerEth).floor();
      const [tokens, available] = await instance.getAvailable.call(amount);
      assert.equals(available, expectedAmount);
      assert.equals(tokens, publicCap);
    });
  });

  describe('publicIssued()', () => {
    it('should return total issued tokens minus issuer created tokens',
      async () => {
        const instance = await initUnstartedSale(TEST_WALLET);
        await instance.addIssuer(accounts[0], 1000);
        await instance.addIssuer(accounts[1], 1000);
        await fastForwardToBlock(instance, 'startBlock');
        await instance.issue(accounts[2], 123);
        await instance.issue(accounts[2], 456);
        await instance.donate(
          accounts[3], { value: web3.toWei(15), from: accounts[3] });
        const issued = await instance.publicIssued.call();
        const tokensIssued = await instance.totalTokensIssued.call();
        const totalSold = await instance.totalTokensSold.call();
        assert.strictEqual(
          issued.toString(10), totalSold.minus(tokensIssued).toString(10));
      });
  });

  describe('issue()', () => {
    it('should throw if amount is zero', async () => {
      const instance = await initStartedSale(TEST_WALLET);
      await instance.addIssuer(accounts[2], 100);
      utils.shouldThrowVmException(
        instance.issue.bind(instance, accounts[1], 0, { from: accounts[2] }));
    });

    it('should throw if requested token amount would exceed issuer cap',
    async () => {
      const instance = await initStartedSale(TEST_WALLET);
      const issuerCap = await instance.ISSUER_CAP.call();
      await instance.addIssuer(accounts[2], issuerCap);
      utils.shouldThrowVmException(
        instance.issue.bind(
          instance, accounts[1], issuerCap.plus(1), { from: accounts[2] }));
    });

    it('should throw if sale has been paused', async () => {
      const instance = await initStartedSale(TEST_WALLET);
      instance.addIssuer(accounts[0], 123);
      await instance.pause();
      return utils.shouldThrowVmException(
        instance.issue.bind(instance, accounts[2], 123));
    });

    it('should throw if sale has been finalised', async () => {
      const instance = await initEndedSale(TEST_WALLET);
      instance.addIssuer(accounts[0], 123);
      await instance.finalise();
      return utils.shouldThrowVmException(
        instance.issue.bind(instance, accounts[2], 123));
    });

    it('should throw if sender isnt issuer', async () => {
      const instance = await initStartedSale(TEST_WALLET);
      return utils.shouldThrowVmException(
        instance.issue.bind(instance, accounts[2], 123));
    });

    it('should create tokens and update totals', async () => {
      const instance = await initStartedSale(TEST_WALLET);
      const issuerCap = await instance.ISSUER_CAP.call();
    });
  });

  describe('donate()', () => {
    it('should throw if sender is team wallet', async () => {
      const instance = await initStartedSale(accounts[3]);
      utils.shouldThrowVmException(
        instance.donate.bind(
          instance, accounts[1], { from: accounts[3], value: web3.toWei(3)})
      );
    });

    it('should throw if sale has ended', async () => {
      const instance = await initEndedSale(TEST_WALLET);
      utils.shouldThrowVmException(
        instance.donate.bind(instance,
          accounts[1], { from: accounts[2], value: web3.toWei(5) }));
    });

    it('should throw if sale has not started yet', async () => {
      const instance = await initUnstartedSale(TEST_WALLET);
      utils.shouldThrowVmException(
        instance.donate.bind(instance,
          accounts[1], { from: accounts[2], value: web3.toWei(5) }));
    });

    it('should throw when sale is paused', async () => {
      const instance = await initStartedSale(TEST_WALLET);
      await instance.pause();
      utils.shouldThrowVmException(
        instance.donate.bind(instance,
          accounts[1], { from: accounts[2], value: web3.toWei(5) }));
    });

    it('should throw if sender is an issuer', async () => {
      const instance = await initStartedSale(TEST_WALLET);
      await instance.addIssuer(accounts[2], web3.toWei(5));
      utils.shouldThrowVmException(
        instance.donate.bind(instance,
          accounts[1], { from: accounts[2], value: web3.toWei(5) }));
    });

    it('should throw if donation is less than dust limit', async () => {
      const instance = await initStartedSale(TEST_WALLET);
      const dustLimit = await instance.DUST_LIMIT.call();
      await instance.addIssuer(accounts[2], web3.toWei(100));
      utils.shouldThrowVmException(
        instance.donate.bind(instance,
          accounts[1], { from: accounts[2], value: dustLimit.minus(1) }));
    });

    it('should refund remaining amount if we cannot honur full amount',
      async () => {
        const instance = await initStartedSale(TEST_WALLET);
        const rate = await instance.tokensPerEth.call();
        const publicCap = await instance.PUBLIC_CAP.call();
        const almostAllTokens = publicCap.minus(263);
        const multiplier = await instance.TOKEN_MULTIPLIER.call();
        const ethAmount = almostAllTokens.mul(multiplier).div(rate).floor();
        await instance.donate(accounts[2], { value: ethAmount });

        const token = MoedaToken.at(await instance.moedaToken.call());
        const ethBalanceBefore = web3.eth.getBalance(accounts[1]);
        await instance.donate(
          accounts[3], { from: accounts[1], value: web3.toWei(50) });

        const totalSupply = await token.totalSupply.call();
        const tokenBalance = await token.balanceOf.call(accounts[3]);
        const ethBalanceAfter = web3.eth.getBalance(accounts[1]);
        const expectedSpent = web3.toBigNumber(525)
          .mul(multiplier).div(rate).floor();
        const depositEvent = await utils.getLatestEvent(
          Wallet.at(TEST_WALLET), 'Deposit');

        assert.equals(totalSupply, publicCap);
        assert.equals(tokenBalance, '525');
        assert.equals(depositEvent.value, expectedSpent);
      });

    it('should update total, create tokens, send funds to wallet', async () => {
      const instance = await initStartedSale(TEST_WALLET);
      const amount = web3.toWei(150);
      const tokensPerEth = await instance.tokensPerEth.call();
      const multiplier = await instance.TOKEN_MULTIPLIER.call();
      const token = MoedaToken.at(await instance.moedaToken.call());
      const walletBalanceBefore = web3.eth.getBalance(TEST_WALLET);

      await instance.donate(accounts[2], { value: amount });

      const balance = await token.balanceOf(accounts[2]);
      const expectedBalance = tokensPerEth.mul(amount).div(multiplier).floor();
      const walletBalanceAfter = web3.eth.getBalance(TEST_WALLET);
      assert.equals(balance, '39352500000000000000000');
      assert.equals(
        walletBalanceAfter.minus(walletBalanceBefore), amount);
    });
  });

  describe('when we recieve ether', () => {
    it('should not throw when sale is active', async () => {
      const instance = await initStartedSale(TEST_WALLET);
      await instance.sendTransaction({
        from: accounts[2], value: web3.toWei(123) });
    });
  });

  describe('isSoldOut()', () => {
    let instance;
    beforeEach(async () => {
      instance = await initStartedSale(TEST_WALLET);
    });

    it('should return true if both ISSUER and PUBLIC caps have been reached',
    async () => {
      const publicCap = await instance.PUBLIC_CAP.call();
      const issuerCap = await instance.ISSUER_CAP.call();
      const tokensPerEth = await instance.tokensPerEth.call();
      const amount = publicCap.mul(10**18)
        .div(tokensPerEth).plus(web3.toWei(1)).floor();
      await instance.addIssuer(accounts[1], issuerCap);
      await instance.issue(accounts[1], issuerCap, { from: accounts[1] });
      await instance.donate(accounts[2], { value: amount });

      const result = await instance.isSoldOut.call();
      assert.isTrue(result);
    });

    it('should return false if only issuer cap has been reached', async () => {
      const issuerCap = await instance.ISSUER_CAP.call();
      await instance.addIssuer(accounts[1], issuerCap);
      await instance.issue(accounts[1], issuerCap, { from: accounts[1] });

      const result = await instance.isSoldOut.call();
      assert.isFalse(result);
    });

    it('should return false if only public cap has been reached', async () => {
      const publicCap = await instance.PUBLIC_CAP.call();
      const tokensPerEth = await instance.tokensPerEth.call();
      const amount = publicCap.mul(10**18)
        .div(tokensPerEth).plus(web3.toWei(1)).floor();
      await instance.donate(accounts[2], { value: amount });

      const result = await instance.isSoldOut.call();
      assert.isFalse(result);
    });
  });

  describe('finalise()', () => {
    it('should throw when sale has not started',
      async () => {
        const instance = await initUnstartedSale(TEST_WALLET);
        return utils.shouldThrowVmException(
          instance.finalise.bind(instance, { from: accounts[0] }));
      });

    it('should throw when sale is still running and cap has not been reached',
      async () => {
        const instance = await initUnstartedSale(TEST_WALLET);
        return utils.shouldThrowVmException(
          instance.finalise.bind(instance, { from: accounts[0] }));
      });

    it('should throw if sale has already been finalised', async () => {
      const instance = await initEndedSale(TEST_WALLET);
      await instance.finalise();
      return utils.shouldThrowVmException(
        instance.finalise.bind(instance, { from: accounts[0] }));
    });

    it('should throw if sale has been paused', async () => {
      const instance = await initStartedSale(TEST_WALLET);
      await instance.pause();
      await fastForwardToBlock(instance, 'endBlock');
      return utils.shouldThrowVmException(instance.finalise.bind(instance));
    });

    it('should finalise sale prematurely if all tokens have been sold',
    async () => {
      const instance = await initStartedSale(TEST_WALLET);
      const publicCap = await instance.PUBLIC_CAP.call();
      const issuerCap = await instance.ISSUER_CAP.call();
      const tokensPerEth = await instance.tokensPerEth.call();
      const endBlock = await instance.endBlock.call();
      const amount = publicCap.mul(10**18)
        .div(tokensPerEth).plus(web3.toWei(1)).floor();
      await instance.addIssuer(accounts[1], issuerCap);
      await instance.issue(accounts[1], issuerCap, { from: accounts[1] });
      await instance.donate(accounts[2], { value: amount });
      await instance.finalise();

      const finalised = await instance.finalised.call();
      assert.isBelow(web3.eth.blockNumber, endBlock);
      assert.isTrue(finalised);
    });

    it('should assign presale tokens to presale wallet', async () => {
      const instance = await initEndedSale(TEST_WALLET);
      await instance.finalise({ from: accounts[0] });

      const tokenAddress = await instance.moedaToken.call();
      const token = MoedaToken.at(tokenAddress);
      const presaleTokens = await instance.PRESALE_TOKEN_ALLOCATION.call();
      const presaleWallet = await instance.PRESALE_WALLET.call();
      const presaleWalletBalance = await token.balanceOf.call(presaleWallet);

      assert.equals(presaleWalletBalance, web3.toWei(5000000));

      const TOKEN_MAX = await token.MAX_TOKENS.call();
      const totalSupply = await token.totalSupply.call();

      assert.equals(totalSupply, web3.toWei(5000000));
    });

    it('should set crowd sale to closed and unlock tokens if cap reached',
      async () => {
        const instance = await initEndedSale(TEST_WALLET);
        await instance.finalise({ from: accounts[0] });

        const finalised = await instance.finalised.call();
        assert.isTrue(finalised);

        const tokenAddress = await instance.moedaToken.call();
        const token = MoedaToken.at(tokenAddress);
        const saleActive = await token.saleActive.call();
        assert.isFalse(saleActive);
      });
  });
});

async function fastForwardToBlock(instance, blockAttributeName) {
  // The starting block is dynamic because we run tests in testrpc
  const blockNumber = await instance[blockAttributeName].call();

  await utils.mineUntilBlock(web3, blockNumber);
}

async function initUnstartedSale(walletAddress, _centsPerEth = centsPerEth) {
  const blockNumber = web3.eth.blockNumber;
  const startBlock = blockNumber + 3;
  const instance = await Crowdsale.new(
    walletAddress, startBlock, startBlock + 8, _centsPerEth);
  assert.isBelow(blockNumber, startBlock, 'sale should not have been started');

  return instance;
}

async function initStartedSale(walletAddress) {
  const blockNumber = web3.eth.blockNumber;
  const startBlock = blockNumber + 2;
  const endBlock = blockNumber + 10;
  const instance = await Crowdsale.new(
    walletAddress, startBlock, endBlock, centsPerEth);
  await utils.mineUntilBlock(web3, startBlock);
  const currentBlock = web3.eth.blockNumber;
  assert.isAtLeast(
    currentBlock, startBlock, 'sale should have been started');
  assert.isBelow(
    currentBlock, endBlock, 'sale should not have ended yet');
  return instance;
}

async function initEndedSale(walletAddress) {
  const instance = await initUnstartedSale(walletAddress);
  const endBlock = await instance.endBlock.call();
  await fastForwardToBlock(instance, 'endBlock');
  const currentBlock = web3.eth.blockNumber;
  assert.isAtLeast(currentBlock, endBlock, 'sale should have ended');
  return instance;
}

module.exports = {
  initStartedSale,
};
