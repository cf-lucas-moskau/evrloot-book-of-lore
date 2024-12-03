# Instructions

1. Install packages with `yarn`, `npm i`, `pnpm i` or your favorite package manager. This example uses `pnpm`.
2. Test contracts compile: `pnpm hardhat compile`
3. Check contract size: `pnpm hardhat size-contracts`
4. Run tests: `pnpm test`
5. Run prettier: `pnpm prettier`
6. Copy `.env.example` into `.env` and set your variables.
7. Use `contracts/`, `tests/` and `scripts/` to build your code.

## Deploying
1. Make sure `MOONSCAN_APIKEY` and `PRIVATE_KEY` are set in `.env`.
2. Run the deploy script specifying the network, either `moonbaseAlpha` or `moonbeam`:
`pnpm hardhat run scripts/run-deploy.ts --network moonbaseAlpha`

## Migrating

1. Update the dump file using the query under `migration/query.txt`. Run it at [Hasura](https://cloud.hasura.io/public/graphiql?endpoint=https%3A%2F%2Fgql.rmrk.link%2Fv1%2Fgraphql) and copy the result into `migration/dump.json`. Use this endpoint only for EVRLOOT related queries.
2. Run script: `pnpm hardhat run scripts/run-mint-newly-burned.ts --network moonbaseAlpha`
3. Commit changes under migration directory.
