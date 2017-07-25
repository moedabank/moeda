pragma solidity ^0.4.11;


contract MockFundraiser {
  function tokensPerEth() public returns (uint256) {
    return 1;
  }

  function issue(address recipient, uint256 amount) {
  }
}
