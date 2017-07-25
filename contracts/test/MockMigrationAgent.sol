pragma solidity ^0.4.11;
import "../MigrationAgent.sol";


contract MockMigrationAgent is MigrationAgent {
  mapping (address => uint256) public balances;

  function balanceOf(address owner) constant returns (uint256 balance) {
    return balances[owner];
  }

  function migrateTo(address to, uint256 amount) {
    balances[to] += amount;
  }
}
