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

            assert.strictEqual(limit, '40000');
            assert.strictEqual(rate, '0.006');
        });

        it('should return tier3 limit and tier2 rate for TIER1_CAP <= total' +
            ' < TIER2_CAP',
        async () => {
            const TIER1_CAP = await instance.TIER1_CAP.call();
            const value = await instance.getLimitAndRate.call(TIER1_CAP);
            const limit = web3.fromWei(value[0]).toString(10);
            const rate = web3.fromWei(value[1]).toString(10);

            assert.strictEqual(limit, '80000');
            assert.strictEqual(rate, '0.008');
        });

        it('should return ether cap limit and tier3 rate for TIER2_CAP <= ' +
            'total < ETHER_CAP',
        async () => {
            const TIER2_CAP = await instance.TIER2_CAP.call();
            const value = await instance.getLimitAndRate.call(TIER2_CAP);
            const limit = web3.fromWei(value[0]).toString(10);
            const rate = web3.fromWei(value[1]).toString(10);

            assert.strictEqual(limit, '130000');
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

        it('should use only tier 0 rate when in tier 0, with no overlap',
        async () => {
            const amount = await instance.getTokenAmount.call(0, web3.toWei(15));
            const tier0_rate = await instance.TIER0_RATE.call();
            const expectedAmount = web3.toWei(web3.toBigNumber(
                web3.toWei(15)).div(tier0_rate).round(18, 1));

            assert.strictEqual(amount.toString(10), expectedAmount.toString(10));
        });

        it('should use only tier 1 rate when in tier 1, with no overlap',
        async () => {
            const tier0_cap = await instance.TIER0_CAP.call();
            const amount = await instance.getTokenAmount.call(
                tier0_cap, web3.toWei(15));
            const tier1_rate = await instance.TIER1_RATE.call();
            const expectedAmount = web3.toWei(web3.toBigNumber(
                web3.toWei(15)).div(tier1_rate).round(18, 1));

            assert.strictEqual(amount.toString(10), expectedAmount.toString(10));
        });

        it('should use 2 different rates when overlapping 2 tiers',
        async () => {
            // 100 ether received previously, try to spend 10000 ether
            const amount = await instance.getTokenAmount.call(
                web3.toWei(100), web3.toWei(10000));
            const tier0_rate = await instance.TIER0_RATE.call();
            const tier1_rate = await instance.TIER1_RATE.call();

            // we should get 9900 eth worth of tokens at the tier 0
            // rate and an additional 100 eth worth at the tier 1 rate
            const amountAtTier0 = web3.toBigNumber(
                web3.toWei(9900)).div(tier0_rate);
            const amountAtTier1 = web3.toBigNumber(
                web3.toWei(100)).div(tier1_rate);
            const expectedAmount = web3.toWei(
                amountAtTier0.plus(amountAtTier1).round(18, 1));

            assert.strictEqual(
                expectedAmount.toString(10), amount.toString(10));
        });

        it('should use 3 different rates when overlapping 3 tiers',
        async () => {
            // 100 ether received previously, try to spend 39800 ether
            // this should overlap tier 0, 1 and 2
            const amount = await instance.getTokenAmount.call(
                web3.toWei(100), web3.toWei(49800));
            const tier0_rate = await instance.TIER0_RATE.call();
            const tier1_rate = await instance.TIER1_RATE.call();
            const tier2_rate = await instance.TIER2_RATE.call();

            // we should get 
            //  9900 eth worth of tokens at the tier 0 rate
            // 30000 eth worth of tokens at the tier 1 rate
            //  9900 eth worth of tokens at the tier 2 rate
            const amountAtTier0 = web3.toBigNumber(
                web3.toWei(9900)).div(tier0_rate);
            const amountAtTier1 = web3.toBigNumber(
                web3.toWei(30000)).div(tier1_rate);
            const amountAtTier2 = web3.toBigNumber(
                web3.toWei(9900)).div(tier2_rate);
            const expectedAmount = web3.toWei(
                amountAtTier0.plus(amountAtTier1)
                    .plus(amountAtTier2).round(18, 1));

            assert.strictEqual(
                expectedAmount.toString(10), amount.toString(10));
        });

        it('should use 4 different rates when overlapping 4 tiers',
        async () => {
            // 0 ether received previously, try to spend 44800 ether
            // this should overlap tier 0, 1, 2 and 3
            const amount = await instance.getTokenAmount.call(
                0, web3.toWei(84800));
            const tier0_rate = await instance.TIER0_RATE.call();
            const tier1_rate = await instance.TIER1_RATE.call();
            const tier2_rate = await instance.TIER2_RATE.call();
            const tier3_rate = await instance.TIER3_RATE.call();

            // we should get 
            // 10000 eth worth of tokens at the tier 0 rate
            // 30000 eth worth of tokens at the tier 1 rate
            // 40000 eth worth of tokens at the tier 2 rate
            //  4800 eth worth of tokens at the tier 3 rate
            const amountAtTier0 = web3.toBigNumber(
                web3.toWei(10000)).div(tier0_rate);
            const amountAtTier1 = web3.toBigNumber(
                web3.toWei(30000)).div(tier1_rate);
            const amountAtTier2 = web3.toBigNumber(
                web3.toWei(40000)).div(tier2_rate);
            const amountAtTier3 = web3.toBigNumber(
                web3.toWei(4800)).div(tier3_rate);
            const expectedAmount = web3.toWei(
                amountAtTier0.plus(amountAtTier1)
                    .plus(amountAtTier2)
                    .plus(amountAtTier3).round(18, 1));

            assert.strictEqual(
                expectedAmount.toString(10), amount.toString(10));
        });

        it('should not throw if total requested is close to but below limit',
        async () => {
            try {
                const donation = web3.toBigNumber('4999999999999999999999');
                const amount = await instance.getTokenAmount.call(
                    web3.toWei(125000), donation);
                const tier3_rate = await instance.TIER3_RATE.call();

                // should get 49999.99999999999999999 worth at the tier 3 rate
                const expectedAmount = web3.toWei(
                    donation.div(tier3_rate).round(18, 1));
                assert.strictEqual(
                    amount.toString(10),
                    expectedAmount.toString(10));
            } catch (error) {
                fail(error.message);
            }
        });

        it('should not throw if total requested would take received to cap', 
        async () => {
            try {
                const amount = await instance.getTokenAmount.call(
                    web3.toWei(125000),
                    web3.toWei(5000));
                const tier3_rate = await instance.TIER3_RATE.call();

                // should get 5000 worth at the tier 3 rate
                const expectedAmount = web3.toWei(web3.toBigNumber(
                web3.toWei(5000)).div(tier3_rate).round(18, 1));
                assert.strictEqual(amount.toString(), expectedAmount.toString());
            } catch (error) {
                fail('should not have thrown');
            }
        });

        it('should throw if total requested would exceed cap', async () => {
            // we're in tier 3, 45000 ether invested so far
            // try to buy so much that we exceed the total cap
            try {
                const amount = await instance.getTokenAmount.call(
                    web3.toWei(125000),
                    '5000000000000000000001');
                fail('should have thrown')
            } catch (error) {
                assert.include(error.message, 'invalid JUMP');
            }
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
        it('should throw', async () => {
            const instance = await Crowdsale.deployed();
            try {
                await instance.sendTransaction({ from: accounts[0] });
            } catch (error) {
                assert.include(error.message, 'invalid JUMP');
            }
        });
    })
});

function fail(message) {
    throw new Error(message);
}
