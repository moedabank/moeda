pragma solidity ^0.4.13;
import '../MoedaToken.sol';

contract TestMintingToken is MoedaToken {
  function create(address recipient, uint256 amount) public {
    super.mint(recipient, amount);
  }
}
