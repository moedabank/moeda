pragma solidity ^0.4.13;


contract MockFundraiser {
  uint256 rate = 1;

  function tokensPerEth() public returns (uint256) {
    return rate;
  }

  function updateRate(uint256 newRate) {
    rate = newRate;
  }

  function issue(address recipient, uint256 amount) {
  }
}
