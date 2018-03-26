pragma solidity ^0.4.16;
import "./IRemittance.sol";
import "./IExchangeShop.sol";

contract Remittance is IRemittance {

    address private contractOwner;
    address private toWhom;
    bytes4  private currencyName;
    bytes32 private key;
    IExchangeShop private shop;
    uint    public deadline;
    uint    private constant DURATION_LIMIT = 10;

    event LogSecureWithdraw(uint currentBalance);
    event LogWitdrawFunds(uint on);
    event LogSetExchangeShop(address exchangeShopAddr);
    event LogDestruction(address destroyer);

    modifier onlyOwner(){
        require(msg.sender == contractOwner);
        _;
    }

    modifier onlyValidDuration(uint duration){
        require(duration > 0 && duration <= DURATION_LIMIT);
        _;
    }

    modifier onlyValidCurrency(bytes4 currency) {
        require(currency != bytes4(0));
        _;
    }

    modifier onlyValidTo(address to){
        require(to != address(0));
        _;
    }

    modifier onlyValidKey(string pass1, string pass2){
        require(keccak256(pass1, pass2) == key);
        _;
    }

    modifier onlyExchangeShop(){
        require(msg.sender == address(shop));
        _;
    }

    modifier onlyAfterDeadline(){
        require(block.number > deadline);
        _;
    }

    function Remittance(address to, uint duration, bytes4 currency, string pass1, string pass2) public payable 
            onlyValidDuration(duration) onlyValidCurrency(currency) onlyValidTo(to)
    { 
        require(bytes(pass1).length > 0);
        require(bytes(pass2).length > 0);

        contractOwner = msg.sender;
        toWhom = to;
        deadline = block.number + duration;
        currencyName = currency;
        key = keccak256(pass1, pass2);
    }

    function setExchangeShop(address exchangeShopAddr) public onlyOwner {
        shop = IExchangeShop(exchangeShopAddr);
        LogSetExchangeShop(shop);
    }

    function withdrawSecure(string pass1, string pass2) external onlyExchangeShop onlyValidKey(pass1, pass2) {
        shop.transferRemittanceAmount.value(this.balance)();

        LogSecureWithdraw(this.balance);
    }

    function withdrawFunds() public onlyOwner onlyAfterDeadline {
        contractOwner.transfer(this.balance);
        LogWitdrawFunds(block.number);
    }

    function getKey() public view onlyOwner returns(bytes32 remittanceKey) {
        return key;
    }

    function to() public view returns(address toAddress) { return toWhom; }
    function owner() public view returns(address ownerAddress) { return contractOwner; }
    function currency() public view returns(bytes4 remittanceCurrency) { return currencyName; }
    function exchangeShop() public view returns(address exchangeShopAddr) { return shop; }

    function destroy() public onlyOwner {
        LogDestruction(contractOwner);
        selfdestruct(contractOwner);
    }
}