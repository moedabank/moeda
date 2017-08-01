pragma solidity ^0.4.13;
import 'zeppelin-solidity/contracts/math/SafeMath.sol';
import 'zeppelin-solidity/contracts/ownership/Ownable.sol';
import 'zeppelin-solidity/contracts/ownership/HasNoTokens.sol';
import 'zeppelin-solidity/contracts/token/ERC20Basic.sol';
import 'zeppelin-solidity/contracts/lifecycle/Pausable.sol';
import './MoedaToken.sol';


/// @title Moeda fundraiser
contract Fundraiser is Ownable, Pausable, HasNoTokens {
  using SafeMath for uint256;
  bool public finalised;          // Whether the fundraiser has been finalised
                                  // manually. Gives us an ability to verify
                                  // that everything is in order before enabling
                                  // token transfers.
  address public wallet;          // recipient of all fundraiser funds
  MoedaToken public moedaToken;   // token that will be sold during fundraiser
  uint256 public etherReceived;   // total ether received (for reference)
  uint256 public totalTokensSold; // total number of tokens sold
  uint256 public totalTokensIssued; // amount of tokens issued
  uint256 public totalAllocated;  // amount allocated to issuers
  uint256 public startBlock;      // block where fundraiser starts
  uint256 public endBlock;        // block where fundraiser ends

  // used to scale token amounts to 18 decimals
  uint256 public constant TOKEN_MULTIPLIER = 10**18;

  // number of tokens allocated to prefunding (prior to fundraiser)
  uint256 public constant PREFUNDING_TOKEN_ALLOCATION = 5000000 * TOKEN_MULTIPLIER;

  // recipient of prefunding tokens
  address public PREFUNDING_WALLET = 0x30B3C64d43e7A1E8965D934Fa96a3bFB33Eee0d2;

  // smallest possible donation
  uint256 public constant DUST_LIMIT = 1 finney;

  // fixed token generation rate, 1 token per US Dollar
  uint256 public constant tokensPerUsd = 1 * TOKEN_MULTIPLIER;

  // dynamic rate based on current ETH/USD exchange rate
  uint256 public tokensPerEth;

  // token caps (how many tokens that can be sold towards each cap)
  uint256 public constant ISSUER_CAP = 10000000 * TOKEN_MULTIPLIER;
  uint256 public constant PUBLIC_CAP =  5000000 * TOKEN_MULTIPLIER;

  // Addresses allowed to issue tokens during the fundraiser
  mapping (address => uint256) public allocations;
  mapping (address => uint256) public tokensIssued;
  address[] public issuers; // for public reference

  // Log an update of the ETH/USD conversion rate in cents
  event LogRateUpdate(uint256 centsPerEth, uint256 tokensPerEth);
  event LogDonation(address indexed donor, uint256 amount, uint256 tokens);
  event LogIssuerAdded(address indexed issuer, uint256 amount);
  event LogIssuerUpdate(address issuer, uint256 oldAlloc, uint256 newAlloc);
  event LogIssuance(address indexed issuer, address recipient, uint256 amount);
  event LogFinalisation();

  modifier notFinalised() {
    require(!finalised);
    _;
  }

  modifier onlyIssuer() {
    require(allocations[msg.sender] > 0);
    _;
  }

  modifier notIssuer() {
    require(allocations[msg.sender] == 0);
    _;
  }

  modifier onlyBeforeFundraiser() {
    require(getBlock() < startBlock);
    _;
  }

  modifier onlyDuringFundraiser() {
    require(!finalised);
    require(getBlock() >= startBlock);
    require(getBlock() < endBlock);
    _;
  }

  /// @dev Initialize a new Fundraiser contract
  /// @param _wallet address of multisig wallet that will store received ether
  /// @param _startBlock block at which to start the fundraiser
  /// @param _endBlock block at which to end the fundraiser
  /// @param _centsPerEth initial US dollar price for 1 ETH in cents
  function Fundraiser(
    address _wallet, uint _startBlock, uint _endBlock, uint _centsPerEth
  ) {
    require(_wallet != address(0));
    require(_startBlock > getBlock());
    require(_endBlock > _startBlock);
    require(_centsPerEth > 0);

    finalised = false;
    wallet = _wallet;
    startBlock = _startBlock;
    endBlock = _endBlock;
    updateRate(_centsPerEth);

    // create token and set myself as minter
    moedaToken = new MoedaToken(this);
    moedaToken.transferOwnership(msg.sender);

    // if there is a balance in this contract on creation, drain it
    if (this.balance > 0) {
      msg.sender.transfer(this.balance);
    }
  }

  /// @dev returns list of issuers
  /// @return list of issuer addresses
  function getIssuers() external constant returns (address[]) {
    return issuers;
  }

  /// @dev Add a token issuer (e.g. for fiat fundraisers)
  /// @param issuer     issuer's address
  /// @param allocation amount of tokens issuer can create
  function addIssuer(address issuer, uint256 allocation) external onlyOwner notFinalised {
    require(issuer != address(0));
    require(allocations[issuer] == 0);
    require(allocation > 0);
    require(totalAllocated.add(allocation) <= ISSUER_CAP);

    setAllocation(issuer, allocation);
    issuers.push(issuer);

    LogIssuerAdded(issuer, allocation);
  }

  /// @dev update an existing issuer allocation
  /// @param issuer     issuer's address
  /// @param allocation new amount of tokens issuer can create
  // Note: this should normally not be needed, but there might be a reason to
  // change an allocation after the fact
  // Note 2: for simplicity we don't delete and shuffle entries around when an
  // issuers allocation is set to zero
  function updateIssuer(address issuer, uint256 allocation)
  external onlyOwner notFinalised {
    require(allocations[issuer] > 0);

    uint256 newAllocation = allocation;

    // can not reduce a previous allocation below what has already been created
    // by that issuer
    if (allocation < tokensIssued[issuer]) {
      newAllocation = tokensIssued[issuer];
    }

    // due to requirement that allocation >= tokensIssued we can just remove the
    // full previous allocation
    uint256 oldAllocation = allocations[issuer];
    totalAllocated = totalAllocated.sub(oldAllocation);

    setAllocation(issuer, newAllocation);
    LogIssuerUpdate(issuer, oldAllocation, newAllocation);
  }

  function setAllocation(address issuer, uint256 allocation) internal {
    allocations[issuer] = allocation;
    totalAllocated = totalAllocated.add(allocation);
  }

  /// @dev Get rate of change between current exchange rate and given rate
  /// @param rate new exchange rate
  /// @return rate of change (e.g. 0.5 for a reduction or 1.5 for an increase)
  function getChangeRatio(uint256 rate) internal constant returns (uint256) {
    if (tokensPerEth == 0) {
      return 10**18;
    }

    if (rate > tokensPerEth) {
      return rate.mul(10**18).div(tokensPerEth);
    }

    return tokensPerEth.mul(10**18).div(rate);
  }

  /// @dev update the ETH/USD exchange rate
  /// @param _centsPerEth exchange rate in cents
  function updateRate(uint256 _centsPerEth) public onlyOwner {
    require(_centsPerEth > 0);

    // Don't allow a change in price larger than 50% in an update
    // ETH/USD is stupidly volatile, but usually not THAT volatile.
    // The assumption here is that we'll be updating the rate regularly starting
    // directly after deployment of the contract, otherwise this could fail on
    // the first update!
    uint256 newRate = _centsPerEth.mul(10**16);
    uint256 changeRatio = getChangeRatio(newRate);
    require(changeRatio >= 500 finney && changeRatio <= 1500 finney);

    tokensPerEth = newRate;
    LogRateUpdate(_centsPerEth, newRate);
  }

  /// @dev issue tokens (e.g. for Bitcoin Suisse)
  /// @param recipient address that receives tokens
  /// @param amount number of tokens to be issued
  /// Note: this can still be called after the public fundraiser has ended as we want
  /// to allow Bitcoin Suisse ample time to finish their allocations
  function issue(address recipient, uint256 amount)
  external notFinalised onlyIssuer whenNotPaused {
    require(amount > 0);
    uint256 newTotal = tokensIssued[msg.sender].add(amount);
    require(newTotal <= allocations[msg.sender]);

    tokensIssued[msg.sender] = newTotal;
    totalTokensSold = totalTokensSold.add(amount);
    totalTokensIssued = totalTokensIssued.add(amount);
    require(totalTokensIssued <= ISSUER_CAP);

    moedaToken.create(recipient, amount);

    LogIssuance(msg.sender, recipient, amount);
  }

  /// @dev get amount of tokens issued for direct ether donations
  function publicIssued() public constant returns (uint256) {
    return totalTokensSold.sub(totalTokensIssued);
  }

  /// @dev determine how much can be bought based on current USD value of
  /// donation (only used for direct ETH donations)
  /// @param amount a suggested amount in Ether to spend
  /// @return tokens to receive and the ether amount that can be spent
  /// note: there is a loss of precision here due to integer division, but the
  /// difference (if any) will be refunded in donate()
  function getAvailable(uint256 amount)
  public constant returns (uint256, uint256) {
    uint256 received = publicIssued();
    uint256 tokenAmount = ethToTokens(amount);

    if (received.add(tokenAmount) > PUBLIC_CAP) {
      tokenAmount = PUBLIC_CAP.sub(received);
      return (tokenAmount, tokensToEth(tokenAmount));
    }

    return (tokenAmount, amount);
  }

  /// @dev process a donation
  /// @param recipient an address that will receive tokens
  function donate(address recipient)
  public payable onlyDuringFundraiser whenNotPaused notIssuer {
    require(msg.value >= DUST_LIMIT);
    require(msg.sender != wallet);
    require(recipient != address(0));
    var (tokenAmount, ethAmount) = getAvailable(msg.value);
    require(ethAmount > 0 && ethAmount <= msg.value);

    etherReceived = etherReceived.add(ethAmount);
    totalTokensSold = totalTokensSold.add(tokenAmount);
    moedaToken.create(recipient, tokenAmount);

    LogDonation(recipient, ethAmount, tokenAmount);

    wallet.transfer(ethAmount);

    // we could not honour the full amount, refund the unspent ether
    // some contracts with high gas fallback functions will fail here due to
    // limited gas
    if (ethAmount < msg.value) {
      msg.sender.transfer(msg.value.sub(ethAmount));
    }
  }

  // Normally donors will use this function to contribute by just sending ether
  // donate() checks conditions, no need to do it here as well
  function () external payable {
    donate(msg.sender);
  }

  /// @dev convert a token amount to the equivalent amount in ether
  /// @param amount amount in tokens
  function tokensToEth(uint256 amount) internal constant returns (uint256) {
    return amount.mul(TOKEN_MULTIPLIER).div(tokensPerEth);
  }

  /// @dev convert an ether amount to the equivalent amount in tokens
  /// @param amount amount in ether
  function ethToTokens(uint256 amount) internal constant returns (uint256) {
    return amount.mul(tokensPerEth).div(TOKEN_MULTIPLIER);
  }

  /// @return whether all available tokens have been sold
  function isSoldOut() public constant returns (bool) {
    // safemath doesn't make sense here
    return PUBLIC_CAP + ISSUER_CAP == totalTokensSold;
  }

  /// @dev finalise the fundraiser manually and unlock token transfers
  /// this will only be successful if:
  /// 1. Not already finalised, or
  /// 2. endBlock has been reached, or
  /// 3. the cap has been reached
  function finalise() external onlyOwner whenNotPaused {
    require(getBlock() > startBlock);
    require(!finalised);

    // If all tokens have been sold before the end block we can allow the fundraiser
    // to end early
    require(getBlock() >= endBlock || isSoldOut());

    // create and assign prefunding allocation
    moedaToken.create(PREFUNDING_WALLET, PREFUNDING_TOKEN_ALLOCATION);

    // unlock tokens for spending
    moedaToken.unlock();
    finalised = true;
    LogFinalisation();
  }

  /// @dev Change wallet when halted (emergency only)
  /// @param _wallet address of new wallet that will receive funds
  function setWallet(address _wallet) external whenPaused onlyOwner {
    require(_wallet != address(0));
    wallet = _wallet;
  }

  // This utility function is overloaded with a mock in tests
  function getBlock() internal constant returns (uint256) {
    return block.number;
  }
}
