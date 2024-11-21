// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.21;

interface IStrangePage {
    struct Page {
        uint8 pageNumber;
        uint8 pageId;
    }

    function nestMintPages(
        uint256 tokenId,
        Page[] memory pages
    ) external returns (uint256 firstId);
}
