pragma solidity ^0.4.16;
import "./IRemittance.sol";
import "./IExchangeShop.sol";

contract ExchangeShop is IExchangeShop {

    struct Remittance {
        address remittanceAddress;  
        bool isExistant;     
    }

    uint    public constant REMITTANCE_FEE = 50000 wei;
    address public owner;
    address private payableRemittance;
    uint    private exchangeShopMoney;

    mapping(address => uint) public unlockedRemittances;
    mapping(bytes4 => uint) public currencies;
    mapping(bytes32 => Remittance) private remittances;

    event LogAddedRemmitance(address remittanceOwner, address remittanceAddress);
    event LogAddedCurrency(bytes4 name, uint commission);
    event LogUnlockUnTrusted(uint unlockedAmount, uint feeForGiving);
    event LogTrusted(uint unlockedAmount);
    event LogWithdrawExchangeShopMoney(uint withdrawnMoney);
    event LogWithdrawFunds(address withdrawer, uint withdrawnAmount);
    event LogDestruction(address destroyer);

    modifier onlyOwner(){
        require(msg.sender == owner);
        _;
    }

    modifier onlyValidAddress(address _address) {
        require(_address != address(0));
        _;
    }

    modifier requiredCommission(uint commission){
        require(commission >= 3);
        _;
    }

    modifier onlyInExistentCurrency(bytes4 name){
        require(currencies[name] == uint(0) && name.length > 0);
        _;
    }

    modifier requireFee(){
        if (msg.sender != owner) {
            require(msg.value == REMITTANCE_FEE);
        }
        _;
    }

    modifier onlyInExistentRemittance(bytes32 key){
        require(!remittances[key].isExistant);
        _;
    }

    modifier onlyThisShop(address remittanceAddr){
        IRemittance remittance = IRemittance(remittanceAddr);
        require(address(remittance.exchangeShop()) == address(this));
        _;
    }

    modifier onlyExistentRemittance(string pass1, string pass2){
        require(remittances[keccak256(pass1, pass2)].isExistant);
        _;
    }

    modifier onlyPositive(uint amount){
        require(amount > 0);
        _;
    }

    function ExchangeShop() public {
        owner = msg.sender;
    }

    function addCurrency(bytes4 name, uint commission) public onlyOwner requiredCommission(commission) onlyInExistentCurrency(name) {
        currencies[name] = commission;    

        LogAddedCurrency(name, currencies[name]);
    }

    function addRemittance(address remittance, bytes32 key) public payable 
            requireFee onlyValidAddress(remittance) onlyInExistentRemittance(key) onlyThisShop(remittance)
    {
        remittances[key] = Remittance({remittanceAddress: remittance, isExistant: true});
        
        LogAddedRemmitance(msg.sender, remittances[key].remittanceAddress);
    }


    function unlockUnTrustedRemittance(string pass1, string pass2) public onlyOwner onlyExistentRemittance(pass1, pass2) {
        uint balanceBeforeUnlock = this.balance;
        bytes32 key;
        IRemittance remittance;
        (key, remittance) = unlock(pass1, pass2);

        if (payableRemittance == remittances[key].remittanceAddress) {
            addUnlockedRemittance(remittance, false, balanceBeforeUnlock);
            unlockedRemittances[remittance.owner()] += REMITTANCE_FEE;
        }else {
            exchangeShopMoney += REMITTANCE_FEE;
        }

        delete(remittances[key]);
        LogUnlockUnTrusted(unlockedRemittances[remittance.to()], unlockedRemittances[remittance.owner()]);
    } 

    function unlockTrustedRemittance(string pass1, string pass2) public onlyOwner onlyExistentRemittance(pass1, pass2) {
        uint balanceBeforeUnlock = this.balance;
        bytes32 key;
        IRemittance remittance;
        (key, remittance) = unlock(pass1, pass2);
        addUnlockedRemittance(remittance, true, balanceBeforeUnlock);

        delete(remittances[key]);
        LogTrusted(unlockedRemittances[remittance.to()]);
    }

    function unlock(string pass1, string pass2) private returns(bytes32 remittanceKey, IRemittance remittanceInstance) {
        require(bytes(pass1).length > 0);
        require(bytes(pass2).length > 0);

        bytes32 key = keccak256(pass1, pass2);
        IRemittance remittance = IRemittance(remittances[key].remittanceAddress);
        remittance.withdrawSecure(pass1, pass2);

        return (key, remittance);
    }

    function addUnlockedRemittance(IRemittance remittance, bool isTrusted, uint balanceBeforeUnlock) private {
        unlockedRemittances[remittance.to()] += calcMoneyWithCommission(
                                                                            this.balance - balanceBeforeUnlock,
                                                                            remittance.currency(),
                                                                            isTrusted
                                                                       );
    }

    function calcMoneyWithCommission(uint amount, bytes4 currency, bool isTrusted) private returns(uint convertedAmount) {
        uint commission = isTrusted ? currencies[currency] - 2 : currencies[currency];
        exchangeShopMoney += commission;
        return amount - commission;
    }

    function withdrawExchangeShopMoney() public onlyOwner onlyPositive(exchangeShopMoney) {
        uint currentMoney = exchangeShopMoney;
        exchangeShopMoney = 0;
        owner.transfer(currentMoney);

        LogWithdrawExchangeShopMoney(currentMoney);
    }

    function withdraw() public onlyPositive(unlockedRemittances[msg.sender]) {
        uint remittanceAmount = unlockedRemittances[msg.sender];
        unlockedRemittances[msg.sender] = 0;
        msg.sender.transfer(remittanceAmount);
        
        LogWithdrawFunds(msg.sender, remittanceAmount);
    }

    function destroy() public onlyOwner {
        LogDestruction(msg.sender);

        selfdestruct(owner);
    }

    function transferRemittanceAmount() external payable {
        payableRemittance = msg.sender;
    }  
}