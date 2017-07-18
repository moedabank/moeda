const Bonus = artifacts.require('Bonus');
const Crowdsale = artifacts.require('Crowdsale');
const initStartedSale = require('./crowdsale').initStartedSale;
const utils = require('./utils');
const assert = utils.assert;

contract('Bonus', (accounts) => {
  describe('initDonors', () => {
    it('should add donors', async () => {
      const instance = await Bonus.new();
      const lenBefore = await instance.donorCount.call();
      assert.equals(lenBefore, 0);

      await instance.initDonors();

      const lenAfter = await instance.donorCount.call();

      assert.isAbove(lenAfter, lenBefore);
    });

    it('should throw if already initialised', async () => {
      const instance = await Bonus.new();
      await instance.initDonors();
      return utils.shouldThrowVmException(instance.initDonors.bind(instance));
    });

    it('should throw if caller isnt owner', async () => {
      const instance = await Bonus.new();
      await utils.shouldThrowVmException(
        instance.initDonors.bind(instance, { from: accounts[2] }));
    });
  });

  describe('donorCount', () => {
    it('should return zero before initialisation', async () => {
      const instance = await Bonus.new(accounts[0]);
      const count = await instance.donorCount.call();
      assert.equals(count, 0);
    });

    it('should return number of donors after init', async () => {
      const instance = await Bonus.new(accounts[0]);
      await instance.initDonors();
      const count = await instance.donorCount.call();
      assert.isAbove(count, 0);
    });
  });

  describe('setCrowdsaleAddress', () => {
    it('should throw if address is blank', async () => {
      const instance = await Bonus.new(accounts[0]);
      return utils.shouldThrowVmException(
        instance.setCrowdsaleAddress.bind(instance, 0));
    });

    it('should throw is issuance has already been done', async () => {
      const sale = await initStartedSale(accounts[0]);
      const instance = await Bonus.new(sale.address);
      await instance.initDonors();
      await instance.setCrowdsaleAddress(sale.address);
      await sale.addIssuer(instance.address);
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

  describe('createBonusTokens', async () => {
    let sale;
    before(async () => {
      sale = await initStartedSale(accounts[1]);
    });

    it('should throw before donor init', async () => {
      const instance = await Bonus.new();
      await instance.setCrowdsaleAddress(sale.address);
      await sale.addIssuer(instance.address);
      return utils.shouldThrowVmException(
        instance.createBonusTokens.bind(instance));
    });

    it('should throw if issuance was already done', async () => {
      const instance = await Bonus.new();
      await sale.addIssuer(instance.address);
      await instance.setCrowdsaleAddress(sale.address);
      await instance.initDonors();
      await instance.createBonusTokens();
      return utils.shouldThrowVmException(
        instance.createBonusTokens.bind(instance));
    });

    it('should issue tokens for all donors and emit events', async () => {
      const instance = await Bonus.new();
      await instance.setCrowdsaleAddress(sale.address);
      await sale.addIssuer(instance.address);
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
