const Crowdsale = artifacts.require("./Crowdsale.sol");
const MoedaToken = artifacts.require("./MoedaToken.sol");
const Web3 = require('web3');
const web3 = new Web3(new Web3.providers.HttpProvider('http://localhost:8545'));

module.exports = function(deployer) {
  const currentBlock = web3.eth.blockNumber;
  const saleDuration = 10;
  const startBlock = currentBlock + 8;
  const endBlock = startBlock + saleDuration;

  deployer.deploy(
    Crowdsale,
    '0x98a321f414d67f186e30bdac641e5ecf990397ae',
    startBlock, 
    endBlock
  );
  deployer.deploy(MoedaToken);
};
