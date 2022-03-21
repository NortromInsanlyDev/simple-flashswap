pragma solidity ^0.6.6;

import "./UniswapV2Library.sol";
import "./interfaces/IUniswapV2Router02.sol";
import "./interfaces/IUniswapV2Pair.sol";
import "./interfaces/IUniswapV2Factory.sol";
import "./interfaces/IUniswapV2Callee.sol";

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "hardhat/console.sol";


contract TestUniswapFlashSwap is IUniswapV2Callee {

  address private constant WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;

  address private constant FACTORY = 0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f;

  address private constant USDT   = 0xdAC17F958D2ee523a2206206994597C13D831ec7;

  address private constant ROUTER = 0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D;

  event FlashSwap(address token, uint amount);
  
  event Payback(address token, uint amount);

  function startFlashloan(address _tokenBorrow, uint _amount) external {
    address pair = IUniswapV2Factory(FACTORY).getPair(_tokenBorrow, WETH);
    require(pair != address(0), "Pair doesn't exist");

    address token0 = IUniswapV2Pair(pair).token0();
    address token1 = IUniswapV2Pair(pair).token1();
    uint amount0Out = _tokenBorrow == token0 ? _amount : 0;
    uint amount1Out = _tokenBorrow == token1 ? _amount : 0;

    bytes memory data = abi.encode(_tokenBorrow, _amount);

    IUniswapV2Pair(pair).swap(amount0Out, amount1Out, address(this), data);
  }

  function uniswapV2Call(
    address _sender,
    uint _amount0,
    uint _amount1,
    bytes calldata _data
  ) external override {
    address token0 = IUniswapV2Pair(msg.sender).token0();
    address token1 = IUniswapV2Pair(msg.sender).token1();
    address pair = IUniswapV2Factory(FACTORY).getPair(token0, token1);
    require(msg.sender == pair, "!pair");
    require(_sender == address(this), "!sender");

    (address tokenBorrow, uint amount) = abi.decode(_data, (address, uint));

    // calculate fee
    uint fee = ((amount * 3) / 997) + 1;
    uint amountToRepay = amount + fee;

    emit FlashSwap(tokenBorrow, amount);

    swapToUSDT(tokenBorrow, amount);

    IERC20(tokenBorrow).transfer(pair, amountToRepay);
    emit Payback(tokenBorrow, amountToRepay);
  }

  function swapToUSDT(address token, uint amount) internal {
    address[] memory path = new address[](2);
    path[0] = token;
    path[1] = USDT;
    uint[] memory amountsOut = UniswapV2Library.getAmountsOut(FACTORY, amount, path);
    IERC20(token).approve(ROUTER, amount);
    IUniswapV2Router02(ROUTER).swapExactTokensForTokensSupportingFeeOnTransferTokens(amount, amountsOut[1], path, address(this), block.timestamp + 60);
  }
}