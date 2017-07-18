import './SafeMath.sol';
import './Ownable.sol';
import './MoedaToken.sol';
import './ERC20.sol';

pragma solidity ^0.4.11;

/// @title Moeda crowdsale
contract Crowdsale is Ownable {
  using SafeMath for uint256;
  bool public finalised;          // Whether the crowdsale has been finalised
                                  // manually. Gives us an ability to verify
                                  // that everything is in order before enabling
                                  // token transfers.
  address public wallet;          // recipient of all crowdsale funds
  MoedaToken public moedaToken;   // token that will be sold during sale
  uint256 public etherReceived;   // total ether received (for reference)
  uint256 public tokensIssued;    // number of tokens created by issuers
  uint256 public totalTokensSold; // total number of tokens sold
  uint256 public startBlock;      // block where sale starts
  uint256 public endBlock;        // block where sale ends

  // used to scale token amounts to 18 decimals
  uint256 public constant TOKEN_MULTIPLIER = 10**18;

  // number of tokens allocated to presale (prior to crowdsale)
  uint256 public constant PRESALE_TOKEN_ALLOCATION = 5000000 * TOKEN_MULTIPLIER;

  // recipient of presale tokens
  address public PRESALE_WALLET = 0x30B3C64d43e7A1E8965D934Fa96a3bFB33Eee0d2;

  // smallest possible donation
  uint256 public constant DUST_LIMIT = 1 finney;

  // fixed token generation rate, 1 token per US Dollar
  uint256 public constant tokensPerUsd = 1 * TOKEN_MULTIPLIER;

  // dynamic rate based on current ETH/USD exchange rate
  uint256 public tokensPerEth;

  // token caps (how many tokens that can be sold towards each cap)
  uint256 public constant ISSUER_CAP = 10000000 * TOKEN_MULTIPLIER;
  uint256 public constant PUBLIC_CAP =  5000000 * TOKEN_MULTIPLIER;

  // Addresses allowed to issue tokens during the sale
  mapping(address => bool) public issuers;

  // Log an update of the ETH/USD conversion rate in cents
  event LogRateUpdate(uint256 centsPerEth, uint256 tokensPerEth);

  // Log a donation
  event LogDonation(address indexed donor, uint256 amount, uint256 tokens);
  event LogIssuance(address indexed issuer, address recipient, uint256 amount);

  // Log transfer of tokens that were sent to this contract by mistake
  event LogTokenDrain(address token, address to, uint256 amount);

  // Whether sale has been paused
  bool public isPaused = false;

  event LogPause();
  event LogUnpause();
  event LogFinalisation();

  modifier notPaused() {
    require(!isPaused);
    _;
  }

  modifier paused() {
    require(isPaused);
    _;
  }

  modifier notFinalised() {
    require(!finalised);
    _;
  }

  modifier onlyIssuer() {
    require(issuers[msg.sender]);
    _;
  }

  modifier notIssuer() {
    require(!issuers[msg.sender]);
    _;
  }

  modifier onlyBeforeSale() {
    require(block.number < startBlock);
    _;
  }

  modifier onlyDuringSale() {
    require(!finalised);
    require(block.number >= startBlock);
    require(block.number < endBlock);
    _;
  }

  /// @dev Initialize a new Crowdsale contract
  /// @param _wallet address of multisig wallet that will store received ether
  /// @param _startBlock block at which to start the sale
  /// @param _endBlock block at which to end the sale
  /// @param _centsPerEth initial US dollar price for 1 ETH in cents
  function Crowdsale(
    address _wallet, uint _startBlock, uint _endBlock, uint _centsPerEth
  ) {
    require(_wallet != address(0));
    require(_startBlock > block.number);
    require(_endBlock > _startBlock);
    require(_centsPerEth > 0);

    finalised = false;
    wallet = _wallet;
    startBlock = _startBlock;
    endBlock = _endBlock;
    updateRate(_centsPerEth);

    // create token and set deployer of this contract as admin of token
    moedaToken = new MoedaToken(msg.sender);

    // if there is a balance in this contract on creation, drain it
    if (this.balance > 0) {
      msg.sender.transfer(this.balance);
    }
  }

  /// @dev Add a token issuer (e.g. for fiat sales)
  /// @param _address issuer's adress
  function addIssuer(address _address) onlyOwner notFinalised {
    require(_address != address(0));
    issuers[_address] = true;
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
  function updateRate(uint256 _centsPerEth) onlyOwner {
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

  /// @dev determine how much can be bought based on current USD value of
  /// donation
  /// @param amount a suggested amount in Ether to spend
  /// @return tokens to receive and the ether amount that can be spent
  function getAvailable(uint256 amount) constant returns (uint256, uint256) {
    uint256 received = publicIssued();
    uint256 tokenAmount = ethToTokens(amount);

    if (received.add(tokenAmount) > PUBLIC_CAP) {
      tokenAmount = PUBLIC_CAP.sub(received);
      return (tokenAmount, tokensToEth(tokenAmount));
    }

    return (tokenAmount, amount);
  }

  /// @dev transfer ownership to a new crowdsale address, would only be used in
  /// the event of a catastrophic bug in this contract
  /// @param _newOwner address that gets ownership of the token
  function transferTokenOwnership(address _newOwner) onlyOwner paused {
    require(_newOwner != address(0));
    moedaToken.transferOwnership(_newOwner);
  }

  /// @dev issue tokens (e.g. for fiat donations)
  /// @param recipient address that receives tokens
  /// @param amount number of tokens to be issued
  /// Note: this can still be called after the public sale has ended as we want
  /// to allow bitcoin suisse ample time to finish their allocations
  function issue(address recipient, uint256 amount)
  notFinalised onlyIssuer notPaused {
    require(amount > 0);
    uint256 newTotal = tokensIssued.add(amount);
    require(newTotal <= ISSUER_CAP);

    tokensIssued = newTotal;
    totalTokensSold = totalTokensSold.add(amount);
    moedaToken.create(recipient, amount);

    LogIssuance(msg.sender, recipient, amount);
  }

  /// @dev amount of tokens issued for direct ether donations
  function publicIssued() constant returns (uint256) {
    return totalTokensSold.sub(tokensIssued);
  }

  /// @dev issue tokens in return for received ether
  /// @param recipient address that receives tokens
  // Usable directly in order to allow someone to donate and issue tokens
  // to a specified address
  function donate(address recipient)
  payable onlyDuringSale notPaused notIssuer {
    require(msg.value >= DUST_LIMIT);
    require(msg.sender != wallet);
    var (tokenAmount, available) = getAvailable(msg.value);
    processDonation(recipient, available, tokenAmount);
  }

  /// @dev process a donation
  /// @param recipient an address that will receive tokens
  /// @param amount the amount (in Ether) to spend
  /// @param tokenAmount the number of tokens to issue
  function processDonation(address recipient, uint256 amount, uint256 tokenAmount) internal {
    require(recipient != address(0));
    require(amount > 0 && amount <= msg.value);

    etherReceived = etherReceived.add(amount);
    totalTokensSold = totalTokensSold.add(tokenAmount);
    moedaToken.create(recipient, tokenAmount);

    LogDonation(recipient, amount, tokenAmount);

    wallet.transfer(amount);

    // we could not honour the full amount, so the difference is refunded
    // some contracts with high gas fallback functions will fail here due to
    // limited gas
    if (amount < msg.value) {
      msg.sender.transfer(msg.value.sub(amount));
    }
  }

  // Normally donors will use this function to contribute by just sending ether
  // donate() checks conditions, no need to do it here as well
  function () payable {
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

  /// @dev determine if all tokens have been sold
  /// @return whether tokens are sold out
  function isSoldOut() constant returns (bool) {
    // safemath doesn't make sense here
    return PUBLIC_CAP + ISSUER_CAP == totalTokensSold;
  }

  /// @dev finalise the crowdsale manually and unlock token transfers
  /// this will only be successful if:
  /// 1. Not already finalised, or
  /// 2. endBlock has been reached, or
  /// 3. the cap has been reached, or
  /// 4. the remaining amount to be sold in Ether is below the dust limit
  function finalise() onlyOwner notPaused {
    require(block.number > startBlock);
    require(!finalised);

    // If all tokens have been sold before the endBlock we can allow it to end
    require(block.number > endBlock || isSoldOut());

    // create and assign presale and advisor token allocations
    moedaToken.create(PRESALE_WALLET, PRESALE_TOKEN_ALLOCATION);

    // unlock tokens for spending
    moedaToken.unlock();
    finalised = true;
    LogFinalisation();
  }

  /// @dev Drain tokens that were sent here by mistake
  /// because people will.
  /// @param _token address of token to transfer
  /// @param _to address where tokens will be transferred
  function drainToken(address _token, address _to) onlyOwner {
    require(_token != address(0));
    require(_to != address(0));

    ERC20 token = ERC20(_token);
    uint256 balance = token.balanceOf(this);
    token.transfer(_to, balance);
    LogTokenDrain(_token, _to, balance);
  }

  /// @dev Stop in the event of an emergency
  function pause() onlyOwner onlyDuringSale notPaused {
    isPaused = true;
    LogPause();
  }

  /// @dev Restart after it has been paused
  function unpause() onlyOwner onlyDuringSale {
    require(isPaused);
    isPaused = false;
    LogUnpause();
  }
}
