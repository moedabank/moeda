pragma solidity ^0.4.15;
import './vendored/openzeppelin/token/StandardToken.sol';
import './vendored/openzeppelin/ownership/Ownable.sol';
import './vendored/openzeppelin/ownership/HasNoTokens.sol';
import './MigrationAgent.sol';


/// @title Moeda Loyalty Points token contract
contract MoedaToken is StandardToken, Ownable, HasNoTokens {
  string public constant name = "Moeda Loyalty Points";
  string public constant symbol = "MDA";
  uint8 public constant decimals = 18;

  // The migration agent is used to be to allow opt-in transfer of tokens to a
  // new token contract. This could be set sometime in the future if additional
  // functionality needs be added.
  MigrationAgent public migrationAgent;
  uint256 public totalMigrated;

  uint constant TOKEN_MULTIPLIER = 10**uint256(decimals);
  // don't allow creation of more than this number of tokens
  uint public constant MAX_TOKENS = 20000000 * TOKEN_MULTIPLIER;

  // transfers are locked during minting
  bool public mintingFinished;
  bool public bonusTokensCreated;

  // Log when tokens are migrated to a new contract
  event LogMigration(address indexed spender, address grantee, uint256 amount);
  event LogCreation(address indexed donor, uint256 tokensReceived);
  event LogDestruction(address indexed sender, uint256 amount);
  event LogMintingFinished();

  modifier afterMinting() {
    require(mintingFinished);
    _;
  }

  modifier canTransfer(address recipient) {
    require(mintingFinished && recipient != address(0));
    _;
  }

  modifier canMint() {
    require(!mintingFinished);
    _;
  }

  /// @dev Create moeda token and assign partner allocations
  function MoedaToken() {
    mint(0xaAaAaAaaAaAaAaaAaAAAAAAAAaaaAaAaAaaAaaAa, 9000000 * TOKEN_MULTIPLIER); // Bitcoin Suisse
    mint(0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB, 2000000 * TOKEN_MULTIPLIER); // ICOage
    mint(0xb03DEA3Ece1B15583C3D471877ed082c61e61885, 5000000 * TOKEN_MULTIPLIER); // presale
    mint(0xCcCCccccCCCCcCCCCCCcCcCccCcCCCcCcccccccC, 3910805111441920000000000); // TBD
  }

  /// @dev start a migration to a new contract
  /// @param agent address of contract handling migration
  function setMigrationAgent(address agent) external onlyOwner afterMinting {
    require(agent != address(0) && isContract(agent));
    require(migrationAgent == address(0));
    migrationAgent = MigrationAgent(agent);
  }

  function isContract(address addr) internal constant returns (bool) {
    uint256 size;
    assembly { size := extcodesize(addr) }
    return size > 0;
  }

  /// @dev move a given amount of tokens a new contract (destroying them here)
  /// @param amount the number of tokens to migrate
  function migrate(address beneficiary, uint256 amount) external afterMinting {
    require(beneficiary != address(0));
    require(migrationAgent != address(0));
    require(amount > 0);

    // safemath subtraction will throw if balance < amount
    balances[msg.sender] = balances[msg.sender].sub(amount);
    totalSupply = totalSupply.sub(amount);
    totalMigrated = totalMigrated.add(amount);
    migrationAgent.migrateTo(beneficiary, amount);

    LogMigration(msg.sender, beneficiary, amount);
  }

  /// @dev destroy a given amount of tokens owned by sender
  // anyone that owns tokens can destroy them, reducing the total supply
  function burn(uint256 amount) external {
    require(amount > 0);
    balances[msg.sender] = balances[msg.sender].sub(amount);
    totalSupply = totalSupply.sub(amount);

    LogDestruction(msg.sender, amount);
  }

  /// @dev unlock transfers
  function unlock() external onlyOwner canMint {
    mintingFinished = true;
    LogMintingFinished();
  }

  /// @dev create tokens, only usable before minting has ended
  /// @param recipient address that will receive the created tokens
  /// @param amount the number of tokens to create
  function mint(address recipient, uint256 amount) internal canMint {
    require(amount > 0);
    require(totalSupply.add(amount) <= MAX_TOKENS);

    balances[recipient] = balances[recipient].add(amount);
    totalSupply = totalSupply.add(amount);

    LogCreation(recipient, amount);
  }

  // only allowed after minting has ended
  // note: transfers to null address not allowed, use burn(value)
  function transfer(address to, uint _value)
  public canTransfer(to) returns (bool)
  {
    return super.transfer(to, _value);
  }

  // only allowed after minting has ended
  // note: transfers to null address not allowed, use burn(value)
  function transferFrom(address from, address to, uint value)
  public canTransfer(to) returns (bool)
  {
    return super.transferFrom(from, to, value);
  }

  // tokens awarded to participants of previous (cancelled) fundraiser
  // see getOldFundraiserAllocation.js for how these numbers were calculated
  function createBonusTokens() onlyOwner {
    require(!bonusTokensCreated);
    bonusTokensCreated = true;
    mint(0x55B30722d84ca292E4432f644F183D1986D2B8F9, 48600000000000000000);
    mint(0x7AB6C31747049BBe34a19253c0abe5001cCBe8c6, 2381400000000000000000);
    mint(0xF851ff5037212C716e91CD474252B86faCa7bb11, 1437635968200000000000);
    mint(0x27ed1A21a243C8CdE077e64014E9E438D8D21482, 72900000000000000000);
    mint(0x1697c3c6b4359124C1b2A8fB85114c67B6491965, 486000000000000000000);
    mint(0x413864b3Fbc9a59a73205C85C1d69be0220a8D6f, 486000000000000000000);
    mint(0x008f2e1AD8ED95040D64Ab9e8D8f3eef7e4e991A, 1458000000000000000000);
    mint(0xe96c7892f11304b9d04a96d6FF6edF9B573b2093, 153418744980000000000);
    mint(0xc44CA6Ec87A229F61f9C8d4fEBa81dcF51a666dD, 486000000000000000);
    mint(0x4e1997a0728bB99ab63e1a39957EE8D9349b0798, 97200000000000000000);
    mint(0x88Ad1eA01e9635EcaDCFF10A19C05d1B1cbe90B9, 486000000000000000000);
    mint(0x7cB57B5A97eAbe94205C07890BE4c1aD31E486A8, 486000000000000000);
    mint(0x3aEd77b7F19f7e0953D4c64a7859699145dbBCCE, 196830000000000000000);
    mint(0x22021bB4404A637Cc82CBff53bd30f9c16083095, 97200000000000000000);
    mint(0x001D8D7dd820e22cE63E6D86D4A48346BA13C154, 486000000000000000000);
    mint(0x3E8A92020d6EF10412b93E52220C68d8f0548a9C, 486000000000000000000);
    mint(0x5043732862627D7b00648D385637A46ff02d41f2, 486000000000000000000);
    mint(0xDa33a97A4fAc818d250832D9708cAE99a487222d, 972000000000000000000);
    mint(0xfE78Be20FeeE8f6d1F64b4731d16ca046A1F625c, 121500000000000000000);
    mint(0x9cF947C47fB8E83006233d6b5f1d7F0e8cEDaacc, 1458000000000000000000);
    mint(0x9f15F58C4161C5Cf0C1B8139a642e108e8eF2C29, 24300000000000000000);
    mint(0x19006Ef9a48f9EA094cCcBA94559266D48FEfF06, 972000000000000000000);
    mint(0xC48A6de82842B531DA08b27ca3CF7A95AbD21b37, 12150000000000000000000);
    mint(0x00f6be63D0847351A891cD43750c245743308D75, 972000000000000000);
    mint(0xdD1240c4A131cB0B037Ac45FfB43b7499f2B164d, 243000000000000000000);
    mint(0xc5C456aF2844F610F61e996B83Ec0eD98faa092D, 972000000000000000000);
    mint(0x949D6642066DEC1C937aAca4Ec3C2c04Fcc0C2AA, 654485994000000000000);
    mint(0xf15E59eccD96E7fC7421ecdf36C100273007E654, 1939140000000000000000);
    mint(0x444F63f3661919cE69cfCE67a2f8BAc5A170cadD, 486000000000000000000);
    mint(0xd45546Cbc3C4dE75CC2B1f324d621A7753f25bB3, 97200000000000000000);
    mint(0xeb3C4E9706064e66358b8c17C351c110Be34F9C7, 486000000000000000000);
    mint(0xfC9455179760fEE65B1F82162ebD96cbb626e1b6, 486000000000000000000);
    mint(0xE94aE3d286F693A313c7C8A0907c2f425ADb80C9, 40997380500000000000);
    mint(0xAc3949c90Aca5e543114b242917426eF78dae650, 36336470400000000000);
    mint(0x6541875114bEca413d016fb60B2Aa25e14604d20, 59194800000000000000000);
  }
}
