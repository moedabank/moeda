const Crowdsale = artifacts.require('./Crowdsale');
const MoedaToken = artifacts.require('./MoedaToken');

const NULL_ADDRESS = '0x0000000000000000000000000000000000000000';

contract('Crowdsale', (accounts) => {
    describe('constructor', () => {
        let instance;        
        before(async () => {
            instance = await Crowdsale.deployed();
        });

        it('should create a moedaToken instance', async () => {
            const token = await instance.moedaToken.call();
            assert.notStrictEqual(token, NULL_ADDRESS);
        });

        it('should throw when wallet address is 0');
        it('should throw when startBlock is in the past');
        it('should throw when endBlock is prior or equal to startBlock');

        it('should assign wallet address', async () => {
            const wallet = await instance.wallet.call();

            assert.notStrictEqual(wallet, NULL_ADDRESS)
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

    describe('getLimitAndRate()', () => {
        let instance;        
        before(async () => {
            instance = await Crowdsale.deployed();
        });

        it('should return tier1 limit and tier0 rate for 0 <= total < ' + 
            'TIER0_CAP',
        async () => {
            const value = await instance.getLimitAndRate.call(0);
            const limit = web3.fromWei(value[0]).toString(10);
            const rate = web3.fromWei(value[1]).toString(10);

            assert.strictEqual(limit, '10000');
            assert.strictEqual(rate, '0.002');
        });

        it('should return tier2 limit and tier1 rate for TIER0_CAP <= total' +
            ' < TIER1_CAP',
        async () => {
            const TIER0_CAP = await instance.TIER0_CAP.call();
            const value = await instance.getLimitAndRate.call(TIER0_CAP);
            const limit = web3.fromWei(value[0]).toString(10);
            const rate = web3.fromWei(value[1]).toString(10);

            assert.strictEqual(limit, '30000');
            assert.strictEqual(rate, '0.006');
        });

        it('should return tier3 limit and tier2 rate for TIER1_CAP <= total' +
            ' < TIER2_CAP',
        async () => {
            const TIER1_CAP = await instance.TIER1_CAP.call();
            const value = await instance.getLimitAndRate.call(TIER1_CAP);
            const limit = web3.fromWei(value[0]).toString(10);
            const rate = web3.fromWei(value[1]).toString(10);

            assert.strictEqual(limit, '40000');
            assert.strictEqual(rate, '0.008');
        });

        it('should return ether cap limit and tier3 rate for TIER2_CAP <= ' +
            'total < ETHER_CAP',
        async () => {
            const TIER2_CAP = await instance.TIER2_CAP.call();
            const value = await instance.getLimitAndRate.call(TIER2_CAP);
            const limit = web3.fromWei(value[0]).toString(10);
            const rate = web3.fromWei(value[1]).toString(10);

            assert.strictEqual(limit, '50000');
            assert.strictEqual(rate, '0.01');
        });

        it('should throw if total is equal to cap', async () => {
            const ethercap = await instance.ETHER_CAP.call();

            try {
                await instance.getLimitAndRate.call(ethercap);
                fail('should have thrown');
            } catch (error) {
                assert.include(error.message, 'invalid JUMP');
            }
        });
    });

    describe('getTokenAmount()', () => {
        let instance;        
        beforeEach(async () => {
            instance = await Crowdsale.deployed();
        });

        it('should return zero when requestedAmount is zero', async () => {
            const amount = await instance.getTokenAmount.call(0, 0);
            assert.strictEqual(amount.valueOf(), '0');
        });

        it('should not spend more than is available at current price', () => {
        });

        it('should throw if limit is less than total received', () => {

        });

        it('should use 2 different rates when overlapping 2 tiers', () => {

        });

        it('should use 3 different rates when overlapping 3 tiers', () => {

        });

        it('should use 4 different rates when overlapping 4 tiers', () => {

        });
    });

    describe('buy()', () => {
        describe('before sale', () => {
            it('should throw and prevent buying', async () => {
                const instance = await Crowdsale.deployed();
                try {
                    const value = await instance.buy.call();
                    fail('should have thrown')
                } catch (error) {
                    assert.include(error.message, 'invalid JUMP');
                }
            });
        });

        describe('during sale', () => {
            it('should throw if amount is less than minimum');
            it('should throw if donation would exceed crowdsale cap');
            it('should throw if multisig deposit is unsuccessful');
            it('should throw if token creation fails');
            it('should call getTokenAmount');
            it('should call create on token contract with calculated amount');
            it('should update total tokens sold amount on success');
            it('should update ether recieved amount on success');
        });

        it('should throw after sale has ended');

        it('should throw with limit reached');
    });

    describe('default method', () => {
        it('should throw', () => {
        });
    })
});
