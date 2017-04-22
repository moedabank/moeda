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
        let instance;

        before(async () => {
            instance = await MoedaToken.deployed();
        });

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
    });

    describe('transfers', () => {
        let instance;

        before(async () => {
            instance = await MoedaToken.deployed();
            await instance.create(accounts[1], web3.toWei(1500), 
                { from: accounts[0] });
        });

        it('should throw in transfer if crowdsale is active', async () => {
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

        it('should throw in transferFrom if crowdsale is active', async () => {
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
    });
});

contract('Moedatoken, sale is over', (accounts) => {
    let instance;

    before(async () => {
        instance = await MoedaToken.deployed();
        await instance.create(accounts[1], web3.toWei(1500), 
            { from: accounts[0] });
        await instance.unlock({ from: accounts[0] });
    });

    it('create should throw error', async () => {
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

    it('transfer should not throw once crowdsale is over', async () => {        
        try {
            const locked = await instance.locked.call();
            assert.isFalse(locked);

            await instance.transfer(
                accounts[2], web3.toWei(15), { from: accounts[1] });

            const balance = await instance.balanceOf.call(accounts[1]);
            assert.strictEqual(web3.fromWei(balance).toNumber(), 1485);
        } catch (error) {
            fail(error.message);
        }
    });

    it('transferFrom should not throw once crowdsale is over', async () => {
        try {
            const locked = await instance.locked.call();
            assert.isFalse(locked);

            await instance.approve(
                accounts[2], web3.toWei(100), { from: accounts[1] });
            const allowance = await instance.allowance.call(
                accounts[1], accounts[2]);
            assert.strictEqual(web3.fromWei(allowance).toNumber(), 100);

            await instance.transferFrom(
                accounts[1], accounts[2], web3.toWei(50), { from: accounts[2] });

            const balance = await instance.balanceOf.call(accounts[1]);
            assert.strictEqual(web3.fromWei(balance).toNumber(), 1435);
        } catch (error) {
            fail(error.message);
        }
    });
});

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