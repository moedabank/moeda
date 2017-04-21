import 'zeppelin/SafeMath.sol';
import 'zeppelin/ownership/Ownable.sol';
import './MoedaToken.sol';
import 'zeppelin/MultisigWallet.sol';

pragma solidity ^0.4.8;

contract Crowdsale is Ownable, SafeMath {
    MultisigWallet public wallet; // recipient of all crowdsale funds
    MoedaToken public moedaToken; // token that will be sold during sale
    uint256 public etherReceived;       // total ether received
    uint256 public totalTokensSold;     // number of tokens sold
    uint256 public startBlock;          // block where sale starts
    uint256 public endBlock;            // block where sale ends
    mapping (address => uint256) public donors;
    
    // smallest possible donation
    uint256 public constant MINIMUM_BUY = 1 ether;

    // token creation rates
    uint256 public constant TIER0_RATE  = 2 finney;
    uint256 public constant TIER1_RATE  = 6 finney;
    uint256 public constant TIER2_RATE  = 8 finney;
    uint256 public constant TIER3_RATE  = 10 finney;

    // limits for each pricing tier (how much can be bought)
    uint256 public constant TIER0_CAP = 10000 ether;
    uint256 public constant TIER1_CAP = 30000 ether;
    uint256 public constant TIER2_CAP = 40000 ether;
    uint256 public constant ETHER_CAP = 50000 ether; // Total ether cap


    modifier onlyDuringSale() {
        if (block.number < startBlock) {
            throw;
        }
        if (block.number >= endBlock) {
            throw;
        }
        _;
    }

    // Initialize a new Crowdsale contract
    // @param _wallet address of multisig wallet that will store received ether
    // @param _startBlock block at which to start the sale
    // @param _endBlock block at which to end the sale
    function Crowdsale(address _wallet, uint _startBlock, uint _endBlock) {
        if (_wallet == address(0)) throw;
        if (_startBlock <= block.number) throw;
        if (_endBlock <= _startBlock) throw;
        
        wallet = MultisigWallet(_wallet);
        moedaToken = new MoedaToken();
        startBlock = _startBlock;
        endBlock = _endBlock;
    }

    // Determine the lowest rate to acquire tokens given an amount of donated
    // ethers
    // @param totalReceived amount of ether that has been received
    function getLimitAndRate(uint256 totalReceived)
    constant returns (uint256, uint256) {
        uint256 limit = 0;
        uint256 rate = 0;

        if (totalReceived < TIER0_CAP) {
            limit = TIER0_CAP;
            rate = TIER0_RATE;
        }
        else if (totalReceived < TIER1_CAP) {
            limit = TIER1_CAP;
            rate = TIER1_RATE;
        }
        else if (totalReceived < TIER2_CAP) {
            limit = TIER2_CAP;
            rate = TIER2_RATE;
        }
        else if (totalReceived < ETHER_CAP) {
            limit = ETHER_CAP;
            rate = TIER3_RATE;
        } else {
            throw; // this shouldn't happen
        }

        return (limit, rate);
    }

    // Determine how many tokens we can get from each pricing tier, in case a
    // donation's amount overlaps multiple pricing tiers.
    // 1. determine cheapest token price
    // 2. determine how many tokens can be bought at this price
    // 3. subtract spent ether from requested amount
    // 4. if there is any ether left, start over from 1, with the remaining ether
    // 5. return the amount of tokens bought
    // @param totalReceived ether received by contract plus spent by this donation
    // @param requestedAmount total ether to spend on tokens in a donation
    function getTokenAmount(uint256 totalReceived, uint256 requestedAmount) 
    constant returns (uint256) {
        if (requestedAmount == 0) return 0;
        uint256 limit = 0;
        uint256 rate = 0;
        (limit, rate) = getLimitAndRate(totalReceived);

        uint256 maxETHSpendableInTier = safeSub(limit, totalReceived);
        uint256 amountToSpend = min256(maxETHSpendableInTier, requestedAmount);
        uint256 tokensToReceiveAtCurrentPrice = safeDiv(amountToSpend, rate);
        uint256 additionalTokens = getTokenAmount(
            safeAdd(totalReceived, amountToSpend),
            safeSub(requestedAmount, amountToSpend));

        return safeAdd(tokensToReceiveAtCurrentPrice, additionalTokens);
    }

    // Used while the crowdsale is active to trade ether for tokens
    function buy() payable onlyDuringSale {
        if (msg.value < MINIMUM_BUY) throw;
        if (safeAdd(etherReceived, msg.value) > ETHER_CAP) throw;
        if (!wallet.send(msg.value)) throw;

        uint256 tokenAmount = getTokenAmount(etherReceived, msg.value);

        if (!moedaToken.create(msg.sender, tokenAmount)) throw;
        etherReceived = safeAdd(etherReceived, msg.value);
        totalTokensSold = safeAdd(totalTokensSold, tokenAmount);
    }

    // always throw, this will prevent sending ether from an exchange
    function () {
        throw;
    }
}
