// const { sluDependencies } = require("mathjs");
var Addresses = require("./addresses.js");

async function main() {
  const RPC = 'https://rpc.ankr.com/polygon_mumbai';
  const provider = new ethers.providers.JsonRpcProvider(RPC);
  const signer = new ethers.Wallet(process.env.PRIVATE_KEY_1, provider);

  console.log("deployer: ", signer.address);

  let currentAddresses = Addresses.LoadAddresses();

  // ADDRESSES OF ERC20 TOKENS
  const DAI = currentAddresses.sDAI;
  const WETH = currentAddresses.sWETH;

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



  // ######## @dev deploying statistics library ###########
  const Statistics = await ethers.getContractFactory("Statistics");
  Statslib = await Statistics.deploy();
  await Statslib.deployed();

  currentAddresses.Statslib = Statslib.address;
  Addresses.UpdateAddresses(currentAddresses);

  // ######## @dev deploying HedgeMath library ###########
  const HedgeMath = await ethers.getContractFactory("HedgeMath");
  HedgeMathlib = await HedgeMath.deploy();
  await HedgeMathlib.deployed();

  currentAddresses.HedgeMathlib = HedgeMathlib.address;
  Addresses.UpdateAddresses(currentAddresses);

  // ######## @dev deploying Black Scholes library ###########
  const BS = await ethers.getContractFactory("BS", {
    signer: signer,
    libraries: {
      Statistics: Statslib.address,
    },
  });
  BSlib = await BS.deploy();
  await BSlib.deployed();

  currentAddresses.BSlib = BSlib.address;
  Addresses.UpdateAddresses(currentAddresses);





  // ######## @dev deploying OptionStorage contract ###########
  const OptionStorage = await ethers.getContractFactory("OptionStorage", {
    signer: signer,
  });
  optionstorage = await OptionStorage.deploy();
  await optionstorage.deployed();
  console.log("storage address:", optionstorage.address);

  currentAddresses.optionstorage = optionstorage.address;
  Addresses.UpdateAddresses(currentAddresses);

  // ######## @dev deploying BSOptionMaker contract ###########
  const BSOptionMaker = await ethers.getContractFactory("BSMOptionMaker", {
    signer: signer,
    libraries: {
      BS: BSlib.address,
      HedgeMath: HedgeMathlib.address,
    },
  });
  bsoptionmaker = await BSOptionMaker.deploy(DAI);
  await bsoptionmaker.deployed();

  console.log("periphery:", bsoptionmaker.address);

  currentAddresses.bsoptionmaker = bsoptionmaker.address;
  Addresses.UpdateAddresses(currentAddresses);


  // ######## @dev deploying OptionMaker contract ###########
  const OptionMaker = await ethers.getContractFactory("OptionMaker", {
    signer: signer,
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

  currentAddresses.optionmaker = optionmaker.address;
  Addresses.UpdateAddresses(currentAddresses);



  // ######## @dev setting addresses ###########
  // sleep(20000);
  console.log("woke up 1");

  let tx = await optionstorage.connect(signer).setCoreAddr(optionmaker.address);
  await tx.wait();

  // sleep(20000);
  console.log("woke up 2");

  let tx1 = await optionstorage.connect(signer).setPeripheryAddr(bsoptionmaker.address);
  await tx1.wait();

  // sleep(20000);
  console.log("woke up 3");

  let tx2 = await optionstorage.connect(signer).initializeAvailablePair(WETH, DAI);
  await tx2.wait();

  // sleep(20000);
  console.log("woke up 4");

  // ######## @dev setting addresses ###########
  let tx3 = await bsoptionmaker.connect(signer).setStorageAddr(optionstorage.address);
  await tx3.wait();

  // sleep(20000);
  console.log("woke up 5");

  let storageAddr = await bsoptionmaker.connect(signer).getStorageAddr();
  console.log("storage addr: ", storageAddr);

  let tx4 = await bsoptionmaker.connect(signer).setCoreAddr(optionmaker.address);
  await tx4.wait();

  // sleep(20000);
  console.log("woke up 6");

  let coreAddr = await bsoptionmaker.connect(signer).getCoreAddr();
  console.log("core addr: ", coreAddr);
}

function sleep(milliseconds) {
  const date = Date.now();
  let currentDate = null;
  do {
    currentDate = Date.now();
  } while (currentDate - date < milliseconds);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
