const { expect } = require("chai");
const { BigNumber } = require("ethers");

const { parseUnits } = require("ethers/lib/utils");
const { ethers, network } = require("hardhat");

const DAI = "0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063";
const WETH = "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619";

// DAI_daiWHALE must be an account, not contract
const daiWHALE = "0x1a34edac6ab1cf8fe609f163d798c8644636c7dd";
const wethWHALE = "0xCe2CC46682E9C6D5f174aF598fb4931a9c0bE68e";

var MAKER;

describe("Multiple User Replication", () => {
  let accounts;
  let dai;
  let daiwhale;
  let weth;
  let wethwhale;

  // libraries
  let Statslib;
  let HedgeMathlib;
  let BSlib;

  // main
  let optionmaker;

  // storage;
  let optionstorage;

  // periphery
  let bsoptionmaker;

  before(async () => {
    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [daiWHALE],
    });

    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [wethWHALE],
    });

    daiwhale = await ethers.getSigner(daiWHALE);
    dai = await ethers.getContractAt("IERC20", DAI);

    wethwhale = await ethers.getSigner(wethWHALE);
    weth = await ethers.getContractAt("IERC20", WETH);

    accounts = await ethers.getSigners();
  });

  it("Should deploy libraries: ", async () => {
    signers = await ethers.getSigners();

    const Statistics = await ethers.getContractFactory("Statistics");
    Statslib = await Statistics.deploy();
    await Statslib.deployed();

    // @dev deploy HedgeMath.sol
    const HedgeMath = await ethers.getContractFactory("HedgeMath");
    HedgeMathlib = await HedgeMath.deploy();
    await HedgeMathlib.deployed();

    // @dev deploy Black Scholes model library
    const BS = await ethers.getContractFactory("BS", {
      signer: signers[0],
      libraries: {
        Statistics: Statslib.address,
      },
    });
    BSlib = await BS.deploy();
    await BSlib.deployed();
  });

  it("Should deploy storage", async () => {
    // @dev Deploying storage
    const OptionStorage = await ethers.getContractFactory("OptionStorage", {
      signer: signers[0],
    });
    // @dev accounts 1 & 2 are fillers
    optionstorage = await OptionStorage.deploy();
    await optionstorage.deployed();
    console.log("storage address:", optionstorage.address);
  });

  it("Should deploy periphery", async () => {
    // ######## @dev deploying periphery contracts Contracts ###########
    const BSOptionMaker = await ethers.getContractFactory("BSMOptionMaker", {
      signer: signers[0],
      libraries: {
        BS: BSlib.address,
        HedgeMath: HedgeMathlib.address,
      },
    });
    bsoptionmaker = await BSOptionMaker.deploy(DAI);
    await bsoptionmaker.deployed();

    console.log("periphery:", bsoptionmaker.address);

  });

  it("Should deploy main", async () => {
    // @dev Deploying main
    const OptionMaker = await ethers.getContractFactory("OptionMaker", {
      signer: signers[0],
      libraries: {
        BS: BSlib.address,
        HedgeMath: HedgeMathlib.address,
      },
    });
    optionmaker = await OptionMaker.deploy(
      optionstorage.address,
      bsoptionmaker.address,
      DAI
    );
    await optionmaker.deployed();

    console.log("core address:", optionmaker.address);
  });

  it("Should set core and periphery addresses in storage", async () => {
    let tx = await optionstorage
      .connect(accounts[0])
      .setCoreAddr(optionmaker.address);
    tx.wait();

    let tx1 = await optionstorage
      .connect(accounts[0])
      .setPeripheryAddr(
        bsoptionmaker.address
      );
    tx1.wait();
  });

  it("Should set addresses inside periphery", async () => {
    // bs
    await bsoptionmaker
      .connect(accounts[0])
      .setStorageAddr(optionstorage.address);

    let storageAddr = await bsoptionmaker.connect(accounts[0]).getStorageAddr();
    console.log("storage addr: ", storageAddr);

    await bsoptionmaker.connect(accounts[0]).setCoreAddr(optionmaker.address);

    let coreAddr = await bsoptionmaker.connect(accounts[0]).getCoreAddr();
    console.log("core addr: ", coreAddr);


    await bsoptionmaker.connect(accounts[0]).initAvailablePairs(WETH, DAI);
  });

  it("Should unlock dai", async () => {
    const amount = await dai.balanceOf(daiWHALE);
    const value = ethers.BigNumber.from(amount);
    console.log("DAI balance of whale", await ethers.utils.formatEther(value));

    await dai.connect(daiwhale).transfer(accounts[0].address, amount);
    expect(await dai.balanceOf(accounts[0].address)).to.gte(amount);
    signer = (await ethers.getSigners())[0];

    await dai.connect(signer, accounts[0]).approve(optionmaker.address, amount);

    expect(
      await dai.allowance(accounts[0].address, optionmaker.address)
    ).to.gte(amount);

    const amount1 = await dai.balanceOf(accounts[0].address);
    const value1 = ethers.BigNumber.from(amount1);

    console.log(
      "DAI balance of account",
      await ethers.utils.formatEther(value1)
    );

  });

  it("Should unlock weth", async () => {
    const amount = await weth.balanceOf(wethWHALE);
    const value = ethers.BigNumber.from(amount);
    console.log("weth balance of whale", await ethers.utils.formatEther(value));

    await weth.connect(wethwhale).transfer(accounts[0].address, amount);
    expect(await weth.balanceOf(accounts[0].address)).to.gte(amount);
    signer = (await ethers.getSigners())[0];

    await weth.connect(signer, accounts[0]).approve(optionmaker.address, amount);

    expect(
      await weth.allowance(accounts[0].address, optionmaker.address)
    ).to.gte(amount);

    const amount1 = await weth.balanceOf(accounts[0].address);
    const value1 = ethers.BigNumber.from(amount1);

    console.log(
      "weth balance of account",
      await ethers.utils.formatEther(value1)
    );

  });

  it("Position 1: BS Call replication: ", async () => {
    // input to JDM start replication
    let tokenA_balance = "5000";
    let amount = "1";
    let fee = "400";
    let perDay = "24";
    let K = "1400";
    let T = "0.3";
    let r = "0.15";
    let sigma = "0.8";

    tokenA_balance = ethers.utils.parseUnits(tokenA_balance);
    amount = ethers.utils.parseUnits(amount);
    fee = ethers.utils.parseUnits(fee);

    perDay = ethers.utils.parseUnits(perDay, "wei");

    K = ethers.utils.parseUnits(K);
    T = ethers.utils.parseUnits(T);
    r = ethers.utils.parseUnits(r);
    sigma = ethers.utils.parseUnits(sigma);

    const input = [
      DAI,
      WETH,
      tokenA_balance,
      0,
      true,
      true,
      amount,
      0,
      fee,
      perDay,
      0,
      0,
      [K, T, r, sigma],
    ];

    const tx = await optionmaker
      .connect(accounts[0])
      .BS_START_REPLICATION(input);
    // wait until the transaction is mined
    await tx.wait();

    const pair = await optionstorage.getPair(DAI, WETH);
    console.log("address of pair:", pair);

    expect(await optionstorage.getPairUserAddress(pair, 0)).to.equal(
      accounts[0].address
    );
  });

  it("Position 2: BS Put replication: ", async () => {
    // input to JDM start replication

    let tokenB_balance = "4";
    let amount = "1";
    let fee = "1000";
    let perDay = "12";
    let K = "2000";
    let T = "0.5";
    let r = "0.11";
    let sigma = "0.95";

    tokenB_balance = ethers.utils.parseUnits(tokenB_balance);
    amount = ethers.utils.parseUnits(amount);
    fee = ethers.utils.parseUnits(fee);
    perDay = ethers.utils.parseUnits(perDay, "wei");
    K = ethers.utils.parseUnits(K);
    T = ethers.utils.parseUnits(T);
    r = ethers.utils.parseUnits(r);
    sigma = ethers.utils.parseUnits(sigma);

    const input = [
      DAI,
      WETH,
      0,
      tokenB_balance,
      false,
      true,
      amount,
      0,
      fee,
      perDay,
      0,
      0,
      [K, T, r, sigma],
    ];

    const tx = await optionmaker
      .connect(accounts[0])
      .BS_START_REPLICATION(input);
    // wait until the transaction is mined
    await tx.wait();

    const pair = await optionstorage.getPair(DAI, WETH);
    console.log("address of pair:", pair);

    expect(await optionstorage.getPairUserAddress(pair, 0)).to.equal(
      accounts[0].address
    );
  });

  it("Change time: ", async () => {
    // getting timestamp
    const blockNumBefore = await ethers.provider.getBlockNumber();
    const blockBefore = await ethers.provider.getBlock(blockNumBefore);

    const currenttimestamp = blockBefore.timestamp;
    console.log("timenow", currenttimestamp);

    // await ethers.provider.send("evm_mine", [newTimestampInSeconds]);

    await hre.ethers.provider.send("evm_increaseTime", [24 * 60 * 60]);
    await network.provider.send("evm_mine");

    const blockNumBefore1 = await ethers.provider.getBlockNumber();
    const blockBefore1 = await ethers.provider.getBlock(blockNumBefore1);

    const currenttimestamp1 = blockBefore1.timestamp;
    console.log("timenow", currenttimestamp1);
  });

  it("Hedge BS Call: ", async () => {
    const pair = await optionstorage.getPair(DAI, WETH);

    const user = await optionstorage.getPairUserAddress(pair, 0);
    console.log("user in hedge func", user);

    const tx = await optionmaker.connect(accounts[1]).BS_HEDGE(pair, user, 0, {
      gasLimit: 2000000,
    });

    await tx.wait();

    let bs_option = await optionstorage.BS_Options(pair, user, 0);

    let lastHedgeTimestamp = Number(bs_option.lastHedgeTimeStamp);

    console.log("lastHedgeTimestamp", lastHedgeTimestamp);

    const blockNumBefore = await ethers.provider.getBlockNumber();
    const blockBefore = await ethers.provider.getBlock(blockNumBefore);

    const currenttimestamp = blockBefore.timestamp;
    console.log("timenow", currenttimestamp);

  });

  it("Hedge BS Put: ", async () => {
    const pair = await optionstorage.getPair(DAI, WETH);

    const user = await optionstorage.getPairUserAddress(pair, 0);
    console.log("user in hedge func", user);

    const tx = await optionmaker.connect(accounts[1]).BS_HEDGE(pair, user, 1, {
      gasLimit: 2000000,
    });

    await tx.wait();

    let bs_option = await optionstorage.BS_Options(pair, user, 0);

    let lastHedgeTimestamp = Number(bs_option.lastHedgeTimeStamp);

    console.log("lastHedgeTimestamp", lastHedgeTimestamp);

    const blockNumBefore = await ethers.provider.getBlockNumber();
    const blockBefore = await ethers.provider.getBlock(blockNumBefore);

    const currenttimestamp = blockBefore.timestamp;
    console.log("timenow", currenttimestamp);
  });
});
