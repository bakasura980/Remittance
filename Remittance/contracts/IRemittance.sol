pragma solidity ^0.4.16;

interface IRemittance {
     function withdrawSecure(string pass1, string pass2) external;
     function to() public view returns(address toAddress);
     function owner() public view returns(address ownerAddress);
     function currency() public view returns(bytes4 remittanceCurrency);
     function exchangeShop() public view returns(address exchangeShopAddr);
}