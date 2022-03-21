import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { BigNumber } from "ethers";
import { ethers } from "hardhat";
import {
  IUniswapV2Router02,
  IUniswapV2Router02__factory,
  TestUniswapFlashSwap,
  TestUniswapFlashSwap__factory,
} from "../typechain";
import { IERC20__factory } from "../typechain/factories/IERC20__factory";
import { IERC20 } from "../typechain/IERC20";

const DAI = "0x6B175474E89094C44Da98b954EedeAC495271d0F";
const USDT = "0xdAC17F958D2ee523a2206206994597C13D831ec7";
const WETH = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
const ROUTER = "0x7a250d5630b4cf539739df2c5dacb4c659f2488d";

describe("TestUniswapFlashSwap", () => {
  const TOKEN_BORROW = DAI;
  const FUND_AMOUNT = ethers.utils.parseEther("2000000");
  const BORROW_AMOUNT = ethers.utils.parseEther("1000000");

  let testUniswapFlashSwap: TestUniswapFlashSwap;
  let token: IERC20, usdt_token: IERC20;
  let deployer: SignerWithAddress, user: SignerWithAddress;

  let sushi_router: IUniswapV2Router02;
  beforeEach(async () => {
    [deployer, user] = await ethers.getSigners();
    token = IERC20__factory.connect(TOKEN_BORROW, ethers.provider);
    usdt_token = IERC20__factory.connect(USDT, ethers.provider);
    const TestUniswapFlashSwap: TestUniswapFlashSwap__factory =
      new TestUniswapFlashSwap__factory(deployer);
    testUniswapFlashSwap = await TestUniswapFlashSwap.deploy();

    sushi_router = IUniswapV2Router02__factory.connect(ROUTER, ethers.provider);

    const amounts = await sushi_router.getAmountsIn(FUND_AMOUNT, [
      WETH,
      token.address,
    ]);
    await sushi_router
      .connect(deployer)
      .swapETHForExactTokens(
        FUND_AMOUNT,
        [WETH, token.address],
        testUniswapFlashSwap.address,
        BigNumber.from(60 * 10).add(Date.now()),
        {
          from: deployer.address,
          value: amounts[0],
        }
      );
  });

  it("flash swap", async () => {
    const tx = await testUniswapFlashSwap
      .connect(user)
      .startFlashloan(token.address, BORROW_AMOUNT);
    const receipt = await tx.wait();
    const flashswap_events = receipt.events?.find(
      (event) => event.event === "FlashSwap"
    );
    if (flashswap_events?.args) {
      const [token_received, amount_received] = flashswap_events.args;
      console.log(`Flashloan result: ${token_received}, ${amount_received}`);
    }
    const payback_events = receipt.events?.find(
      (event) => event.event === "Payback"
    );
    if (payback_events?.args) {
      const [token_repay, amount_repay] = payback_events.args;
      console.log(`Payed back: ${token_repay}, ${amount_repay}`);
    }
    console.log(
      `USDT amount: ${await usdt_token.balanceOf(testUniswapFlashSwap.address)}`
    );
  });
});
