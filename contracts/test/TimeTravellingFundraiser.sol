pragma solidity ^0.4.11;
import '../Fundraiser.sol';

contract TimeTravellingFundraiser is Fundraiser {
  uint256 public currentBlockNumber;

  function TimeTravellingFundraiser(
    address _wallet, uint256 startBlock, uint256 endBlock, uint256 _centsPerEth
  ) Fundraiser(_wallet, startBlock, endBlock, _centsPerEth) {
    currentBlockNumber = 1;
  }

  function setBlock(uint256 _currentBlockNumber) external {
    currentBlockNumber = _currentBlockNumber;
  }

  function getBlock() internal constant returns (uint256) {
    return currentBlockNumber;
  }

  function incrBlock() external {
    currentBlockNumber += 1;
  }
}
