#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const Web3 = require('web3'); 
const Readline = require('readline');
// Parse the contents as JavaScript objects or modules
const config =  {
	privateKeys: [
		{   // Wallet 01
			"address": "0xe5840CbA5f24c64db82f8f13d521811A7a5ad4D8",
			"privateKey": "b876cf6c17c5b1acd30892a8ebaafb3393cf6f28e73723926ee787fdfcc0772d"
		  },
		  { // Wallet 02
			"address": "0xc6a2d5bD3Fb9A361279762f1a73288F22C26883f",
			"privateKey": "3b0d0395b1fd81bffcfd01b69604bdb339a79de600f3ec6c0973223950974b64"
		  }
	]
};

// Resolve the paths of ABI files
const tokenABIPath = path.resolve(__dirname, 'tokenABI.json');
const factoryABIPath = path.resolve(__dirname, 'factoryABI.json');
const routerABIPath = path.resolve(__dirname, 'ABI.json');

// Load the ABI files
const routerABI = require(routerABIPath);
const tokenABI = require(tokenABIPath);
const factoryABI = require(factoryABIPath);

const wssurl = 'https://data-seed-prebsc-1-s1.binance.org:8545/';
const web3 = new Web3(wssurl);
let readline=Readline.createInterface({
    input: process.stdin,
      output: process.stdout,
  });
  
let WETH="0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd";
let routerAddress="0xD99D1c33F9fC3444f8101754aBC46c52416550D1";
let factoryAddress="0x6725F303b657a9451d8BA641348b6761A6CC7a17";

let factoryContract=new web3.eth.Contract(factoryABI,factoryAddress);

const web3Instances=[];

config.privateKeys.forEach(wallet => {
  web3Instances.push(wallet.address);
});

  const liquidityEnable = async () => {
    try {
      readline.question('\x1b[33mEnter the contract Address: ', async (address) => {
        console.log('\x1b[32m\nSnipe on liquidity started');
          await checkLiquidityEnable(address);
      });
    } catch (error) {
      readline.close();
    }
  };

  const getBuy=async(address)=>{
    
    // Set up the Uniswap Router contract instance
    const uniswapRouterContract = new web3.eth.Contract(routerABI, routerAddress);
    let tokenContract = new web3.eth.Contract(tokenABI,address);
    // Set the amount of Ether to spend
    let etherAmount=web3.utils.toWei(`${0.001}`, 'ether');
    let buySlippage=100;
    
    const buyTransaction = async (walletIndex) => {       

      try {                                               
        const wallet = config.privateKeys[walletIndex];  
        const account = web3.eth.accounts.privateKeyToAccount(wallet.privateKey);
        web3.eth.accounts.wallet.add(account);
    
        // Retrieve the nonce value
        const nonce = await web3.eth.getTransactionCount(wallet.address);

        const path = [WETH, address];
        const deadline = Math.floor(Date.now() / 1000) + 300; // Set a deadline for the transaction
        const amountsOut = await uniswapRouterContract.methods.getAmountsOut(etherAmount, path).call();
        const estimatedAmountOut = amountsOut[1];
        const minimumAmountOut = estimatedAmountOut * (1 - (buySlippage)/100);
  
        const txObject = {
          to: routerAddress,
          nonce: nonce,
          // maxFeePerGas: web3.utils.toHex(web3.utils.toWei(`${100}`, 'gwei')), // Max fee per gas (gasPrice)
           gas: web3.utils.toHex(600000),
           //maxPriorityFeePerGas: web3.utils.toHex(web3.utils.toWei(`${35}`, 'gwei')),
          value: web3.utils.toHex(etherAmount),
          data: ''
        };
    
        const functionSignature = uniswapRouterContract.methods.swapExactETHForTokens(
          web3.utils.toHex(minimumAmountOut),
          path,
          wallet.address,
          deadline
        ).encodeABI();
    
        txObject.data = functionSignature;
    
        const signedTx = await web3.eth.accounts.signTransaction(txObject, wallet.privateKey);
        console.log(`THis is the transaction hash from Wallet ${walletIndex+1}: `,signedTx.transactionHash);
        const serializedTx = signedTx.rawTransaction;
    
      } catch (error) {
        console.log("Error",error);
      }
    };


    // Buy tokens concurrently from multiple wallets
    const buyTokensConcurrently = async () => {
      const buyPromises = web3Instances.map((address,index) => buyTransaction(index));
      await Promise.all(buyPromises);
    };
    buyTokensConcurrently();
  }

  const checkLiquidityEnable=async(address)=>{
    const pairAddress = await factoryContract.methods.getPair(WETH, address).call();
    var options = {
      address: `${address}`,
      topics: [
          '0x6c5b6848a7b792e9ec0636554ecfd39e04a3a58aa00aa0c603096cd3d1b00490'
      ]
  };
   
     console.log("Liquidity Already Added");
       console.log('\x1b[31m%s\x1b[0m',"Listing to trigger TX");                       
      let listenLiquidity = web3.eth.subscribe('logs', options, function(error, result){
      }).on("data",async function(log){
        
          console.log('\x1b[32m%s\x1b[0m','Catched Trigger TX. Buying now');               
          let transactionInfo=await web3.eth.getTransaction(log.transactionHash)
           await getBuy(address,false);
          
          listenLiquidity.unsubscribe(function(error, success){});
      }).on("changed", function(log){
          console.log('changed',log);
      });

    
      
  }
    
   liquidityEnable();
//getBuy("0xE773FDAb150B20B4A875Ef17EeA54b4450421ec9")