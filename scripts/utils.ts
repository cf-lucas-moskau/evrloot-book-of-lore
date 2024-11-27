import { ethers, network } from 'hardhat';
import { BookOfLore, StrangePage } from '../typechain-types';

export async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function isHardhatNetwork(): boolean {
  return ['hardhat', 'localhost'].includes(network.name);
}

const BOOK_OF_LORE_MOONBASE_ADDRESS = '0xAf848D02cfCe1CA7B359A74dab71B03273b9C083';
const STRANGE_PAGE_MOONBASE_ADDRESS = '0xadaD14C6DAb2E2CDE7525df989E2Bf368ddFf477';
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
