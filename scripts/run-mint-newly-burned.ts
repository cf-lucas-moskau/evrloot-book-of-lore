import { getDeployedContracts } from './utils';
import dump from '../migration/dump.json';
import minted_test from '../migration/minted_test.json';
import minted_prod from '../migration/minted_prod.json';
import { network } from 'hardhat';
import { randomInt } from 'crypto';
import { batchMintBooks, mintPages } from './deploy-methods';
import * as C from './constants';

const BOOKS_WITH_PURPLE_RIBBON = [9, 13, 19, 30, 42, 47, 50, 65];
const BOOKS_WITH_RED_RIBBON = [1, 2, 5, 7, 8, 18, 20, 22, 29, 31, 36, 43, 54, 58, 60, 63, 64];
const BOOKS_WITH_BLUE_RIBBON = [
  3, 6, 10, 12, 14, 15, 16, 26, 27, 28, 32, 34, 38, 39, 40, 44, 45, 48, 49, 51, 52, 53, 55, 56, 61,
  62,
];
const BOOKS_WITH_GREEN_RIBBON = [4, 11, 17, 21, 23, 24, 25, 33, 35, 37, 41, 46, 57, 59, 66];

interface MintedData {
  books: Record<string, MintedBook>;
  pages: Record<string, MintedPage>;
}

interface MintedBook {
  ksmId: string;
  bookId: number;
  to: string;
  minted_on: string;
  ribbon: number;
  rune1: number;
  rune2: number;
  rune3: number;
  tree: number;
  pages: NestedPage[];
}

interface NestedPage {
  ksmId: string;
  number: number;
  id: number;
}

interface MintedPage {
  ksmId: string;
  to: string;
  minted_on: string;
  bookId: number | null; // Only for nested pages
  pageId: number;
  pageNumber: number;
}

async function main() {
  const { book, page } = await getDeployedContracts();
  let mintedUpdated: MintedData;
  if (network.name === 'moonbaseAlpha') {
    mintedUpdated = minted_test;
    console.log('Using test data');
  } else if (network.name === 'moonbeam') {
    mintedUpdated = minted_prod;
    console.log('Using prod data');
  } else {
    throw new Error(`Unsupported network: ${network.name}`);
  }

  const { books: booksToMint, pages: pagesToMint } = getNewlyBurned(mintedUpdated);

  console.log('Minting newly burned books and pages');

  await batchMintBooks(
    book,
    booksToMint.map((b) => {
      return {
        bookId: BigInt(b.bookId),
        to: b.to,
        ribbon: b.ribbon,
        rune1: b.rune1,
        rune2: b.rune2,
        rune3: b.rune3,
        tree: b.tree,
        pages: b.pages.map((p) => {
          return { id: p.id, number: p.number };
        }),
      };
    }),
  );
  await mintPages(
    page,
    pagesToMint.map((p) => p.to),
    pagesToMint.map((p) => {
      return { id: p.pageId, number: p.pageNumber };
    }),
  );

  for (const book of booksToMint) {
    mintedUpdated.books[book.ksmId] = book;
    for (const page of book.pages) {
      mintedUpdated.pages[page.ksmId] = {
        ksmId: page.ksmId,
        pageId: page.id,
        pageNumber: page.number,
        bookId: book.bookId,
        to: book.to,
        minted_on: book.minted_on,
      };
    }
  }

  for (const page of pagesToMint) {
    mintedUpdated.pages[page.ksmId] = page;
  }

  // Store updated minted data
  console.log('Storing updated minted data');
  const fs = require('fs');
  const dest_file =
    network.name === 'moonbaseAlpha' ? 'migration/minted_test.json' : 'migration/minted_prod.json';
  fs.writeFileSync(dest_file, JSON.stringify(mintedUpdated, null, 2));
}

function getNewlyBurned(minted: MintedData): { books: MintedBook[]; pages: MintedPage[] } {
  const books: MintedBook[] = [];
  const pages: MintedPage[] = [];
  for (const data of dump.data.nfts) {
    const ksmId = data.id;
    const burnMemo = data.burned;
    const name = data.metadata_name;
    let nestMintedPages: string[] = [];

    if (!isValidBurnMemo(burnMemo)) {
      continue;
    }

    const isBook = name === 'Book of Lore';
    if (isBook) {
      const bookId = parseInt(ksmId.slice(-2));

      // Skip if book Id in minted data
      if (minted.books[ksmId]) {
        console.log(`Skipping already minted book: ${ksmId}`);
        continue;
      }

      const minted_on = new Date().toISOString();
      const ribbon = getRibbon(bookId);
      const [rune1, rune2, rune3, tree] = getRunesAndTree();

      const bookPages: NestedPage[] = [];
      for (const child of data.children) {
        const pageKsmId = child.id;
        if (
          child.collectionId !== '54bbe132daf82f486f-EVERLORE' ||
          !child.metadata_name.startsWith('Strange Page')
        ) {
          console.log(`Skipping non-page child: ${pageKsmId}`);
          continue;
        }
        const pageId = parseInt(pageKsmId.slice(-2));
        const pageNumber = parseInt(child.metadata_name.slice(14));
        bookPages.push({ ksmId: pageKsmId, id: pageId, number: pageNumber });
        nestMintedPages.push(pageKsmId);
      }

      books.push({
        ksmId,
        bookId,
        to: burnMemo,
        minted_on,
        ribbon,
        rune1,
        rune2,
        rune3,
        tree,
        pages: bookPages,
      });
    } else {
      if (!data.metadata_name.startsWith('Strange Page')) {
        console.log(`Skipping non-page item: ${ksmId}`);
        continue;
      }

      // Skip if page Id in minted data
      if (minted.pages[ksmId]) {
        // console.log(`Skipping already minted page: ${ksmId}`);
        continue;
      }

      // Skip if page is nested in a book
      if (nestMintedPages.includes(ksmId)) {
        // console.log(`Skipping page nested in book: ${ksmId}`);
        continue;
      }

      const pageId = parseInt(ksmId.slice(-2));
      const pageNumber = parseInt(data.metadata_name.slice(14));
      pages.push({
        ksmId,
        to: burnMemo,
        minted_on: new Date().toISOString(),
        bookId: null,
        pageId,
        pageNumber,
      });
    }
  }

  return { books, pages };
}

function getRibbon(bookId: number): number {
  if (BOOKS_WITH_PURPLE_RIBBON.includes(bookId)) {
    return Number(C.FIXED_PART_RIBBON_PURPLE_PART_ID);
  } else if (BOOKS_WITH_RED_RIBBON.includes(bookId)) {
    return Number(C.FIXED_PART_RIBBON_RED_PART_ID);
  } else if (BOOKS_WITH_BLUE_RIBBON.includes(bookId)) {
    return Number(C.FIXED_PART_RIBBON_BLUE_PART_ID);
  } else if (BOOKS_WITH_GREEN_RIBBON.includes(bookId)) {
    return Number(C.FIXED_PART_RIBBON_GREEN_PART_ID);
  } else {
    throw new Error(`Ribbon not found for book id: ${bookId}`);
  }
}

function getRunesAndTree(): [number, number, number, number] {
  const rune1 = randomInt(
    Number(C.FIXED_PART_RUNE_1A_PART_ID),
    Number(C.FIXED_PART_RUNE_1C_PART_ID) + 3,
  );
  const rune2 = randomInt(
    Number(C.FIXED_PART_RUNE_2A_PART_ID),
    Number(C.FIXED_PART_RUNE_2C_PART_ID) + 3,
  );
  const rune3 = randomInt(
    Number(C.FIXED_PART_RUNE_3A_PART_ID),
    Number(C.FIXED_PART_RUNE_3C_PART_ID) + 3,
  );
  const tree = randomInt(
    Number(C.FIXED_PART_TREE_BLUE_PART_ID),
    Number(C.FIXED_PART_TREE_DARK_PART_ID) + 3,
  );

  return [rune1, rune2, rune3, tree];
}

function isValidBurnMemo(burnMemo: string): boolean {
  return burnMemo.startsWith('0x') && burnMemo.length === 42;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
