import 'zeppelin/token/StandardToken.sol';
import 'zeppelin/ownership/Ownable.sol';

pragma solidity ^0.4.8;

contract MoedaToken is StandardToken, Ownable {
    string public constant name = "Moeda Loalty Points";
    string public constant symbol = "MLO";
    uint8 public constant decimals = 18;
    uint public constant MAX_TOKENS = 20000000 ether;
    bool public locked;

    // determine whether transfers can be made
    modifier onlyAfterSale() {
        if (locked) {
            throw;
        }
        _;
    }

    modifier onlyDuringSale() {
        if (!locked) {
            throw;
        }
        _;
    }

    // Create moeda token, set 
    function MoedaToken() {
        locked = true;
    }

    // called manually once sale has ended, this will unlock transfers
    function unlock() onlyOwner {
        locked = false;
    }

    function create(address recipient, uint256 amount) onlyOwner onlyDuringSale returns(bool) {
        if (amount == 0) throw;
        if (totalSupply + amount > MAX_TOKENS) throw;

        balances[recipient] = safeAdd(balances[recipient], amount);
        totalSupply = safeAdd(totalSupply, amount);
        Transfer(0, recipient, amount);
        return true;
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