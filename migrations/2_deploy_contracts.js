const Crowdsale = artifacts.require("./Crowdsale.sol");
const MoedaToken = artifacts.require("./MoedaToken.sol");

const TEST_WALLET = '0x98a321f414d67f186e30bdac641e5ecf990397ae';

module.exports = function(deployer) {
  const currentBlock = web3.eth.blockNumber;
  const saleDuration = 10;
  const startBlock = currentBlock + 8;
  const endBlock = startBlock + saleDuration;
  const centsPerEth = 26233;

  deployer.deploy(
    Crowdsale,
    TEST_WALLET,
    startBlock,
    endBlock,
    centsPerEth
  );
  deployer.deploy(MoedaToken, TEST_WALLET);
};
