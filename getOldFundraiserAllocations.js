const Web3 = require('web3');

const web3 = new Web3(new Web3.providers.HttpProvider('http://localhost:8545'));
const abi = require('./oldAbi.json');

const contractAddress = '0x4870E705a3def9DDa6da7A953D1cd3CCEDD08573';
const oldFundraiser = web3.eth.contract(abi).at(contractAddress);
const cutoffBlock = 4034787;
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
  const donations = groupByAddress(loggedDonations);

  Object.keys(donations).forEach((address) => {
    const amount = donations[address];
    totalEthReceived = totalEthReceived.plus(amount);
    console.log(`donors.push(Donation(${address}, ${amount}));`);
  });

  console.log('\nTotal received:', `${web3.fromWei(totalEthReceived)} ETH`);
  console.warn('Total only includes donations before the cutoff block:', cutoffBlock);
  console.log('Transactions:', Object.keys(donations).length);
}

console.log('Fetching donations in previous fundraiser...');
oldFundraiser.Purchase(
  null, { fromBlock: 3782416, toBlock: cutoffBlock }).get(processAmounts);
