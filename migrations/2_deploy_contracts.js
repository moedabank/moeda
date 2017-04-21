var Crowdsale = artifacts.require("./Crowdsale.sol");
var MoedaToken = artifacts.require("./MoedaToken.sol");

module.exports = function(deployer) {
  deployer.deploy(
    Crowdsale,
    '0x98a321f414d67f186e30bdac641e5ecf990397ae',
    98273598235, 
    982735982376
  );
  deployer.deploy(MoedaToken);
};
