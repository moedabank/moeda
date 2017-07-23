const Bonus = artifacts.require('Bonus');
const Crowdsale = artifacts.require('Crowdsale');
const MockCrowdsale = artifacts.require('MockCrowdsale');
const initStartedSale = require('./crowdsale').initStartedSale;
const utils = require('./utils');
const assert = utils.assert;

contract('Bonus', (accounts) => {
  describe('initDonors', () => {
    it('should add donors and set bonus rate', async () => {
      const crowdsale = await MockCrowdsale.new();
      const instance = await Bonus.new();
      const lenBefore = await instance.donorCount.call();
      await instance.setCrowdsaleAddress(crowdsale.address);
      assert.equals(lenBefore, 0);

      await instance.initDonors();

      const lenAfter = await instance.donorCount.call();
      const bonusRate = await instance.bonusRate.call();
      assert.isAbove(bonusRate, 0);
      assert.isAbove(lenAfter, lenBefore);
    });

    it('should throw if already initialised', async () => {
      const instance = await Bonus.new();
      const crowdsale = await MockCrowdsale.new();
      await instance.setCrowdsaleAddress(crowdsale.address);
      await instance.initDonors();
      return utils.shouldThrowVmException(instance.initDonors.bind(instance));
    });

    it('should throw if caller isnt owner', async () => {
      const instance = await Bonus.new();
      const crowdsale = await MockCrowdsale.new();
      await instance.setCrowdsaleAddress(crowdsale.address);
      await utils.shouldThrowVmException(
        instance.initDonors.bind(instance, { from: accounts[2] }));
    });

    it('should throw if crowdsale isnt set', async () => {
      const instance = await Bonus.new();
      await utils.shouldThrowVmException(
        instance.initDonors.bind(instance, { from: accounts[2] }));
    });
  });

  describe('donorCount', () => {
    it('should return zero before initialisation', async () => {
      const instance = await Bonus.new();
      const count = await instance.donorCount.call();
      assert.equals(count, 0);
    });

    it('should return number of donors after init', async () => {
      const instance = await Bonus.new();
      const crowdsale = await MockCrowdsale.new();
      await instance.setCrowdsaleAddress(crowdsale.address);
      await instance.initDonors();
      const count = await instance.donorCount.call();
      assert.isAbove(count, 0);
    });
  });

  describe('setCrowdsaleAddress', () => {
    it('should throw if address is blank', async () => {
      const instance = await Bonus.new();
      return utils.shouldThrowVmException(
        instance.setCrowdsaleAddress.bind(instance, 0));
    });

    it('should throw is issuance has already been done', async () => {
      const sale = await initStartedSale(accounts[1]);
      const instance = await Bonus.new();
      await instance.setCrowdsaleAddress(sale.address);
      await instance.initDonors();
      await sale.addIssuer(instance.address, web3.toWei(100000));
      await instance.createBonusTokens();

      return utils.shouldThrowVmException(
        instance.setCrowdsaleAddress.bind(instance, 0));
    });

    it('should throw if caller is not owner', async () => {
      const instance = await Bonus.new();
      return utils.shouldThrowVmException(
        instance.setCrowdsaleAddress.bind(
          instance, accounts[1], { from: accounts[2] }));
    });

    it('should change address of crowdsale', async () => {
      const instance = await Bonus.new();
      await instance.setCrowdsaleAddress(accounts[1]);
      const address = await instance.crowdsale.call();
      assert.equals(address, accounts[1]);
    });
  });

  describe('numTokensToCreate', () => {
    it('should return num tokens that will be issued', async () => {
      const instance = await Bonus.new();
      const sale = await MockCrowdsale.new();
      await instance.setCrowdsaleAddress(sale.address);
      await instance.initDonors();
      const tokens = await instance.numTokensToCreate();

      assert.isAbove(tokens, 0);
    });
  });

  describe('createBonusTokens', async () => {
    let sale;
    before(async () => {
      sale = await initStartedSale(accounts[1]);
    });

    it('should throw before donor init', async () => {
      const instance = await Bonus.new();
      await instance.setCrowdsaleAddress(sale.address);
      await sale.addIssuer(instance.address, 123);
      return utils.shouldThrowVmException(
        instance.createBonusTokens.bind(instance));
    });

    it('should throw if issuance was already done', async () => {
      const instance = await Bonus.new();
      await sale.addIssuer(instance.address, web3.toWei(100000));
      await instance.setCrowdsaleAddress(sale.address);
      await instance.initDonors();
      await instance.createBonusTokens();
      return utils.shouldThrowVmException(
        instance.createBonusTokens.bind(instance));
    });

    it('should issue tokens for all donors and emit events', async () => {
      const instance = await Bonus.new();
      await instance.setCrowdsaleAddress(sale.address);
      await sale.addIssuer(instance.address, web3.toWei(100000));
      await instance.initDonors();
      await instance.createBonusTokens();
      const count = await instance.donorCount.call();
      const events = await utils.getAllEvents(instance, 'LogBonusIssued');
      assert.equals(events.length, count);

      for(let i = 0; i < count; i++) {
        const donation = await instance.donors.call(i);
        donation.donor
      }
    });
  });
});
