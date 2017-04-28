const Crowdsale = artifacts.require('./Crowdsale');
const MoedaToken = artifacts.require('./MoedaToken');
const utils = require('./utils');
const fail = utils.fail;
const assertVmException = utils.assertVmException;
const NULL_ADDRESS = '0x0000000000000000000000000000000000000000';
const TEST_WALLET = '0x98a321f414d67f186e30bdac641e5ecf990397ae';

contract('Crowdsale', (accounts) => {
    describe('constructor', () => {
        let instance;        
        before(async () => {
            instance = await Crowdsale.deployed();
        });

        it('should create a moedaToken instance', async () => {
            const tokenAddress = await instance.moedaToken.call();
            const token = MoedaToken.at(tokenAddress);
            const owner = await token.owner.call();

            assert.strictEqual(owner, instance.address);
            assert.notStrictEqual(tokenAddress, NULL_ADDRESS);
        });

        it('should not throw when using new', async () => {
            const currentBlock = web3.eth.blockNumber;
            const startBlock = currentBlock + 10;

            try {
                const instance = await Crowdsale.new(
                    accounts[0], startBlock, startBlock + 30);
            } catch (error) {
                fail('should not have thrown')
            }
        });

        it('should throw when wallet address is 0', async () => {
            const currentBlock = web3.eth.blockNumber;
            const startBlock = currentBlock + 10;

            try {
                const instance = await Crowdsale.new(
                    0, startBlock, startBlock + 30);
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
                    accounts[0], startBlock, startBlock - 1);
                fail('should have thrown');
            } catch (error) {
                assertVmException(error);
            }
        });

        it('should assign wallet address', async () => {
            const wallet = await instance.wallet.call();

            assert.notStrictEqual(wallet, NULL_ADDRESS)
        });

        it('should assign crowdsale closed boolean', async () => {
            const crowdsaleClosed = await instance.crowdsaleClosed.call();

            assert.strictEqual(crowdsaleClosed, false);
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

        it('should return tier1 limit and tier1 rate for total < TIER1_CAP',
        async () => {
            const value = await instance.getLimitAndRate.call(web3.toWei(10));
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

            assert.strictEqual(limit, '70000');
            assert.strictEqual(rate, '0.008');
        });

        it('should return ether cap limit and tier3 rate for TIER2_CAP <= ' +
            'total < TIER3_CAP',
        async () => {
            const TIER2_CAP = await instance.TIER2_CAP.call();
            const value = await instance.getLimitAndRate.call(TIER2_CAP);
            const limit = web3.fromWei(value[0]).toString(10);
            const rate = web3.fromWei(value[1]).toString(10);

            assert.strictEqual(limit, '130000');
            assert.strictEqual(rate, '0.012');
        });

        it('should throw if total is equal to cap', async () => {
            const ethercap = await instance.TIER3_CAP.call();

            try {
                await instance.getLimitAndRate.call(ethercap);
                fail('should have thrown');
            } catch (error) {
                assertVmException(error);
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

        it('should use only tier 1 rate when in tier 1, with no overlap',
        async () => {
            const amount = await instance.getTokenAmount.call(
                0, web3.toWei(15));
            const tier1_rate = await instance.TIER1_RATE.call();
            const expectedAmount = web3.toWei(web3.toBigNumber(
                web3.toWei(15)).div(tier1_rate).round(18, 1));

            assert.strictEqual(amount.toString(10), expectedAmount.toString(10));
        });

        it('should use 2 different rates when overlapping 2 tiers',
        async () => {
            // 100 ether received previously, try to spend 30000 ether
            const amount = await instance.getTokenAmount.call(
                web3.toWei(100), web3.toWei(30000));
            const tier1_rate = await instance.TIER1_RATE.call();
            const tier2_rate = await instance.TIER2_RATE.call();

            // we should get 29900 eth worth of tokens at the tier 1
            // rate and an additional 100 eth worth at the tier 2 rate
            const amountAtTier0 = web3.toBigNumber(
                web3.toWei(29900)).div(tier1_rate);
            const amountAtTier1 = web3.toBigNumber(
                web3.toWei(100)).div(tier2_rate);
            const expectedAmount = web3.toWei(
                amountAtTier0.plus(amountAtTier1).round(18, 1));

            assert.strictEqual(
                expectedAmount.toString(10), amount.toString(10));
        });

        it('should use 3 different rates when overlapping 3 tiers',
        async () => {
            // 100 ether received previously, try to spend 70000 ether
            // this should overlap tier 1, 2 and 3
            const amount = await instance.getTokenAmount.call(
                web3.toWei(100), web3.toWei(70000));
            const tier1_rate = await instance.TIER1_RATE.call();
            const tier2_rate = await instance.TIER2_RATE.call();
            const tier3_rate = await instance.TIER3_RATE.call();

            // we should get 
            // 29900 eth worth of tokens at the tier 1 rate
            // 40000 eth worth of tokens at the tier 2 rate
            //  100 eth worth of tokens at the tier 3 rate
            const amountAtTier1 = web3.toBigNumber(
                web3.toWei(29900)).div(tier1_rate);
            const amountAtTier2 = web3.toBigNumber(
                web3.toWei(40000)).div(tier2_rate);
            const amountAtTier3 = web3.toBigNumber(
                web3.toWei(100)).div(tier3_rate);
            const expectedAmount = web3.toWei(
                amountAtTier1.plus(amountAtTier2)
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
            // we're in tier 3, 125000 ether invested so far
            // try to buy so much that we exceed the total cap
            try {
                const amount = await instance.getTokenAmount.call(
                    web3.toWei(125000),
                    '5000000000000000000001');
                fail('should have thrown')
            } catch (error) {
                assertVmException(error);
            }
        });
    });

    describe('before sale has started', () => {
        let instance;

        beforeEach(async () => {
            const blockNumber = web3.eth.blockNumber;
            instance = await Crowdsale.new(
                TEST_WALLET, blockNumber + 5, blockNumber + 10);
            const startBlock = await instance.startBlock.call();
            assert.isBelow(
                blockNumber,
                startBlock.toNumber(),
                'sale should not have been started');
        });

        describe('when we receive ether', () => {
            it('should throw and prevent buying', async () => {
                try {
                    const value = await instance.sendTransaction({
                        value: web3.toWei(5), from: accounts[0]
                    });
                    fail('should have thrown')
                } catch (error) {
                    assertVmException(error);
                }
            });
        });

        describe('finalize()', () => {
            it('should throw', async () => {
                try {
                    await instance.finalize({ from: accounts[0]});
                } catch (error) {
                    assertVmException(error);
                }
            });
        });
    });

    describe('during sale', () => {
        let instance;

        beforeEach(async () => {
            let currentBlock = web3.eth.blockNumber;
            const saleDuration = 10;
            const startBlock = currentBlock + 8;
            const endBlock = startBlock + saleDuration;
            
            instance = await Crowdsale.new(
                TEST_WALLET, startBlock, endBlock);
            await fastForwardToBlock(instance, 'startBlock');
            
            currentBlock = web3.eth.blockNumber; 
            assert.isAtLeast(
                currentBlock, startBlock, 'sale should have been started');
            assert.isBelow(
                currentBlock, endBlock, 'sale should not have ended yet');
        });

        describe('when we receive ether', () => {
            it('should throw when limit has already been reached',
            async () => {
                const limit = await instance.TIER3_CAP.call();
                await instance.sendTransaction({
                    value: limit.minus(1),
                    from: accounts[1]
                });

                try {
                    await instance.sendTransaction({ 
                        value: web3.toWei(1),
                        from: accounts[1] 
                    });
                    fail('should have thrown');
                } catch (error) {
                    assertVmException(error);
                }
            });

            it('should throw if amount is less than minimum', async () => {
                try {
                    await instance.sendTransaction({ 
                        from: accounts[2],
                        value: web3.toWei('0.19')
                    });
                    fail('should have thrown');
                } catch (error) {
                    assertVmException(error);
                }
            });

            it('should throw if donation would exceed maximum cap',
            async () => {
                try {
                    await instance.sendTransaction({ 
                        from: accounts[1],
                        value: web3.toWei(131000)
                    });
                    fail('should have thrown');
                } catch (error) {
                    assertVmException(error);
                }
            });

            it('should update total tokens sold amount on success',
            async () => {
                const totalTokensBefore = await instance.totalTokensSold.call();
                await instance.sendTransaction({
                    from: accounts[2],
                    value: web3.toWei('30')
                });
                const totalTokensAfter = await instance.totalTokensSold.call();

                assert.isAbove(
                    web3.fromWei(totalTokensAfter),
                    web3.fromWei(totalTokensBefore));
            });

            it('should update ether recieved amount on success', async () => {
                const etherBefore = await instance.etherReceived.call();
                await instance.sendTransaction({
                    from: accounts[2],
                    value: web3.toWei('30')
                });
                const etherAfter = await instance.etherReceived.call();

                assert.strictEqual(
                    web3.fromWei(etherAfter).toNumber(),
                    web3.fromWei(etherBefore).toNumber() + 30);
            });

            it('should throw if token creation fails', async () => {
                try {
                    const tokenAddress = await instance.moedaToken();
                    const token = MoedaToken.at(tokenAddress);
                    await token.unlock({ from: accounts[0] });
                    await instance.sendTransaction({
                        from: accounts[2],
                        value: web3.toWei('30')
                    });
                    fail('should have thrown');
                } catch (error) {
                    assertVmException(error);
                }
            });
        });

        describe('finalize()', () => {
            it('should set crowd sale to closed and unlock tokens', async () => {
                await instance.finalize({ from: accounts[0] });

                const crowdsaleClosed = await instance.crowdsaleClosed.call();
                assert.isTrue(crowdsaleClosed);

                const tokenAddress = await instance.moedaToken.call();
                const token = MoedaToken.at(tokenAddress);
                const locked = await token.locked.call();
                assert.isFalse(locked);
            });

            it('should throw when already disabled', async () => {
                try {
                    await instance.finalize({ from: accounts[0] });
                    await instance.finalize({ from: accounts[0] });
                    fail('should have thrown');
                } catch (error) {
                    assertVmException(error);
                }
            });

            it('should assign presale tokens to team wallet', async () => {
                // make some buys to reach cap, to test that we can create
                // presale tokens even when cap is reached and that the total
                // matches what is expected
                await instance.sendTransaction({ from: accounts[1], value: web3.toWei(75000) });
                await instance.sendTransaction({ from: accounts[2], value: web3.toWei(35000) });
                await instance.sendTransaction({ from: accounts[3], value: web3.toWei(20000) });

                await instance.finalize({ from: accounts[0] });

                const tokenAddress = await instance.moedaToken.call();
                const token = MoedaToken.at(tokenAddress);
                const presaleTokens = await instance.PRESALE_TOKEN_AMOUNT.call();
                const teamWalletBalance = await token.balanceOf.call(TEST_WALLET);

                assert.strictEqual(
                    teamWalletBalance.toString(10), web3.toWei(5000000));

                const TOKEN_MAX = await token.MAX_TOKENS.call();
                const totalSupply = await token.totalSupply.call();

                // 2 wei rounding error due to precision problems
                assert.isAtMost(
                    totalSupply.toString(10), TOKEN_MAX.toString(10));
            });
        });
    });
    
    describe('after sale has ended', () => {
        describe('when we receive ether', () => {
            it('should throw', async () => {
                const instance = await Crowdsale.deployed();
                const endBlock = await instance.endBlock.call();
                assert.isAtLeast(
                    web3.eth.blockNumber, endBlock, 'sale should have ended');
                const limit = await instance.TIER3_CAP.call();

                try {
                    await instance.sendTransaction({ 
                        value: web3.toWei(1),
                        from: accounts[1]
                    });
                    fail('should have thrown');
                } catch (error) {
                    assertVmException(error);

                    const amount = await instance.etherReceived.call();
                    assert.strictEqual(amount.toNumber(), 0);
                }
            });
        });
    });
});

async function fastForwardToBlock(instance, blockAttributeName) {
    // The starting block is dynamic because we run tests in testrpc
    const blockNumber = await instance[blockAttributeName].call();

    await utils.mineUntilBlock(web3, blockNumber);
}
