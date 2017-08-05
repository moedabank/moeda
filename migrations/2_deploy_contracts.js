const MoedaToken = artifacts.require('./MoedaToken.sol');

async function liveDeploy(deployer) {
  return deployer.deploy(MoedaToken).then(async () => {
    const instance = await MoedaToken.deployed();

    await instance.createBonusTokens();
    await instance.unlock();
  });
}

module.exports = function deployment(deployer) {
  if (deployer.network === 'live') {
    return liveDeploy(deployer);
  }

  return deployer.deploy(MoedaToken);
};
