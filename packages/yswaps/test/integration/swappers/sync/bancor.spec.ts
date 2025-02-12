import { expect } from 'chai';
import { BigNumber, utils, Wallet } from 'ethers';
import { ethers } from 'hardhat';
import { evm, wallet } from '@test-utils';
import { then, when } from '@test-utils/bdd';
import { getNodeUrl } from '@utils/network';
import { IERC20, TradeFactory } from '@typechained';
import forkBlockNumber from '@integration/fork-block-numbers';
import * as setup from '../setup';

const MAX_SLIPPAGE = 10_000; // 1%
const AMOUNT_IN = utils.parseEther('1000');

describe('Bancor', function () {
  let strategy: Wallet;
  let tradeFactory: TradeFactory;

  let MPH: IERC20;
  let DAI: IERC20;

  let snapshotId: string;

  when('on mainnet', () => {
    const FORK_BLOCK_NUMBER = forkBlockNumber['mainnet-swappers'];

    const CHAIN_ID = 1;

    const MPH_ADDRESS = '0x8888801af4d980682e47f1a9036e589479e835c5';
    const DAI_ADDRESS = '0x6b175474e89094c44da98b954eedeac495271d0f';

    const MPH_WHALE_ADDRESS = '0x1702f18c1173b791900f81ebae59b908da8f689b';

    before(async () => {
      strategy = await wallet.generateRandom();

      await evm.reset({
        jsonRpcUrl: getNodeUrl('mainnet'),
        blockNumber: FORK_BLOCK_NUMBER,
      });

      ({
        fromToken: MPH,
        toToken: DAI,
        tradeFactory,
      } = await setup.sync({
        chainId: CHAIN_ID,
        fixture: ['Common', 'Mainnet', 'Bancor'],
        swapper: 'SyncBancor',
        fromTokenAddress: MPH_ADDRESS,
        toTokenAddress: DAI_ADDRESS,
        fromTokenWhaleAddress: MPH_WHALE_ADDRESS,
        strategy,
      }));

      snapshotId = await evm.snapshot.take();
    });

    beforeEach(async () => {
      await evm.snapshot.revert(snapshotId);
    });

    describe('swap', () => {
      const data = ethers.utils.defaultAbiCoder.encode([], []);
      let preSwapBalance: BigNumber;
      beforeEach(async () => {
        preSwapBalance = await MPH.balanceOf(strategy.address);
        await tradeFactory.connect(strategy)['execute((address,address,uint256,uint256),bytes)'](
          {
            _tokenIn: MPH_ADDRESS,
            _tokenOut: DAI_ADDRESS,
            _amountIn: AMOUNT_IN,
            _maxSlippage: MAX_SLIPPAGE,
          },
          data
        );
      });

      then('MPH gets taken from strategy', async () => {
        expect(await MPH.balanceOf(strategy.address)).to.equal(preSwapBalance.sub(AMOUNT_IN));
      });
      then('DAI gets airdropped to strategy', async () => {
        expect(await DAI.balanceOf(strategy.address)).to.be.gt(0);
      });
    });
  });
});
