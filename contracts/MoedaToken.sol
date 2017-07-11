import './StandardToken.sol';
import './Ownable.sol';
import './MigrationAgent.sol';

pragma solidity ^0.4.11;

/// @title Moeda Loaylty Points token contract
contract MoedaToken is StandardToken, Ownable {
  string public constant name = "Moeda Loyalty Points";
  string public constant symbol = "MDA";
  uint8 public constant decimals = 18;

  // Used to be able to allow opt-in transfer of tokens to a new token contract
  // This will be set sometime in the future if additional functionality needs
  // be added.
  MigrationAgent public migrationAgent;
  uint256 public totalMigrated;

  // admin can only set a migration agent
  address public admin;

  // don't allow creation of more than this number of tokens
  uint public constant MAX_TOKENS = 20000000 * 10**18;

  // transfers are locked during the sale
  bool public saleActive;

  // only emitted during the crowdsale
  event LogCreation(address indexed donor, uint256 tokensReceived);

  // Log when tokens are migrated to a new contract
  event LogMigration(address indexed recipient, uint256 amount);

  // Log destruction of tokens
  event LogDestruction(address indexed sender, uint256 amount);

  // determine whether transfers can be made
  modifier onlyAfterSale() {
    require(!saleActive);
    _;
  }

  modifier onlyAdmin() {
    require(msg.sender == admin);
    _;
  }

  modifier onlyDuringSale() {
    require(saleActive);
    _;
  }

  /// @dev Create moeda token and lock transfers
  /// @param _admin address for administrator of contract
  function MoedaToken(address _admin) {
    require(_admin != address(0));
    admin = _admin;
    saleActive = true;
  }

  /// @dev transfer adminitrative privileges to a new address
  /// @param _newAdmin address of new administrator
  function transferAdmin(address _newAdmin) onlyAdmin {
    admin = _newAdmin;
  }

  /// @dev start a migration to a new contract
  /// @param agent address of contract handling migration
  function setMigrationAgent(address agent) onlyAdmin onlyAfterSale {
    require(agent != address(0));
    require(migrationAgent == address(0));
    migrationAgent = MigrationAgent(agent);
  }

  /// @dev move a given amount of tokens a new contract (destroying them here)
  /// @param amount the number of tokens to migrate
  function migrate(address beneficiary, uint256 amount) onlyAfterSale {
    require(beneficiary != address(0));
    require(migrationAgent != address(0));
    require(amount > 0);

    // safemath subtraction will throw if balance < amount
    balances[msg.sender] = balances[msg.sender].sub(amount);
    totalSupply = totalSupply.sub(amount);
    totalMigrated = totalMigrated.add(amount);
    migrationAgent.migrateTo(msg.sender, amount);

    LogMigration(msg.sender, amount);
  }

  /// @dev destroy a given amount of tokens owned by sender
  // anyone that owns tokens can destroy them, reducing the total supply
  function burn(uint256 amount) {
    require(amount > 0);
    balances[msg.sender] = balances[msg.sender].sub(amount);
    totalSupply = totalSupply.sub(amount);

    LogDestruction(msg.sender, amount);
  }

  /// @dev unlock transfers
  function unlock() onlyOwner {
      saleActive = false;
  }

  /// @dev create tokens, only usable while saleActive
  /// @param recipient address that will receive the created tokens
  /// @param amount the number of tokens to create
  function create(address recipient, uint256 amount)
  onlyOwner onlyDuringSale {
      if (amount == 0) throw;
      if (totalSupply.add(amount) > MAX_TOKENS) throw;

      balances[recipient] = balances[recipient].add(amount);
      totalSupply = totalSupply.add(amount);

      LogCreation(recipient, amount);
  }

  // transfer tokens
  // only allowed after sale has ended
  function transfer(address _to, uint _value) onlyAfterSale returns (bool) {
      return super.transfer(_to, _value);
  }

  // transfer tokens
  // only allowed after sale has ended
  function transferFrom(address from, address to, uint value) onlyAfterSale
  returns (bool)
  {
      return super.transferFrom(from, to, value);
  }
}
