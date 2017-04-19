import 'zeppelin/token/StandardToken.sol';
import 'zeppelin/ownership/Ownable.sol';
import './AllotmentSale.sol';

pragma solidity ^0.4.8;

contract MoedaToken is StandardToken, Ownable {
    string public constant name = "Moedas";
    string public constant symbol = "MOE";
    uint8 public constant decimals = 18;
    uint public constant MAX_TOKENS = 20000000 ether;
    bool public locked;
    AllotmentSale public allotmentSale;

    // determine whether transfers can be made
    modifier onlyAfterSale() {
        if (locked) {
            throw;
        }
        _;
    }

    // @param _allotmentSale address of parent crowdsale contract
    // @param supply total amount of tokens to create
    function MoedaToken(address _allotmentSale, uint supply) {
        if (_allotmentSale == address(0)) throw;
        if (supply == 0 || supply > MAX_TOKENS) throw;
 
        allotmentSale = AllotmentSale(_allotmentSale);
        totalSupply = supply;
        balances[_allotmentSale] = totalSupply;
        locked = true;
    }

    // called manually once sale has ended, this will unlock transfers
    function unlock() onlyOwner {
        locked = false;
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