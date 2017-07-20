const Wallet = artifacts.require('MultiSigWalletWithDailyLimit');
const MoedaToken = artifacts.require('MoedaToken');
const utils = require('./utils');
const assert = utils.assert;

contract('Wallet', (accounts) => {
  let token;
  let wallet;
  beforeEach(async () => {
    wallet = await Wallet.new(accounts, 1, web3.toWei(12000));
    token = await MoedaToken.new(accounts[1]);
    await token.create(wallet.address, web3.toWei(120000));
    await token.create(accounts[3], web3.toWei(15000));
    return token.unlock();
  });

  it('should be able to transfer tokens', async () => {
    const methodId = web3.sha3('transfer(address,uint256)').slice(0,10);
    const recipient = `000000000000000000000000${accounts[2].slice(2)}`
    const amount = numberPad(75000);
    const calldata = `${methodId}${recipient}${amount}`;
    await wallet.submitTransaction(token.address, 0, calldata);
    const balance = await token.balanceOf.call(accounts[2]);

    assert.equals(balance, '75000000000000000000000');
  });

  it('should be able to create an allowance', async () => {
    const methodId = web3.sha3('approve(address,uint256)').slice(0, 10);
    const spender = `000000000000000000000000${accounts[2].slice(2)}`;
    const amount = numberPad(75000);
    const calldata = methodId + spender + amount;
    await wallet.submitTransaction(token.address, 0, calldata);
    const allowance = await token.allowance.call(wallet.address, accounts[2]);
    assert.equals(allowance, '75000000000000000000000');

    await token.transferFrom(
      wallet.address, accounts[1], web3.toWei(71000), { from: accounts[2] });
    const balance = await token.balanceOf.call(accounts[1]);

    assert.equals(balance, '71000000000000000000000');
  });

  it('should be able to destroy owned tokens', async () => {
    const methodId = web3.sha3('burn(uint256)').slice(0, 10);
    const amount = numberPad(6350);
    const calldata = methodId + amount;
    await wallet.submitTransaction(token.address, 0, calldata);
    const balance = await token.balanceOf(wallet.address);
    assert.equals(balance, '113650000000000000000000');
  });

  it('should be able to spend an allowance', async () => {
    const methodId = web3.sha3('transferFrom(address,address,uint256)').slice(0, 10);
    const owner = padAddress(accounts[3])
    const recipient = padAddress(accounts[1]);
    const amount = web3.toWei(6350);
    const encodedAmount = numberPad(6350);
    const calldata = methodId + owner + recipient + encodedAmount;
    await token.approve(wallet.address, amount, { from: accounts[3] });
    const allowance = await token.allowance.call(accounts[3], wallet.address);
    assert.equals(allowance, amount);

    await wallet.submitTransaction(token.address, 0, calldata);
    const balance = await token.balanceOf.call(accounts[1]);
    assert.equals(balance, amount);
  });
});

function numberPad(num) {
  return web3._extend.utils.padLeft(web3.toHex(web3.toWei(num)).slice(2), 64);
}

function padAddress(address) {
  return web3._extend.utils.padLeft(address.slice(2), 64);
}
