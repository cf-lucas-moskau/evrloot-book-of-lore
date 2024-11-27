import { ethers, network } from 'hardhat';
import { BookOfLore, StrangePage } from '../typechain-types';

export async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function isHardhatNetwork(): boolean {
  return ['hardhat', 'localhost'].includes(network.name);
}

const BOOK_OF_LORE_MOONBASE_ADDRESS = '0x91dAb3B4c780DcCF200aAC7d6FbD698b5A268e63';
const STRANGE_PAGE_MOONBASE_ADDRESS = '0xE94863aa41e6BaD3aceb2Cd57F1672f7Aa30F9be';
const BOOK_OF_LORE_MOONBEAM_ADDRESS = '0x0000000000000000000000000000000000000000';
const STRANGE_PAGE_MOONBEAM_ADDRESS = '0x0000000000000000000000000000000000000000';

export async function getDeployedContracts(): Promise<{ book: BookOfLore; page: StrangePage }> {
  if (network.name === 'moonbaseAlpha') {
    const book = await ethers.getContractAt('BookOfLore', BOOK_OF_LORE_MOONBASE_ADDRESS);
    const page = await ethers.getContractAt('StrangePage', STRANGE_PAGE_MOONBASE_ADDRESS);
    return { book, page };
  } else if (network.name === 'moonbeam') {
    const book = await ethers.getContractAt('BookOfLore', BOOK_OF_LORE_MOONBEAM_ADDRESS);
    const page = await ethers.getContractAt('StrangePage', STRANGE_PAGE_MOONBEAM_ADDRESS);
    return { book, page };
  }

  throw new Error(`Unsupported network: ${network.name}`);
}
