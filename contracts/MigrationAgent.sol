pragma solidity ^0.4.13;


contract MigrationAgent {
  /*
    A contract implementing this interface is assumed to implement the neccessary
    access controls. E.g;
    * token being migrated FROM is the only one allowed to call migrateTo
    * token being migrated TO has a minting function that can only be called by
      the migration agent
  */
  function migrateTo(address beneficiary, uint256 amount) public;
}
