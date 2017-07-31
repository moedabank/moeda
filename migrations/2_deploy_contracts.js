const ETHUSD = require('moeda-usd');
const blockEstimate = require('eth-blocktime-estimate');

const TestFundraiser = artifacts.require('./TimeTravellingFundraiser.sol');
const MoedaToken = artifacts.require('./MoedaToken.sol');
const Fundraiser = artifacts.require('./Fundraiser');
const Bonus = artifacts.require('./Bonus');

const TEST_WALLET = '0x98a321f414d67f186e30bdac641e5ecf990397ae';
const REAL_WALLET = '0x42c1B347C470d746D096E3B1420A31B29F35291a';
const START_TIME = Date.UTC(2017, 8, 28, 12, 0) / 1000;
const END_TIME = Date.UTC(2017, 9, 28, 12, 0) / 1000;

function testDeploy(deployer) {
  const currentBlock = web3.eth.blockNumber;
  const fundraiserDuration = 10;
  const startBlock = currentBlock + 8;
  const endBlock = startBlock + fundraiserDuration;
  const centsPerEth = 26233;

  deployer.deploy(
    TestFundraiser,
    TEST_WALLET,
    startBlock,
    endBlock,
    centsPerEth);
  deployer.deploy(MoedaToken, TEST_WALLET);
}

async function liveDeploy(deployer) {
  const centsPerEth = await ETHUSD.getRateInCents();
  const { startBlock, endBlock } = await blockEstimate.getBlocks(
    START_TIME, END_TIME);

  console.log('\nStart block', startBlock);
  console.log('End block', endBlock);
  console.log('Initial rate', centsPerEth);

  return deployer.deploy([
    Bonus,
    [Fundraiser, REAL_WALLET, startBlock, endBlock, centsPerEth],
  ]).then(async () => {
    const bonus = await Bonus.deployed();
    const fundraiser = await Fundraiser.deployed();

    try {
      await Promise.all(
        bonus.initDonors(),
        bonus.setFundraiserAddress(fundraiser.address));
    } catch (error) {
      console.log(error);
    }
  });
}

module.exports = function deployment(deployer) {
  if (deployer.network === 'live') {
    return liveDeploy(deployer);
  }

  return testDeploy(deployer);
};
