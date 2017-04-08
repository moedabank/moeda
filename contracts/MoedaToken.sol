import 'zeppelin/token/StandardToken.sol';
import 'zeppelin/ownership/Ownable.sol';
import './AllotmentSale.sol';

pragma solidity ^0.4.8;

contract MoedaToken is StandardToken, Ownable {
    string public constant name = "MoedaToken";
    string public constant symbol = "MOE";
    uint8 public constant decimals = 18;
    AllotmentSale public allotmentSale;

    modifier isSaleOver() {
        if (!allotmentSale.isSaleCompleted()) {
            throw;
        }
        _;
    }

    function MoedaToken(address _allotmentSale, uint supply) {
        if (_allotmentSale == 0) throw;
        allotmentSale = AllotmentSale(_allotmentSale);
        totalSupply = supply;
        balances[_allotmentSale] = totalSupply;
    }

    function transfer(address _to, uint _value) isSaleOver returns(bool) {
        return super.transfer(_to, _value);
    }
}