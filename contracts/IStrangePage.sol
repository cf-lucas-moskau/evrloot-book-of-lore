// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.21;

interface IStrangePage {
    struct Page {
        uint8 number;
        uint8 id;
    }

    function nestMintPages(
        uint256 bookId,
        Page[] memory pages
    ) external returns (uint256 firstId);
}
