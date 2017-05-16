const MoedaToken = artifacts.require('./MoedaToken');
const utils = require('./utils');
const fail = utils.fail;
const assertVmException = utils.assertVmException;

contract('MoedaToken', (accounts) => {
    let instance;
    beforeEach(async () => {
        instance = await MoedaToken.new();
    });

    describe('constructor', () => {
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

        it('should throw an error when transfers are unlocked', async () => {
            const instance = await MoedaToken.new();
            await instance.unlock();
            const locked = await instance.locked.call();
            assert.isFalse(locked);

            try {
                await instance.create(
                        accounts[1], web3.toWei(500), { from: accounts[0] });
                fail('should have thrown');
            } catch (error) {
                assertVmException(error);
            }
        });

        it('should emit a Created event on success', async () => {
            const instance = await MoedaToken.new();

            try {
                await instance.create(
                    accounts[1], web3.toWei(500), { from: accounts[0] });
                const event = await utils.getLatestEvent(
                    instance, 'Created');

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
                assert.include(error.message, 'invalid JUMP');
            }

            const locked = await instance.locked.call();
            assert.strictEqual(locked, true);
        });

        it('should set locked to false', async () => {
            await instance.unlock({ from: accounts[0] });
            const locked = await instance.locked.call();
            assert.strictEqual(locked, false, 'should be unlocked');
        });
    });

    describe('transfer()', () => {
        beforeEach(async () => {
            await instance.create(accounts[1], web3.toWei(1500));
        });

        it('should throw when transfers are locked', async () => {
            try {
                const locked = await instance.locked.call();
                assert.isTrue(locked);

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
                const locked = await instance.locked.call();
                assert.isFalse(locked);

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

        it('should throw when transfers are locked', async () => {
            try {
                const locked = await instance.locked.call();
                assert.isTrue(locked);

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
                const locked = await instance.locked.call();
                assert.isFalse(locked);

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
            const instance = await MoedaToken.new();
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
