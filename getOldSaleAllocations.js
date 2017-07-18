const Web3 = require('web3');
const web3 = new Web3(new Web3.providers.HttpProvider('http://localhost:8545'));

var abi = require('./oldAbi.json');

const address = '0x4870E705a3def9DDa6da7A953D1cd3CCEDD08573';
const instance = web3.eth.contract(abi).at(address);
const publicSaleMax = web3.toBigNumber(web3.toWei(5000000));
const cutoffBlock = 4034787;
const tokensPerEth = 470; // TODO: set actual rate
const bittrexAddress = '0xfbb1b73c4f0bda4f67dca266ce6ef42f520fbb98';

function groupByAddress(donations) {
  const donors = {};
  donations.forEach((donation) => {
    if (donation.args.donor === bittrexAddress) {
      return;
    }
    const donorAddress = web3.toChecksumAddress(donation.args.donor);

    if (donors[donorAddress] === undefined) {
      donors[donorAddress] = donation.args.amount;
      return;
    }

    donors[donorAddress] = donors[donorAddress].plus(donation.args.amount);
  });

  return donors;
}

function processAmounts(error, loggedDonations) {
  if (error) {
    throw new Error(error);
  }

  let totalEthReceived = web3.toBigNumber(0);
  let totalTokens = web3.toBigNumber(0);
  const donations = groupByAddress(loggedDonations);

  for(const address in donations) {
    const amount = donations[address];
    const numTokens = amount.mul(tokensPerEth).toString(10);
    totalEthReceived = totalEthReceived.plus(amount);
    totalTokens = totalTokens.plus(numTokens);
    console.log(`token.transfer(${address}, ${numTokens});`);
  }

  console.log('Total ETH received:', totalEthReceived.toString(10));
  console.log('Total tokens to be issued:', totalTokens.toString(10));
  console.log('Transactions:', Object.keys(donations).length);
}

console.log('Fetching donations in previous crowdsale...');
instance.Purchase(
  null, { fromBlock: 3782416, toBlock: cutoffBlock }).get(processAmounts);
