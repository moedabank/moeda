import 'zeppelin/SafeMath.sol';
import 'zeppelin/ownership/Ownable.sol';
import './MoedaToken.sol';

pragma solidity ^0.4.8;

contract AllotmentSale is Ownable, SafeMath {
    uint256 public constant TOTAL_SUPPLY = 20000000 ether;
    uint256 public constant ICO_ALLOTMENT = 15000000 ether;
    uint256 public constant PRE_ALLOTMENT = 5000000 ether;
    uint256 public totalReceived;
    uint256 public totalClaimed;
    uint256 public startBlock;
    uint256 public endBlock;
    MoedaToken public moedaToken;
    address public wallet;
    mapping (address => uint) public donations;

    modifier isCrowdfundPeriod() {
        if (block.number < startBlock) {
            throw;
        }
        if (block.number >= endBlock) {
            throw;
        }
        _;
    }

    modifier saleCompleted() {
        if (block.number < endBlock) {
            throw;
        }
        _;
    }

    modifier onlyDonor() {
        if (donations[msg.sender] == 0) {
            throw;
        }
        _;
    }

    /// @param _wallet address of multisig wallet that will receive donations
    /// @param _startBlock block number when sale starts
    /// @param _endBlock block number when sale ends
    function AllotmentSale(
        address _wallet,
        uint256 _startBlock,
        uint256 _endBlock
    ) {
        owner = msg.sender;
        if (_wallet == address(0)) throw;
        if (_startBlock <= block.number) throw;
        if (_endBlock <= _startBlock) throw;

        startBlock = _startBlock;
        endBlock = _endBlock;
        wallet = _wallet;
        moedaToken = new MoedaToken(this, TOTAL_SUPPLY);
    }

    function isSaleCompleted() constant returns (bool) {
        return block.number >= endBlock;
    }

    /// Place a bid for tokens, the amount received is based on bid amount 
    /// divided by total bids (in Ether) once sale has completed
    /// e.g. Bob bids 5 ETH and total amount bid by everyone once sale completed
    /// was 100 ETH, that means he gets (5 / 100) * ICO_ALLOMENT tokens, a.k.a.
    /// 750,000 tokens.
    /// Transfer bid value to multi-signature wallet immediately
    function placeBid() isCrowdfundPeriod payable {
        if (msg.value == 0) {
            throw;
        }

        if (!wallet.send(msg.value)) throw;
        totalReceived = safeAdd(totalReceived, msg.value);
        donations[msg.sender] = msg.value;
    }

    function estimateAllotment(address owner) constant returns (uint256) {
        if(donations[owner] == 0) {
            return 0;
        }

        return safeDiv(
            safeMul(donations[owner], ICO_ALLOTMENT), totalReceived);
    }

    /// Claim tokens that were won during the auction.
    /// @param grantee address that will receive tokens
    function claim(address grantee) saleCompleted onlyDonor {
        if (grantee == address(0)) {
            grantee = msg.sender;
        }

        uint256 tokenCount = estimateAllotment(msg.sender);
        donations[grantee] = 0;
        totalClaimed = safeAdd(totalClaimed, tokenCount);
        if (!moedaToken.transfer(grantee, tokenCount)) throw;
    }

    /// Default function executed when sending to contract without arguments
    /// always throw, to prevent people from sending coins from an exchange
    function() {
        throw;
    }
}