import 'zeppelin/token/StandardToken.sol';
import 'zeppelin/ownership/Ownable.sol';
import './AllotmentSale.sol';

pragma solidity ^0.4.8;

contract MoedaToken is StandardToken, Ownable {
    string public constant name = "Moedas";
    string public constant symbol = "MOE";
    uint8 public constant decimals = 18;
    uint public constant MAX_TOKENS = 20000000 ether;
    AllotmentSale public allotmentSale;

    modifier isSaleOver() {
        if (!allotmentSale.isSaleCompleted()) {
            throw;
        }
        _;
    }

    function MoedaToken(address _allotmentSale, uint supply) {
        if (_allotmentSale == address(0)) throw;
        if (supply == 0 || supply > MAX_TOKENS) throw;
 
        allotmentSale = AllotmentSale(_allotmentSale);
        totalSupply = supply;
        balances[_allotmentSale] = totalSupply;
    }

    function transfer(address _to, uint _value) isSaleOver returns (bool) {
        return super.transfer(_to, _value);
    }

    function transferFrom(address from, address to, uint value) isSaleOver 
    returns (bool)
    {
        return super.transferFrom(from, to, value);
    }
}