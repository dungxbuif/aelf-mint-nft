const TOKEN_COTRACT_NAME = 'AElf.ContractNames.Token'
const NODE_ENV = process.env.NODE_ENV;
const PORT = process.env.PORT;
const NODE_URL = process.env.NODE_URL;
const PRIVATE_KEY = process.env.PRIVATE_KEY;

const AElf = require('aelf-sdk');
const aelf = new AElf(new AElf.providers.HttpProvider(NODE_URL));
const wallet = AElf.wallet.getWalletByPrivateKey(PRIVATE_KEY);

const express = require('express');
const app = express();


const AelfConfig = {
   chainStatus: null,
   genesisContractAddress: null,
   zeroContract: null,
};

async function initConfig() {
   AelfConfig.chainStatus = await aelf.chain.getChainStatus();
   const chainStatus = AelfConfig.chainStatus;
   AelfConfig.genesisContractAddress = chainStatus.GenesisContractAddress;
   AelfConfig.zeroContract = await aelf.chain.contractAt(
      chainStatus.GenesisContractAddress,
      wallet
   );
   const zeroContract = AelfConfig.zeroContract;
   AelfConfig.tokenContractAddress = await zeroContract.GetContractAddressByName.call(
      AElf.utils.sha256(TOKEN_COTRACT_NAME)
   );
   const tokenContractAddress = AelfConfig.tokenContractAddress;
   AelfConfig.tokenContract = await aelf.chain.contractAt(
      tokenContractAddress,
      wallet
   );
}

const exploreLink = (transactionId) => {
   if (NODE_ENV === 'producion') {
      return `https://explorer.aelf.io/tx/${transactionId}#logs`;
   }

   return `https://explorer-test.aelf.io/tx/${transactionId}#logs`;
}

const runWithTrx = async (fn, des) => {
   try {
      const { TransactionId } = await fn;
      const result = await aelf.chain.getTxResult(TransactionId);
      const link = exploreLink(TransactionId);
      console.log(`${des} Explore:`, link);
      console.log(`${des} Result`, result);
      return result;
   } catch (error) {
      console.log(`${des} Error:`, error);
   }
};

async function createNftCollection(payload) {
   const collectionSymbol = payload.symbol;
   let collectionInfo = await AelfConfig.tokenContract.GetTokenInfo.call({
      symbol: collectionSymbol,
   });
   if (collectionInfo) {
      throw new Error('Collection already exists');
   }
   await runWithTrx(
      AelfConfig.tokenContract.Create(payload),
      `Create Collection ${collectionSymbol}`
   );
}

async function mintNft(payload, receiverAddress) {
   const symbol = payload.symbol;
   let nftInfo = await AelfConfig.tokenContract.GetTokenInfo.call({
      symbol,
   });
   if (nftInfo) {
      throw new Error('NFT existed');
   }
   await runWithTrx(
      AelfConfig.tokenContract.Create(payload),
      `Mint NFT  ${symbol}`
   );
   const memo = `Issue NFT ${symbol}`;
   await new Promise(resolve => setTimeout(resolve, 4000));
   return runWithTrx(
      AelfConfig.tokenContract.Issue({
         symbol: symbol,
         amount: 1,
         to: receiverAddress,
         memo,
      }),
      memo
   );
}
app.use(express.json());
app.post('/catalogues/release', async (req, res) => {
   try {
      const result = await createNftCollection(req.body);
      res.json(result);
   } catch (error) {
      console.error('Error:', error);
      res.status(500).send(error.message);
   }
});
app.post('/catalogues/mint', async (req, res) => {
   try {
      const { payload, receiverAddress } = req.body;
      const result = await mintNft(payload, receiverAddress);
      res.json(result);
   } catch (error) {
      console.error('Error:', error);
      res.status(500).send(error.message);
   }
});
app.use((req, res) => {
   res.status(404).json({ message: 'Not Found' });
});




(async () => {
   try {
      await initConfig();
   } catch (error) {
      console.error('Init Config Error:', error);
      process.exit(1);
   }

   app.listen(parseInt(PORT || 3000, 10), () => {
      console.log('Server is running on http://localhost:3000');
   });
})();

process.on('uncaughtException', (err) => {
   console.error('uncaughtException:', err);
})

process.on('unhandledRejection', (reason, promise) => {
   console.error('unhandledRejection:', reason, promise);
})