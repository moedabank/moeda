const MoedaToken = artifacts.require('./MoedaToken');
const utils = require('./utils');
const fail = utils.fail;
const assertVmException = utils.assertVmException;

contract('MoedaToken', (accounts) => {
    describe('constructor', () => {
        let instance;
        before(async () => instance = await MoedaToken.deployed());

        it('should set locked to true', async () => {
            const locked = await instance.locked.call();
            assert.strictEqual(
                locked, true, 'should be locked');
        });

        it('should set owner to senders address', async () => {
            const owner = await instance.owner.call();
            assert.strictEqual(
                owner, accounts[0]);
        });
    });

    describe('create', () => {
        it('should throw if newly generated tokens would exceed max supply');
        it('should increase tokenSupply by given amount');
        it('should increase the balance of given recipient by amount');
        it('should return true when successful');
        it('should only allow owner to call');
        it('should only be callable during crowdsale');
    });

    describe('transfer', () => {
        it('should throw if crowdsale is active', async () => {
            
        });
        it('should not throw once crowdsale is over');
        it('should call transfer in super class');
    });

    describe('transferFrom', () => {
        it('should throw if crowdsale is active');
        it('should not throw once crowdsale is over');
        it('should call transferFrom in super class');
    });
});

contract('Moedatoken, sale is over', (accounts) => {
    
});

// these need to happen on fresh contracts, and truffle makes it kind of awkward
// to reset contract state between tests (need to use the contract function like
// below)
contract('Moedatoken unlock', (accounts) => {
    it('should set locked to false', async () => {
        const instance = await MoedaToken.deployed();
        await instance.unlock({ from: accounts[0] });
        const locked = await instance.locked.call();
        assert.strictEqual(locked, false, 'should be unlocked');
    });
});

contract('Moedatoken unlock', (accounts) => {
    it('should only allow owner to invoke', async () => {
        const instance = await MoedaToken.deployed();

        try {
            await instance.unlock({ from: accounts[1] });
            fail('should have thrown');
        } catch (error) {
            assert.include(error.message, 'invalid JUMP');
        }

        const locked = await instance.locked.call();
        assert.strictEqual(locked, true);
    });
});